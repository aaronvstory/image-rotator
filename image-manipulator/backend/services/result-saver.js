const fs = require('fs').promises;
const path = require('path');
const {
  JSON_SUFFIXES,
  TXT_SUFFIXES
} = require('./skip-detector');
const { validateOCRPath } = require('../utils/path-utils');

async function writeFileAtomic(filePath, content) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const tempPath = `${filePath}.tmp`;
  await fs.writeFile(tempPath, content, 'utf8');
  try {
    await fs.rename(tempPath, filePath);
  } catch (error) {
    if (error.code === 'EXDEV') {
      await fs.copyFile(tempPath, filePath);
      await fs.unlink(tempPath);
    } else {
      await fs.unlink(tempPath).catch(() => {});
      throw error;
    }
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
      lines.push(`${key}: ${value}`);
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
    overwrite = 'skip',
    imageDir = process.env.IMAGE_DIR || null
  } = options;

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

    if (overwriteMode === 'suffix') {
      return [validated[validated.length - 1]];
    }
    if (overwriteMode === 'overwrite') {
      return [validated[0]];
    }

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

