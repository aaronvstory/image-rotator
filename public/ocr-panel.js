// OCR Panel Component - Batch OCR Progress UI
class OCRPanel {
  constructor() {
    this.jobId = null;
    this.eventSource = null;
    this.isOpen = false;
    this.initializePanel();
    this.injectInspector();
    this.addHealthTestButton();
  }

  initializePanel() {
    // Create panel HTML
    const panel = document.createElement("div");
    panel.id = "ocr-panel";
    panel.className = "ocr-panel closed";
    panel.innerHTML = `
            <div class="ocr-panel-header">
                <h3>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="11" width="18" height="10" rx="2" ry="2"></rect>
                        <path d="M7 11V7a5 5 0 0110 0v4"></path>
                    </svg>
                    Batch OCR Processing
                </h3>
                <div class="ocr-panel-actions">
                  <button id="ocr-failed-reprocess" class="btn-secondary hidden" title="Reprocess failed only">Retry Failed</button>
                  <button id="ocr-panel-close" class="panel-close-btn">×</button>
                </div>
            </div>

            <div class="ocr-panel-content">
                <div id="ocr-status" class="ocr-status">
                    <div class="status-message">Ready to start OCR processing</div>
                    <div class="cost-estimate"></div>
                </div>

                <div id="ocr-progress" class="ocr-progress hidden">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: 0%"></div>
                    </div>
                    <div class="progress-text">0%</div>
                </div>

                <div id="ocr-stats" class="ocr-stats hidden">
                    <div class="stat-item">
                        <span class="stat-label">Total:</span>
                        <span class="stat-value" id="stat-total">0</span>
                    </div>
                    <div class="stat-item success">
                        <span class="stat-label">Processed:</span>
                        <span class="stat-value" id="stat-processed">0</span>
                    </div>
                    <div class="stat-item skipped">
                        <span class="stat-label">Skipped:</span>
                        <span class="stat-value" id="stat-skipped">0</span>
                    </div>
                    <div class="stat-item error">
                        <span class="stat-label">Failed:</span>
                        <span class="stat-value" id="stat-failed">0</span>
                    </div>
                </div>

                <div id="ocr-current" class="ocr-current hidden">
                    <div class="current-label">Processing:</div>
                    <div class="current-image"></div>
                </div>
                <div id="ocr-concurrency" class="ocr-concurrency hidden">
                    <div class="concurrency-label">Concurrency:</div>
                    <div class="concurrency-value"></div>
                </div>

                <div id="ocr-results" class="ocr-results">
                    <div class="results-header">Results</div>
                    <div class="results-list" id="results-list"></div>
                </div>
            </div>

            <div class="ocr-panel-footer">
                <button id="ocr-stop-btn" class="btn-danger hidden">Stop Processing</button>
                <button id="ocr-download-btn" class="btn-primary hidden">Download Results</button>
            </div>
        `;

    document.body.appendChild(panel);
    this.panel = panel;
    this.attachEventListeners();
  }

  attachEventListeners() {
    document
      .getElementById("ocr-panel-close")
      .addEventListener("click", () => this.close());
    document
      .getElementById("ocr-stop-btn")
      .addEventListener("click", () => this.stopProcessing());
    document
      .getElementById("ocr-download-btn")
      .addEventListener("click", () => this.downloadResults());
  }

  open() {
    this.panel.classList.remove("closed");
    this.panel.classList.add("open");
    this.isOpen = true;
  }

  close() {
    this.panel.classList.remove("open");
    this.panel.classList.add("closed");
    this.isOpen = false;
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  async startBatchOCR() {
    try {
      this.open();
      this.resetUI();
      const response = await fetch("/api/batch/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        let errorPayload = await response.json().catch(() => ({}));
        const parts = [];
        if (errorPayload.message) parts.push(errorPayload.message);
        if (errorPayload.error && errorPayload.error !== errorPayload.message)
          parts.push(`[${errorPayload.error}]`);
        if (errorPayload.suggestion) parts.push(errorPayload.suggestion);
        if (errorPayload.detail) parts.push(errorPayload.detail);
        const msg =
          parts.join(" - ") || `Failed to start OCR (HTTP ${response.status})`;
        this.showError(msg);
        return;
      }
      const data = await response.json();
      this.jobId = data.jobId;
      this.updateStatus(
        "Starting batch OCR...",
        data.estimatedCost,
        data.concurrency
      );
      this.connectToProgressStream();
    } catch (error) {
      this.showError("Failed to start OCR: " + error.message);
    }
  }

  connectToProgressStream() {
    if (!this.jobId) return;
    this.eventSource = new EventSource(`/api/batch/progress/${this.jobId}`);
    this.eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.updateProgress(data);
    };
    this.eventSource.onerror = () => {
      this.fallbackToPolling();
    };
  }

