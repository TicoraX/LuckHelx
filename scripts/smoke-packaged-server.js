const fs = require('fs');
const http = require('http');
const net = require('net');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

function getElectronBinary() {
  const electronPackageDir = path.dirname(require.resolve('electron/package.json'));
  return path.join(electronPackageDir, 'dist', process.platform === 'win32' ? 'electron.exe' : 'electron');
}

function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('No se pudo reservar un puerto libre')));
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
    const timeoutId = setTimeout(() => reject(new Error('Timed out waiting for packaged server startup')), 30000);

    const onExit = (code, signal) => {
      clearTimeout(timeoutId);
      reject(new Error(`Packaged server exited before readiness (code: ${code}, signal: ${signal || 'none'})`));
    };

    childProcess.once('exit', onExit);
    childProcess.once('error', (error) => {
      clearTimeout(timeoutId);
      reject(error);
    });

    const attempt = () => {
      http
        .get({ hostname: '127.0.0.1', port, path: '/api/state' }, (response) => {
          response.resume();
          if (response.statusCode >= 200 && response.statusCode < 300) {
            clearTimeout(timeoutId);
            childProcess.off('exit', onExit);
            resolve();
            return;
          }
          setTimeout(attempt, 300);
        })
        .on('error', () => setTimeout(attempt, 300));
    };

    attempt();
  });
}

async function main() {
  const standaloneServer = path.resolve(__dirname, '..', '.next', 'standalone', 'server.js');
  if (!fs.existsSync(standaloneServer)) {
    throw new Error('No existe .next/standalone/server.js. Ejecuta primero npm run build.');
  }

  const port = await getAvailablePort();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'estiri-smoke-'));
  const dbPath = path.join(tempDir, 'data.db');

  const child = spawn(getElectronBinary(), [standaloneServer], {
    env: {
      ...process.env,
      DB_PATH: dbPath,
      ELECTRON_RUN_AS_NODE: '1',
      HOSTNAME: '127.0.0.1',
      NODE_ENV: 'production',
      PORT: String(port),
    },
    stdio: 'inherit',
  });

  try {
    await waitForServer(port, child);
    console.log(`Packaged server started successfully on 127.0.0.1:${port}`);
  } finally {
    child.kill();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});