const fs = require('fs').promises;
const path = require('path');

async function writeFileAtomic(filePath, content) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const tempPath = `${filePath}.tmp`;
  await fs.writeFile(tempPath, content, 'utf8');
  await fs.rename(tempPath, filePath);
}

function buildPaths(imagePath) {
  const ext = path.extname(imagePath);
  const base = ext ? imagePath.slice(0, -ext.length) : imagePath;
  return {
    json: `${base}_ocr_results.json`,
    txt: `${base}_ocr_results.txt`
  };
}

async function saveOCRResults(imagePath, result, options = {}) {
  const targets = buildPaths(imagePath);
  const formats = options.outputFormat || ['json', 'txt'];
  const files = {};

  if (formats.includes('json')) {
    await writeFileAtomic(targets.json, JSON.stringify(result, null, 2));
    files.json = targets.json;
  }

  if (formats.includes('txt')) {
    const lines = [
      `OCR RESULTS FOR: ${path.basename(imagePath)}`,
      `Processed At: ${result.processedAt || new Date().toISOString()}`,
      ''
    ];
    Object.entries(result)
      .filter(([key]) => typeof key === 'string')
      .forEach(([key, value]) => {
        if (value === undefined || value === null) return;
        lines.push(`${key}: ${value}`);
      });

    await writeFileAtomic(targets.txt, lines.join('\n'));
    files.txt = targets.txt;
  }

  return { files };
}

module.exports = {
  saveOCRResults
};
