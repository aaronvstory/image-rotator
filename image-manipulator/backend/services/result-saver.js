const fs = require('fs').promises;
const path = require('path');
const {
  JSON_SUFFIXES,
  TXT_SUFFIXES
} = require('./skip-detector');

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
  const ext = path.extname(imagePath);
  const base = ext ? imagePath.slice(0, -ext.length) : imagePath;
  return suffixes.map((suffix) => path.normalize(`${base}${suffix}`));
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

async function saveOCRResults(imagePath, result, options = {}) {
  const formats = options.outputFormat || ['json', 'txt'];
  const files = {};

  if (formats.includes('json')) {
    const jsonPaths = buildPaths(imagePath, JSON_SUFFIXES);
    files.json = await saveJSONVariants(jsonPaths, result);
  }

  if (formats.includes('txt')) {
    const txtPaths = buildPaths(imagePath, TXT_SUFFIXES);
    files.txt = await saveTxtVariants(txtPaths, result);
  }

  return { files };
}

module.exports = {
  saveOCRResults,
  writeFileAtomic
};
