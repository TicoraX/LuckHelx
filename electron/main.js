const { app, BrowserWindow } = require('electron');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const isDev = !app.isPackaged;
const PORT = 3000;
const READINESS_TIMEOUT_MS = 30_000;

function waitForServer(url, childProcess) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timeoutId;

    const cleanup = () => {
      clearTimeout(timeoutId);
      childProcess?.off('error', onChildFailure);
      childProcess?.off('exit', onChildExit);
    };

    const settle = (handler, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      handler(value);
    };

    const onChildFailure = (error) => {
      settle(reject, error);
    };

    const onChildExit = (code, signal) => {
      settle(reject, new Error(`Startup server exited before becoming ready (code: ${code}, signal: ${signal || 'none'})`));
    };

    const attempt = () => {
      if (settled) return;

      const request = http.get(url, (response) => {
        response.resume();
        if (response.statusCode >= 200 && response.statusCode < 300) {
          settle(resolve);
          return;
        }

        setTimeout(attempt, 300);
      });

      request.on('error', () => {
        if (!settled) setTimeout(attempt, 300);
      });
    };

    timeoutId = setTimeout(() => {
      settle(reject, new Error(`Timed out waiting for ${url} to become ready`));
    }, READINESS_TIMEOUT_MS);

    childProcess?.once('error', onChildFailure);
    childProcess?.once('exit', onChildExit);
    attempt();
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 900,
    webPreferences: { contextIsolation: true },
  });
  win.loadURL(`http://localhost:${PORT}`);
}

app.whenReady().then(async () => {
  process.env.DB_PATH = path.join(app.getPath('userData'), 'data.db');

  if (isDev) {
    // In dev, Electron owns the Next.js process so DB_PATH is set before `next dev` starts.
    const child = spawn('npm', ['run', 'dev'], {
      env: { ...process.env, DB_PATH: process.env.DB_PATH },
      stdio: 'inherit',
      shell: true,
    });
    app.on('before-quit', () => child.kill());
    try {
      await waitForServer(`http://localhost:${PORT}/api/state`, child);
      createWindow();
    } catch (error) {
      console.error('Failed to start Electron dev server:', error);
      app.quit();
    }
  } else {
    // Packaged build: spawn the standalone Next.js server bundled alongside this app.
    const serverPath = path.join(process.resourcesPath, 'standalone', 'server.js');
    const child = spawn(process.execPath, [serverPath], {
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        PORT: String(PORT),
        NODE_ENV: 'production',
      },
      stdio: 'inherit',
    });
    app.on('before-quit', () => child.kill());
    try {
      await waitForServer(`http://localhost:${PORT}/api/state`, child);
      createWindow();
    } catch (error) {
      console.error('Failed to start packaged server:', error);
      app.quit();
    }
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
