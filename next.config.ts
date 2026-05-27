import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // fs and path are used in API route handlers to read world data from the filesystem
  serverExternalPackages: ['fs', 'path'],

  
  // In production, copy worlds/ into public/worlds/ before build.
  // Next.js serves public/ files at the root URL path automatically,
  // so /worlds/* will serve public/worlds/* as static files.
  //
  // In development, there are no static files in public/worlds/,
  // so this rewrite proxies /worlds/* requests to the API route
  // which reads directly from the worlds/ directory at project root.
  // Next.js checks public/ for static files BEFORE applying rewrites,
  // so in production the static files are served directly and this
  // rewrite is never reached.
  rewrites: async () => [
    {
      source: '/worlds/:worldId/:path*',
      destination: '/api/worlds/:worldId/:path*',
    },
  ],
};

export default nextConfig;