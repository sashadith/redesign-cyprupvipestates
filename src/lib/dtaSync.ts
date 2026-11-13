import { prisma } from "@/lib/prisma";
import { dropboxConfigured, getDropboxAccessToken, listSharedFolder, downloadSharedFile, isDropboxShareUrl, type DropboxFile } from "./dropbox";
import { readPdfPages, type PdfPage } from "./ai/availabilityTable";
import { DTA_PROJECTS, dtaFeedKey, findDtaProjectFolder, findDtaPriceFolder, findDtaPriceList, parseDtaPriceList, planDtaWrite, priceRangeAfter, type DtaProject } from "./dta";
import { recomputeDevelopmentDerivedState } from "./developmentDerivedState";
import { beginSyncWindow } from "./imageMirror";
import { intervalMs, notDueYet } from "./syncInterval";

/* DTA Group — daily price-list sync (2026-11-13). The pure rules are in dta.ts;
   this file is the Dropbox + database half. Modelled on stylianidesSync.ts.

   WHERE THE LINK LIVES: DeveloperAccount.developerCloudUrl of the account with
   slug "dta" — the one Dropbox share holding every DTA project folder. NOT
   driveFolderUrl: a Dropbox link there makes the admin developer page offer
   "Sync Dropbox now", which runs the Kuutio importer (dropboxAvailabilitySync)
   on the share and would create a draft project from every folder, FOR RENT
   included. developerCloudUrl is read by no sync at all (only shown on the admin
   developer page as a link), so this connector is its only reader. The link is
   a bearer credential and never appears in the repo or in this job's output.

   SCOPE: the six projects of DTA_PROJECTS that have a price list. Their
   Developments are found by feedKey "manual:dta-<slug>" ON THIS ACCOUNT; Alti
   (no price list), the deck, FOR RENT and Level Plots are never read.

   WHAT IT WRITES: status and price of existing units, "unlisted" for a unit
   missing from its list, and the Development's price range + syncedAt (unit
   counts via recomputeDevelopmentDerivedState). Never a unit's areas, type or
   texts, never a description, gallery or project field, never a new or deleted
   unit. Per project all unit writes go in one transaction.

   WHAT IT WILL NOT DO: anything planDtaWrite refuses (no units, an unreadable
   row, a stranger reference, a gap in a full table, wholesale drift) is written
   nowhere and fails the run, so the failure streak reaches Telegram.

   UNCHANGED FILES: each list's path and modified time is remembered in
   DeveloperAccount.driveFileModified (the Drive sync's column and meaning), so a
   daily run costs a few folder listings and downloads only a list DTA changed.
   A refused list is NOT remembered, so it is read again the next day. */

export const DTA_ACCOUNT_SLUG = "dta";

export type DtaProjectResult = {
  project: string;
  developmentId?: string;
  file?: string;
  listDate?: string | null;
  outcome: "written" | "unchanged" | "refused" | "dry-run" | "skipped";
  units?: number;
  changes?: string[];
  issues: string[];
};

export type DtaSyncResult = { ok: boolean; message: string; notDue?: string; projects: DtaProjectResult[] };

const sigOf = (developmentId: string, f: DropboxFile) => `${developmentId}:${f.id}:${f.modifiedTime}`;

async function locateList(shareUrl: string, root: DropboxFile[], p: DtaProject, token: string): Promise<{ file: DropboxFile | null; issues: string[] }> {
  const issues: string[] = [];
  const { folder, issue } = findDtaProjectFolder(root, p);
  if (!folder) return { file: null, issues: [issue!] };
  const priceFolder = findDtaPriceFolder(await listSharedFolder(shareUrl, folder.id, token));
  if (!priceFolder) return { file: null, issues: [`no Price List folder in ${folder.name}`] };
  const { file, others } = findDtaPriceList(await listSharedFolder(shareUrl, priceFolder.id, token), p);
  if (!file) return { file: null, issues: [`no price list PDF in ${folder.name}/${priceFolder.name}`] };
  if (others.length) issues.push(`newest of ${others.length + 1} PDFs used; also there: ${others.join(", ")}`);
  return { file, issues };
}

