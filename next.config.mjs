/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Trust proxy headers (x-forwarded-host, x-forwarded-proto) set by Coolify's
  // reverse proxy so server-side code sees the real public domain, not localhost.
  experimental: {
    trustHostHeader: true,
  },
};

export default nextConfig;
