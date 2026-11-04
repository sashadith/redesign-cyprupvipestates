/* AGG — manual monthly run from a laptop (agcyprus.com's Cloudflare challenges the
 * prod VPS, so the agg-sync cron cannot fetch it; a residential IP can).
 *
 *   AGG_SOD_URL='<url>' npx tsx --env-file=.env.local scripts/manual-sync/agg-manual-run.mts          # dry run summary
 *   AGG_SOD_URL='<url>' npx tsx --env-file=.env.local scripts/manual-sync/agg-manual-run.mts --diff   # per-unit diff vs DB
 *   AGG_SOD_URL='<url>' npx tsx --env-file=.env.local scripts/manual-sync/agg-manual-run.mts --apply  # real writeAggDraft, logged as agg-sync
 *
 * DeveloperAccount "AGG".driveFolderUrl is the plain https://www.agcyprus.com/marketing/
 * page, which parseShareOneDriveUrl can't read. The page's ShareOneDrive module still
 * works: its HTML carries the listtoken as `data-token="…"`, and one
 * action=shareonedrive-get-filelist call with it returns `accountId` and `driveId`
 * (see agg.ts). AGG_SOD_URL is any admin-ajax URL with those three, e.g.
 *   https://www.agcyprus.com/wp-admin/admin-ajax.php?action=shareonedrive-preview&account_id=<accountId>&drive_id=<driveId>&listtoken=<data-token>
 * (2026-11-03: account_id 68fdac1d-7d5d-4686-824e-746407a66c91, listtoken
 * 07401db8e4b161cb012c334fc45ef2e7.) Only this process reads the account with that
 * URL; the DB row is not changed, so the prod cron keeps failing quietly instead of
 * hitting Cloudflare with a valid link. --apply uses force (the file-name trigger
 * would skip a list whose name equals driveFileModified), which is safe only while
 * every AGG project is published: published = units and prices only, no texts or
 * media regenerated. --diff reports a sold unit missing from the list as GONE; the
 * sync itself leaves sold units sold. */
import { prisma } from "../../src/lib/prisma";
import { dryRunAggSync, writeAggDraft, previewAggSync } from "../../src/lib/aggSync";
import { normalizeRef } from "../../src/lib/unitRef";
import { withCronLog } from "../../src/lib/cronLog";
const REF = process.env.AGG_SOD_URL!;
const orig = prisma.developerAccount.findUnique.bind(prisma.developerAccount);
(prisma.developerAccount as any).findUnique = async (args: any) => {
  const r: any = await orig(args);
  return r && r.slug === "agg" ? { ...r, driveFolderUrl: REF } : r;
};
const id = "7a09c386-abb2-466d-972d-42bfc965b969";
if (process.argv.includes("--diff")) {
  const { plans } = await previewAggSync(id);
  for (const p of plans) {
    const dev = await prisma.development.findUnique({ where: { feedKey: p.feedKey }, select: { units: { select: { ref: true, status: true, price: true, areaBuilt: true } } } });
    const db = new Map((dev?.units ?? []).map((u) => [normalizeRef(u.ref ?? ""), u]));
    const lines: string[] = [];
    for (const u of p.units) {
      const k = normalizeRef(u.ref); const o: any = db.get(k); db.delete(k);
      if (!o) { lines.push(`  NEW ${u.ref} ${u.status} ${u.price ?? ""}`); continue; }
      const np = u.status === "available" ? u.price ?? null : null, op = o.status === "available" ? o.price : null;
      if (o.status !== u.status || np !== op) lines.push(`  ${u.ref}: ${o.status} ${op ?? ""} -> ${u.status} ${np ?? ""}`);
    }
    for (const [k, o] of db) if ((o as any).status !== "unlisted") lines.push(`  GONE ${k} (${(o as any).status}) -> unlisted`);
    console.log(`## ${p.projectName} ${lines.length ? "" : "no change"}`); lines.forEach((l) => console.log(l));
  }
} else if (process.argv.includes("--apply")) {
  const res = await withCronLog("agg-sync", () => writeAggDraft(id, { force: true }));
  console.log(JSON.stringify(res, null, 1));
} else {
  console.log(JSON.stringify(await dryRunAggSync(id), null, 1));
}
await prisma.$disconnect();
