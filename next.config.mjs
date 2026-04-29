/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Trust reverse-proxy headers (x-forwarded-host, x-forwarded-proto) set by
  // Coolify's Traefik so server-side code resolves the real public domain.
  experimental: {
    trustHostHeader: true,
  },
};

export default nextConfig;
