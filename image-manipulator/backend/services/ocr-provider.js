const path = require('path');
const OCRService = require('../../../server-ocr');

class OCRProvider {
  constructor() {
    const rawKey = process.env.OPENROUTER_API_KEY ?? process.env.OCR_API_KEY ?? null;
    const trimmedKey = typeof rawKey === 'string' ? rawKey.trim() : '';
    this.apiKey = trimmedKey.length > 0 ? trimmedKey : null;
    this.service = this.apiKey ? new OCRService(this.apiKey) : null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    // Potential hook for validating API connectivity without blocking start-up
    this.initialized = true;
  }

  async processImage(imagePath, options = {}) {
    if (!this.apiKey || !this.service) {
      throw new Error('An OCR API key environment variable is required before processing OCR jobs');
    }
    if (!this.initialized) {
      await this.initialize();
    }
    const response = await this.service.processImage(imagePath, options);
    const status = String(response?.status || '').toLowerCase();

    if (status === 'skipped') {
      return {
        success: true,
        skipped: true,
        message: response?.message,
        data: response
      };
    }

    if (status === 'success' && response?.data) {
      return {
        success: true,
        data: this.parseResult(response.data)
      };
    }

    return {
      success: false,
      error: response?.error || response?.message || `Failed to process ${path.basename(imagePath)}`
    };
  }

  parseResult(data = {}) {
    return { ...data };
  }

  async shutdown() {
    const svc = this.service;
    if (svc && typeof svc.shutdown === 'function') {
      await svc.shutdown();
    } else if (svc && typeof svc.dispose === 'function') {
      await svc.dispose();
    }
  }
}

module.exports = {
  OCRProvider
};
