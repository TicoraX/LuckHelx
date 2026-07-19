import { Roboto_Slab, Inter, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

const robotoSlab = Roboto_Slab({ subsets: ['latin'], variable: '--font-heading', display: 'swap' });
const inter = Inter({ subsets: ['latin'], variable: '--font-body', display: 'swap' });
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['500', '600'], variable: '--font-mono', display: 'swap' });

// Runs before React hydrates — reads the saved theme (or system preference) and applies
// data-theme immediately, so there's no flash of the wrong theme on first paint.
const NO_FLASH_SCRIPT = `
(function() {
  try {
    var stored = localStorage.getItem('theme');
    var theme = stored || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${robotoSlab.variable} ${inter.variable} ${plexMono.variable}`}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#14120f" />
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
