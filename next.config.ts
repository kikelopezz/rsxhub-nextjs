import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  // Pin the workspace root to this project (a stray lockfile in a parent folder was
  // making Next.js infer the wrong root and trace/watch far more files than needed).
  outputFileTracingRoot: path.join(__dirname),

  // Enable gzip/brotli compression for all responses
  compress: true,

  // Don't advertise the framework in every response.
  poweredByHeader: false,

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

  // Baseline security headers for every response. The CSP is deliberately limited to directives
  // that can't break the app (no script-src/img-src: Next inlines scripts and images come from
  // several CDNs) — it still stops clickjacking, <object>/<base> injection.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=15552000' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'self'; object-src 'none'; base-uri 'self'" },
        ],
      },
    ]
  },
}

export default nextConfig
