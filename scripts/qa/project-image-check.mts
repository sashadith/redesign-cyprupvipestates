// Testbed verification for heroImageUrl / publicUrlAbsolute on the project
// MCP tools (2026-10-19). Runs the shared helpers against DATABASE_URL — which
// must be the disposable testbed DB (/opt/cvp-testbed, DEPLOYMENT.md):
//
//   cd /opt/cvp-testbed/<worktree> && set -a && source /opt/cvp-testbed/.env.testbed && set +a
//   npx tsx scripts/qa/project-image-check.mts [published-slug]
//
// Read-only on the DB; network = HEAD requests against the live site. Also
// lists every published project whose hero is still a vendor URL (not
// mirrored by us) — the social routine re-uploads images, so those work, but
// they depend on a third-party host. Exits 1 on the first failed assertion.
// @ts-expect-error — plain .mjs module without a declaration file
import { assertNotProdDb } from "../assert-not-prod-db.mjs";
assertNotProdDb();
import { prisma } from "@/lib/prisma";
import { heroImageUrl, isMirroredImage, resolveHeroImage, absoluteUrls } from "@/lib/developmentHero";
import { publicUrlFor } from "@/lib/crm/inventorySearch";

let failures = 0;
const check = (ok: boolean, msg: string) => { console.log(`${ok ? "✓" : "✗"} ${msg}`); if (!ok) failures++; };
const head = async (url: string) => { try { const r = await fetch(url, { method: "HEAD", redirect: "manual" }); return { status: r.status, type: r.headers.get("content-type") ?? "" }; } catch { return { status: -1, type: "" }; } };

const select = { id: true, slug: true, publicName: true, publishStatus: true, gallery: true, override: { select: { mainImage: true, gallery: true } } } as const;
const SLUG = process.argv[2] ?? "cap-st-georges-resort";

// 1. one published project: image loads, four+ absolute URLs load
const pub = await prisma.development.findFirst({ where: { slug: SLUG, publishStatus: "published" }, select });
check(!!pub, `published project "${SLUG}" exists`);
if (pub) {
  const hero = heroImageUrl(pub);
  console.log(`  heroImageUrl: ${hero}`);
  check(!!hero, "heroImageUrl is set");
  if (hero) {
    const r = await head(hero);
    check(r.status === 200 && /^image\//.test(r.type), `HEAD hero → ${r.status} ${r.type}`);
    check(isMirroredImage(hero), "hero is served from our own /uploads/ (largest mirrored tier)");
    check(/_large\.webp$/.test(hero), "hero is the _large.webp tier");
  }
  const urls = absoluteUrls(publicUrlFor(pub.slug, pub.publishStatus));
  check(!!urls && Object.values(urls).every((u) => u.startsWith("https://cyprusvipestates.com/")), `publicUrlAbsolute: ${JSON.stringify(urls)}`);
  for (const [l, u] of Object.entries(urls ?? {})) {
    if (l === "he") continue; // launch-gated locale — not advertised, may redirect
    const r = await head(u);
    check(r.status === 200, `HEAD ${l} ${u} → ${r.status}`);
  }
}

// 2. an unpublished project with images → null
const unpub = await prisma.development.findFirst({ where: { publishStatus: { in: ["draft", "ready"] } }, select, orderBy: { updatedAt: "desc" } });
check(!!unpub, `an unpublished project exists (${unpub?.publishStatus} "${unpub?.publicName}")`);
if (unpub) {
  check(resolveHeroImage(unpub) !== null || true, `(it ${resolveHeroImage(unpub) ? "has" : "has no"} images — the gate must not depend on that)`);
  check(heroImageUrl(unpub) === null, "unpublished project → heroImageUrl null");
  check(absoluteUrls(publicUrlFor(unpub.slug, unpub.publishStatus)) === null, "unpublished project → publicUrlAbsolute null");
}

// 3. census over every published project
const all = await prisma.development.findMany({ where: { publishStatus: "published" }, select, orderBy: { publicName: "asc" } });
const noHero = all.filter((d) => heroImageUrl(d) === null);
const vendor = all.map((d) => ({ d, hero: heroImageUrl(d) })).filter((x) => x.hero && !isMirroredImage(x.hero));
console.log(`  published: ${all.length}; with hero: ${all.length - noHero.length}; no image at all: ${noHero.length}; vendor-hosted hero: ${vendor.length}`);
if (noHero.length) console.log("  no image:", noHero.map((d) => d.slug).join(", "));
if (vendor.length) {
  console.log("  vendor-hosted heroes (third-party dependency):");
  for (const { d, hero } of vendor) console.log(`    ${d.slug}  →  ${hero}`);
}
// sample 10 mirrored heroes across developers: must all load as images
const sample = all.filter((d) => heroImageUrl(d) && isMirroredImage(heroImageUrl(d)!)).filter((_, i, a) => i % Math.max(1, Math.floor(a.length / 10)) === 0).slice(0, 10);
let okCount = 0;
for (const d of sample) { const r = await head(heroImageUrl(d)!); if (r.status === 200 && /^image\//.test(r.type)) okCount++; else console.log(`    ✗ ${d.slug}: ${r.status} ${r.type}`); }
check(okCount === sample.length, `${okCount}/${sample.length} sampled mirrored heroes load as images`);

await prisma.$disconnect();
console.log(failures ? `\n${failures} check(s) FAILED` : "\nall checks passed");
process.exit(failures ? 1 : 0);
