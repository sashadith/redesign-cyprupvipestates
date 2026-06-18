// Phase 3 — Sanity client replaced by local-asset resolution.
// `urlFor()` keeps its call-site API (chainable builder) but resolves Sanity image/file
// refs to local /public/uploads paths, so the ~57 components that use it need no changes.
// Next.js <Image> handles on-the-fly resizing of the originals (WebP/sizes deferred).
import { refToLocalUrl } from "@/lib/sanityRefs";

export const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID as string;
export const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET as string;
export const apiVersion = "2023-10-16";
export const useCdn = false;
export const token = process.env.SANITY_API_TOKEN;

function extractRef(src: any): string | null {
  if (!src) return null;
  if (typeof src === "string") return src;
  if (src.asset) {
    if (typeof src.asset.url === "string" && src.asset.url.startsWith("/uploads/")) return src.asset.url;
    return src.asset._ref ?? src.asset._id ?? null;
  }
  return src._ref ?? src._id ?? (typeof src.url === "string" ? src.url : null);
}

class LocalImageUrlBuilder {
  private ref: string | null;
  constructor(source: any) {
    this.ref = extractRef(source);
  }
  // chainable no-ops — transforms are handled by next/image at render time
  width(..._a: any[]) { return this; }
  height(..._a: any[]) { return this; }
  size(..._a: any[]) { return this; }
  quality(..._a: any[]) { return this; }
  format(..._a: any[]) { return this; }
  auto(..._a: any[]) { return this; }
  fit(..._a: any[]) { return this; }
  dpr(..._a: any[]) { return this; }
  crop(..._a: any[]) { return this; }
  focalPoint(..._a: any[]) { return this; }
  ignoreImageParams(..._a: any[]) { return this; }
  url(): string {
    return refToLocalUrl(this.ref) ?? "";
  }
  toString(): string {
    return this.url();
  }
}

export function urlFor(source: any) {
  return new LocalImageUrlBuilder(source);
}

// Back-compat stub. Direct Sanity fetching is gone; surface a clear error if any
// stray call site remains (all data access goes through Prisma in sanity.utils.ts).
export const client = {
  fetch: async (..._args: any[]): Promise<any> => {
    throw new Error(
      "sanity.client.client.fetch is no longer available — use the Prisma-backed helpers in sanity.utils.ts",
    );
  },
};

export const sanityConfig = { projectId, dataset, apiVersion, useCdn, token };
