import { urlFor } from "@/sanity/sanity.client";
import type { Image as ImageType } from "@/types/homepage";

/* Parallax image band — a full-bleed visual breather. Pure CSS parallax
   (background-attachment: fixed) on desktop pointers; static cover on touch
   and under reduced-motion. Reuses the original parallaxImage. */

const safeUrl = (img: unknown) => {
  try {
    return urlFor(img as never).url();
  } catch {
    return undefined;
  }
};

export default function ParallaxBand({ image }: { image?: ImageType }) {
  const url = image ? safeUrl(image) : undefined;
  if (!url) return null;

  return (
    <section className="parallax" style={{ backgroundImage: `url("${url}")` }}>
      <span className="parallax__scrim" aria-hidden />
    </section>
  );
}