export async function syncDta(
  developerAccountId: string,
  opts: { force?: boolean; respectInterval?: boolean; dryRun?: boolean; onlyDevelopmentId?: string } = {},
): Promise<DtaSyncResult> {
  const acct = await prisma.developerAccount.findUnique({ where: { id: developerAccountId } });
  if (!acct) throw new Error("DTA developer account not found");
  if (!dropboxConfigured()) throw new Error("Dropbox is not configured (DROPBOX_APP_KEY / DROPBOX_APP_SECRET / DROPBOX_REFRESH_TOKEN)");
  const shareUrl = acct.developerCloudUrl;
  if (!isDropboxShareUrl(shareUrl)) throw new Error("No Dropbox share link in the DTA account's developerCloudUrl");

  if (opts.respectInterval && !opts.force && !opts.dryRun && notDueYet(acct.driveSyncInterval, acct.driveSyncedAt)) {
    const iv = intervalMs(acct.driveSyncInterval);
    const notDue = iv === Infinity
      ? "Interval is off — scheduled run skipped."
      : `Not due yet (${acct.driveSyncInterval ?? "daily"}, last synced ${acct.driveSyncedAt!.toISOString()}).`;
    return { ok: true, message: notDue, notDue, projects: [] };
  }

  const devs = await prisma.development.findMany({
    where: { developerAccountId, feedKey: { in: DTA_PROJECTS.map((p) => dtaFeedKey(p.slug)) } },
    select: { id: true, feedKey: true, publicName: true, publishStatus: true },
  });
  const devByKey = new Map(devs.map((d) => [d.feedKey, d]));

  const prevSigs = new Set((acct.driveFileModified ?? "").split("|").filter(Boolean));
  const nextSigs: string[] = [];
  const results: DtaProjectResult[] = [];
  const release = opts.dryRun ? () => {} : beginSyncWindow("dropbox:dta");
  try {
    const token = await getDropboxAccessToken();
    const root = await listSharedFolder(shareUrl!, "", token);
    for (const p of DTA_PROJECTS) {
      const dev = devByKey.get(dtaFeedKey(p.slug));
      if (opts.onlyDevelopmentId && dev?.id !== opts.onlyDevelopmentId) continue;
      const r: DtaProjectResult = { project: dev?.publicName ?? p.name, developmentId: dev?.id, outcome: "refused", issues: [] };
      results.push(r);
      if (!dev) { r.issues.push(`no Development ${dtaFeedKey(p.slug)} on this account`); continue; }
      if (dev.publishStatus === "archived") { r.outcome = "skipped"; r.issues.push("archived — not synced"); continue; }

      let file: DropboxFile | null;
      try {
        const found = await locateList(shareUrl!, root, p, token);
        r.issues.push(...found.issues);
        file = found.file;
      } catch (e) { r.issues.push(`could not list the folder: ${e instanceof Error ? e.message : String(e)}`); continue; }
      if (!file) continue;
      r.file = file.name;
      const sig = sigOf(dev.id, file);
      if (!opts.force && !opts.dryRun && prevSigs.has(sig)) { r.outcome = "unchanged"; nextSigs.push(sig); continue; }

      const existing = await prisma.developmentUnit.findMany({
        where: { developmentId: dev.id },
        select: { id: true, ref: true, status: true, price: true, beds: true, pinnedFields: true },
      });

      let pages: PdfPage[];
      try { pages = await readPdfPages(await downloadSharedFile(shareUrl!, file.id, token)); }
      catch (e) { r.issues.push(`could not read ${file.name}: ${e instanceof Error ? e.message : String(e)}`); continue; }

      const parsed = parseDtaPriceList(pages, existing.map((u) => u.ref ?? "").filter(Boolean), p.name);
      r.listDate = parsed.listDate;
      r.units = parsed.units.length;
      const plan = planDtaWrite(existing, parsed, p.name);
      r.issues.push(...plan.issues);
      if (plan.refusal) { r.issues.push(plan.refusal); continue; }
      r.changes = [
        ...plan.updates.map((u) => `${u.ref}: ${u.changes.join(", ")}`),
        ...plan.unlist.map((u) => `${u.ref}: no longer in the list → unlisted`),
      ];

      if (opts.dryRun) { r.outcome = "dry-run"; continue; }

      const range = priceRangeAfter(existing, plan);
      await prisma.$transaction([
        ...plan.updates.map((u) => prisma.developmentUnit.update({ where: { id: u.id }, data: u.data })),
        ...(plan.unlist.length ? [prisma.developmentUnit.updateMany({ where: { id: { in: plan.unlist.map((u) => u.id) } }, data: { status: "unlisted" } })] : []),
        prisma.development.update({ where: { id: dev.id }, data: { ...range, syncedAt: new Date() } }),
      ]);
      await recomputeDevelopmentDerivedState(dev.id);
      r.outcome = "written";
      nextSigs.push(sig);
    }

    if (!opts.dryRun) {
      // A project-limited run (onlyDevelopmentId) must not forget the others' signatures.
      const keep = opts.onlyDevelopmentId ? Array.from(prevSigs).filter((s) => !s.startsWith(`${opts.onlyDevelopmentId}:`)) : [];
      await prisma.developerAccount.update({
        where: { id: developerAccountId },
        data: { driveFileModified: Array.from(new Set([...keep, ...nextSigs])).sort().join("|") || null, driveSyncedAt: new Date() },
      });
    }
  } finally {
    release();
  }

  const refused = results.filter((r) => r.outcome === "refused");
  const written = results.filter((r) => r.outcome === "written");
  const unchanged = results.filter((r) => r.outcome === "unchanged");
  const message = opts.dryRun
    ? `dry run: ${results.length} project(s) read, ${refused.length} refused`
    : `${written.length} written, ${unchanged.length} unchanged, ${refused.length} refused${refused.length ? ` (${refused.map((r) => `${r.project}: ${r.issues[r.issues.length - 1] ?? "?"}`).join("; ")})` : ""}`;
  return { ok: refused.length === 0, message, projects: results };
}
