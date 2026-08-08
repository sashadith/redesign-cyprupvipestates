// Pure, client-safe image-size helpers (no server deps). Feeds encode the size
// variant of an image in one of three ways:
//   • suffix  (INEX/Qubehub): …_medium.avif
//   • UPPERCASE prefix (BBF): …/projects/MEDIUM_<uuid>.jpg
//   • Weblium/Domenica: …_optimized.webp (full) vs …_optimized_1396.webp
//     (a smaller pre-generated derivative — the trailing number is that
//     variant's own pixel width, confirmed live; 1396/1520/1350/… all seen)
// These helpers normalise all three so variants can be grouped (sizeKey),
// identified (sizeOf) and swapped to the quality a component actually needs
// (atSize).
const SUFFIX_RE = /_(small|medium|large)(?=[._])/i;
const PREFIX_RE = /(^|\/)(small|medium|large)_/i;
// Domenica's feed lists BOTH the full "_optimized.webp" and a smaller
// "_optimized_<N>.webp" as separate <image> entries for the SAME photo
// (confirmed 2026-08-08: e.g. Cirvis's hero photo, 1920x1280 vs 1396x931 —
// same image, same hash prefix, two derivatives). Before this pattern was
// recognised, sizeKey()/sizeOf() treated both as unrelated "single" images,
// so sizedImages() kept BOTH instead of grouping+picking one — the same
// photo appeared twice in the gallery, once full-size, once as the smaller
// derivative. Mapped onto the existing small/medium/large vocabulary so the
// normal grouping mechanism does the deduping: unnumbered → "large" (it's
// the biggest derivative ever seen), numbered → "medium" (see xml2u's
// sizedImages() calls in feeds.ts, which now explicitly ask for "large" so
// the bigger one wins whenever both exist for the same photo — Pafilia,
// the other xml2u source, never matches this pattern at all, so it's
// unaffected; every current single-derivative Domenica image also falls
// through the "single" bucket exactly as before, unaffected too).
const WEBLIUM_RE = /_optimized(?:_(\d+))?(?=\.[a-z0-9]+$)/i;

export const atSize = (url: string, size: "small" | "medium" | "large") => {
  if (!url) return url;
  if (SUFFIX_RE.test(url)) return url.replace(SUFFIX_RE, `_${size}`);
  if (PREFIX_RE.test(url)) return url.replace(PREFIX_RE, (_m, slash) => `${slash}${size.toUpperCase()}_`);
  return url;
};
// collapse every size variant of the same image to one identical key
export const sizeKey = (url: string) =>
  url.replace(SUFFIX_RE, "_@@").replace(PREFIX_RE, (_m, slash) => `${slash}@@_`).replace(WEBLIUM_RE, "_optimized_@@");
// the size a given url represents ("single" when the feed ships only one)
export const sizeOf = (url: string) => {
  const suffix = url.match(SUFFIX_RE)?.[1];
  if (suffix) return suffix.toLowerCase();
  const prefix = url.match(PREFIX_RE)?.[2];
  if (prefix) return prefix.toLowerCase();
  const weblium = url.match(WEBLIUM_RE);
  if (weblium) return weblium[1] ? "medium" : "large"; // numbered = smaller derivative, unnumbered = the full one
  return "single";
};
