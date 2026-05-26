import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['fs', 'path'],

  rewrites: async () => [
    {
      source: '/worlds/:path*',
      destination: '/worlds/:path*',
    },
  ],
};

export default nextConfig;
