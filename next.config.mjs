/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Trust the x-forwarded-host header from Coolify's reverse proxy
  // so that server-side code (auth callback) sees the real public domain.
  experimental: {
    trustHostHeader: true,
  },
};

export default nextConfig;
