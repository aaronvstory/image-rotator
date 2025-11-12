const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

let mainWindow;
let serverProcess;
// Resolve server port/host from env so Electron builds can override defaults (0.0.0.0 may be required outside localhost).
const parsedPort = Number(process.env.SERVER_PORT ?? process.env.PORT ?? process.env.APP_PORT);
const SERVER_PORT = Number.isFinite(parsedPort) ? parsedPort : 3001;
const SERVER_HOST = process.env.SERVER_HOST || process.env.HOST || 'localhost';
const WINDOW_HOST = SERVER_HOST === '0.0.0.0' ? '127.0.0.1' : SERVER_HOST;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'electron-preload.js')
    },
    title: 'Image Rotator',
    icon: path.join(__dirname, 'public', 'favicon.ico')
  });

  // Start Express server
  startServer();

  const APP_URL = `http://${WINDOW_HOST}:${SERVER_PORT}`;
  (function waitForServer() {
    http.get(APP_URL, () => {
      mainWindow.loadURL(APP_URL);
    }).on('error', () => setTimeout(waitForServer, 250));
  })();
}

function startServer() {
  console.log('Starting Express server...');

  serverProcess = spawn('node', ['server.js'], {
    env: {
      ...process.env,
      PORT: String(SERVER_PORT),
      HOST: SERVER_HOST,
      SERVER_PORT: String(SERVER_PORT),
      SERVER_HOST: SERVER_HOST
    },
    stdio: 'inherit'
  });

  serverProcess.on('error', (err) => {
    console.error('Failed to start server:', err);
    dialog.showErrorBox('Server Error', `Failed to start server: ${err.message}`);
  });

  serverProcess.on('exit', (code) => {
    console.log(`Server process exited with code ${code}`);
  });
}

function stopServer() {
  if (serverProcess) {
    console.log('Stopping Express server...');
    serverProcess.kill();
    serverProcess = null;
  }
}

// Handle directory picker
ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

// App lifecycle
app.on('ready', createWindow);

app.on('window-all-closed', () => {
  stopServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Cleanup on quit
app.on('before-quit', () => {
  stopServer();
});

app.on('will-quit', () => {
  stopServer();
});



