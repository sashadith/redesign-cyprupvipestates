/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    minimumCacheTTL: 2678400, // 31 days — optimized variants are cached on disk after first hit
    // WebP only: ~0.09s cold encode vs AVIF's ~1.8s (libvips AVIF is slow on a single 2-vCPU VPS).
    // For Core Web Vitals across 4k+ unique images, fast cold-encode beats AVIF's marginal size
    // win. Revisit AVIF (["image/avif","image/webp"]) once a CDN/edge optimizer fronts the app.
    formats: ["image/webp"],
    // All images are served locally from /public/uploads (content-addressed) — no remote sources.
    // Uploads are capped at 2560px on the long edge, so the optimizer never needs the 3840 size.
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 2560],
  },
  async rewrites() {
    return [
      {
        source: '/sitemap.xml',
        destination: '/api/sitemap',
      },
    ];
  },
};

export default nextConfig;
