import type { MetadataRoute } from 'next';

// Instalable desde el celular porque tailscale serve entrega HTTPS (B7). Los colores son
// los de --bg del tema oscuro, el mismo que fija el meta theme-color del layout.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'LuckHelx',
    short_name: 'LuckHelx',
    description: 'Tareas reales que se convierten en XP para abrir cajas.',
    start_url: '/',
    display: 'standalone',
    background_color: '#14120f',
    theme_color: '#14120f',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
