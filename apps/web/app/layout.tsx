import type { Metadata, Viewport } from 'next';
import { Providers } from '@/components/providers';
import { getMe } from '@/lib/server';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Haat — Shop online in Bangladesh', template: '%s | Haat' },
  description: 'Phones, fashion, home and beauty delivered across all 64 districts. Cash on delivery, bKash and Nagad.',
};

export const viewport: Viewport = {
  themeColor: '#0b6e4f',
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Galada&family=Hind+Siliguri:wght@400;500;600;700&display=swap"
        />
      </head>
      <body className="min-h-dvh antialiased">
        <Providers me={me}>{children}</Providers>
      </body>
    </html>
  );
}
