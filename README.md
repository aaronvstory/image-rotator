# 🔄 Image Manipulator - Professional Bulk Image Rotation Tool

[![GitHub stars](https://img.shields.io/github/stars/aaronvstory/image-manipulator?style=social)](https://github.com/aaronvstory/image-manipulator)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)

A beautiful, efficient web application for bulk image rotation with thumbnail grid view, dynamic folder selection, and intelligent hover previews. Perfect for photographers, content creators, and anyone needing to quickly review and rotate hundreds of images with an intuitive interface.

![Image Manipulator Screenshot](https://via.placeholder.com/800x400/1e293b/e2e8f0?text=Image+Manipulator+Interface)

## ✨ Key Features

### 🎯 Smart Rotation Controls

- **Quick Rotation**: Click any thumbnail for instant 90° clockwise rotation
- **Precision Controls**: Dedicated CCW (-90°), Flip (180°), and CW (+90°) buttons
- **Rotation Throttling**: Intelligent 3-second cooldown prevents file corruption
- **Visual Feedback**: Instant success/error notifications with countdown timers

### 📁 Dynamic Folder Management

- **Direct Path Input**: Simply type or paste any folder path on your Windows system
- **Recursive Scanning**: Automatically finds all images in subdirectories
- **Instant Loading**: Quick scan and load with a single click
- **Real-time Validation**: Automatic path validation and error handling

### 🖼️ Advanced Image Preview

- **Smart Hover Preview**: 2-second hover triggers high-quality preview tooltip
- **Auto-Hide**: Preview disappears when you move mouse away (no clicking required!)
- **Optimized Loading**: Fast preview generation with loading indicators
- **Keyboard Support**: Press Escape to close any open previews

### 🎨 Beautiful Modern UI

- **Dark Theme**: Professional dark navy/blue gradient interface
- **Adjustable Grid**: Dynamic thumbnail sizing from 100px to 400px
- **Glassmorphism Effects**: Modern backdrop blur and transparency
- **Responsive Design**: Optimized for all screen sizes
- **Smooth Animations**: Polished hover effects and transitions

### ⚡ Performance & Reliability

- **High-Performance Processing**: Sharp image library for fast operations
- **Real-time Updates**: Changes immediately reflected in UI
- **Error Recovery**: Robust error handling with helpful messages
- **Memory Efficient**: Optimized for handling hundreds of images
- **File Safety**: Built-in protection against corruption

### 🧠 Integrated Batch OCR (Driver Licenses)

- **One-Click Batch OCR**: Process all images in the loaded directory tree
- **Smart Skipping**: Already processed images (with *.ocr.json) are skipped automatically
- **Driver License Detection**: Classifies images (license front/back vs other) before extraction
- **Structured Output**: Saves both JSON and human-readable TXT beside each image
- **Progress Streaming**: Real-time updates via Server-Sent Events (SSE)
- **Cost Estimation**: Up-front token cost projection before long runs
- **Concurrency Control**: Adjustable parallel processing (env var OCR_CONCURRENCY)
- **Graceful Cancellation**: Stop an in-progress batch without losing completed results
- **Export**: Download consolidated CSV of extracted fields
- **Single Image Reprocess**: Re-run OCR on just one image via inspector
- **Force Refresh**: Delete cached OCR outputs before reprocessing
- **Health Diagnostics**: API key & directory validation endpoint
- **Failed-Only Mode**: Retry only previously failed images
- **Detailed Error Codes**: Clear guidance when startup conditions unmet

## 🚀 Quick Start

### Prerequisites

- **Node.js 18+** - [Download here](https://nodejs.org/)
- **Windows 10/11** - Optimized for Windows file systems

### Installation

```bash
# Clone the repository
git clone https://github.com/aaronvstory/image-manipulator.git
cd image-manipulator

# Install dependencies
npm install

# Start the application
npm start
```

The application will be available at **http://localhost:3000**

### Alternative: Download & Run

1. [Download ZIP](https://github.com/aaronvstory/image-manipulator/archive/refs/heads/main.zip)
2. Extract to your desired location
3. Open terminal in the extracted folder
4. Run `npm install` then `npm start`
5. Open http://localhost:3000 in your browser

## 🎮 How to Use

### 1. 📂 Select Your Images

- Enter your folder path directly in the input field (e.g., `C:\Photos\Vacation`)
- Click **"Load"** to scan for images in that directory
- Use **"Refresh"** to reload the current directory
- All subdirectories are automatically scanned for images

### 2. 🔧 Adjust Your View

- Use the **Grid Size** slider to resize thumbnails (100px - 400px)
- Perfect for different screen sizes and preferences
- Grid automatically adjusts to fit your screen

### 3. 🔄 Rotate Images

- **Quick Rotation**: Click any thumbnail for 90° CW rotation
- **Precision Controls**: Use the three control buttons:
  - 🔴 **Red**: Rotate 90° Counter-Clockwise
  - 🔵 **Blue**: Flip 180° (upside down)
  - 🟢 **Green**: Rotate 90° Clockwise
- **Smart Throttling**: Wait 3 seconds between rotations per image

### 4. 👁️ Preview Images

- **Hover** over any thumbnail for 2+ seconds
- High-quality preview appears as tooltip
- Move mouse away to hide instantly
- Press **Escape** to close all previews

## 🛠️ Technical Details

### Architecture

- **Backend**: Node.js with Express server
- **Image Processing**: Sharp (fastest Node.js image library)
- **Frontend**: Pure HTML5, CSS3, JavaScript (no frameworks!)
- **File Operations**: Direct file system manipulation with safety checks

### Supported Formats

- **JPEG** (.jpg, .jpeg) - Most common format
- **PNG** (.png) - Lossless compression
- **WebP** (.webp) - Modern web format
- **GIF** (.gif) - Animated/static
- **TIFF** (.tiff) - High quality
- **BMP** (.bmp) - Bitmap format

### Performance Features

- **Smart Caching**: Intelligent thumbnail cache with automatic invalidation
- **Lazy Loading**: Images load as you scroll
- **Memory Management**: Efficient handling of large image collections
- **Background Processing**: Non-blocking rotation operations
- **File Lock Prevention**: Built-in safeguards against corruption

## 📋 Project Structure

```
image-manipulator/
├── 📄 server.js              # Express server + image processing
├── 📁 public/                # Client-side application
│   ├── 🌐 index.html         # Main interface
│   ├── 🎨 style.css          # Modern UI styling
│   └── ⚡ script.js          # Client-side logic

├── 📦 package.json           # Dependencies
├── 📖 README.md              # This file
├── 📋 CHANGELOG.md           # Version history
└── 🚀 start-image-manipulator.bat # Windows quick start
```

## 🎨 UI Features Deep Dive

### Advanced Grid System

- **Dynamic Sizing**: CSS custom properties for real-time updates
- **Responsive Breakpoints**: Optimized layouts for different screens
- **Smart Scaling**: Buttons and text scale with grid size
- **Touch Friendly**: Works perfectly on touch devices

### Professional Controls

- **Uniform Button Design**: All rotation buttons same size and shape
- **Visual Hierarchy**: Clear distinction between actions
- **Hover Feedback**: Subtle glow effects without movement
- **Loading States**: Progress indicators during operations

### Error Handling

- **Rotation Throttling**: "Wait 3s" messages with countdown
- **File Access Errors**: Clear error messages with solutions
- **Network Issues**: Graceful degradation with retry options
- **Invalid Paths**: Helpful validation with suggestions

## 🔧 Configuration

### Environment Variables

```bash
# Set custom default directory
IMAGE_DIR=C:\Your\Custom\Path

# Set custom port (default: 3000)
PORT=8080

# OpenRouter API key (required for OCR features)
OPENROUTER_API_KEY=sk-or-...

# OCR concurrency (parallel image processing workers, default 1)
OCR_CONCURRENCY=2

# Maximum concurrency allowed (safety limit, default 5)
MAX_OCR_CONCURRENCY=5
```

### Customization

- **Grid Size Range**: Modify CSS variables for different size limits
- **Hover Delay**: Adjust preview timing in script.js
- **Rotation Cooldown**: Change throttling duration as needed
- **Theme Colors**: Customize color palette in style.css
- **OCR Parallelism**: Tune OCR_CONCURRENCY for speed vs. rate limits
- **Retry Logic**: Built-in exponential backoff for transient API errors (429 / 5xx)
- **Skipping Behavior**: Removes need to reprocess already OCR'd files

## 🧠 OCR Workflow Details

1. You click "OCR All" → A batch job is created (assigned jobId)
2. The server scans all images recursively under the active folder
3. Each image is (a) checked for prior results, (b) compressed & classified
4. Only driver license images (front/back) proceed to structured field extraction
5. Results are written next to the source image as:
   - filename.ocr.json (full structured data)
   - filename.ocr.txt (pretty text summary)
6. Front-end streams live progress (processed / skipped / failed) and active files
7. You may cancel at any time; already completed outputs remain
8. Download CSV aggregates key fields for all successful items

### Output JSON Fields

```
{
  "firstName": string|null,
  "lastName": string|null,
  "middleName": string|null,
  "licenseNumber": string|null,
  "dateOfBirth": "MM/DD/YYYY"|null,
  "expirationDate": "MM/DD/YYYY"|null,
  "address": string|null,
  "city": string|null,
  "state": string|null,
  "zipCode": string|null,
  "sex": string|null,
  "height": string|null,
  "weight": string|null,
  "eyeColor": string|null,
  "restrictions": string|null,
  "class": string|null,
  "imageType": "license_front"|"license_back"|"selfie"|"unknown",
  "processedAt": ISO8601 timestamp,
  "model": string,
  "imagePath": absolute server path
}
```

### API Endpoints (OCR)

- `POST /api/ocr/batch` (body optional: `{ "concurrency": number }`) → `{ jobId, totalImages, estimatedCost, concurrency }`
- `GET /api/ocr/progress/:jobId` (SSE stream)
- `GET /api/ocr/job/:jobId` (current snapshot)
- `POST /api/ocr/job/:jobId/cancel` (request cancellation)
- `GET /api/ocr/unprocessed` → Count & list of images lacking OCR outputs
- `GET /api/ocr/check/:relativePath` → Whether a specific image already has results
- `GET /api/ocr/health` → Diagnostic (apiKeyPresent, directoryAccessible, model)

### Rate Limits & Concurrency

The app uses exponential backoff and limited parallel workers to respect provider limits. Increase `OCR_CONCURRENCY` cautiously; watch for elevated 429 responses.

### Cancellation Semantics

On cancellation, in-flight requests finish; no new images start. Status moves to `cancelled` with partial results preserved.

## 📦 Persistence & Job History

Every OCR batch job is persisted as a JSON snapshot under `.ocr_jobs/<jobId>.json`. This provides:

- Durable record of each run (status, timings, per-image results)
- Ability to inspect prior job outcomes after a server restart
- Support for selective reprocessing of only failed images

A server restart will mark any previously in-flight (still `processing`) jobs as `cancelled` (they are not auto-resumed to avoid double billing). You can list historical jobs via:

```
GET /api/ocr/jobs
```

## 🔍 Inline Result Inspector UI

Click any image name in the OCR results list to open the **Inspector Modal**:

- Pretty-printed JSON of the stored result
- Quick reprocess of a single image (fires a one‑image batch)
- Close via the × button, backdrop click, or `Esc`
- Force Refresh button clears cached JSON/TXT then automatically reprocesses

## 🔄 Failed-Only Retry Mode

If a prior job has failures you can launch a new batch that ONLY includes the failed images:

```
POST /api/ocr/batch { "mode": "failed_only" }
```

In the UI a "Retry Failed" button appears automatically when the active or most recent job has any failed entries.

## 🔁 Force Refresh (Clear Cached OCR Output)

Sometimes you want to force a clean re-run even if a JSON/TXT result already exists. Use:

```
DELETE /api/ocr/result/:jobId/<relativeImagePath>
```

This will remove the cached `.ocr.json` / `.ocr.txt` files (if present) and prune the entry from that job's stored JSON so the UI no longer shows stale data. After clearing, re-run a normal batch or use the single-image reprocess from the inspector.

## 🎯 Single Image Reprocess

Open the inspector and click **Reprocess**. The backend supports subsets:

```
POST /api/ocr/batch
{ "images": ["relative/path/to/file.jpg"] }
```

If the path is invalid you'll receive `requested_images_missing` with a `missing` array.

## 🩺 Health Check & Diagnostics

`GET /api/ocr/health` returns structured diagnostics:

```
{
  "ok": true,
  "apiKeyPresent": true,
  "directorySet": true,
  "directoryAccessible": true,
  "model": "openai/gpt-4o-mini",
  "raw": "OK"
}
```

If `ok` is false inspect flags and `error`.

### Common Error Codes from /api/ocr/batch

| Code                     | Meaning                                   | Suggested Action                      |
| ------------------------ | ----------------------------------------- | ------------------------------------- |
| api_key_missing          | OPENROUTER_API_KEY not loaded             | Add key to `.env` then restart server |
| directory_not_set        | No folder chosen yet                      | Load a folder in the UI first         |
| directory_inaccessible   | Path missing or permission issue          | Verify path exists & permissions      |
| no_images_found          | No supported images under directory       | Add images or choose different folder |
| requested_images_missing | Subset request referenced missing files   | Check `missing` array & retry         |
| no_previous_job          | Failed-only requested with no history     | Run a full batch first                |
| no_failed_images         | Failed-only requested but none failed     | Nothing to retry; inspect results     |
| failed_images_missing    | Previously failed files no longer on disk | Restore files or run full scan        |
| start_failed             | Unexpected internal startup failure       | See `detail` field, check server logs |

Restart the server after editing `.env` (env vars read only at startup).

## New / Updated OCR Endpoints

| Method | Endpoint                   | Description                                                                        |
| ------ | -------------------------- | ---------------------------------------------------------------------------------- |
| POST   | /api/ocr/batch             | Start batch (supports `{ concurrency, mode }`, mode can be `all` or `failed_only`) |
| GET    | /api/ocr/jobs              | List persisted jobs (summary)                                                      |
| GET    | /api/ocr/job/:jobId/raw    | Raw persisted job JSON                                                             |
| GET    | /api/ocr/result/:jobId/\*  | Fetch specific image result from a job                                             |
| DELETE | /api/ocr/result/:jobId/\*  | Clear cached OCR result for that image (force refresh)                             |
| POST   | /api/ocr/job/:jobId/cancel | Request cancellation                                                               |
| GET    | /api/ocr/progress/:jobId   | SSE progress stream                                                                |

## 🔮 Future Enhancements (Ideas)

- Combine classification + extraction into a single multimodal call to reduce latency.
- Integrate basic field validation (DOB format, state abbreviation whitelist) and summary warnings.
- Add optional barcode (PDF417) decoding on license back images using a local library for added accuracy.
- Job resume (true continuation) for interrupted processing (currently we mark as cancelled instead).
- Tag / filter historical jobs in front-end UI.

## 🤝 Contributing

We welcome contributions! Here's how to get started:

1. **Fork the Repository**
2. **Create Feature Branch**: `git checkout -b feature/amazing-feature`
3. **Commit Changes**: `git commit -m 'Add amazing feature'`
4. **Push to Branch**: `git push origin feature/amazing-feature`
5. **Open Pull Request**

### Development Setup

```bash
# Clone your fork
git clone https://github.com/yourusername/image-manipulator.git

# Install dependencies
npm install

# Start development server
npm run dev
```

## 📝 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **[Sharp](https://sharp.pixelplumbing.com/)** - High-performance image processing
- **[Express.js](https://expressjs.com/)** - Fast, minimalist web framework
- **[Font Awesome](https://fontawesome.com/)** - Beautiful icons

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/aaronvstory/image-manipulator/issues)
- **Discussions**: [GitHub Discussions](https://github.com/aaronvstory/image-manipulator/discussions)
- **Email**: support@example.com

---

**Built with ❤️ by developers, for content creators**

_Transform your image workflow with professional-grade rotation tools_
