/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,

  // API rewrites for local development and skill file proxying
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    return [
      // Proxy API requests
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
      // Proxy skill files from API (for install.sh, skill.md, etc.)
      {
        source: '/install.sh',
        destination: `${apiUrl}/install.sh`,
      },
      {
        source: '/skill.md',
        destination: `${apiUrl}/skill.md`,
      },
      {
        source: '/skill.json',
        destination: `${apiUrl}/skill.json`,
      },
      {
        source: '/heartbeat.md',
        destination: `${apiUrl}/heartbeat.md`,
      },
      {
        source: '/tools.md',
        destination: `${apiUrl}/tools.md`,
      },
      {
        source: '/messaging.md',
        destination: `${apiUrl}/messaging.md`,
      },
    ];
  },

  // Image optimization
  images: {
    domains: ['localhost'],
    formats: ['image/avif', 'image/webp'],
  },

  // Environment variables available to the browser
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001',
  },
};

module.exports = nextConfig;
