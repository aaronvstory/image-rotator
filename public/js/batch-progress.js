/**
 * Batch Progress Client - SSE client for real-time batch progress tracking
 */

class BatchProgress {
  constructor(fetchImpl = window.fetch.bind(window)) {
    this.eventSource = null;
    this.jobId = null;
    this.onUpdate = null;
    this.onComplete = null;
    this.onError = null;
    this._fetch = fetchImpl;
    this._pollTimer = null;
    this._pollIntervalMs = 1500;
    this._maxPollIntervalMs = 10000;
  }

  /**
   * Start listening to batch progress
   * @param {string} jobId
   * @param {Object} callbacks - { onUpdate, onComplete, onError }
   */
  connect(jobId, callbacks = {}) {
    // Close existing connection
    this.disconnect();

    const hasValidId = typeof jobId === 'string' && jobId.trim().length > 0;
    if (!hasValidId) {
      const message = 'BatchProgress: invalid jobId provided to connect()';
      console.error(message, { jobId });
      if (typeof callbacks.onError === 'function') {
        callbacks.onError(message);
      }
      return;
    }

    this.jobId = jobId.trim();
    this.onUpdate = callbacks.onUpdate;
    this.onComplete = callbacks.onComplete;
    this.onError = callbacks.onError;

    // Reset polling cadence each time we connect
    this._pollIntervalMs = 1500;

    const url = `/api/batch/progress/${encodeURIComponent(this.jobId)}?includeItems=true`;
    try {
      this.eventSource = new EventSource(url);

      this.eventSource.addEventListener('job-update', (event) => {
        try {
          const data = JSON.parse(event.data);
          this._handleUpdate(data);
        } catch (error) {
          console.error('Error parsing job update:', error);
          this._safeError(error);
        }
      });

      // Fallback for servers that emit default 'message' events
      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this._handleUpdate(data);
        } catch (error) {
          console.error('Error parsing SSE message:', error);
        }
      };

