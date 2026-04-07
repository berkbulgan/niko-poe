// ABOUTME: Root layout for the C.A.D.I.R.O. application with font loading and providers.
// ABOUTME: Wraps all pages with QueryProvider + AuthProvider, applies dark PoE theme and metadata.

import type { Metadata } from 'next';
import { Inter, JetBrains_Mono, Cinzel } from 'next/font/google';
import { Providers } from '@/app/providers';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

const cinzel = Cinzel({
  subsets: ['latin'],
  variable: '--font-cinzel',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'C.A.D.I.R.O.',
  description: 'Path of Exile 1 Trade Helper — regex-powered item search and filtering',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} ${cinzel.variable}`}
    >
      <body className="min-h-screen bg-poe-bg font-sans text-poe-text">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
