/** @type {import('next').NextConfig} */

// LOCAL REDESIGN PREVIEW ONLY. Enabled by `LOCAL_PREVIEW=1` in .env.local.
// On a developer's machine the /uploads media lives on the production box, not
// in the local checkout, so we proxy it from production AND skip image
// optimization (the Next optimizer can't follow that external proxy).
// This flag is NEVER set on staging or production, where /uploads is on disk
// and full image optimization is used.
const isLocalPreview = process.env.LOCAL_PREVIEW === "1";

const nextConfig = {
  images: {
    ...(isLocalPreview ? { unoptimized: true } : {}),
    minimumCacheTTL: 2678400, // 31 days — optimized variants are cached on disk after first hit
    // WebP only: ~0.09s cold encode vs AVIF's ~1.8s (libvips AVIF is slow on a single 2-vCPU VPS).
    formats: ["image/webp"],
    // Uploads are capped at 2560px on the long edge, so the optimizer never needs the 3840 size.
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 2560],
  },
  async headers() {
    return [
      // Client Presentation pages are token-protected and must never be indexed
      // — belt-and-braces alongside the page's own <meta robots> (see
      // src/app/c/[token]/page.tsx generateMetadata) and robots.ts's disallow.
      { source: "/c/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/sitemap.xml",
        destination: "/api/sitemap",
      },
      // Local preview only: serve /uploads from production so images/video show locally.
      ...(isLocalPreview
        ? [{ source: "/uploads/:path*", destination: "https://cyprusvipestates.com/uploads/:path*" }]
        : []),
    ];
  },
  experimental: {
    // Developer brochures uploaded to the PDF-import server action
    // (src/app/admin/(panel)/developments/[id]/actions.ts) can be ~20 MB —
    // well over Next's default 1 MB server-action body limit, which would
    // otherwise reject the upload outright.
    serverActions: {
      bodySizeLimit: "50mb",
    },
    // geoip-lite (src/lib/geoCountry.ts) locates its bundled .dat files via a
    // path relative to its own package directory at runtime — webpack
    // bundling this into the route chunk breaks that lookup (ENOENT at build
    // time collecting /api/analytics/track). Keeping it external makes Next
    // require() it from node_modules as-is instead.
    serverComponentsExternalPackages: ["geoip-lite"],
  },
};

export default nextConfig;
