import React from "react";

/* Below-the-fold image for the homepage sections.

   The CMS stores originals up to 2560 px and urlFor().width() is a no-op, so a plain
   <img src={urlFor(..).url()}> shipped the full original to every phone (the 2026-10-16
   Lighthouse run found ~3 MB of oversized and ~3.6 MB of off-screen images). This
   serves local raster uploads through the Next optimizer (WebP, cached 31 days, see
   next.config.mjs) with a width srcset, and lazy-loads them. SVG / external URLs pass
   through untouched. Do NOT use it for the hero or the nav logo (LCP candidates). */

const RASTER = /^\/uploads\/.+\.(jpe?g|png|webp)$/i;
const WIDTHS = [384, 640, 750, 828, 1080, 1200];

/** One optimized URL for places that take a single URL (CSS background, video poster). */
export function optUrl(src: string, w = 1080): string {
  return RASTER.test(src) ? `/_next/image?url=${encodeURIComponent(src)}&w=${w}&q=75` : src;
}

type Props = Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src" | "srcSet"> & {
  src: string;
  alt: string;
  maxWidth?: number; // widest variant worth generating (CSS px * DPR ceiling)
  widths?: number[]; // explicit variant widths (must be Next image sizes), e.g. small logos
};

export default function OptImg({ src, alt, sizes = "(max-width: 768px) 100vw, 50vw", maxWidth = 1200, widths: explicitWidths, ...rest }: Props) {
  if (!RASTER.test(src)) {
    return <img src={src} alt={alt} loading="lazy" decoding="async" {...rest} />;
  }
  const enc = encodeURIComponent(src);
  const widths = explicitWidths ?? WIDTHS.filter((w) => w <= maxWidth);
  const srcSet = widths.map((w) => `/_next/image?url=${enc}&w=${w}&q=75 ${w}w`).join(", ");
  const fallback = `/_next/image?url=${enc}&w=${widths[Math.min(2, widths.length - 1)]}&q=75`;
  return <img src={fallback} srcSet={srcSet} sizes={sizes} alt={alt} loading="lazy" decoding="async" {...rest} />;
}
