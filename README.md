# Image Rotator - Desktop App

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

```bash
# 1. Clone repository
git clone https://github.com/aaronvstory/image-rotator.git
cd image-rotator

# 2. Install dependencies
npm install

# 3. Start desktop app
npm start
```

The app will launch in a native window!

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

## Building Distributable App

### Windows Installer (.exe)
```bash
npm run build:win
```
Output: `dist/Image Rotator Setup.exe`

### macOS App Bundle (.dmg)
```bash
npm run build:mac
```
Output: `dist/Image Rotator.dmg`

### Linux AppImage
```bash
npm run build:linux
```
Output: `dist/Image Rotator.AppImage`

## Development

### Run in Dev Mode (with DevTools)
```bash
npm run dev
```

### Run Server Only (for testing)
```bash
npm run server
```
Then open http://localhost:3000 in browser

### Architecture
- **Electron Main**: `electron-main.js` - Window management, IPC
- **Electron Preload**: `electron-preload.js` - Secure context bridge
- **Express Backend**: `server.js` - Image processing, API
- **OCR Service**: `server-ocr.js` - OpenRouter integration
- **Frontend**: `public/` - Vanilla JS UI (no frameworks)

## Configuration

### Environment Variables
| Variable | Description | Default |
|----------|-------------|---------|
| `OPENROUTER_API_KEY` | OpenRouter API key for OCR | Required for OCR |
| `OCR_CONCURRENCY` | Parallel OCR workers | 1 (max: 5) |
| `PORT` | Server port | 3000 |
| `NODE_ENV` | Environment (development/production) | production |

### Build Configuration
Edit `package.json` → `"build"` section for custom:
- App icons
- Installer options
- Target platforms
- File associations

## Troubleshooting

### App Won't Start
- Check Node.js version: `node --version` (need 18+)
- Delete `node_modules` and run `npm install` again
- Check console for errors

### Sharp Library Errors (Windows)
```bash
npm rebuild sharp
```

### OCR Not Working
- Verify `.env` file exists with valid `OPENROUTER_API_KEY`
- Check API key at https://openrouter.ai/keys
- Ensure internet connection (API calls required)

### Images Not Loading
- Verify directory permissions
- Check file formats (JPG, PNG, WebP only)
- Look for errors in DevTools console (`Ctrl+Shift+I`)

## File Structure

```
image-rotator/
├── electron-main.js          # Electron main process
├── electron-preload.js       # Preload script (security)
├── server.js                 # Express backend
├── server-ocr.js             # OCR service
├── public/
│   ├── index.html           # Main UI
│   ├── script.js            # Image grid logic
│   ├── style.css            # Main styles
│   ├── ocr-panel.js         # OCR UI component
│   └── ocr-panel.css        # OCR styles
├── package.json             # Dependencies & build config
└── .env                     # Environment variables (create this)
```

## Technology Stack

- **Electron** - Desktop app framework
- **Node.js** - Backend runtime
- **Express** - Web server
- **Sharp** - Image processing (rotation, thumbnails)
- **OpenRouter API** - OCR via GPT-4o-mini
- **Vanilla JavaScript** - Frontend (no frameworks!)

## License

MIT

## Contributing

PRs welcome! Key areas:
- UI/UX improvements
- Additional image operations
- OCR field customization
- Performance optimizations

## Roadmap

- [ ] System tray integration
- [ ] Auto-updater
- [ ] Drag & drop support
- [ ] Batch operations (resize, crop)
- [ ] More OCR document types
- [ ] Dark mode
- [ ] Keyboard shortcuts
