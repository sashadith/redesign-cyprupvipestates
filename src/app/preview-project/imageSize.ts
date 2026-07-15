// Pure, client-safe image-size helpers (no server deps). Feeds encode the size
// variant of an image in one of two ways:
//   • suffix  (INEX/Qubehub): …_medium.avif
//   • UPPERCASE prefix (BBF): …/projects/MEDIUM_<uuid>.jpg
// These helpers normalise both so variants can be grouped (sizeKey), identified
// (sizeOf) and swapped to the quality a component actually needs (atSize).
const SUFFIX_RE = /_(small|medium|large)(?=[._])/i;
const PREFIX_RE = /(^|\/)(small|medium|large)_/i;

export const atSize = (url: string, size: "small" | "medium" | "large") => {
  if (!url) return url;
  if (SUFFIX_RE.test(url)) return url.replace(SUFFIX_RE, `_${size}`);
  if (PREFIX_RE.test(url)) return url.replace(PREFIX_RE, (_m, slash) => `${slash}${size.toUpperCase()}_`);
  return url;
};
// collapse every size variant of the same image to one identical key
export const sizeKey = (url: string) => url.replace(SUFFIX_RE, "_@@").replace(PREFIX_RE, (_m, slash) => `${slash}@@_`);
// the size a given url represents ("single" when the feed ships only one)
export const sizeOf = (url: string) => (url.match(SUFFIX_RE)?.[1] ?? url.match(PREFIX_RE)?.[2] ?? "single").toLowerCase();
