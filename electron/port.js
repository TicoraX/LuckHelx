const net = require('net');

// Escucha un momento en 127.0.0.1:port y libera. Con port 0 el sistema elige uno libre.
function listenOnce(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(port, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('No se pudo reservar un puerto de inicio')));
        return;
      }

      const bound = address.port;
      server.close((closeError) => {
        if (closeError) reject(closeError);
        else resolve(bound);
      });
    });
  });
}

// Sin LUCKHELX_PORT, puerto aleatorio como siempre. Con la variable se usa ese puerto o se
// aborta: caer a otro en silencio dejaria la URL del celular (tailscale serve) apuntando a
// la nada, o peor, a otro servidor que ya escuche ahi y responda /api/state.
async function resolveStartupPort(fixedPort) {
  if (fixedPort === undefined || fixedPort === '') return listenOnce(0);

  const port = Number(fixedPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`LUCKHELX_PORT="${fixedPort}" no es un puerto valido (1-65535)`);
  }

  try {
    return await listenOnce(port);
  } catch (error) {
    if (error.code === 'EADDRINUSE' || error.code === 'EACCES') {
      throw new Error(
        `El puerto ${port} (LUCKHELX_PORT) no esta disponible (${error.code}). ` +
          'Cerra el proceso que lo usa o elegi otro puerto; LuckHelx no arranca en uno distinto.'
      );
    }
    throw error;
  }
}

module.exports = { resolveStartupPort };
