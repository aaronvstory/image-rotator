const fs = require('fs').promises;
const path = require('path');

const JSON_SUFFIXES = ['_ocr_results.json', '.ocr.json'];
const TXT_SUFFIXES = ['_ocr_results.txt', '.ocr.txt'];
const VALID_RESULT_SUFFIXES = Array.from(new Set([...JSON_SUFFIXES, ...TXT_SUFFIXES]));

/**
 * Remove the file extension from a file path.
 * @param {string} filePath - The path of the file.
 * @returns {string} The file path without its trailing extension; returns the original path if no extension is present.
 */
function stripExtension(filePath) {
  const ext = path.extname(filePath);
  return ext ? filePath.slice(0, -ext.length) : filePath;
}

/**
 * Build a deduplicated list of normalized candidate file paths by appending each suffix to a base path and, if provided, an original path.
 * @param {string} basePath - Base file path (without suffix) to which suffixes will be appended.
 * @param {string|undefined} originalPath - Optional alternate path to also append suffixes to.
 * @param {string[]} suffixes - Array of suffix strings to append (including leading dot or separator as needed).
 * @returns {string[]} An array of unique, normalized file paths generated from the provided base and original paths with each suffix. 
 */
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

/**
 * Produce candidate result file paths (JSON and TXT) derived from an image path.
 * @param {string} imagePath - Path to the image file (may include or omit an extension).
 * @returns {{json: string[], txt: string[]}} An object with `json` and `txt` arrays containing normalized candidate file paths for JSON and TXT result files respectively.
 */
function getResultFileCandidates(imagePath) {
  const normalizedOriginal = path.normalize(imagePath);
  const base = stripExtension(normalizedOriginal);
  return {
    json: buildCandidatePaths(base, normalizedOriginal, JSON_SUFFIXES),
    txt: buildCandidatePaths(base, normalizedOriginal, TXT_SUFFIXES)
  };
}

/**
 * Check for existing result files associated with an image and return the first accessible JSON and TXT paths.
 *
 * Resolves the provided imagePath against imageDir (or the IMAGE_DIR environment variable) and, only if a root is available,
 * probes candidate result file locations. Probing is not performed when no root is set; in that case both fields are `null`.
 *
 * @param {string} imagePath - Path or name of the image to inspect (may be relative).
 * @param {string} [imageDir] - Optional root directory to restrict filesystem probing; if omitted, `process.env.IMAGE_DIR` is used.
 * @returns {{ json: string|null, txt: string|null }} The first found JSON and TXT result file paths, or `null` for each type if none were found or probing was not allowed.
 */
async function checkResultFiles(imagePath, imageDir) {
  // Security: Validate path is within IMAGE_DIR before probing filesystem
  const root = imageDir || process.env.IMAGE_DIR;
  if (root) {
    const { resolveImagePath } = require('../utils/path-utils');
    const resolved = await resolveImagePath(imagePath, root);
    if (!resolved) {
      return { json: null, txt: null };
    }
    // Use resolved path for candidate generation
    const { json: jsonCandidates, txt: txtCandidates } = getResultFileCandidates(resolved);
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

  // Require IMAGE_DIR to prevent filesystem probing
  return { json: null, txt: null };
}

/**
 * Decides whether processing of an image should be skipped.
 *
 * Checks configured overwrite behavior and, if not forcing overwrite, probes for existing
 * JSON or TXT result files for the given image to determine if processing should be skipped.
 *
 * @param {string} imagePath - Path to the image to check for existing result files.
 * @param {Object} [options] - Optional settings.
 * @param {'skip'|'overwrite'|'suffix'} [options.overwrite='skip'] - Overwrite mode; `'overwrite'` and `'suffix'` disable skipping.
 * @param {string} [options.imageDir] - Optional root directory used when resolving and probing result file paths.
 * @returns {boolean} `true` if processing should be skipped because a result file exists, `false` otherwise.
 */
async function shouldSkipImage(imagePath, options = {}) {
  const overwriteMode = options.overwrite || 'skip';
  if (overwriteMode === 'overwrite') return false;
  if (overwriteMode === 'suffix') return false;

  const existing = await checkResultFiles(imagePath, options.imageDir);
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