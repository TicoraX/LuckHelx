import type { Metadata } from 'next';
import { Roboto_Slab, Inter, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

export const metadata: Metadata = {
  title: 'EStiri — Sistema de Recompensas y Hábitos Gamificados',
  description: 'Convierte tus tareas y hábitos diarios en XP para abrir cajas de CS2, coleccionar skins e intercambiar en contratos de trade-up.',
  metadataBase: new URL('https://estiri.local'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'EStiri — Sistema de Recompensas',
    description: 'Convierte tus tareas y hábitos diarios en XP para abrir cajas de CS2.',
    type: 'website',
    locale: 'es_ES',
    siteName: 'EStiri',
  },
  twitter: {
    card: 'summary',
    title: 'EStiri — Sistema de Recompensas',
    description: 'Convierte tus tareas y hábitos diarios en XP para abrir cajas de CS2.',
  },
};

const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'EStiri',
  applicationCategory: 'ProductivityApplication',
  operatingSystem: 'Windows, Web',
  description: 'Sistema de productividad y recompensas gamificado con economía CS2.',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
};

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

import KeyboardShortcuts from '@/components/KeyboardShortcuts';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${robotoSlab.variable} ${inter.variable} ${plexMono.variable}`} suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#14120f" />
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
      </head>
      <body>
        <KeyboardShortcuts />
        {children}
      </body>
    </html>
  );
}
