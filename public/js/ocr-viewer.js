/**
 * OCR Results Viewer - View and edit OCR results
 */

class OCRViewer {
  constructor() {
    this.modal = null;
    this.currentImagePath = null;
    this.currentJsonPath = null;
    this.currentTxtPath = null;
    this.currentData = null;
    this.activeTab = 'formatted';
    this.hasChanges = false;
    this.init();
  }

  // HTML escape utility to prevent XSS
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  init() {
    this.modal = document.getElementById('ocrViewerModal');
    this.bindEvents();
  }

  bindEvents() {
    // Close button
    document.getElementById('ocrViewerClose').addEventListener('click', () => {
      this.close();
    });

    // Cancel button
    document.getElementById('ocrCancelBtn').addEventListener('click', () => {
      this.close();
    });

    // Save button
    document.getElementById('ocrSaveBtn').addEventListener('click', () => {
      this.saveChanges();
    });

    // Tab switching
    document.querySelectorAll('.ocr-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const tabName = e.currentTarget.dataset.tab;
        this.switchTab(tabName);
      });
    });

    // Track changes
    document.getElementById('ocrJsonEditor').addEventListener('input', () => {
      this.hasChanges = true;
    });

    document.getElementById('ocrRawEditor').addEventListener('input', () => {
      this.hasChanges = true;
    });

    // Click outside to close
    const overlayEl = this.modal ? this.modal.querySelector('.ocr-viewer-overlay') : null;
    if (overlayEl) {
      overlayEl.addEventListener('click', () => {
        if (!this.hasChanges || confirm('You have unsaved changes. Close anyway?')) {
          this.close();
        }
      });
    }
  }

  async open(imagePath) {
    this.currentImagePath = imagePath;
    this.currentJsonPath = null;
    this.currentTxtPath = null;
    this.hasChanges = false;

    try {
      const query = `/api/ocr-results?imagePath=${encodeURIComponent(imagePath)}`;
      const response = await fetch(query);
      if (!response.ok) {
        throw new Error('Failed to load OCR results');
      }

      this.currentData = await response.json();

      // Update filename display
  const filename = imagePath.split(/[\\/]/).pop();
      document.getElementById('ocrViewerFilename').textContent = filename;

      // Populate views
      this.populateFormattedView();
      this.populateJsonView();
      await this.populateRawView();

      // Show modal
      this.modal.classList.remove('hidden');
      this.switchTab('formatted');

    } catch (error) {
      console.error('Error loading OCR results:', error);
      alert('Failed to load OCR results: ' + error.message);
    }
  }

  close() {
    if (this.hasChanges && !confirm('You have unsaved changes. Close anyway?')) {
      return;
    }

    this.modal.classList.add('hidden');
    this.currentImagePath = null;
    this.currentJsonPath = null;
    this.currentTxtPath = null;
    this.currentData = null;
    this.hasChanges = false;
  }

  switchTab(tabName) {
    this.activeTab = tabName;

    // Update tab buttons
    document.querySelectorAll('.ocr-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    // Update tab content
    document.querySelectorAll('.ocr-tab-content').forEach(content => {
      const contentId = content.id;
      const isActive =
        (tabName === 'formatted' && contentId === 'ocrFormattedView') ||
        (tabName === 'json' && contentId === 'ocrJsonView') ||
        (tabName === 'raw' && contentId === 'ocrRawView');

      content.classList.toggle('active', isActive);
    });
  }

  renderCopyButton(value) {
    const encoded = encodeURIComponent(value || '');
    return `
      <button class="field-copy-btn" data-copy-value="${encoded}">
        <i class="fas fa-copy"></i> Copy
      </button>
    `;
  }

  populateFormattedView() {
    const container = document.getElementById('ocrFormattedData');
    const data = this.currentData;

    const confidenceValue = (typeof data?.confidence === 'number' && Number.isFinite(data.confidence)) ? data.confidence : 0;
    const confidenceDisplay = `${(confidenceValue * 100).toFixed(0)}%`;

    let processedDisplay = 'N/A';
    if (data && data.processedAt) {
      const processedDate = new Date(data.processedAt);
      if (!Number.isNaN(processedDate.getTime())) {
        processedDisplay = processedDate.toLocaleString();
      }
    }

    const html = `
      <button class="copy-all-btn">
        <i class="fas fa-copy"></i>
        Copy All Data
        <span class="copy-feedback" id="copyAllFeedback">Copied!</span>
      </button>

      <div class="field-group">
        <h3>Personal Information</h3>
        <div class="field">
          <div class="field-label">Name:</div>
          <div class="field-value">
            ${this.escapeHtml(this.formatName(data))}
            ${this.renderCopyButton(this.formatName(data))}
          </div>
        </div>
        <div class="field">
          <div class="field-label">Date of Birth:</div>
          <div class="field-value">
            ${this.escapeHtml(data.dateOfBirth) || 'N/A'}
            ${this.renderCopyButton(data.dateOfBirth || '')}
          </div>
        </div>
        <div class="field">
          <div class="field-label">Sex:</div>
          <div class="field-value">
            ${this.escapeHtml(data.sex) || 'N/A'}
            ${this.renderCopyButton(data.sex || '')}
          </div>
        </div>
      </div>

      <div class="field-group">
        <h3>License Information</h3>
        <div class="field">
          <div class="field-label">License Number:</div>
          <div class="field-value">
            ${this.escapeHtml(data.licenseNumber) || 'N/A'}
            ${this.renderCopyButton(data.licenseNumber || '')}
          </div>
        </div>
        <div class="field">
          <div class="field-label">State:</div>
          <div class="field-value">
            ${this.escapeHtml(data.state) || 'N/A'}
            ${this.renderCopyButton(data.state || '')}
          </div>
        </div>
        <div class="field">
          <div class="field-label">Class:</div>
          <div class="field-value">
            ${this.escapeHtml(data.documentClass) || 'N/A'}
            ${this.renderCopyButton(data.documentClass || '')}
          </div>
        </div>
        <div class="field">
          <div class="field-label">Issue Date:</div>
          <div class="field-value">
            ${this.escapeHtml(data.issueDate) || 'N/A'}
            ${this.renderCopyButton(data.issueDate || '')}
          </div>
        </div>
        <div class="field">
          <div class="field-label">Expiration:</div>
          <div class="field-value">
            ${this.escapeHtml(data.expirationDate) || 'N/A'}
            ${this.renderCopyButton(data.expirationDate || '')}
          </div>
        </div>
      </div>

      <div class="field-group">
        <h3>Address</h3>
        <div class="field">
          <div class="field-label">Street:</div>
          <div class="field-value">
            ${this.escapeHtml(data.address) || 'N/A'}
            ${this.renderCopyButton(data.address || '')}
          </div>
        </div>
        <div class="field">
          <div class="field-label">City:</div>
          <div class="field-value">
            ${this.escapeHtml(data.city) || 'N/A'}
            ${this.renderCopyButton(data.city || '')}
          </div>
        </div>
        <div class="field">
          <div class="field-label">Zip Code:</div>
          <div class="field-value">
            ${this.escapeHtml(data.zipCode) || 'N/A'}
            ${this.renderCopyButton(data.zipCode || '')}
          </div>
        </div>
      </div>

      <div class="field-group">
        <h3>Physical Description</h3>
        <div class="field">
          <div class="field-label">Height:</div>
          <div class="field-value">
            ${this.escapeHtml(data.height) || 'N/A'}
            ${this.renderCopyButton(data.height || '')}
          </div>
        </div>
        <div class="field">
          <div class="field-label">Weight:</div>
          <div class="field-value">
            ${this.escapeHtml(data.weight) || 'N/A'}
            ${this.renderCopyButton(data.weight || '')}
          </div>
        </div>
        <div class="field">
          <div class="field-label">Eye Color:</div>
          <div class="field-value">
            ${this.escapeHtml(data.eyeColor) || 'N/A'}
            ${this.renderCopyButton(data.eyeColor || '')}
          </div>
        </div>
        <div class="field">
          <div class="field-label">Hair Color:</div>
          <div class="field-value">
            ${this.escapeHtml(data.hairColor) || 'N/A'}
            ${this.renderCopyButton(data.hairColor || '')}
          </div>
        </div>
      </div>

      <div class="field-group">
        <h3>Metadata</h3>
        <div class="field">
          <div class="field-label">Confidence:</div>
          <div class="field-value">${confidenceDisplay}</div>
        </div>
        <div class="field">
          <div class="field-label">Model Used:</div>
          <div class="field-value">${this.escapeHtml(data.modelUsed) || 'N/A'}</div>
        </div>
        <div class="field">
          <div class="field-label">Processed:</div>
          <div class="field-value">${processedDisplay}</div>
        </div>
        <div class="field">
          <div class="field-label">Cost:</div>
          <div class="field-value">$${this.formatCost(data.cost)}</div>
        </div>
      </div>
    `;

    container.innerHTML = html;
    const copyAllBtn = container.querySelector('.copy-all-btn');
    if (copyAllBtn) {
      copyAllBtn.addEventListener('click', () => this.copyAllData());
    }
    container.querySelectorAll('.field-copy-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const raw = btn.getAttribute('data-copy-value') || '';
        this.copyField(decodeURIComponent(raw));
      });
    });
  }

  copyField(text) {
    if (!text || text === 'N/A') return;

    navigator.clipboard.writeText(text).then(() => {
      console.log('Field copied:', text);
    }).catch(err => {
      console.error('Failed to copy:', err);
    });
  }

  copyAllData() {
    const data = this.currentData;

    const text = `
PERSONAL INFORMATION
Name: ${this.formatName(data)}
Date of Birth: ${data.dateOfBirth || 'N/A'}
Sex: ${data.sex || 'N/A'}

LICENSE INFORMATION
License Number: ${data.licenseNumber || 'N/A'}
State: ${data.state || 'N/A'}
Class: ${data.documentClass || 'N/A'}
Issue Date: ${data.issueDate || 'N/A'}
Expiration: ${data.expirationDate || 'N/A'}

ADDRESS
Street: ${data.address || 'N/A'}
City: ${data.city || 'N/A'}
Zip Code: ${data.zipCode || 'N/A'}

PHYSICAL DESCRIPTION
Height: ${data.height || 'N/A'}
Weight: ${data.weight || 'N/A'}
Eye Color: ${data.eyeColor || 'N/A'}
Hair Color: ${data.hairColor || 'N/A'}
    `.trim();

    navigator.clipboard.writeText(text).then(() => {
      const feedback = document.getElementById('copyAllFeedback');
      feedback.classList.add('show');
      setTimeout(() => feedback.classList.remove('show'), 2000);
    }).catch(err => {
      console.error('Failed to copy all data:', err);
      alert('Failed to copy to clipboard');
    });
  }

  populateJsonView() {
    const editor = document.getElementById('ocrJsonEditor');
    editor.value = JSON.stringify(this.currentData, null, 2);
  }

  async populateRawView() {
    const editor = document.getElementById('ocrRawEditor');

    try {
      if (!this.currentImagePath) {
        editor.value = 'Image path is not set';
        return;
      }

      const response = await fetch(`/api/ocr-results?imagePath=${encodeURIComponent(this.currentImagePath)}&raw=true`);
      if (response.status === 404) {
        this.currentTxtPath = null;
        editor.value = 'No raw OCR text file found';
        return;
      }

      if (!response.ok) {
        editor.value = 'Failed to load raw text file';
        return;
      }

      const text = await response.text();
      editor.value = text;

    } catch (error) {
      console.error('Error loading raw text:', error);
      editor.value = 'Error loading raw text file';
    }
  }

  formatName(data) {
    const parts = [];
    if (data.firstName) parts.push(data.firstName);
    if (data.middleName) parts.push(data.middleName);
    if (data.lastName) parts.push(data.lastName);
    return parts.join(' ') || 'N/A';
  }

  formatCost(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return '0.0000';
    }
    return numeric.toFixed(4);
  }

  async saveChanges() {
    try {
      // Get the edited content based on active tab
      let updatedData;

      if (this.activeTab === 'json') {
        const jsonText = document.getElementById('ocrJsonEditor').value;
        try {
          updatedData = JSON.parse(jsonText);
        } catch (e) {
          alert('Invalid JSON format. Please fix the errors and try again.');
          return;
        }
      } else if (this.activeTab === 'raw') {
        // For raw text, we'll save it to the .txt file
        const rawText = document.getElementById('ocrRawEditor').value;

        const response = await fetch('/api/ocr-results/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imagePath: this.currentImagePath,
            content: rawText,
            type: 'txt'
          })
        });

        if (!response.ok) {
          throw new Error('Failed to save changes');
        }

        const payload = await response.json().catch(() => null);
        if (payload && Array.isArray(payload.paths) && payload.paths.length > 0) {
          this.currentTxtPath = payload.paths[0];
        }

        alert('Changes saved successfully!');
        this.hasChanges = false;
        return;

      } else {
        alert('Formatted view is read-only. Switch to JSON or Raw Text tab to edit.');
        return;
      }

      // Save JSON changes
      const response = await fetch('/api/ocr-results/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imagePath: this.currentImagePath,
          content: JSON.stringify(updatedData, null, 2),
          type: 'json'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save changes');
      }

      const payload = await response.json().catch(() => null);
      if (payload && Array.isArray(payload.paths) && payload.paths.length > 0) {
        this.currentJsonPath = payload.paths[0];
      }

      this.currentData = updatedData;
      this.populateFormattedView();
      this.hasChanges = false;

      alert('Changes saved successfully!');

    } catch (error) {
      console.error('Error saving changes:', error);
      alert('Failed to save changes: ' + error.message);
    }
  }
}
