import { urlFor } from "@/sanity/sanity.client";
import type { Image as ImageType } from "@/types/homepage";

/* Parallax band — a full-bleed visual breather. Now a looping background video
   (sunset.mp4). The original parallaxImage is kept as the poster fallback.
   The video lives under /preview-assets so the i18n middleware leaves it alone. */

const VIDEO_SRC = "/preview-assets/sunset.mp4";

const safeUrl = (img: unknown) => {
  try {
    return urlFor(img as never).url();
  } catch {
    return undefined;
  }
};

export default function ParallaxBand({ image }: { image?: ImageType }) {
  const poster = image ? safeUrl(image) : undefined;

  return (
    <section className="parallax">
      <video
        className="parallax__video"
        src={VIDEO_SRC}
        poster={poster}
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        aria-hidden
      />
      <span className="parallax__scrim" aria-hidden />
    </section>
  );
}
