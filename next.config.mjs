/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Trust x-forwarded-host and x-forwarded-proto headers from Coolify's
  // Traefik reverse proxy so server-side code sees the real public domain.
  experimental: {
    trustHostHeader: true,
  },
};

export default nextConfig;
