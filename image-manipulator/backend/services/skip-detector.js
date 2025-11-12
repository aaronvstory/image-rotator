const fs = require('fs').promises;
const path = require('path');

const JSON_SUFFIXES = ['_ocr_results.json', '.ocr.json'];
const TXT_SUFFIXES = ['_ocr_results.txt', '.ocr.txt'];
const VALID_RESULT_SUFFIXES = [...JSON_SUFFIXES, ...TXT_SUFFIXES];

function stripExtension(filePath) {
  const ext = path.extname(filePath);
  return ext ? filePath.slice(0, -ext.length) : filePath;
}

function getResultFileCandidates(imagePath) {
  const base = stripExtension(imagePath);
  return JSON_SUFFIXES.map((jsonSuffix, index) => ({
    json: path.normalize(`${base}${jsonSuffix}`),
    txt: path.normalize(`${base}${TXT_SUFFIXES[index] || TXT_SUFFIXES[0]}`)
  }));
}

async function checkResultFiles(imagePath) {
  const candidates = getResultFileCandidates(imagePath);
  const results = { json: null, txt: null };

  for (const candidate of candidates) {
    if (!results.json) {
      try {
        await fs.access(candidate.json);
        results.json = candidate.json;
      } catch {
        /* ignore */
      }
    }
    if (!results.txt) {
      try {
        await fs.access(candidate.txt);
        results.txt = candidate.txt;
      } catch {
        /* ignore */
      }
    }
    if (results.json && results.txt) break;
  }

  return results;
}

async function shouldSkipImage(imagePath, options = {}) {
  const overwriteMode = options.overwrite || 'skip';
  if (overwriteMode === 'overwrite') return false;
  if (overwriteMode === 'suffix') return false;

  const existing = await checkResultFiles(imagePath);
  return Boolean(existing.json || existing.txt);
}

module.exports = {
  checkResultFiles,
  shouldSkipImage,
  getResultFileCandidates,
  JSON_SUFFIXES,
  TXT_SUFFIXES,
  VALID_RESULT_SUFFIXES
};
