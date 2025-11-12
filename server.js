/**
 * WSL Functional Base Server - Batch OCR + results editing endpoints
 */
require('dotenv').config();
const express = require('express');
const sharp = require('sharp');
const fs = require('fs').promises;
const { constants } = require('fs');
const path = require('path');

// Batch routes (from WSL services)
const batchRoutes = require('./image-manipulator/backend/routes/batch');
const {
  checkResultFiles,
  getResultFileCandidates,
  VALID_RESULT_SUFFIXES
} = require('./image-manipulator/backend/services/skip-detector');
const { writeFileAtomic } = require('./image-manipulator/backend/services/result-saver');
// Shared path utilities for validation and resolution
const { isPathInside, resolveImagePath, validateOCRPath } = require('./image-manipulator/backend/utils/path-utils');

const app = express();
const PORT = Number(process.env.PORT) || 3001;
// Bind to localhost by default for security. Set HOST='0.0.0.0' in .env to expose externally.
const HOST = process.env.HOST || 'localhost';

app.use(express.static('public'));
app.use(express.json());

let IMAGE_DIR = process.env.IMAGE_DIR || null;
app.set('IMAGE_DIR', IMAGE_DIR);
const SUPPORTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.tiff', '.bmp'];

function isImageFile(filename) { return SUPPORTED_EXTENSIONS.includes(path.extname(filename).toLowerCase()); }

async function hasOCRResults(imagePath) {
  const files = await checkResultFiles(imagePath);
  return Boolean(files.json || files.txt);
}

async function scanImagesRecursively(dirPath, opts = {}) {
  const { checkOCRResults = true, ocrCache = new Map() } = opts;
  const acc = [];
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dirPath, e.name);
      if (e.isDirectory()) {
        acc.push(...await scanImagesRecursively(full, { checkOCRResults, ocrCache }));
        continue;
      }
      if (!isImageFile(e.name)) continue;
      const rel = path.relative(IMAGE_DIR, full);

      let hasOCR = false;
      if (checkOCRResults) {
        if (ocrCache.has(full)) {
          hasOCR = ocrCache.get(full);
        } else {
          hasOCR = await hasOCRResults(full);
          ocrCache.set(full, hasOCR);
        }
      }

      acc.push({
        filename: e.name,
        fullPath: full,
        relativePath: rel,
        directory: path.dirname(rel),
        hasOCRResults: hasOCR
      });
    }
  } catch (e) { console.error('scan error', e.message); }
  return acc;
}

async function generateThumbnail(p) { return sharp(p).resize(150, 150, { fit: 'cover', position: 'center' }).jpeg({ quality: 85 }).toBuffer(); }
async function generatePreview(p) { return sharp(p).resize(1200, 900, { fit: 'inside', withoutEnlargement: false }).jpeg({ quality: 95 }).toBuffer(); }

async function rotateImage(p, deg) {
  const max = 3; let last;
  for (let i = 1; i <= max; i++) {
    try {
      await fs.access(p, constants.R_OK | constants.W_OK);
      const buf = await fs.readFile(p);
      const out = await sharp(buf).rotate(deg).toBuffer();
      const tmp = p + '.tmp';
      await fs.writeFile(tmp, out);
      const fd = await fs.open(tmp, 'r+');
      try {
        await fd.sync();
      } finally {
        await fd.close();
      }
      await fs.rename(tmp, p);
      const st = await fs.stat(p);
      if (st.size === 0) throw new Error('Empty file after rotate');
      return true;
    } catch (e) {
      last = e;
      const retryable = ['EBUSY', 'UNKNOWN', 'EACCES'].includes(e.code || '');
      if (i < max && retryable) {
        await new Promise(r => setTimeout(r, 200 * i));
        continue;
      }
      break;
    }
  }
  if (last) throw last;
}


function listCandidatePaths(imagePath, type) {
  const candidates = getResultFileCandidates(imagePath);
  return type === 'txt' ? candidates.txt : candidates.json;
}

