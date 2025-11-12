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
const MAX_SERVER_WAIT_ATTEMPTS = 60; // ~15 seconds at 250ms interval
const SERVER_WAIT_INTERVAL_MS = 250;

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
  const waitForServer = (attempt = 0) => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }
const request = http.request(APP_URL, { method: 'HEAD' }, (response) => {
    const request = http.get(APP_URL, (response) => {
      response.resume();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadURL(APP_URL);
      }
    });

    request.on('error', () => {
      if (attempt + 1 >= MAX_SERVER_WAIT_ATTEMPTS) {
        showServerError(APP_URL);
        return;
      }
      setTimeout(() => waitForServer(attempt + 1), SERVER_WAIT_INTERVAL_MS);
    });

    request.setTimeout(2000, () => {
      request.destroy();
      if (attempt + 1 >= MAX_SERVER_WAIT_ATTEMPTS) {
        showServerError(APP_URL);
        return;
      }
      setTimeout(() => waitForServer(attempt + 1), SERVER_WAIT_INTERVAL_MS);
    });
  };

  waitForServer();

  // Stop server when window is closed (prevents orphan processes on macOS)
  mainWindow.on('closed', () => {
    mainWindow = null;
    stopServer();
  });
}

function startServer() {
  console.log('Starting Express server...');

  const serverEntry = path.join(__dirname, 'server.js');
  const nodeExec = process.execPath;

  serverProcess = spawn(nodeExec, [serverEntry], {
    cwd: path.dirname(serverEntry),
    env: {
      ...process.env,
      // Ensure Electron child runs server.js as a plain Node process
      ELECTRON_RUN_AS_NODE: '1',
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
    showServerError(`http://${WINDOW_HOST}:${SERVER_PORT}`, err);
  });

  serverProcess.on('exit', (code, signal) => {
    console.log(`Server process exited with code ${code}${signal ? ` (signal: ${signal})` : ''}`);
    if (code !== 0) {
      showServerError(`http://${WINDOW_HOST}:${SERVER_PORT}`);
    }
    serverProcess = null;
  });
}

function stopServer() {
  if (serverProcess) {
    console.log('Stopping Express server...');
    try {
      serverProcess.kill('SIGTERM');
    } catch (error) {
      console.warn('Error terminating server process', error);
    }
    serverProcess = null;
  }
}

function showServerError(appUrl, error) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  const errorMessage = error?.message || 'Server failed to start in time.';
  const html = `<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>Image Manipulator</title>
        <style>
          body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 40px; background: #10131a; color: #f2f5f9; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
          .card { max-width: 540px; background: rgba(15, 18, 26, 0.85); border-radius: 16px; padding: 32px; box-shadow: 0 20px 45px rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.06); }
          h1 { margin-top: 0; font-size: 1.8rem; }
          p { line-height: 1.5; }
          code { background: rgba(255,255,255,0.08); padding: 2px 6px; border-radius: 6px; font-size: 0.95rem; }
          button { margin-top: 24px; padding: 12px 18px; border-radius: 8px; border: none; background: #2978ff; color: #fff; font-size: 1rem; cursor: pointer; }
          button:hover { background: #1f62d1; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>We couldn't reach the local server</h1>
          <p>Image Manipulator tried to connect to <code>${appUrl}</code> but the server never responded.</p>
          <p>${errorMessage}</p>
          <p>Please check the server logs in this window and try again.</p>
          <button onclick="location.reload()">Retry</button>
        </div>
      </body>
    </html>`;

  mainWindow.loadURL(`data:text/html,${encodeURIComponent(html)}`);
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



