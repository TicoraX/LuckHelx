const { app, BrowserWindow } = require('electron');
const path = require('path');
const http = require('http');
const net = require('net');
const { spawn } = require('child_process');

const isDev = !app.isPackaged;
const READINESS_TIMEOUT_MS = 30_000;

let activePort = null;

function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('No se pudo reservar un puerto de inicio')));
        return;
      }

      const port = address.port;
      server.close((closeError) => {
        if (closeError) reject(closeError);
        else resolve(port);
      });
    });
  });
}

function waitForServer(port, childProcess) {
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

      const request = http.get(
        {
          hostname: '127.0.0.1',
          port,
          path: '/api/state',
        },
        (response) => {
          response.resume();
          if (response.statusCode >= 200 && response.statusCode < 300) {
            settle(resolve);
            return;
          }

          setTimeout(attempt, 300);
        }
      );

      request.on('error', () => {
        if (!settled) setTimeout(attempt, 300);
      });
    };

    timeoutId = setTimeout(() => {
      settle(reject, new Error(`Timed out waiting for 127.0.0.1:${port}/api/state to become ready`));
    }, READINESS_TIMEOUT_MS);

    childProcess?.once('error', onChildFailure);
    childProcess?.once('exit', onChildExit);
    attempt();
  });
}

function killProcessTree(childProcess) {
  if (!childProcess || childProcess.killed) return;

  if (process.platform === 'win32') {
    const killer = spawn('taskkill', ['/pid', String(childProcess.pid), '/t', '/f'], { stdio: 'ignore' });
    killer.unref();
    return;
  }

  childProcess.kill('SIGTERM');
}

function createWindow() {
  if (activePort === null) return;

  const win = new BrowserWindow({
    width: 1280,
    height: 900,
    webPreferences: { contextIsolation: true },
  });
  win.loadURL(`http://127.0.0.1:${activePort}`);
}

async function startLaunch() {
  activePort = await getAvailablePort();

  if (isDev) {
    const child = spawn('npm', ['run', 'dev'], {
      env: {
        ...process.env,
        DB_PATH: process.env.DB_PATH,
        ELECTRON_RUN_AS_NODE: '1',
        HOSTNAME: '127.0.0.1',
        PORT: String(activePort),
      },
      stdio: 'inherit',
      shell: true,
    });

    app.on('before-quit', () => killProcessTree(child));

    await waitForServer(activePort, child);
    createWindow();
    return;
  }

  const serverPath = path.join(process.resourcesPath, 'standalone', 'server.js');
  const child = spawn(process.execPath, [serverPath], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      HOSTNAME: '127.0.0.1',
      PORT: String(activePort),
      NODE_ENV: 'production',
    },
    stdio: 'inherit',
  });

  app.on('before-quit', () => killProcessTree(child));

  await waitForServer(activePort, child);
  createWindow();
}

app.whenReady().then(() => {
  process.env.DB_PATH = path.join(app.getPath('userData'), 'data.db');
  startLaunch().catch((error) => {
    console.error('Failed to start Electron app:', error);
    app.quit();
  });
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0 && activePort !== null) {
    createWindow();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