      this.eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        this._safeError('Connection interrupted. Falling back to polling…');
        this._startPolling();
      };

      this.eventSource.onopen = () => {
        console.log(`Connected to batch progress for job ${jobId}`);
      };
    } catch (error) {
      console.error('Failed to initialize SSE connection:', error);
      this._safeError('Unable to open live progress stream. Using polling instead.');
      this._startPolling();
    }
  }
  disconnect() {
    this.disconnectSSE();
    if (this._pollTimer) {
      clearTimeout(this._pollTimer);
      this._pollTimer = null;
    }
    this.jobId = null;
  }

  disconnectSSE() {
    if (this.eventSource) {
      try {
        this.eventSource.close();
      } catch { }
      this.eventSource = null;
    }
  }

  _startPolling() {
    this.disconnectSSE();
    if (this._pollTimer) {
      clearTimeout(this._pollTimer);
      this._pollTimer = null;
    }
    this._pollIntervalMs = 1500;
    this._pollOnce();
  }

  async _pollOnce() {
    if (!this.jobId) return;
    try {
      const response = await this._fetch(
        `/api/batch/status/${encodeURIComponent(this.jobId)}?includeItems=true`
      );
      if (!response.ok) {
        throw new Error(`Failed to load job status (HTTP ${response.status})`);
      }
      const data = await response.json();
      this._handleUpdate(data);

      const done = data?.status === 'completed' ||
        data?.status === 'completed_with_errors' ||
        data?.status === 'cancelled';
      if (!done) {
        this._pollTimer = setTimeout(() => this._pollOnce(), this._pollIntervalMs);
        this._pollIntervalMs = Math.min(
          Math.floor(this._pollIntervalMs * 1.3),
          this._maxPollIntervalMs
        );
      }
    } catch (error) {
      console.error('Error polling batch status:', error);
      this._safeError(error);
      this._pollTimer = setTimeout(() => this._pollOnce(), this._pollIntervalMs);
      this._pollIntervalMs = Math.min(
        Math.floor(this._pollIntervalMs * 1.5),
        this._maxPollIntervalMs
      );
    }
  }

  _safeError(error) {
    if (!error) return;
    const message = typeof error === 'string' ? error : (error?.message || 'Unexpected error');
    this._notifyError(message);
  }

  /**
   * Handle job update
   * @private
   */
  _handleUpdate(data) {
    if (!data || typeof data !== 'object' || !data.stats) {
      this._notifyError('Missing job statistics in update payload');
      return;
    }

    // Check if job is complete
    const isComplete = data.status === 'completed' ||
      data.status === 'completed_with_errors' ||
      data.status === 'cancelled';

    if (isComplete) {
      this._notifyComplete(data);
      this.disconnect();
    } else {
      this._notifyUpdate(data);
    }
  }

  /**
   * Notify update callback
   * @private
   */
  _notifyUpdate(data) {
    if (this.onUpdate) {
      this.onUpdate(data);
    }
  }

  /**
   * Notify completion callback
   * @private
   */
  _notifyComplete(data) {
    if (this.onComplete) {
      this.onComplete(data);
    }
  }

  /**
   * Notify error callback
   * @private
   */
  _notifyError(message) {
    if (this.onError) {
      this.onError(message);
    }
  }

  /**
   * Pause the current job
   */
  async pause() {
    if (!this.jobId) return;

    try {
      const response = await this._fetch(`/api/batch/pause/${encodeURIComponent(this.jobId)}`, {
        method: 'POST'
      });
      if (!response.ok) {
        let detail = '';
        try {
          detail = await response.text();
        } catch { }
        console.error(`Error pausing job: HTTP ${response.status}`, detail || response.statusText);
        return false;
      }
      const data = await response.json();
      return data.success;
    } catch (error) {
      console.error('Error pausing job:', error);
      return false;
    }
  }

  /**
   * Resume the current job
   */
  async resume() {
    if (!this.jobId) return;

    try {
      const response = await this._fetch(`/api/batch/resume/${encodeURIComponent(this.jobId)}`, {
        method: 'POST'
      });
      if (!response.ok) {
        let detail = '';
        try {
          detail = await response.text();
        } catch { }
        console.error(`Error resuming job: HTTP ${response.status}`, detail || response.statusText);
        return false;
      }
      const data = await response.json();
      return data.success;
    } catch (error) {
      console.error('Error resuming job:', error);
      return false;
    }
  }

  /**
   * Cancel the current job
   */
  async cancel() {
    if (!this.jobId) return;

    try {
      const response = await this._fetch(`/api/batch/cancel/${encodeURIComponent(this.jobId)}`, {
        method: 'POST'
      });
      if (!response.ok) {
        let detail = '';
        try {
          detail = await response.text();
        } catch { }
        console.error(`Error cancelling job: HTTP ${response.status}`, detail || response.statusText);
        return false;
      }
      const data = await response.json();

      if (data.success) {
        this.disconnect();
      }

      return data.success;
    } catch (error) {
      console.error('Error cancelling job:', error);
      return false;
    }
  }

  /**
   * Calculate progress percentage
   * @param {Object} stats
   * @returns {number} - Percentage 0-100
   */
  static calculateProgress(stats) {
    if (
      !stats ||
      !Number.isFinite(stats.total) ||
      stats.total <= 0
    ) {
      return 0;
    }

    const completed = (stats.completed || 0) + (stats.failed || 0) + (stats.skipped || 0);
    return Math.round((completed / stats.total) * 100);
  }

  /**
   * Format time estimate
   * @param {number} itemsRemaining
   * @param {number} avgTimePerItem - milliseconds
   * @returns {string}
   */
  static formatTimeEstimate(itemsRemaining, avgTimePerItem) {
    if (itemsRemaining === 0) return 'Complete';
    if (!avgTimePerItem) return 'Calculating...';

    const totalMs = itemsRemaining * avgTimePerItem;
    const seconds = Math.ceil(totalMs / 1000);

    if (seconds < 60) {
      return `~${seconds}s remaining`;
    } else {
      const minutes = Math.ceil(seconds / 60);
      return `~${minutes}m remaining`;
    }
  }
}

window.BatchProgress = BatchProgress;