  fallbackToPolling() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    const pollInterval = setInterval(async () => {
      if (!this.jobId) {
        clearInterval(pollInterval);
        return;
      }
      try {
        const response = await fetch(`/api/batch/status/${this.jobId}`);
        if (!response.ok) {
          clearInterval(pollInterval);
          return;
        }
        const data = await response.json();
        this.updateProgress(data);
        if (["completed", "failed", "cancelled"].includes(data.status)) {
          clearInterval(pollInterval);
        }
      } catch {
        clearInterval(pollInterval);
      }
    }, 2000);
  }

  updateProgress(data) {
    if (data.status === "processing") {
      this.updateStatus(
        "Processing images...",
        data.estimatedCost,
        data.concurrency
      );
      if (!data.cancelled)
        document.getElementById("ocr-stop-btn").classList.remove("hidden");
    } else if (data.status === "completed") {
      this.updateStatus("Processing completed!");
      document.getElementById("ocr-stop-btn").classList.add("hidden");
      document.getElementById("ocr-download-btn").classList.remove("hidden");
    } else if (data.status === "cancelled") {
      this.updateStatus("Processing cancelled by user");
      document.getElementById("ocr-stop-btn").classList.add("hidden");
      document.getElementById("ocr-download-btn").classList.remove("hidden");
    } else if (data.status === "failed") {
      this.updateStatus("Processing failed!");
      document.getElementById("ocr-stop-btn").classList.add("hidden");
    }
    if (data.totalImages > 0) {
      const progress =
        data.progress ||
        ((data.processedImages + data.skippedImages + data.failedImages) /
          data.totalImages) *
        100;
      this.updateProgressBar(progress);
    }
    this.updateStats(data);
    if (data.currentImages && data.currentImages.length) {
      this.updateCurrentImage(data.currentImages);
    } else if (data.currentImage) {
      this.updateCurrentImage([data.currentImage]);
    }
    if (data.results && data.results.length > 0) {
      this.updateResults(data.results);
    }
  }

  updateStatus(message, cost, concurrency) {
    const statusEl = document.querySelector(".status-message");
    statusEl.textContent = message;
    if (cost) {
      const costEl = document.querySelector(".cost-estimate");
      costEl.textContent = `Estimated cost: $${cost.totalCost} USD`;
    }
    if (concurrency) {
      const concEl = document.getElementById("ocr-concurrency");
      concEl.classList.remove("hidden");
      concEl.querySelector(".concurrency-value").textContent = concurrency;
    }
  }

  updateProgressBar(percentage) {
    const progressContainer = document.getElementById("ocr-progress");
    const progressFill = document.querySelector(".progress-fill");
    const progressText = document.querySelector(".progress-text");
    progressContainer.classList.remove("hidden");
    progressFill.style.width = `${percentage}%`;
    progressText.textContent = `${Math.round(percentage)}%`;
  }

  updateStats(data) {
    const statsContainer = document.getElementById("ocr-stats");
    statsContainer.classList.remove("hidden");
    document.getElementById("stat-total").textContent = data.totalImages || 0;
    document.getElementById("stat-processed").textContent =
      data.processedImages || 0;
    document.getElementById("stat-skipped").textContent =
      data.skippedImages || 0;
    document.getElementById("stat-failed").textContent = data.failedImages || 0;
  }

  updateCurrentImage(imagePaths) {
    const currentContainer = document.getElementById("ocr-current");
    const currentImage = document.querySelector(".current-image");
    currentContainer.classList.remove("hidden");
    currentImage.textContent = Array.isArray(imagePaths)
      ? imagePaths.join(", ")
      : imagePaths;
  }

  injectInspector() {
    if (document.getElementById("ocr-inspector")) return;
    const modal = document.createElement("div");
    modal.id = "ocr-inspector";
    modal.className = "ocr-inspector hidden";
    modal.innerHTML = `
      <div class="ocr-inspector-backdrop"></div>
      <div class="ocr-inspector-dialog">
        <div class="ocr-inspector-header">
          <h4 id="ocr-inspector-title">Result</h4>
          <div class="spacer"></div>
          <button id="ocr-inspector-force" class="btn-secondary" title="Clear cached OCR & reprocess fresh">Force Refresh</button>
          <button id="ocr-inspector-reprocess" class="btn-secondary" title="Reprocess this image">Reprocess</button>
          <button id="ocr-inspector-close" class="btn-icon">×</button>
        </div>
        <div class="ocr-inspector-body">
          <pre id="ocr-inspector-json" class="json-viewer"></pre>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.querySelector("#ocr-inspector-close").onclick = () =>
      this.hideInspector();
    modal.querySelector(".ocr-inspector-backdrop").onclick = () =>
      this.hideInspector();
    modal.querySelector("#ocr-inspector-reprocess").onclick = () =>
      this.reprocessSingle();
    modal.querySelector("#ocr-inspector-force").onclick = () =>
      this.forceRefreshSingle();
  }

  showInspector(entry) {
    this.currentEntryForReprocess = entry;
    const modal = document.getElementById("ocr-inspector");
    modal.classList.remove("hidden");
    document.getElementById("ocr-inspector-title").textContent = entry.image;
    const pre = document.getElementById("ocr-inspector-json");
    pre.textContent = JSON.stringify(entry, null, 2);
  }

  hideInspector() {
    const modal = document.getElementById("ocr-inspector");
    if (modal) modal.classList.add("hidden");
    this.currentEntryForReprocess = null;
  }

  async reprocessSingle() {
    if (!this.currentEntryForReprocess) return;
    // Force delete existing OCR files on disk? For now just start an ad-hoc batch of one by calling batch with mode=single
    try {
      const img = this.currentEntryForReprocess.image;
      const response = await fetch("/api/ocr/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: [img] }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        alert(
          `Failed to reprocess image: ${payload.message || payload.error || response.status
          }`
        );
        return;
      }
      this.hideInspector();
    } catch (e) {
      console.error(e);
    }
  }

  async forceRefreshSingle() {
    if (!this.currentEntryForReprocess || !this.jobId) return;
    const img = this.currentEntryForReprocess.image;
    if (!confirm("Reprocess this image (will overwrite existing results)?"))
      return;
    try {
      // Directly reprocess with overwrite mode
      await this.reprocessSingle({ overwrite: 'overwrite' });
    } catch (e) {
      console.error(e);
      alert("Error performing force refresh");
    }
  }

  // Modify updateResults to add click handlers
  updateResults(results) {
    const resultsList = document.getElementById("results-list");
    resultsList.innerHTML = "";
    const hasFailures = results.some((r) => r.status === "error");
    const retryBtn = document.getElementById("ocr-failed-reprocess");
    if (retryBtn) {
      if (hasFailures && this.jobId) retryBtn.classList.remove("hidden");
      else retryBtn.classList.add("hidden");
      retryBtn.onclick = () => this.startFailedOnly();
    }
    results.forEach((result) => {
      const item = document.createElement("div");
      item.className = `result-item ${result.status}`;
      let statusIcon = "";
      if (result.status === "success") statusIcon = "✓";
      else if (result.status === "skipped") statusIcon = "⊘";
      else if (result.status === "error") statusIcon = "✗";
      item.innerHTML = `
                <span class="result-status">${statusIcon}</span>
                <span class="result-image link" title="View details">${result.image
        }</span>
                <span class="result-message">${result.message || ""}</span>
            `;
      const imgEl = item.querySelector(".result-image");
      imgEl.addEventListener("click", () =>
        this.fetchAndShowResult(this.jobId, result.image)
      );
      resultsList.appendChild(item);
    });
    resultsList.scrollTop = resultsList.scrollHeight;
  }

  async fetchAndShowResult(jobId, imagePath) {
    try {
      const encoded = encodeURIComponent(imagePath);
      const resp = await fetch(`/api/ocr-results?path=${encoded}`);
      if (!resp.ok) {
        const text = await resp.text();
        alert(`Failed to load result (status ${resp.status})\n${text}`);
        return;
      }
      const data = await resp.json();
      this.showInspector(data);
    } catch (e) {
      console.error(e);
      alert("Network error fetching result");
    }
  }

  async startFailedOnly() {
    try {
      const resp = await fetch("/api/batch/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "failed_only" }),
      });
      if (!resp.ok) {
        const d = await resp.json().catch(() => ({}));
        alert(d.error || "Failed to start failed-only batch");
        return;
      }
      const data = await resp.json();
      this.jobId = data.jobId;
      this.resetUI();
      this.updateStatus(
        "Retrying failed images...",
        data.estimatedCost,
        data.concurrency
      );
      this.connectToProgressStream();
    } catch (e) {
      console.error(e);
    }
  }

  addHealthTestButton() {
    // Attach a lightweight test button if not present
    if (document.getElementById("ocr-health-test")) return;
    const footer = document.querySelector(".ocr-panel-footer");
    if (!footer) return;
    const btn = document.createElement("button");
    btn.id = "ocr-health-test";
    btn.className = "btn-secondary";
    btn.style.fontSize = "0.65rem";
    btn.textContent = "Test OCR Key";
    btn.title = "Health check endpoint not available";
    btn.disabled = true;
    /* Health check endpoint /api/ocr/health not implemented
    btn.onclick = async () => {
      btn.disabled = true;
      const old = btn.textContent;
      btn.textContent = "Testing...";
      try {
        const resp = await fetch("/api/ocr/health");
        const data = await resp.json();
        if (data.ok) {
          alert(`OCR OK (model: ${data.model}, echo: ${data.raw})`);
        } else {
          alert("OCR check failed: " + (data.error || JSON.stringify(data)));
        }
      } catch (e) {
        alert("Network error running health check");
      } finally {
        btn.disabled = false;
        btn.textContent = old;
      }
    };
    */
    footer.appendChild(btn);
  }
}

// Initialize OCR panel when DOM is ready
let ocrPanel = null;
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    ocrPanel = new OCRPanel();
  });
} else {
  ocrPanel = new OCRPanel();
}
