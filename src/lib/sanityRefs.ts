// Deterministic resolution of Sanity asset references to local /public/uploads paths,
// plus a recursive walker that rewrites embedded asset refs into the dereferenced shape
// ({ asset: { _ref, _id, url, metadata: { dimensions } } }) that the existing components
// and GROQ output expect. Image dimensions are encoded in the ref itself, so no DB lookup
// is needed. (Phase 3 — replaces Sanity CDN dereferencing after the migration.)

import { blurForRef } from "./blurStore";

const IMAGE_RE = /^image-([a-f0-9]+)-(\d+)x(\d+)-(\w+)$/;
const FILE_RE = /^file-([a-f0-9]+)-(\w+)$/;

/** Map a Sanity asset _ref (or already-local/remote url) to a local /uploads path. */
export function refToLocalUrl(ref?: string | null): string | null {
  if (!ref || typeof ref !== "string") return null;
  if (ref.startsWith("/uploads/")) return ref;
  if (ref.startsWith("http")) return ref; // safety: leave absolute urls untouched
  const img = ref.match(IMAGE_RE);
  if (img) return `/uploads/images/${img[1]}-${img[2]}x${img[3]}.${img[4]}`;
  const file = ref.match(FILE_RE);
  if (file) return `/uploads/files/${file[1]}.${file[2]}`;
  return null;
}

/** Pixel dimensions encoded in an image ref, if present. */
export function refDimensions(ref?: string | null): { width: number; height: number } | null {
  if (!ref) return null;
  const m = ref.match(IMAGE_RE);
  return m ? { width: Number(m[2]), height: Number(m[3]) } : null;
}

function isAssetHolder(node: any): boolean {
  return (
    node &&
    typeof node === "object" &&
    node.asset &&
    typeof node.asset === "object" &&
    typeof (node.asset._ref ?? node.asset._id) === "string" &&
    /^(image|file)-/.test(node.asset._ref ?? node.asset._id)
  );
}

/**
 * Recursively walk any value and rewrite every Sanity image/file asset into the
 * dereferenced shape the frontend reads (`asset.url`, `asset.metadata.dimensions`).
 * Non-asset references (author/project/etc.) are left untouched — those are resolved
 * by the per-query Prisma joins in sanity.utils.ts. Returns a new structure (input
 * is not mutated).
 */
export function dereferenceAssets<T = any>(node: T): T {
  // Preserve Date instances — Object.entries(date) is [] so the generic
  // object-walk below would otherwise collapse every Date into {} (this is why
  // blog publishedAt was unreadable downstream).
  if (node instanceof Date) return node;
  if (Array.isArray(node)) {
    return node.map((n) => dereferenceAssets(n)) as unknown as T;
  }
  if (node && typeof node === "object") {
    if (isAssetHolder(node)) {
      const a: any = (node as any).asset;
      const ref: string = a._ref ?? a._id;
      const url = refToLocalUrl(ref);
      const dims = refDimensions(ref);
      const rebuiltAsset: any = {
        _ref: ref,
        _id: ref,
        _type: "sanity.imageAsset",
        url,
        ...(a.url && a.url.startsWith("/uploads/") ? { url: a.url } : {}),
        // Blur placeholder: an explicit one (withBlur) wins, else the process-cached LQIP
        // from blurStore (populated server-side by loadBlurMap) — so every image gets blur.
        ...((a.blurDataURL ?? blurForRef(ref)) ? { blurDataURL: a.blurDataURL ?? blurForRef(ref) } : {}),
        metadata: { ...(a.metadata ?? {}), ...(dims ? { dimensions: dims } : {}) },
      };
      const out: any = {};
      for (const [k, v] of Object.entries(node as any)) {
        out[k] = k === "asset" ? rebuiltAsset : dereferenceAssets(v);
      }
      return out;
    }
    const out: any = {};
    for (const [k, v] of Object.entries(node as any)) out[k] = dereferenceAssets(v);
    return out;
  }
  return node;
}
