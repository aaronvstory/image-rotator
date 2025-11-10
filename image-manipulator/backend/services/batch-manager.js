/**
 * Batch Manager
 * Keeps in-memory state for each batch job (queue, stats, controls).
 */

const EventEmitter = require('events');
const { randomUUID: uuidv4 } = require('node:crypto');

const ITEM_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  SKIPPED: 'skipped'
};

const JOB_STATUS = {
  QUEUED: 'queued',
  PROCESSING: 'processing',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  COMPLETED_WITH_ERRORS: 'completed_with_errors',
  CANCELLED: 'cancelled'
};

const DEFAULT_OPTIONS = {
  chunkSize: 50,
  retryCount: 2,
  overwrite: 'skip',
  outputFormat: ['json', 'txt']
};

class BatchManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.maxQueueSize = options.maxQueueSize || 1000;
    this.defaultOptions = { ...DEFAULT_OPTIONS, ...(options.defaultOptions || {}) };
    this.jobs = new Map();
    this.cleanupTimers = new Map();
    this.jobTtlMs = typeof options.jobTtlMs === 'number' ? options.jobTtlMs : 60 * 60 * 1000;
  }

  createJob(items, options = {}) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('Cannot create job with empty items array');
    }
    if (items.some((item) => !item || typeof item.path !== 'string' || !item.path.trim())) {
      throw new Error('All items must have a valid path property');
    }
    if (items.length > this.maxQueueSize) {
      throw new Error(`Batch size ${items.length} exceeds maximum ${this.maxQueueSize}`);
    }

    // Always generate server-side job IDs; ignore any caller-supplied value
    const jobId = `batch_${Date.now()}_${uuidv4().slice(0, 8)}`;
    const now = new Date().toISOString();
    const mergedOptions = { ...this.defaultOptions, ...options };

    // Security/robustness: enforce sane chunkSize server-side to avoid hangs or DoS
    const configuredChunkSize = Number(mergedOptions.chunkSize);
    if (!Number.isFinite(configuredChunkSize) || configuredChunkSize <= 0) {
      mergedOptions.chunkSize = this.defaultOptions.chunkSize;
    } else {
      const maxChunkSize = 500; // upper bound to avoid enormous bursts
      mergedOptions.chunkSize = Math.max(1, Math.min(configuredChunkSize, maxChunkSize));
    }

    const queueItems = items.map((item, index) => ({
      id: item.id || `${jobId}_item_${index}`,
      path: item.path,
      filename: item.filename || this._getFilename(item.path),
      status: ITEM_STATUS.PENDING,
      retries: 0,
      error: null,
      result: null,
      savedFiles: null,
      startedAt: null,
      completedAt: null
    }));

    const job = {
      id: jobId,
      status: JOB_STATUS.QUEUED,
      options: mergedOptions,
      controls: {
        paused: false,
        cancelRequested: false,
        chunkSize: mergedOptions.chunkSize
      },
      stats: {
        total: queueItems.length,
        pending: queueItems.length,
        processing: 0,
        completed: 0,
        failed: 0,
        skipped: 0
      },
      queue: queueItems,
      createdAt: now,
      startedAt: null,
      completedAt: null
    };

    this.jobs.set(jobId, job);
    this.emit('jobCreated', { jobId, totalItems: queueItems.length, options: mergedOptions });
    return jobId;
  }

  getJob(jobId) {
    return this.jobs.get(jobId) || null;
  }

  getAllJobs() {
    return Array.from(this.jobs.values()).map((job) => ({
      id: job.id,
      status: job.status,
      stats: job.stats,
      createdAt: job.createdAt
    }));
  }

  deleteJob(jobId) {
    this._clearCleanupTimer(jobId);
    this.jobs.delete(jobId);
    this.emit('jobDeleted', { jobId });
  }

  startJob(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) return;
    this._clearCleanupTimer(jobId);
    job.status = JOB_STATUS.PROCESSING;
    job.startedAt = new Date().toISOString();
    this.emit('jobStarted', { jobId });
  }

  getNextChunk(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) return [];
    if (job.controls.cancelRequested || job.status === JOB_STATUS.CANCELLED) {
      return [];
    }
    if (job.controls.paused || job.status === JOB_STATUS.PAUSED) {
      return [];
    }

    const chunk = [];
    for (const item of job.queue) {
      if (item.status === ITEM_STATUS.PENDING) {
        const startedAt = new Date().toISOString();
        item.status = ITEM_STATUS.PROCESSING;
        item.startedAt = startedAt;
        item.completedAt = null;
        chunk.push(item);
        job.stats.pending--;
        job.stats.processing++;
        this.emit('itemStatusChanged', {
          jobId,
          itemId: item.id,
          status: ITEM_STATUS.PROCESSING,
          meta: { startedAt }
        });
      }
      if (chunk.length >= job.controls.chunkSize) break;
    }

    return chunk;
  }

  updateItemStatus(jobId, itemId, newStatus, meta = {}) {
    const job = this.jobs.get(jobId);
    if (!job) return;

    const item = job.queue.find((entry) => entry.id === itemId);
    if (!item) return;

    const metaPayload = meta || {};
    const oldStatus = item.status;
    const applyMeta = () => {
      const hasOwn = Object.prototype.hasOwnProperty;
      if (hasOwn.call(metaPayload, 'error')) item.error = metaPayload.error;
      if (hasOwn.call(metaPayload, 'result')) item.result = metaPayload.result;
      if (hasOwn.call(metaPayload, 'savedFiles')) item.savedFiles = metaPayload.savedFiles;
      if (typeof metaPayload.retries === 'number') item.retries = metaPayload.retries;
      if (hasOwn.call(metaPayload, 'startedAt')) item.startedAt = metaPayload.startedAt;
      if (hasOwn.call(metaPayload, 'completedAt')) item.completedAt = metaPayload.completedAt;
    };

    if (oldStatus === newStatus) {
      applyMeta();
      this.emit('itemStatusChanged', { jobId, itemId, status: newStatus, meta: metaPayload });
      return;
    }

    item.status = newStatus;
    if (newStatus === ITEM_STATUS.PENDING) {
      item.startedAt = null;
      item.completedAt = null;
      if (!metaPayload.preserveError) item.error = null;
      if (!metaPayload.preserveResult) {
        item.result = null;
        item.savedFiles = null;
      }
    } else if (newStatus === ITEM_STATUS.PROCESSING) {
      item.startedAt = metaPayload.startedAt || new Date().toISOString();
      item.completedAt = null;
    }

    if ([ITEM_STATUS.COMPLETED, ITEM_STATUS.FAILED, ITEM_STATUS.SKIPPED].includes(newStatus)) {
      item.completedAt = new Date().toISOString();
    }

    applyMeta();

    this._updateStats(job, oldStatus, newStatus);
    this.emit('itemStatusChanged', { jobId, itemId, status: newStatus, meta: metaPayload });
    this._checkJobCompletion(jobId);
  }

  pauseJob(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) return;
    job.controls.paused = true;
    job.status = JOB_STATUS.PAUSED;
    this.emit('jobPaused', { jobId });
  }

  resumeJob(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) return;
    job.controls.paused = false;
    job.status = JOB_STATUS.PROCESSING;
    this.emit('jobResumed', { jobId });
  }

  cancelJob(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) return;
    if (job.status === JOB_STATUS.CANCELLED) return;

    job.controls.cancelRequested = true;
    job.status = JOB_STATUS.CANCELLED;
    job.completedAt = new Date().toISOString();

    for (const item of job.queue) {
      if ([ITEM_STATUS.COMPLETED, ITEM_STATUS.SKIPPED, ITEM_STATUS.FAILED].includes(item.status)) {
        continue;
      }
      this.updateItemStatus(jobId, item.id, ITEM_STATUS.FAILED, {
        error: 'Cancelled by user'
      });
    }

    this._scheduleCleanup(jobId);
    this.emit('jobCancelled', { jobId });
  }

  _updateStats(job, oldStatus, newStatus) {
    if (oldStatus === ITEM_STATUS.PENDING) job.stats.pending--;
    else if (oldStatus === ITEM_STATUS.PROCESSING) job.stats.processing--;
    else if (oldStatus === ITEM_STATUS.COMPLETED) job.stats.completed--;
    else if (oldStatus === ITEM_STATUS.FAILED) job.stats.failed--;
    else if (oldStatus === ITEM_STATUS.SKIPPED) job.stats.skipped--;

    if (newStatus === ITEM_STATUS.PENDING) job.stats.pending++;
    else if (newStatus === ITEM_STATUS.PROCESSING) job.stats.processing++;
    else if (newStatus === ITEM_STATUS.COMPLETED) job.stats.completed++;
    else if (newStatus === ITEM_STATUS.FAILED) job.stats.failed++;
    else if (newStatus === ITEM_STATUS.SKIPPED) job.stats.skipped++;
  }

  _checkJobCompletion(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) return;
    if (job.status === JOB_STATUS.CANCELLED) return;

    const { pending, processing } = job.stats;
    if (pending === 0 && processing === 0) {
      job.completedAt = new Date().toISOString();
      job.status = job.stats.failed > 0 ? JOB_STATUS.COMPLETED_WITH_ERRORS : JOB_STATUS.COMPLETED;
      this.emit('jobCompleted', { jobId, stats: job.stats, status: job.status });
      this._scheduleCleanup(jobId);
    }
  }

  _getFilename(filePath) {
    if (!filePath) return 'unknown';
    return filePath.split('/').pop().split('\\').pop();
  }

  _scheduleCleanup(jobId) {
    if (!this.jobTtlMs || this.jobTtlMs <= 0) return;
    this._clearCleanupTimer(jobId);
    const timer = setTimeout(() => {
      this.deleteJob(jobId);
    }, this.jobTtlMs);
    if (typeof timer.unref === 'function') timer.unref();
    this.cleanupTimers.set(jobId, timer);
  }

  _clearCleanupTimer(jobId) {
    const timer = this.cleanupTimers.get(jobId);
    if (timer) {
      clearTimeout(timer);
      this.cleanupTimers.delete(jobId);
    }
  }
}

module.exports = {
  BatchManager,
  ITEM_STATUS,
  JOB_STATUS
};