app.get('/api/directory', (req, res) => res.json({ success: true, directory: IMAGE_DIR }));

app.post('/api/directory', async (req, res) => { const { directory } = req.body || {}; if (!directory) return res.status(400).json({ success: false, error: 'Directory path is required' }); try { await fs.access(directory); const s = await fs.stat(directory); if (!s.isDirectory()) return res.status(400).json({ success: false, error: 'Path is not a directory' }); IMAGE_DIR = directory; app.set('IMAGE_DIR', IMAGE_DIR); res.json({ success: true, directory: IMAGE_DIR }); } catch { return res.status(400).json({ success: false, error: 'Directory does not exist or is not accessible' }); } });

app.get('/api/images', async (req, res) => {
  if (!IMAGE_DIR) {
    return res.json({ success: true, count: 0, images: [], directory: null });
  }
  const images = await scanImagesRecursively(IMAGE_DIR, {
    checkOCRResults: req.query.checkOCRResults !== 'false',
    ocrCache: new Map()
  });
  res.json({ success: true, count: images.length, images, directory: IMAGE_DIR });
});

app.get('/api/thumbnail/:imagePath(*)', async (req, res) => {
  if (!IMAGE_DIR) {
    return res.status(400).json({ error: 'Image directory not set' });
  }
  const full = path.resolve(path.join(IMAGE_DIR, req.params.imagePath));
  if (!(await isPathInside(full, path.resolve(IMAGE_DIR)))) {
    return res.status(403).json({ error: 'Image not within configured directory' });
  }
  try {
    await fs.access(full);
    const thumb = await generateThumbnail(full);
    res.set({ 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-cache' });
    res.send(thumb);
  } catch {
    res.status(404).json({ error: 'Image not found or thumbnail failed' });
  }
});

app.get('/api/preview/:imagePath(*)', async (req, res) => {
  if (!IMAGE_DIR) {
    return res.status(400).json({ error: 'Image directory not set' });
  }
  const full = path.resolve(path.join(IMAGE_DIR, req.params.imagePath));
  if (!(await isPathInside(full, path.resolve(IMAGE_DIR)))) {
    return res.status(403).json({ error: 'Image not within configured directory' });
  }
  try {
    await fs.access(full);
    const preview = await generatePreview(full);
    res.set({ 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-cache' });
    res.send(preview);
  } catch {
    res.status(404).json({ error: 'Image not found or preview failed' });
  }
});

app.post('/api/rotate', async (req, res) => {
  const { imagePath, degrees } = req.body || {};
  if (!IMAGE_DIR) {
    return res.status(400).json({ success: false, error: 'Image directory not set' });
  }
  if (!imagePath || typeof degrees !== 'number') {
    return res.status(400).json({ success: false, error: 'Missing imagePath or degrees' });
  }
  const full = path.resolve(path.join(IMAGE_DIR, imagePath));
  if (!(await isPathInside(full, path.resolve(IMAGE_DIR)))) {
    return res.status(403).json({ success: false, error: 'Image not within configured directory' });
  }
  try {
    await fs.access(full);
    await rotateImage(full, degrees);
    res.json({ success: true, message: `Image rotated ${degrees} degrees` });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to rotate image' });
  }
});

app.get('/api/ocr-results', async (req, res) => {
  const filePath = req.query.path;
  const imagePathParam = req.query.imagePath;
  const isRaw = req.query.raw === 'true';

  if (!filePath && !imagePathParam) {
    return res.status(400).json({ error: 'Path or imagePath parameter required' });
  }

  try {
    if (filePath) {
      const validation = await validateOCRPath(filePath, IMAGE_DIR, VALID_RESULT_SUFFIXES);
      if (!validation.valid) {
        return res.status(403).json({ error: validation.error });
      }

      const content = await fs.readFile(validation.path, 'utf-8');
      if (isRaw) {
        return res.type('text/plain').send(content);
      }
      const parsed = JSON.parse(content);
      return res.json(parsed);
    }

    const resolvedImagePath = await resolveImagePath(imagePathParam, IMAGE_DIR);
    if (!resolvedImagePath) {
      return res.status(403).json({ error: 'Image not within configured directory' });
    }

    const existing = await checkResultFiles(resolvedImagePath);
    const targetPath = isRaw ? existing.txt : existing.json;
    if (!targetPath) {
      return res.status(404).json({ error: 'OCR results not found' });
    }

    const content = await fs.readFile(targetPath, 'utf-8');
    if (isRaw) {
      return res.type('text/plain').send(content);
    }

    const parsed = JSON.parse(content);
    return res.json(parsed);
  } catch (error) {
    console.error('Failed to read OCR results', error);
    return res.status(500).json({ error: 'Failed to read OCR results' });
  }
});

app.post('/api/ocr-results/save', async (req, res) => {
  const { path: fp, content, type, imagePath } = req.body || {};
  if (typeof content !== 'string') {
    return res.status(400).json({ error: 'Content is required' });
  }

  const mode = type === 'txt' ? 'txt' : 'json';
  let targets = [];

  if (imagePath) {
    const resolvedImagePath = await resolveImagePath(imagePath, IMAGE_DIR);
    if (!resolvedImagePath) {
      return res.status(403).json({ error: 'Image not within configured directory' });
    }

    // Use existing file if present; otherwise choose a single canonical target
    const existing = await checkResultFiles(resolvedImagePath);
    let target;
    if (mode === 'json') {
      target = existing.json || listCandidatePaths(resolvedImagePath, 'json')[0];
    } else {
      target = existing.txt || listCandidatePaths(resolvedImagePath, 'txt')[0];
    }
    const validation = await validateOCRPath(target, IMAGE_DIR, VALID_RESULT_SUFFIXES);
    if (!validation.valid) {
      return res.status(403).json({ error: validation.error });
    }
    targets = [validation.path];
  } else if (fp) {
    const validation = await validateOCRPath(fp, IMAGE_DIR, VALID_RESULT_SUFFIXES);
    if (!validation.valid) {
      return res.status(403).json({ error: validation.error });
    }
    targets = [validation.path];
  } else {
    return res.status(400).json({ error: 'Path or imagePath parameter required' });
  }

  let payload = content;
  if (mode === 'json') {
    try {
      const parsed = JSON.parse(content);
      payload = JSON.stringify(parsed, null, 2);
    } catch (error) {
      return res.status(400).json({ error: 'Invalid JSON content' });
    }
  }

  try {
    // Write exactly one validated file
    await writeFileAtomic(targets[0], payload);
    res.json({ success: true, paths: targets });
  } catch (error) {
    console.error('Failed to save OCR results', error);
    res.status(500).json({ error: 'Failed to save OCR results' });
  }
});

app.get('/api/ocr/has/:imagePath(*)', async (req, res) => {
  if (!IMAGE_DIR) return res.json({ success: true, has: false });
  const rootDir = path.resolve(path.normalize(IMAGE_DIR));
  const requestedPath = path.resolve(path.join(IMAGE_DIR, req.params.imagePath || ''));
  if (!(await isPathInside(requestedPath, rootDir))) {
    return res.status(403).json({ success: false, error: 'Image not within configured directory' });
  }
  try {
    const files = await checkResultFiles(requestedPath);
```suggestion
res.json({ success: true, has: Boolean(files.json || files.txt) });
  } catch (error) {
    console.error('Error checking OCR files', error);
    res.status(500).json({ success: false, error: 'Failed to check OCR files' });
  }
});

app.use('/api/batch', batchRoutes);

app.listen(PORT, HOST, () => {
  console.log(`\nWSL Functional Base server running at http://${HOST}:${PORT}`);
  console.log('Rollback tag: v1-polished-ui');
});





