# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Image Manipulator is a Node.js/Express web application for bulk image rotation with integrated OCR capabilities. The application provides a thumbnail grid interface for managing large collections of images with advanced features like hover previews, batch OCR processing for driver licenses, and real-time progress streaming.

## Architecture

### Backend (`server.js`, `server-ocr.js`)
- **Express server** on port 3000 (configurable via PORT env var)
- **Sharp library** for image processing (thumbnails, previews, rotation)
- **OCR Service** using OpenRouter API (GPT-4o-mini model)
- **Server-Sent Events (SSE)** for real-time OCR progress streaming
- **Job persistence** in `.ocr_jobs/` directory

### Frontend (`public/`)
- **Pure vanilla JavaScript** (no frameworks) - ImageManipulator class
- **OCRPanel class** (`ocr-panel.js`) for OCR UI management
- **CSS Grid layout** with dynamic sizing via CSS variables
- **WebSocket-like streaming** via EventSource for OCR progress

### Key Design Patterns
- **Recursive directory scanning** for finding images in subdirectories
- **Throttling mechanism** (3-second cooldown) to prevent file corruption during rotation
- **Lazy loading** with base64 thumbnail generation
- **Job-based OCR processing** with cancellation support
- **File-based result caching** (prevents reprocessing)

## Development Commands

```bash
# Install dependencies
npm install

# Start production server
npm start

# Start with auto-reload (nodemon)
npm run dev

# Required environment variables for OCR
OPENROUTER_API_KEY=sk-or-...  # Required for OCR features
OCR_CONCURRENCY=2              # Parallel OCR workers (default: 1)
IMAGE_DIR=C:\path\to\images   # Optional default directory
```

## Core API Endpoints

### Image Operations
- `GET /api/images` - List all images in current directory (recursive)
- `POST /api/set-directory` - Change working directory
- `GET /api/thumbnail/:imagePath` - Generate/serve thumbnail
- `GET /api/preview/:imagePath` - Generate larger preview
- `POST /api/rotate` - Rotate image (degrees: 90, -90, 180)

### OCR Operations
- `POST /api/ocr/batch` - Start batch OCR job
- `GET /api/ocr/progress/:jobId` - SSE stream for live progress
- `POST /api/ocr/job/:jobId/cancel` - Cancel running job
- `GET /api/ocr/jobs` - List all persisted jobs
- `GET /api/ocr/export/:jobId` - Export results as CSV

## Working with Image Rotation

The rotation system uses Sharp's `.rotate()` with these safeguards:
1. **File locking prevention**: Atomic operations with temp files
2. **Throttling**: 3-second cooldown per image (tracked in `lastRotationTime`)
3. **Error recovery**: Multiple retry attempts with exponential backoff

## OCR Processing Workflow

1. **Job Creation**: Each batch OCR creates a unique job with ID
2. **Image Discovery**: Recursive scan excluding already-processed files
3. **Classification**: Images classified as license_front/license_back/selfie/unknown
4. **Field Extraction**: Only driver licenses proceed to structured extraction
5. **Result Storage**: JSON and TXT files saved beside source images
6. **Progress Streaming**: Real-time updates via Server-Sent Events

### OCR Result Structure
```javascript
{
  firstName, lastName, middleName,
  licenseNumber, dateOfBirth, expirationDate,
  address, city, state, zipCode,
  sex, height, weight, eyeColor,
  restrictions, class,
  imageType, processedAt, model, imagePath
}
```

### OCR File Naming Convention
- JSON results: `{original_filename}.ocr.json`
- Text results: `{original_filename}.ocr.txt`
- Example: `image.jpg` → `image.jpg.ocr.json` and `image.jpg.ocr.txt`

## Testing Specific Features

```bash
# Test OCR on single image
curl -X POST http://localhost:3000/api/ocr/single \
  -H "Content-Type: application/json" \
  -d '{"imagePath": "relative/path/to/image.jpg"}'

# Check OCR job status
curl http://localhost:3000/api/ocr/job/{jobId}

# Export OCR results
curl http://localhost:3000/api/ocr/export/{jobId} > results.csv
```

## Key Implementation Details

### Concurrency Control
- OCR processing uses worker pool pattern
- Configurable via `OCR_CONCURRENCY` (max: 5)
- Implements exponential backoff for rate limits (429 errors)

### File Organization
- OCR results: `{filename}.ocr.json` and `{filename}.ocr.txt`
- Job persistence: `.ocr_jobs/{jobId}.json`
- Thumbnails served dynamically (not cached on disk)

### Error Handling Patterns
- API retries with exponential backoff (100ms, 200ms, 400ms...)
- Graceful degradation for failed images
- Partial job completion on cancellation
- Comprehensive error logging with context

### Frontend State Management
- ImageManipulator class manages image grid state
- OCRPanel class handles OCR UI independently
- localStorage for user preferences (hover delay, grid size)
- No frontend framework dependencies

## Common Development Tasks

### Adding New OCR Fields
1. Update field extraction prompt in `server-ocr.js::extractDriverLicenseInfo()`
2. Modify result structure validation
3. Update CSV export columns in `/api/ocr/export`
4. Adjust frontend display in OCR panel

### Modifying Image Processing
- Thumbnail generation: `generateThumbnail()` in server.js (150x150)
- Preview generation: `generatePreview()` in server.js (1200x900)
- Rotation logic: `/api/rotate` endpoint with Sharp

### Debugging OCR Issues
- Check `.ocr_jobs/{jobId}.json` for detailed job state
- Review individual `_ocr_results.json` files beside images
- Monitor console for retry attempts and rate limits
- Use `/api/ocr/job/{jobId}/raw` for complete job data

## Performance Considerations

- **Recursive scanning**: Can be slow for deep directories with many files
- **Thumbnail generation**: Dynamic generation adds latency (consider caching)
- **OCR rate limits**: Respect provider limits with concurrency control
- **Memory usage**: Sharp processes images in-memory (watch for large files)
- **SSE connections**: Long-lived connections for progress updates

## Security Notes

- Path traversal prevention in all file operations
- API key validation for OCR endpoints
- Input sanitization for directory paths
- No direct file system access from frontend