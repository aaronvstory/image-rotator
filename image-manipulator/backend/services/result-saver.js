const fs = require('fs').promises;
const path = require('path');
const {
  JSON_SUFFIXES,
  TXT_SUFFIXES
} = require('./skip-detector');
const { validateOCRPath } = require('../utils/path-utils');

/**
 * Atomically writes content to the given file path, creating parent directories as needed and replacing any existing file.
 *
 * Writes the provided string or the JSON serialization of a non-string value to a uniquely-created temporary file and then atomically replaces the destination file. Handles cross-device copy fallbacks and performs best-effort cleanup of temporary files and directories.
 *
 * @param {string} filePath - Destination file path to write.
 * @param {string|any} content - String content to write, or a value that will be JSON-serialized before writing.
 */
async function writeFileAtomic(filePath, content) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });

  // Use a unique temp directory per write to avoid collisions across concurrent calls.
  const tmpBase = await fs.mkdtemp(path.join(dir, '.ocr-tmp-'));
  const tempPath = path.join(tmpBase, `${path.basename(filePath)}.tmp`);

  // Use exclusive create so we never clobber an existing file at this temp path.
  const handle = await fs.open(tempPath, 'wx');

  try {
    const payload = (typeof content === 'string')
      ? content
      : JSON.stringify(content);

    await handle.writeFile(payload, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }

  // Atomic replace into final location; best-effort cleanup on failure.
  try {
await fs.copyFile(tempPath, filePath, require('fs').constants.COPYFILE_EXCL);
  } catch (error) {
    if (error && error.code === 'EXDEV') {
      try {
        await fs.copyFile(tempPath, filePath);
      } finally {
        try { await fs.unlink(tempPath); } catch { }
      }
    } else {
      try { await fs.unlink(tempPath); } catch { }
      throw error;
    }
  }

  // Best-effort cleanup of the unique temp directory.
  try {
    await fs.rmdir(tmpBase);
  } catch {
    // ignore; non-fatal
  }
}

/**
 * Generate candidate file paths by applying each suffix to the provided image path.
 * @param {string} imagePath - Original image file path.
 * @param {string[]} suffixes - Suffixes to append (for example ".json", ".txt", ".ocr.json"); if a suffix starts with ".ocr", an additional variant using the original file extension is produced.
 * @returns {string[]} Array of normalized, unique candidate file paths.
 */
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

/**
 * Write the provided data as pretty-printed JSON to each target path.
 *
 * Serializes `data` using two-space indentation and writes the resulting JSON to every path in `paths`.
 *
 * @param {string[]} paths - Array of file paths to write the JSON payload to.
 * @param {*} data - Value to serialize to JSON.
 * @returns {string|undefined} The first target path written (`paths[0]`), or `undefined` if `paths` is empty.
 */
async function saveJSONVariants(paths, data) {
  const payload = JSON.stringify(data, null, 2);
  for (const target of paths) {
    await writeFileAtomic(target, payload);
  }
  return paths[0];
}

/**
 * Write OCR results as a plain-text payload to each provided file path.
 *
 * The payload begins with an "OCR RESULTS FOR" header using `data.imagePath` (or "image")
 * and a "Processed At" timestamp (using `data.processedAt` or the current ISO timestamp),
 * followed by each enumerable string key from `data` as `key: value`. Object values are
 * JSON-serialized to preserve their structure.
 *
 * @param {string[]} paths - Target file paths to write the TXT payload to. Each path will be written.
 * @param {Object} data - OCR result data to serialize. Common properties:
 *   - {string} [imagePath] - Original image name or path used in the header.
 *   - {string} [processedAt] - ISO timestamp to include in the header.
 *   - ...other keys containing values to include as `key: value` lines.
 * @returns {string|undefined} The first path from `paths`, or `undefined` if `paths` is empty.
 */
async function saveTxtVariants(paths, data) {
  const lines = [
    `OCR RESULTS FOR: ${path.basename(data.imagePath || 'image')}`,
    `Processed At: ${data.processedAt || new Date().toISOString()}`,
    ''
  ];
  Object.entries(data)
    .filter(([key, value]) => value !== undefined && value !== null && typeof key === 'string')
    .forEach(([key, value]) => {
      // Serialize objects to JSON to prevent '[object Object]' in output
      const displayValue = (typeof value === 'object' && value !== null)
        ? JSON.stringify(value)
        : value;
      lines.push(`${key}: ${displayValue}`);
    });

  const payload = lines.join('\n');
  for (const target of paths) {
    await writeFileAtomic(target, payload);
  }
  return paths[0];
}

/**
 * Determine whether a filesystem path is accessible.
 * @param {string} candidate - Filesystem path to check.
 * @returns {boolean} `true` if the path is accessible, `false` otherwise.
 */
async function pathExists(candidate) {
  try {
    await fs.access(candidate);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate candidate target paths against an image directory and allowed suffixes.
 * @param {string[]} [paths] - Candidate file paths to validate.
 * @param {string} imageDir - The image directory used as the validation base.
 * @param {string[]} suffixes - Allowed suffixes used during validation.
 * @returns {string[]} An array of validated, normalized paths that passed checks; empty if imageDir is not provided or no candidates are valid.
 */
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

/**
 * Save OCR results for an image in configured output formats and return written file paths.
 *
 * Saves the provided OCR result to one or more target files (JSON and/or TXT) under the configured IMAGE_DIR,
 * selecting target paths according to the overwrite policy and writing files atomically.
 *
 * @param {string} imagePath - Path to the source image used to derive target result filenames.
 * @param {object} result - OCR result data to persist; used as the JSON payload and to build text output.
 * @param {object} [options] - Optional settings.
 * @param {string|string[]} [options.outputFormat=['json','txt']] - Desired output formats; accepts 'json' and/or 'txt'.
 * @param {'skip'|'suffix'|'overwrite'} [options.overwrite='skip'] - Overwrite policy: 'skip' (avoid existing targets), 'suffix' (prefer suffixed non-existing target, otherwise overwrite canonical), or 'overwrite' (replace the canonical target).
 * @param {string} [options.imageDir] - Root directory where result files will be saved; falls back to process.env.IMAGE_DIR if not provided.
 * @returns {{files: {json?: string, txt?: string}}} Object containing the paths of the saved files keyed by format.
 * @throws {Error} If IMAGE_DIR is not configured.
 * @throws {Error} If IMAGE_DIR is not accessible (cannot be resolved).
 */
async function saveOCRResults(imagePath, result, options = {}) {
  const {
    outputFormat = ['json', 'txt'],
    overwrite = 'skip'
  } = options;

  const configuredRoot = options.imageDir || process.env.IMAGE_DIR;
  if (!configuredRoot) {
    throw new Error('IMAGE_DIR is not configured for OCR result saving');
  }

  let imageDir;
  try {
    imageDir = await fs.realpath(path.resolve(String(configuredRoot)));
  } catch (error) {
    throw new Error('IMAGE_DIR is not accessible for OCR result saving');
  }

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

    // In 'suffix' mode, prefer the first non-existing validated candidate.
    // If all exist, fall back to the last one so caller explicitly overwrites that canonical suffix.
    if (overwriteMode === 'suffix') {
      for (const candidate of validated) {
        const exists = await pathExists(candidate);
        if (!exists) return [candidate];
      }
      return [validated[validated.length - 1]];
    }

    if (overwriteMode === 'overwrite') {
      return [validated[0]];
    }

    // 'skip' mode: write only when a new target is available
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