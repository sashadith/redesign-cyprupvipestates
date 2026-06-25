// Server-only loader for the image blur-placeholder cache. Loads every Media row's
// lqip-derived blurDataUrl into the (client-safe) blurStore ONCE per process; after
// that, `dereferenceAssets` attaches blur to every image synchronously with no extra
// DB hits. Call `loadBlurMap()` at the top of image-bearing data functions — it's
// memoized, so only the first call touches the DB.
import "server-only";
import { prisma } from "./prisma";
import { setBlurMap } from "./blurStore";

let loaded = false;
let inflight: Promise<void> | null = null;

export async function loadBlurMap(): Promise<void> {
  if (loaded) return;
  if (inflight) return inflight;
  inflight = (async () => {
    const rows = await prisma.media.findMany({
      where: { blurDataUrl: { not: null } },
      select: { sanityAssetId: true, blurDataUrl: true },
    });
    const map = new Map<string, string>();
    for (const r of rows) if (r.sanityAssetId && r.blurDataUrl) map.set(r.sanityAssetId, r.blurDataUrl);
    setBlurMap(map);
    loaded = true;
  })();
  return inflight;
}
