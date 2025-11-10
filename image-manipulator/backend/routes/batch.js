/**
 * Batch Processing Routes
 * Handles batch OCR job lifecycle (start/pause/resume/cancel) and SSE progress.
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const { BatchManager } = require('../services/batch-manager');
const { BatchProcessor } = require('../services/batch-processor');

const batchManager = new BatchManager();
const batchProcessor = new BatchProcessor(batchManager);

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

    if (!process.env.OPENROUTER_API_KEY) {
      return res.status(400).json({ success: false, error: 'OCR API key missing (OPENROUTER_API_KEY)' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Items array is required and must not be empty' });
    }

    const isInside = (child, parent) => {
      const rel = path.relative(parent, child);
      return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
    };

    const sanitized = [];
    for (const item of items) {
      const abs = path.resolve(String(item.path || ''));
      if (!isInside(abs, path.resolve(imageRoot))) {
        return res.status(400).json({ success: false, error: `Item path is outside image root: ${item.path}` });
      }
      sanitized.push({
        id: item.id,
        path: abs,
        filename: item.filename || path.basename(abs)
      });
    }

    const jobId = batchManager.createJob(sanitized, options);
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

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*'
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
  try {
    batchManager.pauseJob(req.params.jobId);
    res.json({ success: true, jobId: req.params.jobId });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/resume/:jobId', (req, res) => {
  try {
    batchManager.resumeJob(req.params.jobId);
    res.json({ success: true, jobId: req.params.jobId });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/cancel/:jobId', (req, res) => {
  try {
    batchManager.cancelJob(req.params.jobId);
    res.json({ success: true, jobId: req.params.jobId });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/jobs', (req, res) => {
  res.json({ jobs: batchManager.getAllJobs() });
});

router.delete('/job/:jobId', (req, res) => {
  try {
    batchManager.deleteJob(req.params.jobId);
    res.json({ success: true, jobId: req.params.jobId });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;


