const path = require('path');
const fs = require('fs').promises;

/**
 * Canonicalize a filesystem path using realpath, falling back to a resolved absolute path if the target does not exist.
 *
 * Returns null for non-string or empty inputs.
 *
 * @param {string} targetPath - The path to canonicalize.
 * @returns {Promise<string|null>} The canonical absolute path; the realpath when available, or the resolved absolute path if the file does not exist, or `null` for invalid input.
 * @throws {Error} Rethrows errors from `fs.realpath` except when the error code is `ENOENT`.
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
 * Determine whether a child filesystem path is inside or equal to a parent path.
 * @param {string} child - Path to test.
 * @param {string} parent - Directory path to test against.
 * @returns {boolean} `true` if `child` resides inside or is equal to `parent`, `false` otherwise.
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
 * Resolve an image file path against a configured image directory and ensure it remains inside that directory.
 * @param {string} imagePath - The image path to resolve; may be absolute or relative.
 * @param {string} imageDir - The root image directory to resolve relative paths against.
 * @returns {string|null} The absolute path that lies inside `imageDir`, or `null` if the path is invalid or outside the directory.
 */
async function resolveImagePath(imagePath, imageDir) {
  if (!imageDir || typeof imagePath !== 'string') {
    return null;
  }
  try {
    const rootReal = await fs.realpath(path.resolve(String(imageDir)));
    const normalizedInput = path.normalize(imagePath);
    const candidate = path.isAbsolute(normalizedInput)
      ? normalizedInput
      : path.resolve(rootReal, normalizedInput);
    const abs = await fs.realpath(candidate).catch(async (e) => {
      if (e && e.code === 'ENOENT') {
        const parentReal = await fs.realpath(path.dirname(candidate)).catch(() => null);
        return parentReal ? path.join(parentReal, path.basename(candidate)) : path.resolve(candidate);
      }
      throw e;
    });
    return (await isPathInside(abs, rootReal)) ? abs : null;
  } catch {
    return null;
  }
}

/**
 * Validate an OCR results file path against a configured image directory and allowed filename suffixes.
 *
 * @param {string} fp - The file path to validate (can be relative or absolute).
 * @param {string} imageDir - The configured image directory that `fp` must reside within.
 * @param {string[]} [validSuffixes=[]] - Optional list of allowed filename suffixes (case-insensitive).
 * @returns {{ valid: boolean, path?: string, error?: string }} If valid, `valid` is `true` and `path` is the resolved absolute path; otherwise `valid` is `false` and `error` contains a short message.
 */
async function validateOCRPath(fp, imageDir, validSuffixes = []) {
  if (!imageDir) {
    return { valid: false, error: 'No image directory configured' };
  }
  if (typeof fp !== 'string' || fp.trim() === '') {
    return { valid: false, error: 'Invalid OCR results file' };
  }
  try {
    const rootReal = await fs.realpath(path.resolve(String(imageDir)));
    const parentReal = await toRealOrResolved(path.resolve(path.dirname(fp)));
    const abs = path.join(parentReal, path.basename(fp));
    const inside = await isPathInside(abs, rootReal);
    if (!inside) {
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
