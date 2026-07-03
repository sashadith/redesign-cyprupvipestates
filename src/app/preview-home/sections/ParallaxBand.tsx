import { urlFor } from "@/sanity/sanity.client";
import type { Image as ImageType } from "@/types/homepage";

/* Parallax band — a full-bleed visual breather. The preview passes a looping
   background video (sunset.mp4, under /preview-assets); production omits it and
   uses the CMS `parallaxImage` as the fixed background image. Same `.parallax`
   pinned-background effect either way. */

const safeUrl = (img: unknown) => {
  try {
    return urlFor(img as never).url();
  } catch {
    return undefined;
  }
};

export default function ParallaxBand({ image, videoSrc }: { image?: ImageType; videoSrc?: string }) {
  const poster = image ? safeUrl(image) : undefined;

  return (
    <section className="parallax">
      {videoSrc ? (
        <video
          className="parallax__video"
          src={videoSrc}
          poster={poster}
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          aria-hidden
        />
      ) : (
        poster && <img className="parallax__video" src={poster} alt="" aria-hidden />
      )}
      <span className="parallax__scrim" aria-hidden />
    </section>
  );
}
