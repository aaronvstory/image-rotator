# 🚀 Image Manipulator - Launch Guide

## TL;DR - Just Want to Run It?

### Desktop App (Recommended)
**Double-click:** `start-electron.bat` ⚡

### Browser Mode
**Double-click:** `start-image-manipulator.bat` 🌐

### Build .exe Installer
**Double-click:** `build-electron.bat` 📦

---

## What's the Difference?

| Mode | Launch File | Opens In | Requires |
|------|-------------|----------|----------|
| **Desktop** | `start-electron.bat` | Native window | Node.js |
| **Browser** | `start-image-manipulator.bat` | Chrome/Edge | Node.js |
| **Standalone** | Built .exe (see below) | Native window | Nothing! |

## Step-by-Step Instructions

### 🖥️ Running Desktop Mode (Electron)

1. **Double-click** `start-electron.bat`
2. Wait while it checks dependencies (first time only)
3. App launches in a native desktop window
4. Select your image directory and start working!

**What it does:**
- Checks if Node.js is installed
- Installs dependencies if needed
- Launches Electron desktop app
- Starts internal server automatically

### 🌐 Running Browser Mode

1. **Double-click** `start-image-manipulator.bat`
2. Wait for server to start (~3 seconds)
3. Your default browser opens to `http://localhost:3001`
4. Select your image directory and start working!

**What it does:**
- Starts Express server
- Opens URL in Chrome (or default browser)
- Keeps server running until you close the window

### 📦 Building Standalone .exe

**Why?** Share with users who don't have Node.js installed!

1. **Double-click** `build-electron.bat`
2. Wait 5-10 minutes (downloads ~200MB first time)
3. Find your .exe files in the `dist/` folder

**You get TWO versions:**

#### Option A: Installer (Recommended)
- `dist/Image Rotator Setup x.x.x.exe`
- Double-click to install to Program Files
- Creates Start Menu shortcuts
- Professional installation experience
- ~100MB installed size

#### Option B: Portable
- `dist/Image Rotator x.x.x.exe`
- Run directly - no installation needed
- Copy to USB drive, desktop, anywhere
- Perfect for testing or portable use
- ~200MB file size

**Distribute either file** - recipients don't need Node.js!

---

## Troubleshooting

### "Node.js is not installed"
**Fix:** Install from https://nodejs.org/ (download LTS version)

### "Failed to install dependencies"
**Fix:**
```bash
# Delete node_modules and try again
rmdir /s /q node_modules
npm install
```

### "Port 3001 already in use"
**Fix:** Edit `.env` file and change port:
```
PORT=3002
```

### Build fails with errors
**Fix:** Make sure you have 10GB free disk space and stable internet

### Electron window is blank
**Fix:**
1. Close the app
2. Delete `.ocr_jobs` folder
3. Start again

---

## Configuration

### Setting Image Directory

Create a `.env` file (copy from `.env.example`):

```env
IMAGE_DIR=C:\Users\YourName\Pictures\ToProcess
PORT=3001
HOST=localhost
```

### Enabling OCR

Add OpenRouter API key to `.env`:

```env
OPENROUTER_API_KEY=sk-or-v1-your-key-here
OCR_CONCURRENCY=2
```

Get your key at: https://openrouter.ai/

---

## Command Line Usage (Advanced)

If you prefer the command line:

```bash
# Install dependencies
npm install

# Launch desktop app
npm start

# Launch in dev mode (with DevTools)
npm run dev

# Run server only (then visit http://localhost:3001)
npm run server

# Build Windows installer
npm run build:win

# Build for macOS
npm run build:mac

# Build for Linux
npm run build:linux
```

---

## Files Reference

| File | Purpose |
|------|---------|
| `start-electron.bat` | Launch desktop app (development) |
| `start-image-manipulator.bat` | Launch browser version |
| `build-electron.bat` | Build .exe installer/portable |
| `electron-main.js` | Electron configuration |
| `server.js` | Backend server |
| `package.json` | Project configuration |
| `.env` | Your settings (create from `.env.example`) |

---

## Next Steps

1. ✅ Launch the app (pick Desktop or Browser mode above)
2. 📁 Select your image directory
3. 🔄 Click images to rotate them
4. 🔍 Optional: Set up OCR for batch processing
5. 📤 Optional: Build .exe to share with others

**Need more help?** See:
- [README.md](README.md) - Full feature documentation
- [README-ELECTRON.md](README-ELECTRON.md) - Electron & build details

---

**Questions?** Open an issue on GitHub!
