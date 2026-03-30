// ABOUTME: Next.js configuration for the C.A.D.I.R.O. frontend application.
// ABOUTME: Configures strict mode and image domains for PoE CDN assets.

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'web.poecdn.com' },
    ],
  },
};

export default nextConfig;
