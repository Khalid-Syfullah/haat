import type { NextConfig } from 'next';

const API_URL = process.env.API_URL || 'http://localhost:4000';

const config: NextConfig = {
  // The browser only ever talks to this origin; API calls and uploaded images are proxied.
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${API_URL}/api/:path*` },
      { source: '/uploads/:path*', destination: `${API_URL}/uploads/:path*` },
    ];
  },
  poweredByHeader: false,
};

export default config;
