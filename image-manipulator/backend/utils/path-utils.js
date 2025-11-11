const path = require('path');

/**
 * Checks whether `child` path is inside `parent` path (or equal).
 * Returns true when `child` is within `parent`, false otherwise.
 */
function isPathInside(child, parent) {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

/**
 * Resolves an image path (absolute or relative) against the configured image directory.
 * Returns the absolute path when it's inside the directory, or null if invalid.
 */
function resolveImagePath(imagePath, imageDir) {
  if (!imageDir || typeof imagePath !== 'string') {
    return null;
  }
  const root = path.resolve(path.normalize(imageDir));
  const normalizedInput = path.normalize(imagePath);
  const abs = path.isAbsolute(normalizedInput)
    ? path.resolve(normalizedInput)
    : path.resolve(root, normalizedInput);
  return isPathInside(abs, root) ? abs : null;
}

/**
 * Validates an OCR results file path (`fp`) against the configured image directory
 * and allowed filename suffixes. Returns an object with `valid` and either `path`
 * (absolute normalized filepath) or `error` message.
 */
function validateOCRPath(fp, imageDir, validSuffixes) {
  if (!imageDir) {
    return { valid: false, error: 'No image directory configured' };
  }
  const root = path.resolve(path.normalize(imageDir));
  const abs = path.resolve(path.normalize(fp));
  if (!isPathInside(abs, root)) {
    return { valid: false, error: 'Path must be within image directory' };
  }
  const name = path.basename(abs);
  const matchesSuffix = validSuffixes.some((suffix) =>
    name.toLowerCase().endsWith(suffix)
  );
  if (!matchesSuffix) {
    return { valid: false, error: 'Invalid OCR results file' };
  }
  return { valid: true, path: abs };
}

module.exports = {
  isPathInside,
  resolveImagePath,
  validateOCRPath
};
