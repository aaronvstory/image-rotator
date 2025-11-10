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
    this.processingJobs = new Set();
    this.ocrProvider = new OCRProvider();
  }

  async processJob(jobId) {
    if (this.processingJobs.has(jobId)) {
      throw new Error(`Job ${jobId} is already being processed`);
    }

    this.processingJobs.add(jobId);

    try {
      const job = this.batchManager.getJob(jobId);
      if (!job) throw new Error(`Job ${jobId} not found`);

      await this.ocrProvider.initialize();
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
        if (chunk.length === 0) break;

        await this.processChunk(jobId, chunk);
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    } finally {
      this.processingJobs.delete(jobId);
    }
  }

  async processChunk(jobId, chunk) {
    const job = this.batchManager.getJob(jobId);
    if (!job) return;

    for (const item of chunk) {
      const currentJob = this.batchManager.getJob(jobId);
      if (!currentJob || currentJob.controls.cancelRequested) break;

      try {
        await this.processItem(jobId, item, job.options);
      } catch (error) {
        console.error(`Error processing item ${item.id}:`, error);
      }
    }
  }

  async processItem(jobId, item, options) {
    try {
      this.batchManager.updateItemStatus(jobId, item.id, ITEM_STATUS.PROCESSING);

      const skip = await shouldSkipImage(item.path, options);
      if (skip) {
        this.batchManager.updateItemStatus(jobId, item.id, ITEM_STATUS.SKIPPED, {
          result: { skipped: true, reason: 'Already processed' }
        });
        return;
      }

      const ocrResult = await this.ocrProvider.processImage(item.path, options);

      if (ocrResult.skipped) {
        this.batchManager.updateItemStatus(jobId, item.id, ITEM_STATUS.SKIPPED, {
          result: ocrResult.data,
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

      if (item.retries < (options.retryCount || 0)) {
        this.batchManager.updateItemStatus(jobId, item.id, ITEM_STATUS.PENDING, {
          retries: item.retries + 1
        });
      }
    }
  }
}

module.exports = {
  BatchProcessor
};
