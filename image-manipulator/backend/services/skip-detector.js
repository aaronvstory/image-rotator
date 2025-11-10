const fs = require('fs').promises;
const path = require('path');

const JSON_SUFFIX = '_ocr_results.json';
const TXT_SUFFIX = '_ocr_results.txt';

function buildResultPaths(imagePath) {
  const ext = path.extname(imagePath);
  const base = ext ? imagePath.slice(0, -ext.length) : imagePath;
  return {
    json: `${base}${JSON_SUFFIX}`,
    txt: `${base}${TXT_SUFFIX}`
  };
}

async function checkResultFiles(imagePath) {
  const targets = buildResultPaths(imagePath);
  const results = { json: false, txt: false };

  await Promise.all(
    Object.entries(targets).map(async ([key, filePath]) => {
      try {
        await fs.access(filePath);
        results[key] = true;
      } catch {
        results[key] = false;
      }
    })
  );

  return results;
}

async function shouldSkipImage(imagePath, options = {}) {
  const overwriteMode = options.overwrite || 'skip';
  if (overwriteMode === 'overwrite') return false;

  const existing = await checkResultFiles(imagePath);
  if (overwriteMode === 'suffix') {
    // suffix mode always writes a new file with incremented suffix, so never skip
    return false;
  }

  return existing.json || existing.txt;
}

module.exports = {
  checkResultFiles,
  shouldSkipImage
};
