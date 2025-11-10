/**
 * Batch Processor
 * Runs OCR processing in chunks using the OCR provider + helper services.
 */

const { ITEM_STATUS } = require('./batch-manager');
const { shouldSkipImage } = require('./skip-detector');
const { saveOCRResults } = require('./result-saver');
const { OCRProvider } = require('./ocr-provider');

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
        if (chunk.length === 0) {
          if (currentJob.controls.paused) {
            await new Promise((resolve) => setTimeout(resolve, 500));
            continue;
          }
          break;
        }

        await this.processChunk(jobId, chunk);
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
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

      this.batchManager.updateItemStatus(jobId, item.id, ITEM_STATUS.PROCESSING);

      const skip = await shouldSkipImage(item.path, options);
      if (skip) {
        this.batchManager.updateItemStatus(jobId, item.id, ITEM_STATUS.SKIPPED, {
          result: { skipped: true, reason: 'Already processed' }
        });
        return;
      }

      const ocrResult = await provider.processImage(item.path, options);

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

      const saveResult = await saveOCRResults(item.path, ocrResult.data, options);

      this.batchManager.updateItemStatus(jobId, item.id, ITEM_STATUS.COMPLETED, {
        result: ocrResult.data,
        savedFiles: saveResult.files
      });
    } catch (error) {
      this.batchManager.updateItemStatus(jobId, item.id, ITEM_STATUS.FAILED, {
        error: error.message
      });

      const allowedRetries = options?.retryCount ?? 0;
      const currentRetries = typeof item.retries === 'number' ? item.retries : 0;
      const nextRetries = currentRetries + 1;
      if (nextRetries <= allowedRetries) {
        this.batchManager.updateItemStatus(jobId, item.id, ITEM_STATUS.PENDING, {
          retries: nextRetries
        });
      }
    }
  }

  _requeueItems(jobId, items) {
    if (!items || items.length === 0) return;
    items.forEach((item) => {
      this.batchManager.updateItemStatus(jobId, item.id, ITEM_STATUS.PENDING, {
        retries: item.retries ?? 0
      });
    });
  }
}

module.exports = {
  BatchProcessor
};
