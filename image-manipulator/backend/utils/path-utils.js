const path = require('path');
const fs = require('fs').promises;

/**
 * Attempt to canonicalize a path via realpath; fall back to the resolved path when ENOENT.
 * This lets us validate paths that might not exist yet while still preventing symlink escapes.
 * @param {string} targetPath
 * @returns {Promise<string|null>}
 */
async function toRealOrResolved(targetPath) {
  if (typeof targetPath !== 'string') return null;
  const trimmed = targetPath.trim();
  if (!trimmed) return null;
  const normalized = path.resolve(path.normalize(trimmed));
  try {
    return await fs.realpath(normalized);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return normalized;
    }
    throw error;
  }
}

/**
 * Checks whether `child` path is inside `parent` path (or equal).
 * Returns true when `child` is within `parent`, false otherwise.
 */
async function isPathInside(child, parent) {
  if (!child || !parent) return false;
  try {
    const [childPath, parentPath] = await Promise.all([
      toRealOrResolved(child),
      toRealOrResolved(parent)
    ]);
    if (!childPath || !parentPath) return false;
    const relative = path.relative(parentPath, childPath);
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
  } catch {
    return false;
  }
}

/**
 * Resolves an image path (absolute or relative) against the configured image directory.
 * Returns the absolute path when it's inside the directory, or null if invalid.
 */
async function resolveImagePath(imagePath, imageDir) {
  if (!imageDir || typeof imagePath !== 'string') {
    return null;
  }
  try {
    const root = await toRealOrResolved(imageDir);
    if (!root) return null;

    const normalizedInput = path.normalize(imagePath);
    const candidate = path.isAbsolute(normalizedInput)
      ? normalizedInput
      : path.resolve(root, normalizedInput);
    const abs = await toRealOrResolved(candidate);
    if (!abs) return null;
    return (await isPathInside(abs, root)) ? abs : null;
  } catch {
    return null;
  }
}

/**
 * Validates an OCR results file path (`fp`) against the configured image directory
 * and allowed filename suffixes. Returns an object with `valid` and either `path`
 * (absolute normalized filepath) or `error` message.
 */
async function validateOCRPath(fp, imageDir, validSuffixes = []) {
  if (!imageDir) {
    return { valid: false, error: 'No image directory configured' };
  }
  if (typeof fp !== 'string' || fp.trim() === '') {
    return { valid: false, error: 'Invalid OCR results file' };
  }
  try {
    const root = await toRealOrResolved(imageDir);
    const abs = await toRealOrResolved(fp);
    if (!root || !abs || !(await isPathInside(abs, root))) {
      return { valid: false, error: 'Path must be within image directory' };
    }

    const normalizedSuffixes = Array.isArray(validSuffixes)
      ? validSuffixes.map((suffix) => String(suffix || '').toLowerCase())
      : [];
    const name = path.basename(abs).toLowerCase();
    const matchesSuffix = normalizedSuffixes.some((suffix) => suffix && name.endsWith(suffix));

    if (!matchesSuffix) {
      return { valid: false, error: 'Invalid OCR results file' };
    }
    return { valid: true, path: abs };
  } catch {
    return { valid: false, error: 'Failed to validate OCR path' };
  }
}

module.exports = {
  toRealOrResolved,
  isPathInside,
  resolveImagePath,
  validateOCRPath,
};
