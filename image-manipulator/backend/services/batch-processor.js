const path = require('path');
const { ITEM_STATUS, JOB_STATUS } = require('./batch-manager');
const { shouldSkipImage } = require('./skip-detector');
const { saveOCRResults } = require('./result-saver');
const { OCRProvider } = require('./ocr-provider');
const { resolveImagePath } = require('../utils/path-utils');


class BatchProcessor {
  constructor(batchManager) {
    this.batchManager = batchManager;
    this.processingJobs = new Map();
    this.ocrProviderFactory = () => new OCRProvider();
  }

  async processJob(jobId) {
    if (this.processingJobs.has(jobId)) {
      throw new Error(`Job ${jobId} is already being processed`);
    }

    const runtime = {
      provider: this.ocrProviderFactory()
    };
    this.processingJobs.set(jobId, runtime);

    try {
      const job = this.batchManager.getJob(jobId);
      if (!job) throw new Error(`Job ${jobId} not found`);

      const provider = runtime.provider;
      await provider.initialize();
      this.batchManager.startJob(jobId);

      while (true) {
        const currentJob = this.batchManager.getJob(jobId);
        if (!currentJob) break;
        if (currentJob.controls.cancelRequested) break;

        if (currentJob.controls.paused) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }

        const chunk = this.batchManager.getNextChunk(jobId);

        if (!chunk || chunk.length === 0) {
          if (currentJob.controls.paused) {
            await new Promise((resolve) => setTimeout(resolve, 500));
            continue;
          }
          break;
        }

        await this.processChunk(jobId, chunk);
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      this._ensureJobCompletion(jobId);
    } finally {
      const storedRuntime = this.processingJobs.get(jobId);
      const provider = storedRuntime?.provider;

      if (provider) {
        try {
          if (typeof provider.shutdown === 'function') {
            await provider.shutdown();
          } else if (typeof provider.dispose === 'function') {
            await provider.dispose();
          }
        } catch (error) {
          console.warn('Error shutting down OCR provider', error);
        }
      }

      this.processingJobs.delete(jobId);
      this._ensureJobCompletion(jobId);
    }
  }

  async processChunk(jobId, chunk) {
    const job = this.batchManager.getJob(jobId);
    if (!job) return;

    for (let index = 0; index < chunk.length; index++) {
      const item = chunk[index];
      const currentJob = this.batchManager.getJob(jobId);
      if (!currentJob || currentJob.controls.cancelRequested) break;
      if (currentJob.controls.paused) {
        this._requeueItems(jobId, chunk.slice(index));
        break;
      }

      try {
        await this.processItem(jobId, item, job.options);
      } catch (error) {
        console.error(`Error processing item ${item.id}:`, error);
      }
    }
  }

