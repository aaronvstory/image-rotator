const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const {
  JSON_SUFFIXES,
  TXT_SUFFIXES
} = require('./skip-detector');
const { validateOCRPath } = require('../utils/path-utils');

async function writeFileAtomic(filePath, content) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });

  // Use a unique temp directory per write to avoid collisions across concurrent calls.
const tmpBase = await fs.mkdtemp(path.join(dir, '.ocr-tmp-'));
const tempPath = path.join(tmpBase, `${path.basename(filePath)}.tmp`);
const handle = await fs.open(tempPath, 'wx');

  try {
    const payload = (typeof content === 'string')
      ? content
      : JSON.stringify(content);

    await handle.writeFile(payload, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }

  // Atomic replace into final location; best-effort cleanup on failure.
  try {
    await fs.rename(tempPath, filePath);
} catch (error) {
  if (error && error.code === 'EXDEV') {
    try {
      await fs.copyFile(tempPath, filePath);
    } finally {
      try { await fs.unlink(tempPath); } catch {}
    }
  } else {
    try { await fs.unlink(tempPath); } catch {}
    throw error;
  }
}

  // Best-effort cleanup of the unique temp directory.
  try {
    await fs.rmdir(tmpBase);
  } catch {
    // ignore; non-fatal
  }
}

function buildPaths(imagePath, suffixes) {
  const normalizedOriginal = path.normalize(imagePath);
  const ext = path.extname(normalizedOriginal);
  const base = ext ? normalizedOriginal.slice(0, -ext.length) : normalizedOriginal;
  const candidates = new Set();

  suffixes.forEach((suffix) => {
    candidates.add(path.normalize(`${base}${suffix}`));
    if (suffix.startsWith('.ocr')) {
      candidates.add(path.normalize(`${normalizedOriginal}${suffix}`));
    }
  });

  return Array.from(candidates);
}

async function saveJSONVariants(paths, data) {
  const payload = JSON.stringify(data, null, 2);
  for (const target of paths) {
    await writeFileAtomic(target, payload);
  }
  return paths[0];
}

async function saveTxtVariants(paths, data) {
  const lines = [
    `OCR RESULTS FOR: ${path.basename(data.imagePath || 'image')}`,
    `Processed At: ${data.processedAt || new Date().toISOString()}`,
    ''
  ];
  Object.entries(data)
    .filter(([key, value]) => value !== undefined && value !== null && typeof key === 'string')
    .forEach(([key, value]) => {
      // Serialize objects to JSON to prevent '[object Object]' in output
      const displayValue = (typeof value === 'object' && value !== null)
        ? JSON.stringify(value)
        : value;
      lines.push(`${key}: ${displayValue}`);
    });

  const payload = lines.join('\n');
  for (const target of paths) {
    await writeFileAtomic(target, payload);
  }
  return paths[0];
}

async function pathExists(candidate) {
  try {
    await fs.access(candidate);
    return true;
  } catch {
    return false;
  }
}

async function validateTargets(paths = [], imageDir, suffixes) {
  if (!imageDir) return [];
  const valid = [];
  for (const candidate of paths) {
    const check = await validateOCRPath(candidate, imageDir, suffixes);
    if (check?.valid && check.path) {
      valid.push(check.path);
    }
  }
  return valid;
}

async function saveOCRResults(imagePath, result, options = {}) {
  const {
    outputFormat = ['json', 'txt'],
    overwrite = 'skip'
  } = options;

  const configuredRoot = options.imageDir || process.env.IMAGE_DIR;
  if (!configuredRoot) {
    throw new Error('IMAGE_DIR is not configured for OCR result saving');
  }

  let imageDir;
  try {
    imageDir = await fs.realpath(path.resolve(String(configuredRoot)));
  } catch (error) {
    throw new Error('IMAGE_DIR is not accessible for OCR result saving');
  }

  const formats = Array.isArray(outputFormat) && outputFormat.length
    ? outputFormat.map((fmt) => fmt.toLowerCase())
    : ['json', 'txt'];
  const overwriteMode = overwrite === 'suffix'
    ? 'suffix'
    : overwrite === 'overwrite'
      ? 'overwrite'
      : 'skip';
  const files = {};

  const pickTargets = async (paths, suffixes) => {
    const validated = await validateTargets(paths, imageDir, suffixes);
    if (!validated.length) return [];

    // In 'suffix' mode, prefer the first non-existing validated candidate.
    // If all exist, fall back to the last one so caller explicitly overwrites that canonical suffix.
    if (overwriteMode === 'suffix') {
      for (const candidate of validated) {
        const exists = await pathExists(candidate);
        if (!exists) return [candidate];
      }
      return [validated[validated.length - 1]];
    }

    if (overwriteMode === 'overwrite') {
      return [validated[0]];
    }

    // 'skip' mode: write only when a new target is available
    for (const candidate of validated) {
      const exists = await pathExists(candidate);
      if (!exists) {
        return [candidate];
      }
    }
    return [];
  };

  if (formats.includes('json')) {
    const jsonPaths = buildPaths(imagePath, JSON_SUFFIXES);
    const targets = await pickTargets(jsonPaths, JSON_SUFFIXES);
    if (targets.length) {
      files.json = await saveJSONVariants(targets, result);
    }
  }

  if (formats.includes('txt')) {
    const txtPaths = buildPaths(imagePath, TXT_SUFFIXES);
    const targets = await pickTargets(txtPaths, TXT_SUFFIXES);
    if (targets.length) {
      files.txt = await saveTxtVariants(targets, result);
    }
  }

  return { files };
}

module.exports = {
  saveOCRResults,
  writeFileAtomic
};

