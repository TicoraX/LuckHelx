const { app, BrowserWindow } = require('electron');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const isDev = !app.isPackaged;
const PORT = 3000;

function waitForServer(url, callback) {
  const attempt = () => {
    http
      .get(url, () => callback())
      .on('error', () => setTimeout(attempt, 300));
  };
  attempt();
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 900,
    webPreferences: { contextIsolation: true },
  });
  win.loadURL(`http://localhost:${PORT}`);
}

app.whenReady().then(() => {
  process.env.DB_PATH = path.join(app.getPath('userData'), 'data.db');

  if (isDev) {
    // In dev, Electron owns the Next.js process so DB_PATH is set before `next dev` starts.
    const child = spawn('npm', ['run', 'dev'], {
      env: { ...process.env, DB_PATH: process.env.DB_PATH },
      stdio: 'inherit',
      shell: true,
    });
    app.on('before-quit', () => child.kill());
    waitForServer(`http://localhost:${PORT}`, createWindow);
  } else {
    // Packaged build: spawn the standalone Next.js server bundled alongside this app.
    const serverPath = path.join(process.resourcesPath, 'standalone', 'server.js');
    const child = spawn(process.execPath, [serverPath], {
      env: { ...process.env, PORT: String(PORT), NODE_ENV: 'production' },
      stdio: 'inherit',
    });
    app.on('before-quit', () => child.kill());
    waitForServer(`http://localhost:${PORT}`, createWindow);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
