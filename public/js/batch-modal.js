/**
 * Batch Modal - Display batch progress and results
 */

class BatchModal {
  constructor() {
    this.modal = null;
    this.isOpen = false;
    this.currentJobId = null;
    this.progressClient = null;
    this.startTime = null;
    this.isComplete = false;
    this.currentFilter = 'all';
    this.createModal();
  }

  _query(selector) {
    if (!this.modal) return null;
    return this.modal.querySelector(selector);
  }

  static escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/[&<>"']/g, (match) => {
      const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      };
      return map[match];
    });
  }

  /**
   * Create modal HTML structure
   * @private
   */
  createModal() {
    const modalHTML = `
      <div id="batchModal" class="batch-modal hidden">
        <div class="batch-modal-overlay"></div>
        <div class="batch-modal-content">
          <!-- Header -->
          <div class="batch-modal-header">
            <h2>
              <i class="fas fa-cogs"></i>
              <span id="batchModalTitle">Batch OCR Processing</span>
            </h2>
            <button id="batchModalClose" class="batch-modal-close">
              <i class="fas fa-times"></i>
            </button>
          </div>

          <!-- Progress Section -->
          <div class="batch-progress-section">
            <div class="batch-stats">
              <div class="batch-stat">
                <span class="stat-label">Total:</span>
                <span id="batchTotal" class="stat-value">0</span>
              </div>
              <div class="batch-stat batch-stat-success">
                <span class="stat-label">Completed:</span>
                <span id="batchCompleted" class="stat-value">0</span>
              </div>
              <div class="batch-stat batch-stat-warning">
                <span class="stat-label">Skipped:</span>
                <span id="batchSkipped" class="stat-value">0</span>
              </div>
              <div class="batch-stat batch-stat-error">
                <span class="stat-label">Failed:</span>
                <span id="batchFailed" class="stat-value">0</span>
              </div>
            </div>

            <div class="batch-progress-bar-container">
              <div class="batch-progress-bar">
                <div id="batchProgressFill" class="batch-progress-fill" style="width: 0%"></div>
              </div>
              <div class="batch-progress-text">
                <span id="batchProgressPercent">0%</span>
                <span id="batchProgressTime">Calculating...</span>
              </div>
            </div>

            <!-- Control Buttons -->
            <div class="batch-controls">
              <button id="batchPauseBtn" class="btn btn-warning">
                <i class="fas fa-pause"></i> Pause
              </button>
              <button id="batchResumeBtn" class="btn btn-success hidden">
                <i class="fas fa-play"></i> Resume
              </button>
              <button id="batchCancelBtn" class="btn btn-danger">
                <i class="fas fa-stop"></i> Cancel
              </button>
            </div>
          </div>

          <!-- Results Section -->
          <div class="batch-results-section">
            <div class="batch-results-header">
              <h3>Processing Results</h3>
              <div class="batch-results-filter">
                <button class="filter-btn active" data-filter="all">All</button>
                <button class="filter-btn" data-filter="completed">Completed</button>
                <button class="filter-btn" data-filter="failed">Failed</button>
                <button class="filter-btn" data-filter="skipped">Skipped</button>
              </div>
            </div>
            <div id="batchResultsList" class="batch-results-list">
              <!-- Results will be populated here -->
            </div>
          </div>

          <!-- Footer -->
          <div class="batch-modal-footer">
            <button id="batchDoneBtn" class="btn btn-primary">
              <i class="fas fa-check"></i> Done
            </button>
          </div>
        </div>
      </div>
    `;

    // Add to document
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    this.modal = document.getElementById('batchModal');

    // Bind events
    this.bindEvents();
  }

  /**
   * Bind modal events
   * @private
   */
  bindEvents() {
    // Close button
    this._query('#batchModalClose')?.addEventListener('click', () => this.close());

    // Done button
    this._query('#batchDoneBtn')?.addEventListener('click', () => this.close());

    // Pause button
    this._query('#batchPauseBtn')?.addEventListener('click', async () => {
      if (!this.progressClient) return;
      const success = await this.progressClient.pause();
      if (success) this.showResumeButton();
    });

    // Resume button
    this._query('#batchResumeBtn')?.addEventListener('click', async () => {
      if (!this.progressClient) return;
      const success = await this.progressClient.resume();
      if (success) this.showPauseButton();
    });

    // Cancel button
    this._query('#batchCancelBtn')?.addEventListener('click', async () => {
      if (!this.progressClient) return;
      const confirmCancel = confirm('Are you sure you want to cancel this batch?');
      if (!confirmCancel) return;
      await this.progressClient.cancel();
    });

    // Filter buttons scoped to modal
    const filterButtons = this.modal?.querySelectorAll('.batch-results-filter .filter-btn') || [];
    filterButtons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const button = e.currentTarget;
        const filter = button.dataset.filter || 'all';
        this.applyFilter(filter);

        filterButtons.forEach((b) => b.classList.remove('active'));
        button.classList.add('active');
      });
    });

    // Click outside to close
    this._query('.batch-modal-overlay')?.addEventListener('click', () => {
      if (this.isComplete) {
        this.close();
      }
    });
  }

  /**
   * Open modal and start batch processing
   * @param {string} jobId
   * @param {BatchProgress} progressClient
   */
  open(jobId, progressClient) {
    this.currentJobId = jobId;
    this.startTime = Date.now();
    this.isComplete = false;

    // Show modal
    this.modal.classList.remove('hidden');
    this.isOpen = true;

    // Reset UI
    this.reset();

    // Setup progress tracking
    if (progressClient && typeof progressClient.connect === 'function') {
      this.progressClient = progressClient;
      this.progressClient.connect(jobId, {
        onUpdate: (data) => this.handleUpdate(data),
        onComplete: (data) => this.handleComplete(data),
        onError: (error) => this.handleError(error)
      });
    } else {
      this.progressClient = null;
      console.error('BatchModal: invalid progress client supplied; skipping progress tracking.');
    }
  }

  /**
   * Close modal
   */
  close() {
    if (this.progressClient) {
      this.progressClient.disconnect();
    }

    this.modal.classList.add('hidden');
    this.isOpen = false;
    this.currentJobId = null;
  }

  /**
   * Reset modal UI
   * @private
   */
  reset() {
    const totalEl = this._query('#batchTotal');
    const completedEl = this._query('#batchCompleted');
    const skippedEl = this._query('#batchSkipped');
    const failedEl = this._query('#batchFailed');
    const progressFill = this._query('#batchProgressFill');
    const progressPercent = this._query('#batchProgressPercent');
    const progressTime = this._query('#batchProgressTime');
    const resultsList = this._query('#batchResultsList');
    const modalTitle = this._query('#batchModalTitle');

    if (totalEl) totalEl.textContent = '0';
    if (completedEl) completedEl.textContent = '0';
    if (skippedEl) skippedEl.textContent = '0';
    if (failedEl) failedEl.textContent = '0';
    if (progressFill) progressFill.style.width = '0%';
    if (progressPercent) progressPercent.textContent = '0%';
    if (progressTime) progressTime.textContent = 'Calculating...';
    if (resultsList) resultsList.innerHTML = '';
    if (modalTitle) modalTitle.textContent = 'Batch OCR Processing';

    this.showPauseButton();
  }

  /**
   * Handle progress update
   * @private
   */
  handleUpdate(data) {
  const { stats, items } = data;

    // Update stats
    const totalEl = this._query('#batchTotal');
    const completedEl = this._query('#batchCompleted');
    const skippedEl = this._query('#batchSkipped');
    const failedEl = this._query('#batchFailed');
    if (totalEl) totalEl.textContent = stats.total;
    if (completedEl) completedEl.textContent = stats.completed;
    if (skippedEl) skippedEl.textContent = stats.skipped;
    if (failedEl) failedEl.textContent = stats.failed;

    // Update progress bar
    const progress = BatchModal.calculateProgress(stats);
    const progressFill = this._query('#batchProgressFill');
    const progressPercent = this._query('#batchProgressPercent');
    if (progressFill) progressFill.style.width = `${progress}%`;
    if (progressPercent) progressPercent.textContent = `${progress}%`;

    // Update time estimate
    const elapsed = Date.now() - this.startTime;
    const completed = stats.completed + stats.failed + stats.skipped;
    const avgTime = completed > 0 ? elapsed / completed : 0;
    const remaining = stats.total - completed;
    const estimate = BatchModal.formatTimeEstimate(remaining, avgTime);
    const progressTime = this._query('#batchProgressTime');
    if (progressTime) progressTime.textContent = estimate;

    // Update results list
    if (items && items.length > 0) {
      this.updateResultsList(items);
    }
  }

  /**
   * Handle batch completion
   * @private
   */
  handleComplete(data) {
    this.isComplete = true;

    const { stats, status } = data;

    // Update title
    const title = status === 'cancelled' ? 'Batch Cancelled' :
                  stats.failed > 0 ? 'Batch Completed with Errors' :
                  'Batch Completed Successfully';
    const modalTitle = this._query('#batchModalTitle');
    if (modalTitle) modalTitle.textContent = title;

    // Hide control buttons
    this._query('#batchPauseBtn')?.classList.add('hidden');
    this._query('#batchResumeBtn')?.classList.add('hidden');
    this._query('#batchCancelBtn')?.classList.add('hidden');

    // Update progress
    this.handleUpdate(data);
    const progressTime = this._query('#batchProgressTime');
    if (progressTime) progressTime.textContent = 'Complete';
  }

  /**
   * Handle error
   * @private
   */
  handleError(error) {
    console.error('Batch processing error:', error);
    // Could show error notification here
  }

  /**
   * Update results list
   * @private
   */
  updateResultsList(items) {
    const container = this._query('#batchResultsList');
    if (!container) return;
    const allowedStatuses = ['pending', 'processing', 'completed', 'failed', 'skipped'];

    // Clear and rebuild
    container.innerHTML = items.map(item => {
      const status = allowedStatuses.includes(item.status) ? item.status : 'pending';
      const filename = BatchModal.escapeHtml(item.filename || 'Unnamed file');
      const error = item.error ? `<div class="result-error">${BatchModal.escapeHtml(item.error)}</div>` : '';

      return `
      <div class="batch-result-item batch-result-${status}" data-status="${status}">
        <div class="result-icon">
          ${this.getStatusIcon(status)}
        </div>
        <div class="result-info">
          <div class="result-filename">${filename}</div>
          ${error}
        </div>
        <div class="result-status">
          <span class="status-badge status-${status}">${status}</span>
        </div>
      </div>
    `;
    }).join('');

    if (this.currentFilter) {
      this.applyFilter(this.currentFilter);
    }
  }

  /**
   * Get status icon
   * @private
   */
  getStatusIcon(status) {
    const icons = {
      pending: '<i class="fas fa-clock"></i>',
      processing: '<i class="fas fa-spinner fa-spin"></i>',
      completed: '<i class="fas fa-check-circle"></i>',
      failed: '<i class="fas fa-exclamation-circle"></i>',
      skipped: '<i class="fas fa-forward"></i>'
    };
    return icons[status] || '<i class="fas fa-question-circle"></i>';
  }

  /**
   * Apply filter to results
   * @private
   */
  applyFilter(filter) {
    this.currentFilter = filter;
    const items = this.modal ? this.modal.querySelectorAll('.batch-result-item') : [];

    items.forEach(item => {
      if (filter === 'all') {
        item.style.display = '';
      } else {
        const status = item.dataset.status;
        item.style.display = status === filter ? '' : 'none';
      }
    });
  }

  /**
   * Show pause button, hide resume
   * @private
   */
  showPauseButton() {
    this._query('#batchPauseBtn')?.classList.remove('hidden');
    this._query('#batchResumeBtn')?.classList.add('hidden');
  }

  /**
   * Show resume button, hide pause
   * @private
   */
  showResumeButton() {
    this._query('#batchPauseBtn')?.classList.add('hidden');
    this._query('#batchResumeBtn')?.classList.remove('hidden');
  }
}

BatchModal.calculateProgress = function(stats) {
  if (!stats || !stats.total) return 0;
  const completed = (stats.completed || 0) + (stats.failed || 0) + (stats.skipped || 0);
  return Math.round((completed / stats.total) * 100);
};

BatchModal.formatTimeEstimate = function(itemsRemaining, avgTimePerItem) {
  if (!itemsRemaining) return 'Complete';
  if (!avgTimePerItem) return 'Calculating...';

  const totalMs = itemsRemaining * avgTimePerItem;
  const seconds = Math.ceil(totalMs / 1000);
  if (seconds < 60) {
    return `~${seconds}s remaining`;
  }
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) {
    return `~${minutes}m remaining`;
  }
  const hours = Math.ceil(minutes / 60);
  return `~${hours}h remaining`;
};
