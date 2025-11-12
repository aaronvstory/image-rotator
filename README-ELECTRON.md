# Image Manipulator - Electron Desktop App

## Quick Start

### Option 1: Run in Development Mode
Simply double-click `start-electron.bat` to launch the desktop application.

### Option 2: Build Standalone Executable
1. Double-click `build-electron.bat`
2. Wait for the build to complete (may take 5-10 minutes first time)
3. Find your .exe files in the `dist` folder

## Available Executables

After building, you'll find two types of executables in the `dist` folder:

### NSIS Installer (`Image Rotator Setup x.x.x.exe`)
- Full Windows installer
- Installs to Program Files
- Creates Start Menu shortcuts
- Supports automatic updates
- **Recommended for end users**

### Portable Version (`Image Rotator x.x.x.exe`)
- Single executable file
- No installation required
- Run from anywhere (USB drive, desktop, etc.)
- Perfect for testing or portable use

## Launch Scripts

| Script | Purpose |
|--------|---------|
| `start-electron.bat` | Launch in Electron desktop mode (development) |
| `start-image-manipulator.bat` | Launch in browser mode (web interface) |
| `build-electron.bat` | Build standalone .exe files |

## Building for Different Platforms

```bash
# Windows (generates .exe)
npm run build:win

# macOS (generates .dmg and .zip)
npm run build:mac

# Linux (generates .AppImage and .deb)
npm run build:linux
```

## Configuration

The Electron app uses the same configuration as the web version:

1. Copy `.env.example` to `.env`
2. Set your `IMAGE_DIR` path
3. Optionally configure `PORT` and `HOST`

Example `.env`:
```
IMAGE_DIR=C:\Users\YourName\Pictures\ToProcess
PORT=3001
HOST=localhost
```

## Differences: Electron vs Browser Mode

| Feature | Electron Mode | Browser Mode |
|---------|--------------|--------------|
| Launch | Desktop window | Web browser tab |
| Distribution | .exe installer | Requires Node.js |
| Updates | Can auto-update | Manual |
| Integration | Native OS dialogs | Web dialogs |
| Performance | Native | Web-based |

## Troubleshooting

### "Node.js not found"
Install Node.js from https://nodejs.org/ (LTS version recommended)

### Build fails with "Out of memory"
Add to `package.json` build section:
```json
"build": {
  "buildDependenciesFromSource": false
}
```

### Electron won't start
1. Delete `node_modules` folder
2. Run `npm install`
3. Try again with `start-electron.bat`

### Server won't start in Electron
Check that port 3001 isn't already in use. Modify `PORT` in `.env` if needed.

## File Structure

```
image-manipulator-main/
├── electron-main.js          # Electron app entry point
├── electron-preload.js       # Security preload script
├── server.js                 # Express backend server
├── public/                   # Frontend files
├── start-electron.bat        # Development launcher
├── build-electron.bat        # Build script
└── dist/                     # Built executables (after build)
```

## Advanced: Customizing the Build

Edit `package.json` under the `"build"` section to customize:
- App icon
- Installer settings
- Auto-update configuration
- Platform-specific options

See [electron-builder docs](https://www.electron.build/) for details.
