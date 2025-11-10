const fs = require('fs').promises;
const path = require('path');

const JSON_SUFFIXES = ['_ocr_results.json', '.ocr.json'];
const TXT_SUFFIXES = ['_ocr_results.txt', '.ocr.txt'];
const VALID_RESULT_SUFFIXES = Array.from(new Set([...JSON_SUFFIXES, ...TXT_SUFFIXES]));

function stripExtension(filePath) {
  const ext = path.extname(filePath);
  return ext ? filePath.slice(0, -ext.length) : filePath;
}

function buildCandidatePaths(basePath, originalPath, suffixes) {
  const candidates = new Set();
  suffixes.forEach((suffix) => {
    candidates.add(path.normalize(`${basePath}${suffix}`));
    if (originalPath) {
      candidates.add(path.normalize(`${originalPath}${suffix}`));
    }
  });
  return Array.from(candidates);
}

function getResultFileCandidates(imagePath) {
  const normalizedOriginal = path.normalize(imagePath);
  const base = stripExtension(normalizedOriginal);
  return {
    json: buildCandidatePaths(base, normalizedOriginal, JSON_SUFFIXES),
    txt: buildCandidatePaths(base, normalizedOriginal, TXT_SUFFIXES)
  };
}

async function checkResultFiles(imagePath) {
  const { json: jsonCandidates, txt: txtCandidates } = getResultFileCandidates(imagePath);
  const results = { json: null, txt: null };

  for (const candidate of jsonCandidates) {
    try {
      await fs.access(candidate);
      results.json = candidate;
      break;
    } catch {
      /* ignore */
    }
  }

  for (const candidate of txtCandidates) {
    try {
      await fs.access(candidate);
      results.txt = candidate;
      break;
    } catch {
      /* ignore */
    }
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
