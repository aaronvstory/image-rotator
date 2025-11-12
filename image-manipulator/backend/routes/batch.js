/**
 * Batch Processing Routes
 * Handles batch OCR job lifecycle (start/pause/resume/cancel) and SSE progress.
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const { isPathInside } = require('../utils/path-utils');
const fs = require('fs').promises;
const { BatchManager, JOB_STATUS } = require('../services/batch-manager');
const { BatchProcessor } = require('../services/batch-processor');

const batchManager = new BatchManager();
const batchProcessor = new BatchProcessor(batchManager);
const TERMINAL_STATUSES = new Set([
  JOB_STATUS.COMPLETED,
  JOB_STATUS.COMPLETED_WITH_ERRORS,
  JOB_STATUS.CANCELLED
]);

router.post('/start', async (req, res) => {
  try {
    const { items, options = {} } = req.body || {};
    const imageRoot = req.app.get('IMAGE_DIR') || process.env.IMAGE_DIR || null;

    if (!imageRoot) {
      return res.status(400).json({ success: false, error: 'IMAGE_DIR is not configured' });
    }
    try {
      const st = await fs.stat(imageRoot);
      if (!st.isDirectory()) throw new Error('not a directory');
    } catch {
      return res.status(400).json({ success: false, error: 'IMAGE_DIR is not accessible' });
    }

    const apiKeyRaw = process.env.OPENROUTER_API_KEY ?? process.env.OCR_API_KEY;
    const apiKey = typeof apiKeyRaw === 'string' ? apiKeyRaw.trim() : '';
    if (!apiKey) {
      return res.status(400).json({ success: false, error: 'OCR API key missing (OPENROUTER_API_KEY)' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Items array is required and must not be empty' });
    }


    const resolvedImageRoot = path.resolve(imageRoot);
    const sanitized = [];
    for (const item of items) {
      const abs = path.resolve(String(item.path || ''));
      if (!(await isPathInside(abs, resolvedImageRoot))) {
        return res.status(400).json({ success: false, error: `Item path is outside image root: ${item.path}` });
      }
      sanitized.push({
        id: item.id,
        path: abs,
        filename: item.filename || path.basename(abs)
      });
    }

    const jobOptions = { ...options, imageDir: resolvedImageRoot };
    const jobId = await batchManager.createJob(sanitized, jobOptions);
    batchProcessor.processJob(jobId).catch((error) => {
      console.error(`Batch job ${jobId} failed:`, error);
    });

    res.json({ success: true, jobId, totalItems: sanitized.length, options: batchManager.getJob(jobId).options });
  } catch (error) {
    console.error('Error starting batch job:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/progress/:jobId', (req, res) => {
  const { jobId } = req.params;
  const includeItems = req.query.includeItems === 'true';
  const job = batchManager.getJob(jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  // Security: restrict who can consume SSE progress
  const appOrigin = req.app.get('APP_ORIGIN') || process.env.APP_ORIGIN;
  if (appOrigin) {
    const requestOrigin = req.get('origin');
    if (requestOrigin && requestOrigin !== appOrigin) {
      return res.status(403).json({ error: 'Forbidden origin for progress stream' });
    }
    res.setHeader('Access-Control-Allow-Origin', appOrigin);
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });

  const snapshot = () => {
    const latest = batchManager.getJob(jobId);
    if (!latest) return null;
    return {
      jobId: latest.id,
      status: latest.status,
      stats: latest.stats,
      items: includeItems ? latest.queue : undefined,
      createdAt: latest.createdAt,
      startedAt: latest.startedAt,
      completedAt: latest.completedAt
    };
  };

  const writeSnapshot = () => {
    const data = snapshot();
    if (!data) return;
    res.write(`event: job-update\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  writeSnapshot();

  const events = [];
  const register = (eventName) => {
    const handler = (payload) => {
      if (payload?.jobId === jobId) {
        writeSnapshot();
      }
    };
    batchManager.on(eventName, handler);
    events.push({ eventName, handler });
  };

  ['jobStarted', 'jobCompleted', 'jobPaused', 'jobResumed', 'jobCancelled', 'itemStatusChanged'].forEach(register);

  const heartbeat = setInterval(() => {
    if (!res.destroyed) {
      res.write(': heartbeat\n\n');
    } else {
      clearInterval(heartbeat);
    }
  }, 30000);

  req.on('close', () => {
    clearInterval(heartbeat);
    events.forEach(({ eventName, handler }) => batchManager.off(eventName, handler));
  });
});

router.get('/status/:jobId', (req, res) => {
  const job = batchManager.getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json({
    jobId: job.id,
    status: job.status,
    stats: job.stats,
    items: req.query.includeItems === 'true' ? job.queue : undefined,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt
  });
});

router.post('/pause/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = batchManager.getJob(jobId);
  if (!job) {
    return res.status(404).json({ success: false, error: 'Job not found' });
  }
  if (TERMINAL_STATUSES.has(job.status)) {
    return res.status(409).json({ success: false, error: 'Job can no longer be paused' });
  }
  if (job.status === JOB_STATUS.PAUSED) {
    return res.json({ success: true, jobId, status: job.status });
  }

  try {
    batchManager.pauseJob(jobId);
    res.json({ success: true, jobId, status: JOB_STATUS.PAUSED });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/resume/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = batchManager.getJob(jobId);
  if (!job) {
    return res.status(404).json({ success: false, error: 'Job not found' });
  }
  if (TERMINAL_STATUSES.has(job.status)) {
    return res.status(409).json({ success: false, error: 'Job cannot be resumed' });
  }
  if (job.status === JOB_STATUS.PROCESSING && !job.controls.paused) {
    return res.json({ success: true, jobId, status: job.status });
  }

  try {
    batchManager.resumeJob(jobId);
    res.json({ success: true, jobId, status: JOB_STATUS.PROCESSING });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/cancel/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = batchManager.getJob(jobId);
  if (!job) {
    return res.status(404).json({ success: false, error: 'Job not found' });
  }
  if (TERMINAL_STATUSES.has(job.status)) {
    return res.status(409).json({ success: false, error: 'Job is already finished' });
  }

  try {
    batchManager.cancelJob(jobId);
    res.json({ success: true, jobId, status: JOB_STATUS.CANCELLED });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/jobs', (req, res) => {
  res.json({ jobs: batchManager.getAllJobs() });
});

router.delete('/job/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = batchManager.getJob(jobId);
  if (!job) {
    return res.status(404).json({ success: false, error: 'Job not found' });
  }
  if (TERMINAL_STATUSES.has(job.status)) {
    return res.status(409).json({ success: false, error: 'Job can no longer be deleted' });
  }

  try {
    batchManager.deleteJob(jobId);
    res.json({ success: true, jobId });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