  async processItem(jobId, item, options) {
    try {
      const runtime = this.processingJobs.get(jobId);
      const provider = runtime?.provider;
      if (!provider) {
        throw new Error(`OCR provider is not initialized for job: ${jobId}`);
      }

      if (item.status !== ITEM_STATUS.PROCESSING) {
        this.batchManager.updateItemStatus(jobId, item.id, ITEM_STATUS.PROCESSING);
      }

      if (this._isCancellationRequested(jobId)) {
        this._markCancelled(jobId, item.id);
        return;
      }

      const baseDir = options?.imageDir ? path.resolve(String(options.imageDir)) : null;
      if (!baseDir) {
        throw new Error('IMAGE_DIR is required to process OCR items');
      }

      // Resolve and validate path first (security critical)
      const safePath = await resolveImagePath(item.path, baseDir);
      if (!safePath) {
        throw new Error('Refusing to process file outside IMAGE_DIR');
      }

      const runtimeOptions = { ...options, imageDir: baseDir };

      if (this._isCancellationRequested(jobId)) {
        this._markCancelled(jobId, item.id);
        return;
      }

      // Run skip detection on validated path only
      const skip = await shouldSkipImage(safePath, runtimeOptions);
      if (skip) {
        this.batchManager.updateItemStatus(jobId, item.id, ITEM_STATUS.SKIPPED, {
          result: { skipped: true, reason: 'Already processed' }
        });
        return;
      }

      if (this._isCancellationRequested(jobId)) {
        this._markCancelled(jobId, item.id);
        return;
      }
      const ocrResult = await provider.processImage(safePath, runtimeOptions);

      if (this._isCancellationRequested(jobId)) {
        this._markCancelled(jobId, item.id);
        return;
      }

      if (ocrResult.skipped) {
        this.batchManager.updateItemStatus(jobId, item.id, ITEM_STATUS.SKIPPED, {
          result: { skipped: true, message: ocrResult.message },
          message: ocrResult.message || 'Existing results detected'
        });
        return;
      }

      if (!ocrResult.success) {
        throw new Error(ocrResult.error || 'OCR processing failed');
      }

      const saveResult = await saveOCRResults(safePath, ocrResult.data, runtimeOptions);

      if (this._isCancellationRequested(jobId)) {
        this._markCancelled(jobId, item.id);
        return;
      }

      this.batchManager.updateItemStatus(jobId, item.id, ITEM_STATUS.COMPLETED, {
        result: ocrResult.data,
        savedFiles: saveResult.files
      });
    } catch (error) {
      this.batchManager.updateItemStatus(jobId, item.id, ITEM_STATUS.FAILED, {
        error: (error && error.message) ? error.message : String(error)
      });

      const allowedRetries = options?.retryCount ?? 0;
      const currentRetries = typeof item.retries === 'number' ? item.retries : 0;
      const nextRetries = currentRetries + 1;
      const jobState = this.batchManager.getJob(jobId);
      if (jobState && (jobState.controls.cancelRequested || jobState.status === JOB_STATUS.CANCELLED)) {
        return;
      }
      if (nextRetries <= allowedRetries) {
        this.batchManager.updateItemStatus(jobId, item.id, ITEM_STATUS.PENDING, {
          retries: nextRetries
        });
      }
    }
  }

  _isCancellationRequested(jobId) {
    const job = this.batchManager.getJob(jobId);
    if (!job) return true;
    return job.status === JOB_STATUS.CANCELLED || job.controls.cancelRequested;
  }

  _markCancelled(jobId, itemId) {
    this.batchManager.updateItemStatus(jobId, itemId, ITEM_STATUS.SKIPPED, {
      error: 'Cancelled while processing',
      preserveResult: true,
      preserveError: true
    });
  }

  _requeueItems(jobId, items) {
    if (!items || items.length === 0) return;
    items.forEach((item) => {
      this.batchManager.updateItemStatus(jobId, item.id, ITEM_STATUS.PENDING, {
        retries: item.retries ?? 0
      });
    });
  }

  _ensureJobCompletion(jobId) {
    const job = this.batchManager.getJob(jobId);
    if (!job) return;
    if (job.status === JOB_STATUS.CANCELLED) return;

    const doneStatuses = new Set([JOB_STATUS.COMPLETED, JOB_STATUS.COMPLETED_WITH_ERRORS]);
    if (doneStatuses.has(job.status)) {
      if (!job.completedAt) {
        job.completedAt = new Date().toISOString();
      }
      return;
    }

    const stats = job.stats || {};
    const pending = stats.pending || 0;
    const processing = stats.processing || 0;
    if (pending > 0 || processing > 0) {
      return;
    }

    const nextStatus = (stats.failed || 0) > 0
      ? JOB_STATUS.COMPLETED_WITH_ERRORS
      : JOB_STATUS.COMPLETED;

    job.status = nextStatus;
    job.completedAt = new Date().toISOString();
    this.batchManager.emit('jobCompleted', { jobId, stats, status: nextStatus });

    if (typeof this.batchManager._scheduleCleanup === 'function') {
      this.batchManager._scheduleCleanup(jobId);
    }
  }
}

module.exports = {
  BatchProcessor
};






