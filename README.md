..# Image Rotator - Desktop App

A powerful desktop application for bulk image rotation with integrated OCR capabilities for driver license processing.

## Features

✅ **Image Management**
- Browse and rotate images from any local directory
- Thumbnail grid view with hover previews
- Support for JPG, PNG, WebP formats
- Rotate 90°, -90°, or 180° with one click
- Recursive directory scanning

✅ **OCR Processing** (Driver Licenses)
- Batch OCR processing with OpenRouter API (GPT-4o-mini)
- Automatic license front/back classification
- Structured field extraction (name, DOB, license #, address, etc.)
- Real-time progress streaming
- CSV export functionality
- Smart caching (skips already-processed images)

✅ **Desktop App Benefits**
- Full local file system access
- Native window controls
- No browser required
- System tray integration (future)
- Auto-updates (future)

## Installation

### Prerequisites
- Node.js 18+ installed
- Windows, macOS, or Linux

### Quick Start

### Option 1: Electron Desktop App (Recommended)

**Windows Users:**
1. Double-click `start-electron.bat`
2. Wait for dependencies to install (first time only)
3. App launches in a native window!

**Command Line:**
```bash
git clone https://github.com/aaronvstory/image-rotator.git
cd image-rotator
npm install
npm start
```

### Option 2: Web Browser Mode

**Windows Users:**
1. Double-click `start-image-manipulator.bat`
2. App opens in your default browser

**Command Line:**
```bash
npm run server
# Then open http://localhost:3001 in your browser
```

📖 **See [README-ELECTRON.md](README-ELECTRON.md) for detailed Electron/build documentation**

## Usage

### 1. Select Image Directory
- Click "Choose Directory" button
- Navigate to your image folder
- App will recursively scan for images

### 2. Rotate Images
- Click thumbnails to rotate 90° clockwise
- Right-click for more rotation options (future)
- Changes are saved immediately to disk

### 3. OCR Processing (Optional)

#### Setup:
1. Get API key from [OpenRouter](https://openrouter.ai/)
2. Create `.env` file:
```env
OPENROUTER_API_KEY=sk-or-v1-your-key-here
OCR_CONCURRENCY=2
```

#### Process Images:
1. Click "Batch OCR" button
2. Watch real-time progress in panel
3. Export results to CSV when complete
4. OCR results saved as `{filename}.ocr.json` and `{filename}.ocr.txt`

## Building Standalone Executable

Want a single .exe file to share with others? No Node.js installation required!

### Windows
**Easy Way:** Double-click `build-electron.bat` and wait 5-10 minutes

**Command Line:**
```bash
npm run build:win
```
**Output:**
- `dist/Image Rotator Setup.exe` - Full installer (recommended)
- `dist/Image Rotator.exe` - Portable version

### macOS
```bash
npm run build:mac
```
**Output:** `dist/Image Rotator.dmg`

### Linux
```bash
npm run build:linux
```
**Output:** `dist/Image Rotator.AppImage`

📖 **Full build documentation: [README-ELECTRON.md](README-ELECTRON.md)**

## Development

### Run in Dev Mode (with DevTools)
```bash
npm run dev
```

### Run Server Only (for testing)
```bash
npm run server
```
Then open http://localhost:3001 in browser

### Host and port
- The Express server reads `PORT` and `HOST` from env (defaults: `3001` / `localhost`). Set `HOST=0.0.0.0` to expose outside localhost.
- The Electron launcher prefers `SERVER_PORT`, then `PORT`, and forwards `HOST`/`PORT` to the spawned server so desktop and browser builds stay in sync.
- Note: WINDOW_HOST is set to 127.0.0.1 when SERVER_HOST is
