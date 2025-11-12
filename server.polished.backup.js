// Image Manipulator v2.0 - Express Server with Image Processing
require("dotenv").config();
const express = require("express");
const sharp = require("sharp");
const fs = require("fs").promises;
const { constants } = require("fs");
const path = require("path");

const app = express();
// Allow custom port
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

// Serve static files from public directory
app.use(express.static("public"));
app.use(express.json());

// Configuration - Default target directory for images
// Users can change this through the web interface or set via environment variable
let IMAGE_DIR = process.env.IMAGE_DIR || null;

// Supported image extensions
const SUPPORTED_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".tiff",
  ".bmp",
];

const JOB_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

function isValidJobId(jobId) {
  return typeof jobId === "string" && JOB_ID_PATTERN.test(jobId);
}

function isPathInside(childPath, parentPath) {
  const relative = path.relative(parentPath, childPath);
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

// Check if file is an image
function isImageFile(filename) {
  const ext = path.extname(filename).toLowerCase();
  return SUPPORTED_EXTENSIONS.includes(ext);
}

// Recursively scan directory for images
async function scanImagesRecursively(dirPath) {
  let images = [];

  try {
    const items = await fs.readdir(dirPath, { withFileTypes: true });

    for (const item of items) {
      const fullPath = path.join(dirPath, item.name);

      if (item.isDirectory()) {
        // Recursively scan subdirectories
        const subImages = await scanImagesRecursively(fullPath);
        images.push(...subImages);
      } else if (isImageFile(item.name)) {
        // Add image with relative path info
        const relativePath = path.relative(IMAGE_DIR, fullPath);
        images.push({
          filename: item.name,
          fullPath: fullPath,
          relativePath: relativePath,
          directory: path.dirname(relativePath),
        });
      }
    }
  } catch (error) {
    console.error(`Error scanning directory ${dirPath}:`, error);
  }

  return images;
}

// Generate thumbnail using Sharp
async function generateThumbnail(imagePath) {
  try {
    const thumbnail = await sharp(imagePath)
      .resize(150, 150, {
        fit: "cover",
        position: "center",
      })
      .jpeg({ quality: 85 })
      .toBuffer();

    return thumbnail;
  } catch (error) {
    console.error(`Error generating thumbnail for ${imagePath}:`, error);
    throw error;
  }
}

// Generate preview (larger version) using Sharp
async function generatePreview(imagePath) {
  try {
    const preview = await sharp(imagePath)
      .resize(1200, 900, {
        fit: "inside",
        withoutEnlargement: false,
      })
      .jpeg({ quality: 95 })
      .toBuffer();

    return preview;
  } catch (error) {
    console.error(`Error generating preview for ${imagePath}:`, error);
    throw error;
  }
}

// Rotate image with robust retry logic for Windows file locking
async function rotateImage(imagePath, degrees) {
  const maxRetries = 3;
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(
        `Attempting to rotate ${imagePath} (attempt ${attempt}/${maxRetries})`
      );

      // Check if file is accessible
      await fs.access(imagePath, constants.R_OK | constants.W_OK);

      // Read the original image with retry logic
      let imageBuffer;
      try {
        imageBuffer = await fs.readFile(imagePath);
      } catch (readError) {
        if (
          attempt < maxRetries &&
          (readError.code === "EBUSY" || readError.code === "UNKNOWN")
        ) {
          console.log(`File read failed (attempt ${attempt}), retrying...`);
          await new Promise((resolve) => setTimeout(resolve, 200 * attempt)); // Exponential backoff
          continue;
        }
        throw readError;
      }

      // Rotate the image
      const rotatedBuffer = await sharp(imageBuffer).rotate(degrees).toBuffer();

      // Write back to the original file with retry logic
      try {
        // Try to write to a temporary file first, then rename
        const tempPath = imagePath + ".tmp";
        await fs.writeFile(tempPath, rotatedBuffer);

        // Ensure the temp file is fully written
        const fd = await fs.open(tempPath, "r+");
        try {
          await fd.sync();
        } finally {
          await fd.close();
        }

        // Rename temp file to original (atomic operation on most systems)
        await fs.rename(tempPath, imagePath);
      } catch (writeError) {
        if (
          attempt < maxRetries &&
          (writeError.code === "EBUSY" ||
            writeError.code === "UNKNOWN" ||
            writeError.code === "EACCES")
        ) {
          console.log(`File write failed (attempt ${attempt}), retrying...`);
          // Clean up temp file if it exists
          try {
            await fs.unlink(imagePath + ".tmp");
          } catch (cleanupError) {
            // Ignore cleanup errors
          }
          await new Promise((resolve) => setTimeout(resolve, 300 * attempt)); // Longer delay for write operations
          continue;
        }
        throw writeError;
      }

      // Verify the file was written correctly
      const finalStats = await fs.stat(imagePath);
      if (finalStats.size === 0) {
        throw new Error("File was corrupted during write operation");
      }

      // Additional delay to ensure file system stability
      await new Promise((resolve) => setTimeout(resolve, 150));

      console.log(`Successfully rotated ${imagePath} by ${degrees} degrees`);
      return true;
    } catch (error) {
      lastError = error;
      console.error(
        `Rotation attempt ${attempt} failed for ${imagePath}:`,
        error.message
      );

      // If this isn't the last attempt and it's a retryable error, continue
      if (attempt < maxRetries && isRetryableError(error)) {
        const delay = 400 * attempt; // Exponential backoff
        console.log(`Waiting ${delay}ms before retry...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      // If we've exhausted retries or it's a non-retryable error, throw
      break;
    }
  }

  // If we get here, all retries failed
  console.error(`All ${maxRetries} rotation attempts failed for ${imagePath}`);

  // Provide more specific error messages
  if (lastError.code === "ENOENT") {
    throw new Error("Image file not found");
  } else if (lastError.code === "EACCES") {
    throw new Error(
      "Permission denied - file may be locked by another process"
    );
  } else if (lastError.code === "EBUSY") {
    throw new Error("File is busy - please try again in a moment");
  } else if (lastError.code === "UNKNOWN") {
    throw new Error("File access error - file may be locked or corrupted");
  } else {
    throw new Error(
      `Image processing failed after ${maxRetries} attempts: ${lastError.message}`
    );
  }
}

// Helper function to determine if an error is retryable
function isRetryableError(error) {
  const retryableCodes = [
    "EBUSY",
    "UNKNOWN",
    "EACCES",
    "EAGAIN",
    "EMFILE",
    "ENFILE",
  ];
  return (
    retryableCodes.includes(error.code) ||
    error.message.includes("locked") ||
    error.message.includes("busy") ||
    error.message.includes("access")
  );
}

// API Routes

// Get current directory
app.get("/api/directory", (req, res) => {
  res.json({
    success: true,
    directory: IMAGE_DIR,
  });
});

// Set new directory
app.post("/api/directory", async (req, res) => {
  try {
    const { directory } = req.body;

    if (!directory) {
      return res.status(400).json({
        success: false,
        error: "Directory path is required",
      });
    }

    // Check if directory exists
    try {
      await fs.access(directory);
      const stats = await fs.stat(directory);
      if (!stats.isDirectory()) {
        return res.status(400).json({
          success: false,
          error: "Path is not a directory",
        });
      }
    } catch {
      return res.status(400).json({
        success: false,
        error: "Directory does not exist or is not accessible",
      });
    }

    IMAGE_DIR = directory;
    console.log(`Directory changed to: ${IMAGE_DIR}`);

    res.json({
      success: true,
      directory: IMAGE_DIR,
      message: "Directory updated successfully",
    });
  } catch (error) {
    console.error("Error setting directory:", error);
    res.status(500).json({
      success: false,
      error: "Failed to set directory",
    });
  }
});

// Get all images from the directory
app.get("/api/images", async (req, res) => {
  try {
    console.log("Scanning for images...");
    const images = await scanImagesRecursively(IMAGE_DIR);

    console.log(`Found ${images.length} images`);
    res.json({
      success: true,
      count: images.length,
      images: images,
      directory: IMAGE_DIR,
    });
  } catch (error) {
    console.error("Error getting images:", error);
    res.status(500).json({
      success: false,
      error: "Failed to scan images",
    });
  }
});

// Get thumbnail for a specific image
app.get("/api/thumbnail/:imagePath(*)", async (req, res) => {
  try {
    const imagePath = req.params.imagePath;
    const fullPath = path.join(IMAGE_DIR, imagePath);

    // Check if file exists
    try {
      await fs.access(fullPath);
    } catch {
      return res.status(404).json({ error: "Image not found" });
    }

    const thumbnail = await generateThumbnail(fullPath);

    res.set({
      "Content-Type": "image/jpeg",
      "Cache-Control": "no-cache", // Ensure fresh thumbnails after rotation
    });

    res.send(thumbnail);
  } catch (error) {
    console.error("Error generating thumbnail:", error);
    res.status(500).json({ error: "Failed to generate thumbnail" });
  }
});

// Get preview (larger version) for a specific image
app.get("/api/preview/:imagePath(*)", async (req, res) => {
  try {
    const imagePath = req.params.imagePath;
    const fullPath = path.join(IMAGE_DIR, imagePath);

    // Check if file exists
    try {
      await fs.access(fullPath);
    } catch {
      return res.status(404).json({ error: "Image not found" });
    }

    const preview = await generatePreview(fullPath);

    res.set({
      "Content-Type": "image/jpeg",
      "Cache-Control": "no-cache", // Ensure fresh previews after rotation
    });

    res.send(preview);
  } catch (error) {
    console.error("Error generating preview:", error);
    res.status(500).json({ error: "Failed to generate preview" });
  }
});

// Rotate image endpoint
app.post("/api/rotate", async (req, res) => {
  try {
    const { imagePath, degrees } = req.body;

    if (!imagePath || !degrees) {
      return res.status(400).json({
        success: false,
        error: "Missing imagePath or degrees",
      });
    }

    const fullPath = path.join(IMAGE_DIR, imagePath);

    // Check if file exists
    try {
      await fs.access(fullPath);
    } catch {
      return res.status(404).json({
        success: false,
        error: "Image not found",
      });
    }

    await rotateImage(fullPath, degrees);

    res.json({
      success: true,
      message: `Image rotated ${degrees} degrees`,
    });
  } catch (error) {
    console.error("Error rotating image:", error);
    res.status(500).json({
      success: false,
      error: "Failed to rotate image",
    });
  }
});

// OCR Service Integration
const OCRService = require("./server-ocr");
const ocr = new OCRService(process.env.OPENROUTER_API_KEY);

// Store active batch jobs
const batchJobs = new Map();
const sseConnections = new Map();

// Default concurrency (can be overridden via env or request)
const DEFAULT_OCR_CONCURRENCY = process.env.OCR_CONCURRENCY
  ? Math.max(1, parseInt(process.env.OCR_CONCURRENCY, 10))
  : 1;
const MAX_OCR_CONCURRENCY = process.env.MAX_OCR_CONCURRENCY
  ? Math.max(1, parseInt(process.env.MAX_OCR_CONCURRENCY, 10))
  : 5;

// Persistence for jobs
const JOBS_DIR = path.join(process.cwd(), ".ocr_jobs");

async function ensureJobsDir() {
  try {
    await fs.mkdir(JOBS_DIR, { recursive: true });
  } catch {}
}

async function saveJob(job) {
  try {
    await ensureJobsDir();
    const file = path.join(JOBS_DIR, `${job.id}.json`);
    await fs.writeFile(file, JSON.stringify(job, null, 2));
  } catch (e) {
    console.warn("Failed to persist job:", e.message);
  }
}

async function loadPersistedJobs() {
  const jobs = [];
  try {
    await ensureJobsDir();
    const files = await fs.readdir(JOBS_DIR);
    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      try {
        const data = JSON.parse(
          await fs.readFile(path.join(JOBS_DIR, f), "utf8")
        );
        jobs.push(data);
      } catch (e) {
        console.warn("Failed to load job file", f, e.message);
      }
    }
  } catch (e) {
    console.warn("Unable to read jobs dir:", e.message);
  }
  return jobs.sort((a, b) =>
    (a.startTime || "").localeCompare(b.startTime || "")
  );
}

function summarizeJob(job) {
  const {
    id,
    status,
    startTime,
    endTime,
    totalImages,
    processedImages,
    skippedImages,
    failedImages,
    concurrency,
  } = job;
  return {
    id,
    status,
    startTime,
    endTime,
    totalImages,
    processedImages,
    skippedImages,
    failedImages,
    concurrency,
  };
}

// Batch OCR endpoint
app.post("/api/ocr/batch", async (req, res) => {
  try {
    // Basic environment validations
    if (!process.env.OPENROUTER_API_KEY) {
      return res.status(400).json({
        error: "api_key_missing",
        message: "OpenRouter API key not configured",
        suggestion:
          "Add OPENROUTER_API_KEY=sk-... to .env then restart the server",
      });
    }
    if (!IMAGE_DIR) {
      return res.status(400).json({
        error: "directory_not_set",
        message: "Image directory not set",
        suggestion:
          "Use the folder input at top and press Load before starting OCR",
      });
    }
    // Verify directory still accessible
    try {
      const st = await fs.stat(IMAGE_DIR);
      if (!st.isDirectory()) throw new Error("Not a directory");
    } catch (e) {
      return res.status(400).json({
        error: "directory_inaccessible",
        message: `Cannot access IMAGE_DIR: ${e.message}`,
        suggestion: "Verify path exists and permissions, then reload in UI",
      });
    }

    const mode = (req.body?.mode || "all").toLowerCase();
    let images = await scanImagesRecursively(IMAGE_DIR);

    if (!Array.isArray(images) || images.length === 0) {
      return res.status(400).json({
        error: "no_images_found",
        message: "No supported images found in directory tree",
        suggestion:
          "Confirm the folder contains .jpg/.png etc. and click Refresh",
      });
    }

    // Optional explicit subset of images (single-image reprocess)
    const subset = Array.isArray(req.body?.images) ? req.body.images : null;
    if (subset && subset.length > 0) {
      // Validate each path exists among scanned images
      const allMap = new Map(images.map((img) => [img.relativePath, img]));
      const missing = subset.filter((p) => !allMap.has(p));
      if (missing.length) {
        return res.status(400).json({
          error: "requested_images_missing",
          message: `Some requested images were not found (${missing.length})`,
          missing,
        });
      }
      images = subset.map((p) => allMap.get(p));
    }

    // If mode=failed_only, gather failed images from most recent job
    if (mode === "failed_only") {
      const persisted = await loadPersistedJobs();
      const last = [...persisted]
        .reverse()
        .find(
          (j) =>
            j.status && ["completed", "cancelled", "failed"].includes(j.status)
        );
      if (!last) {
        return res.status(400).json({
          error: "no_previous_job",
          message: "No previous job to reprocess failed images from",
        });
      }
      const failedSet = new Set(
        (last.results || [])
          .filter((r) => r.status === "error" || r.status === "failed")
          .map((r) => r.image)
      );
      if (failedSet.size === 0) {
        return res.status(400).json({
          error: "no_failed_images",
          message: "Previous job had no failed images",
        });
      }
      // Map relative path back to current full paths (if they still exist)
      images = images.filter((img) => failedSet.has(img.relativePath));
      if (images.length === 0) {
        return res.status(400).json({
          error: "failed_images_missing",
          message:
            "Previously failed images are no longer present at their paths",
        });
      }
    }

    // Determine concurrency (bounded)
    let requestedConcurrency = parseInt(
      req.body?.concurrency || DEFAULT_OCR_CONCURRENCY,
      10
    );
    if (isNaN(requestedConcurrency) || requestedConcurrency <= 0)
      requestedConcurrency = DEFAULT_OCR_CONCURRENCY;
    const concurrency = Math.min(requestedConcurrency, MAX_OCR_CONCURRENCY);

    // Create batch job
    const jobId = Date.now().toString();
    const job = {
      id: jobId,
      status: "pending",
      totalImages: images.length,
      processedImages: 0,
      skippedImages: 0,
      failedImages: 0,
      currentImage: null, // Backwards compatibility (most recently started image)
      currentImages: [], // Array of currently processing images (for concurrency)
      results: [],
      startTime: new Date().toISOString(),
      estimatedCost: ocr.estimateCost(images.length),
      concurrency,
      cancelled: false,
      cancellationTime: null,
      mode,
    };

    batchJobs.set(jobId, job);
    await saveJob(job);

    // Start processing in background
    processBatchOCR(jobId, images, concurrency).catch((err) => {
      console.error("Unhandled batch OCR error:", err);
      const j = batchJobs.get(jobId);
      if (j) {
        j.status = "failed";
        j.endTime = new Date().toISOString();
        j.error = err.message;
        broadcastProgress(jobId, j);
      }
    });

    res.json({
      jobId,
      totalImages: images.length,
      estimatedCost: job.estimatedCost,
      concurrency,
      mode,
    });
  } catch (error) {
    console.error("Error starting batch OCR:", error);
    // Provide more diagnostic info
    res.status(500).json({
      error: "start_failed",
      message: "Failed to start batch OCR",
      detail: error.message,
    });
  }
});

// Batch processing function with concurrency & cancellation
async function processBatchOCR(jobId, images, concurrency) {
  const job = batchJobs.get(jobId);
  if (!job) return;
  job.status = "processing";
  broadcastProgress(jobId, job);
  await saveJob(job);

  let index = 0;
  const total = images.length;

  async function worker(workerId) {
    while (true) {
      if (job.cancelled) break;
      const currentIndex = index;
      if (currentIndex >= total) break;
      index++;
      const image = images[currentIndex];

      // Track active images
      job.currentImage = image.relativePath; // Legacy field
      job.currentImages.push(image.relativePath);
      broadcastProgress(jobId, job);

      try {
        const result = await ocr.processImage(image.fullPath);
        if (result.status === "success") {
          job.processedImages++;
        } else if (result.status === "skipped") {
          job.skippedImages++;
        } else {
          job.failedImages++;
        }
        job.results.push({ image: image.relativePath, ...result });
      } catch (error) {
        console.error(`Error processing ${image.relativePath}:`, error);
        job.failedImages++;
        job.results.push({
          image: image.relativePath,
          status: "error",
          error: error.message,
        });
      } finally {
        // Remove from active list
        job.currentImages = job.currentImages.filter(
          (p) => p !== image.relativePath
        );
        const progressPayload = {
          ...job,
          progress:
            ((job.processedImages + job.skippedImages + job.failedImages) /
              job.totalImages) *
            100,
        };
        broadcastProgress(jobId, progressPayload);
        await saveJob(job);
        // Small pacing delay to reduce API burst
        await new Promise((r) => setTimeout(r, 400));
      }
    }
  }

  const workers = [];
  for (let i = 0; i < concurrency; i++) {
    workers.push(worker(i));
  }
  await Promise.all(workers);

  if (job.cancelled) {
    job.status = "cancelled";
    job.cancellationTime = new Date().toISOString();
  } else {
    job.status = "completed";
  }
  job.endTime = new Date().toISOString();
  broadcastProgress(jobId, job);
  await saveJob(job);
}

// SSE progress endpoint
app.get("/api/ocr/progress/:jobId", (req, res) => {
  const { jobId } = req.params;

  if (!isValidJobId(jobId)) {
    return res.status(400).json({ error: "Invalid job id" });
  }

  const job = batchJobs.get(jobId);

  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }

  // Set up SSE
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive"
});
  });

  // Store connection
  if (!sseConnections.has(jobId)) {
    sseConnections.set(jobId, new Set());
  }
  sseConnections.get(jobId).add(res);

  // Send initial data
  res.write(`data: ${JSON.stringify(job)}\n\n`);

  // Heartbeat
  const heartbeat = setInterval(() => {
    res.write(": heartbeat\n\n");
  }, 30000);

  // Cleanup on disconnect
  req.on("close", () => {
    clearInterval(heartbeat);
    const connections = sseConnections.get(jobId);
    if (connections) {
      connections.delete(res);
      if (connections.size === 0) {
        sseConnections.delete(jobId);
      }
    }
  });
});

// Broadcast progress to all connected clients
function broadcastProgress(jobId, data) {
  const connections = sseConnections.get(jobId);
  if (connections) {
    const message = `data: ${JSON.stringify(data)}\n\n`;
    connections.forEach((res) => {
      res.write(message);
    });
  }
}

// List persisted jobs metadata
app.get("/api/ocr/jobs", async (req, res) => {
  try {
    const persisted = await loadPersistedJobs();
    res.json(persisted.map(summarizeJob));
  } catch (e) {
    res.status(500).json({ error: "Failed to list jobs" });
  }
});

// Get raw job file
app.get("/api/ocr/job/:jobId/raw", async (req, res) => {
  try {
    const { jobId } = req.params;
    if (!isValidJobId(jobId)) {
      return res.status(400).json({ error: "Invalid job id" });
    }
    const file = path.join(JOBS_DIR, `${jobId}.json`);
    const data = JSON.parse(await fs.readFile(file, "utf8"));
    res.json(data);
  } catch (e) {
    res.status(404).json({ error: "Job not found" });
  }
});

// Fetch a specific image result from a job
app.get("/api/ocr/result/:jobId/*", async (req, res) => {
  try {
    const jobId = req.params.jobId;
    if (!isValidJobId(jobId)) {
      return res.status(400).json({ error: "Invalid job id" });
    }
    const encodedPath = req.params[0];
    const file = path.join(JOBS_DIR, `${jobId}.json`);
    const data = JSON.parse(await fs.readFile(file, "utf8"));
    const target = decodeURIComponent(encodedPath);
    const entry = (data.results || []).find((r) => r.image === target);
    if (!entry) return res.status(404).json({ error: "Result not found" });
    res.json(entry);
  } catch (e) {
    res.status(404).json({ error: "Result not found" });
  }
});

// Lightweight health check to verify OpenRouter key & basic access
app.get("/api/ocr/health", async (req, res) => {
  try {
    const apiKeyPresent = !!process.env.OPENROUTER_API_KEY;
    const dirSet = !!IMAGE_DIR;
    const dirAccessible = dirSet
      ? await fs
          .stat(IMAGE_DIR)
          .then((s) => s.isDirectory())
          .catch(() => false)
      : false;
    const health = await ocr.healthCheck();
    const payload = {
      ok: health.ok && apiKeyPresent,
      apiKeyPresent,
      directorySet: dirSet,
      directoryAccessible: dirAccessible,
      model: health.model,
      raw: health.raw,
      error: health.error,
    };
    if (!payload.ok) return res.status(500).json(payload);
    res.json(payload);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Force delete cached OCR result files for an image so it can be reprocessed fresh
// This operates on the underlying image path, not strictly bound to a job, but accepts jobId for audit trail
app.delete("/api/ocr/result/:jobId/*", async (req, res) => {
  try {
    const { jobId } = req.params;
    if (!isValidJobId(jobId)) {
      return res.status(400).json({ error: "Invalid job id" });
    }
    const user = req.user;

    if (user) {
      const ownsJob = Array.isArray(user.jobIds) && user.jobIds.includes(jobId);
      const isAdmin = user.role === "admin" || user.isAdmin === true;
      if (!ownsJob && !isAdmin) {
        return res.status(403).json({ error: "Not authorized to modify this job" });
      }
    } else {
      // This service currently runs as a single-user/local-only utility. Do not expose externally without auth.
      console.warn("DELETE /api/ocr/result invoked without authenticated user. Ensure the server runs in a trusted environment.");
    }

    if (!IMAGE_DIR) {
      return res.status(400).json({ error: "Image directory not set" });
    }

    const encodedPath = req.params[0];
    const relativeImagePath = decodeURIComponent(encodedPath);
    const rootDir = path.resolve(IMAGE_DIR);
    const fullPath = path.resolve(path.join(IMAGE_DIR, relativeImagePath));
    if (!isPathInside(fullPath, rootDir)) {
      return res.status(403).json({ error: "Image not within configured directory" });
    }
    // Determine JSON/TXT output paths based on server-ocr.js conventions
    const jsonOut = fullPath + ".ocr.json";
    const txtOut = fullPath + ".ocr.txt";
    let removed = 0;
    for (const p of [jsonOut, txtOut]) {
      try {
        await fs.unlink(p);
        removed++;
      } catch (e) {
        // ignore missing
      }
    }
    // Also update most recent job record removing prior entry so UI doesn't show stale data
    try {
      const file = path.join(JOBS_DIR, `${jobId}.json`);
      const data = JSON.parse(await fs.readFile(file, "utf8"));
      if (Array.isArray(data.results)) {
        data.results = data.results.filter(
          (r) => r.image !== relativeImagePath
        );
        await fs.writeFile(file, JSON.stringify(data, null, 2));
      }
    } catch {}
    res.json({
      removedFiles: removed,
      message: removed ? "Cache cleared" : "No cached files found",
    });
  } catch (e) {
    res.status(500).json({ error: "Failed to clear cached OCR results" });
  }
});

// Get job status endpoint
app.get("/api/ocr/job/:jobId", (req, res) => {
  const { jobId } = req.params;

  if (!isValidJobId(jobId)) {
    return res.status(400).json({ error: "Invalid job id" });
  }

  const job = batchJobs.get(jobId);

  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }

  res.json(job);
});

// Export OCR results as CSV
app.get("/api/ocr/export/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params;
    if (!isValidJobId(jobId)) {
      return res.status(400).json({ error: "Invalid job id" });
    }
    let job = batchJobs.get(jobId);

    // If not in memory, try to load from persisted file
    if (!job) {
      try {
        const file = path.join(JOBS_DIR, `${jobId}.json`);
        job = JSON.parse(await fs.readFile(file, "utf8"));
      } catch {
        return res.status(404).json({ error: "Job not found" });
      }
    }

    // Build CSV content
    const headers = [
      "Image Path",
      "Status",
      "Image Type",
      "First Name",
      "Last Name",
      "License Number",
      "Date of Birth",
      "Expiration Date",
      "Address",
      "City",
      "State",
      "Zip Code",
      "Processed At"
    ];

    let csv = headers.join(",") + "\n";

    // Add data rows
    for (const result of job.results || []) {
      if (result.status === "success" && result.data) {
        const row = [
          result.image || "",
          result.status || "",
          result.data.imageType || "",
          result.data.firstName || "",
          result.data.lastName || "",
          result.data.licenseNumber || "",
          result.data.dateOfBirth || "",
          result.data.expirationDate || "",
          (result.data.address || "").replace(/,/g, ";"),
          result.data.city || "",
          result.data.state || "",
          result.data.zipCode || "",
          result.data.processedAt || ""
        ];
        csv += row.map(field => `"${field}"`).join(",") + "\n";
      }
    }

    // Set response headers for CSV download
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="ocr_results_${jobId}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error("Error exporting CSV:", error);
    res.status(500).json({ error: "Failed to export CSV" });
  }
});

// Cancel a batch job
app.post("/api/ocr/job/:jobId/cancel", (req, res) => {
  const { jobId } = req.params;
  if (!isValidJobId(jobId)) {
    return res.status(400).json({ error: "Invalid job id" });
  }
  const job = batchJobs.get(jobId);
  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }
  if (
    job.status === "completed" ||
    job.status === "failed" ||
    job.status === "cancelled"
  ) {
    return res.json({ message: "Job already finished", status: job.status });
  }
  job.cancelled = true;
  broadcastProgress(jobId, job);
  res.json({ message: "Cancellation requested", status: "cancelling" });
});

// Get count/list of images without OCR results
app.get("/api/ocr/unprocessed", async (req, res) => {
  try {
    const images = await scanImagesRecursively(IMAGE_DIR);
    const unprocessed = [];
    for (const image of images) {
      try {
        const has = await ocr.hasOCRResults(image.fullPath);
        if (!has) unprocessed.push(image.relativePath);
      } catch (e) {
        // Ignore access errors
      }
    }
    res.json({
      totalImages: images.length,
      unprocessedCount: unprocessed.length,
      unprocessed,
    });
  } catch (error) {
    console.error("Error listing unprocessed images:", error);
    res.status(500).json({ error: "Failed to list unprocessed images" });
  }
});

// Check for existing OCR results
app.get("/api/ocr/check/:imagePath(*)", async (req, res) => {
  try {
    const imagePath = req.params.imagePath;
    const fullPath = path.join(IMAGE_DIR, imagePath);

    const hasResults = await ocr.hasOCRResults(fullPath);
    const results = hasResults ? await ocr.loadOCRResults(fullPath) : null;

    res.json({
      hasResults,
      results,
    });
  } catch (error) {
    console.error("Error checking OCR results:", error);
    res.status(500).json({ error: "Failed to check OCR results" });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(
    `\n🎨 Image Manipulator Server running at http://localhost:${PORT}`
  );
  console.log(`📁 Current directory: ${IMAGE_DIR}`);
  console.log("🚀 Ready for image rotation and OCR!\n");

  if (!process.env.OPENROUTER_API_KEY) {
    console.log("⚠️  OpenRouter API key not set - OCR features disabled");
    console.log("   Set OPENROUTER_API_KEY in .env file to enable OCR\n");
  } else {
    console.log(
      `🧠 OCR Ready - Default concurrency: ${DEFAULT_OCR_CONCURRENCY} (max ${MAX_OCR_CONCURRENCY})`
    );
    // Load persisted jobs into memory summary (do not auto-resume running tasks yet)
    loadPersistedJobs()
      .then((jobs) => {
        const unfinished = jobs.filter((j) => j.status === "processing");
        if (unfinished.length) {
          console.log(
            `⚠️ Found ${unfinished.length} previously in-progress job(s). They were not auto-resumed. You can inspect with GET /api/ocr/jobs.`
          );
          unfinished.forEach((j) => {
            j.status = "cancelled";
            j.cancellationTime = new Date().toISOString();
            saveJob(j);
          });
        }
      })
      .catch(() => {});
  }
});

