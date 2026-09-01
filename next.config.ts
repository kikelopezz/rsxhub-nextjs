import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  // Pin the workspace root to this project (a stray lockfile in a parent folder was
  // making Next.js infer the wrong root and trace/watch far more files than needed).
  outputFileTracingRoot: path.join(__dirname),

  // Enable gzip/brotli compression for all responses
  compress: true,

  experimental: {
    serverActions: {
      bodySizeLimit: '10mb', // Reduced from 100mb — uploads are compressed to <2MB by the API
    },
  },

  images: {
    // Enable image format negotiation (WebP/AVIF when browser supports it)
    formats: ['image/avif', 'image/webp'],
    // Set aggressive cache TTL for optimized images (1 year)
    minimumCacheTTL: 31536000,
    // Allow higher-quality renditions for photos (logos/thumbnails still use the lower end)
    qualities: [60, 75, 90],
    // Default max is 3840 — too narrow for full-bleed hero images on high-DPI/ultrawide
    // screens (devicePixelRatio multiplies the CSS width, e.g. 2560px @ 2x needs 5120px).
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840, 5120],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.steamstatic.com',
      },
      {
        protocol: 'https',
        hostname: 'avatars.steamstatic.com',
      },
      {
        protocol: 'https',
        hostname: 'steamcdn-a.akamaihd.net',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'placehold.co',
      },
      {
        protocol: 'https',
        hostname: 'api.dicebear.com',
      },
      {
        protocol: 'https',
        hostname: '*.r2.dev',
      },
    ],
  },

  // Reduce bundle size by only including used locales
  // (removes ~1MB from next's built-in i18n polyfills)
  webpack(config, { isServer }) {
    // Tree-shake unused lucide-react icons (they ship ESM so webpack can do this automatically,
    // but we make sure moduleIds are deterministic for better caching)
    config.optimization = {
      ...config.optimization,
      moduleIds: 'deterministic',
    }
    return config
  },
}

export default nextConfig
