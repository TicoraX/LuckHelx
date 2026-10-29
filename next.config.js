/** @type {import('next').NextConfig} */
const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
];

// Con LUCKHELX_REMOTE_HOST (el <pc>.<tailnet>.ts.net de tailscale serve), `next dev` deja
// pasar los pedidos a /_next/* que llegan desde el celular. Definir la lista pasa Next de
// "avisar" a "bloquear" lo que no este en ella, por eso va 127.0.0.1, que es como Electron
// abre la ventana. Sin la variable no se define y todo queda como antes. En produccion no aplica.
const remoteHost = process.env.LUCKHELX_REMOTE_HOST;

module.exports = {
  output: 'standalone',
  ...(remoteHost ? { allowedDevOrigins: ['127.0.0.1', remoteHost] } : {}),
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};
