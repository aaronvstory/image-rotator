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
  VALID_RESULT_SUFFIXES
} = require('./image-manipulator/backend/services/skip-detector');
const { writeFileAtomic } = require('./image-manipulator/backend/services/result-saver');

const app = express();
const PORT = process.env.PORT || 3001;

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

async function scanImagesRecursively(dirPath) {
  const acc = [];
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dirPath, e.name);
      if (e.isDirectory()) { acc.push(...await scanImagesRecursively(full)); continue; }
      if (!isImageFile(e.name)) continue;
      const rel = path.relative(IMAGE_DIR, full);
      acc.push({ filename: e.name, fullPath: full, relativePath: rel, directory: path.dirname(rel), hasOCRResults: await hasOCRResults(full) });
    }
  } catch (e) { console.error('scan error', e.message); }
  return acc;
}

async function generateThumbnail(p) { return sharp(p).resize(150,150,{fit:'cover',position:'center'}).jpeg({quality:85}).toBuffer(); }
async function generatePreview(p) { return sharp(p).resize(1200,900,{fit:'inside',withoutEnlargement:false}).jpeg({quality:95}).toBuffer(); }

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

function isPathInside(child, parent) {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function validateOCRPath(fp) {
  if (!IMAGE_DIR) return { valid: false, error: 'No image directory configured' };
  const root = path.resolve(path.normalize(IMAGE_DIR));
  const abs = path.resolve(path.normalize(fp));
  if (!isPathInside(abs, root)) {
    return { valid: false, error: 'Path must be within image directory' };
  }
  const name = path.basename(abs);
  const matchesSuffix = VALID_RESULT_SUFFIXES.some((suffix) =>
    name.toLowerCase().endsWith(suffix)
  );
  if (!matchesSuffix) {
    return { valid: false, error: 'Invalid OCR results file' };
  }
  return { valid: true, path: abs };
}

app.get('/api/directory', (req,res)=> res.json({success:true,directory:IMAGE_DIR}));

app.post('/api/directory', async (req,res)=>{ const {directory}=req.body||{}; if(!directory) return res.status(400).json({success:false,error:'Directory path is required'}); try{ await fs.access(directory); const s=await fs.stat(directory); if(!s.isDirectory()) return res.status(400).json({success:false,error:'Path is not a directory'}); IMAGE_DIR=directory; app.set('IMAGE_DIR', IMAGE_DIR); res.json({success:true,directory:IMAGE_DIR}); } catch { return res.status(400).json({success:false,error:'Directory does not exist or is not accessible'}); }});

app.get('/api/images', async (req, res) => {
  if (!IMAGE_DIR) {
    return res.json({ success: true, count: 0, images: [], directory: null });
  }
  const images = await scanImagesRecursively(IMAGE_DIR);
  res.json({ success: true, count: images.length, images, directory: IMAGE_DIR });
});

app.get('/api/thumbnail/:imagePath(*)', async (req, res) => {
  if (!IMAGE_DIR) {
    return res.status(400).json({ error: 'Image directory not set' });
  }
  const full = path.resolve(path.join(IMAGE_DIR, req.params.imagePath));
  if (!isPathInside(full, path.resolve(IMAGE_DIR))) {
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
  if (!isPathInside(full, path.resolve(IMAGE_DIR))) {
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
  if (!isPathInside(full, path.resolve(IMAGE_DIR))) {
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

app.get('/api/ocr-results', async (req,res)=>{ const filePath=req.query.path; const isRaw=req.query.raw==='true'; if(!filePath) return res.status(400).json({error:'Path parameter required'}); const v=validateOCRPath(filePath); if(!v.valid) return res.status(403).json({error:v.error}); try{ const content=await fs.readFile(v.path,'utf-8'); if(isRaw) return res.type('text/plain').send(content); res.json(JSON.parse(content)); } catch { res.status(500).json({error:'Failed to read OCR results'}); } });

app.post('/api/ocr-results/save', async (req,res)=>{ const {path:fp,content}=req.body||{}; if(!fp || typeof content!=='string') return res.status(400).json({error:'Path and content required'}); const v=validateOCRPath(fp); if(!v.valid) return res.status(403).json({error:v.error}); const ext=path.extname(v.path).toLowerCase(); let payload=content; if(ext==='.json'){ try{ const parsed=JSON.parse(content); payload=JSON.stringify(parsed,null,2); } catch (error){ return res.status(400).json({error:'Invalid JSON content'}); } } try{ await writeFileAtomic(v.path,payload); res.json({success:true}); } catch (error){ console.error('Failed to save OCR results', error); res.status(500).json({error:'Failed to save OCR results'}); } });

app.get('/api/ocr/has/:imagePath(*)', async (req, res) => {
  if (!IMAGE_DIR) return res.json({ success: true, has: false });
  const rootDir = path.resolve(path.normalize(IMAGE_DIR));
  const requestedPath = path.resolve(path.join(IMAGE_DIR, req.params.imagePath || ''));
  if (!isPathInside(requestedPath, rootDir)) {
    return res.status(403).json({ success: false, error: 'Image not within configured directory' });
  }
  try {
    const files = await checkResultFiles(requestedPath);
    res.json({ success: true, has: files.json || files.txt });
  } catch (error) {
    console.error('Error checking OCR files', error);
    res.status(500).json({ success: false, error: 'Failed to check OCR files' });
  }
});

app.use('/api/batch', batchRoutes);

app.listen(PORT,'0.0.0.0',()=>{ console.log(`\nWSL Functional Base server running at http://localhost:${PORT}`); console.log('Rollback tag: v1-polished-ui'); });


