const path = require('path');
const OCRService = require('../../../server-ocr');

class OCRProvider {
  constructor() {
    this.service = new OCRService(process.env.OPENROUTER_API_KEY);
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    // Potential hook for validating API connectivity without blocking start-up
    this.initialized = true;
  }

  async processImage(imagePath, options = {}) {
    const response = await this.service.processImage(imagePath, options);
    const status = (response?.status || '').toLowerCase();

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
}

module.exports = {
  OCRProvider
};
