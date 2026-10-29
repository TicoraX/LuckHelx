import net from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveStartupPort } from './port';

let blocker: net.Server | null = null;

afterEach(async () => {
  await new Promise<void>((resolve) => (blocker ? blocker.close(() => resolve()) : resolve()));
  blocker = null;
});

function occupy(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    blocker = server;
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address && typeof address !== 'string') resolve(address.port);
      else reject(new Error('El bloqueador no obtuvo puerto'));
    });
  });
}

describe('resolveStartupPort', () => {
  it('sin LUCKHELX_PORT devuelve un puerto libre aleatorio', async () => {
    const port = await resolveStartupPort(undefined);
    expect(port).toBeGreaterThan(0);
  });

  it('con el puerto libre devuelve exactamente ese', async () => {
    const free = await resolveStartupPort(undefined);
    expect(await resolveStartupPort(String(free))).toBe(free);
  });

  it('con el puerto ocupado aborta nombrando el puerto, sin caer a otro', async () => {
    const busy = await occupy();
    await expect(resolveStartupPort(String(busy))).rejects.toThrow(`El puerto ${busy}`);
  });

  it('rechaza valores que no son puerto', async () => {
    await expect(resolveStartupPort('abc')).rejects.toThrow('no es un puerto valido');
    await expect(resolveStartupPort('70000')).rejects.toThrow('no es un puerto valido');
  });
});
