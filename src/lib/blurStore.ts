// Pure, client-safe in-memory store for image blur placeholders (LQIP), keyed by
// Sanity asset ref. Populated server-side once per process by `loadBlurMap()` in
// blur.ts; read synchronously by `dereferenceAssets` so every image gets its blur.
// NOTE: no Prisma/server imports here — this module is reachable from client
// components via sanityRefs/urlFor, so it must stay dependency-free.

let MAP: Map<string, string> = new Map();

export function setBlurMap(m: Map<string, string>): void {
  MAP = m;
}

export function blurForRef(ref?: string | null): string | null {
  if (!ref) return null;
  return MAP.get(ref) ?? null;
}

export function blurMapSize(): number {
  return MAP.size;
}
