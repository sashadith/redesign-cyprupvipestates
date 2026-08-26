"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { syncAll, syncDeveloper } from "@/lib/feedSync";
import { syncDeveloperDrive, previewDriveFolders, type DriveSyncResult, type DriveFolderPreview } from "@/lib/driveAvailabilitySync";
import { writeKuutioDraft } from "@/lib/dropboxAvailabilitySync";
import { writeKorantinaDraft } from "@/lib/sharepointAvailabilitySync";
import { syncErrorMessage } from "@/lib/syncErrorMessage";

// Manual "Sync Drive now" = full content import (rich data + description + images), force.
// try/catch added 2026-08-11 — DriveSyncButton.tsx's own catch only ever sees Next's
// generic redacted digest for an uncaught Server Action error (e.g. an expired
// Google OAuth token); developments/[id]/actions.ts's syncThisDevelopmentAction
// already guards its own drive-sync button the same way — this one was missed.
export async function syncDeveloperDriveAction(developerAccountId: string): Promise<DriveSyncResult> {
  try {
    const r = await syncDeveloperDrive(developerAccountId, { force: true, content: true });
    revalidatePath(`/admin/developments/developers/${developerAccountId}`);
    revalidatePath("/admin/developments");
    return r;
  } catch (e) {
    return { ok: false, message: syncErrorMessage(e) };
  }
}

/* The same button for a DROPBOX-linked developer (2026-08-26). Until now the
   panel only ever offered the Drive path, which refuses a Dropbox account
   with "sync via the Kuutio Dropbox sync route instead" — a route reachable
   only by curl, so the button was a dead end for Kuutio and would have been
   for any future Dropbox developer.

   Deliberately NOT force:true, unlike the Drive button above. `force` in the
   Dropbox adapter re-downloads and REPLACES each project's gallery and floor
   plans wholesale (~12 minutes, and it discards any manual curation of those
   fields); the plain run still creates missing projects, refreshes units and
   prices, and backfills content for anything whose gallery is still empty,
   which is what "Sync now" should mean. A deliberate full re-import stays a
   conscious `&force=1` call against the cron route. */
export async function syncDeveloperDropboxAction(developerAccountId: string): Promise<DriveSyncResult> {
  try {
    const r = await writeKuutioDraft(developerAccountId);
    revalidatePath(`/admin/developments/developers/${developerAccountId}`);
    revalidatePath("/admin/developments");
    return {
      ok: true,
      message: `${r.created.length} project(s) synced, ${r.skippedExisting.length} skipped (existing), ${r.skippedEmpty.length} skipped (no units).`,
    };
  } catch (e) {
    return { ok: false, message: syncErrorMessage(e) };
  }
}

/* The same button for a SHAREPOINT-linked developer (Korantina, 2026-08-26).
   Added together WITH the adapter rather than left for later: without it the
   panel falls through to the Drive path, which now refuses a SharePoint account
   with "sync via the Korantina SharePoint sync route instead" — a route
   reachable only by curl, which is exactly the dead end the Dropbox button
   above had to be written to fix.

   Not force:true, for the same reason as the Dropbox button: `force` re-downloads
   and REPLACES every project's gallery and floor plans wholesale and discards any
   manual curation of those fields. The plain run creates missing projects,
   refreshes units and prices, and backfills content only where the gallery is
   still empty — which is what "Sync now" should mean. */
export async function syncDeveloperSharePointAction(developerAccountId: string): Promise<DriveSyncResult> {
  try {
    const r = await writeKorantinaDraft(developerAccountId);
    revalidatePath(`/admin/developments/developers/${developerAccountId}`);
    revalidatePath("/admin/developments");
    const notes = r.notes.length ? ` ${r.notes.length} note(s) — see the korantina-sync dry run for detail.` : "";
    return {
      ok: true,
      message: `${r.created.length} created, ${r.updated.length} updated, ${r.skippedExisting.length} skipped (existing), ${r.skippedEmpty.length} skipped (no units).${notes}`,
    };
  } catch (e) {
    return { ok: false, message: syncErrorMessage(e) };
  }
}

// Read-only dry run of the folder scan (2026-08-24) — no AI, no downloads, no
// writes. Answers "why is this Drive folder not on the site?" in the panel itself:
// every project folder, the price list found in it, the project it resolves to, and
// the reason when it resolves to nothing.
export async function previewDriveFoldersAction(developerAccountId: string): Promise<{ ok: boolean; message: string; rows: DriveFolderPreview[] }> {
  try {
    return await previewDriveFolders(developerAccountId);
  } catch (e) {
    return { ok: false, message: syncErrorMessage(e), rows: [] };
  }
}

export async function setDriveSyncInterval(developerAccountId: string, interval: string) {
  const valid = ["daily", "2day", "weekly", "off"].includes(interval) ? interval : "daily";
  await prisma.developerAccount.update({ where: { id: developerAccountId }, data: { driveSyncInterval: valid } });
  revalidatePath(`/admin/developments/developers/${developerAccountId}`);
}

// Mirrors images now (2026-08-04) — previously data-only, which meant a
// gallery/unit-photo array freshly written by this button could silently
// contain raw external feed URLs (skipping mirroring, not just deferring it:
// the DB write happens unconditionally either way). Confirmed live: 581 of
// 584 external gallery/unit-photo URLs found in the DB had a matching
// already-mirrored file still sitting on disk — this button had overwritten
// the local reference with the feed's raw URL again. mirrorAll()'s
// skip-if-exists + scheduleAppRestart()'s own debounce (imageMirror.ts) keep
// a routine "nothing new" click fast and restart-free; only a click that
// hits genuinely new/changed images pays the mirroring cost.
// forceMirror (2026-08-08): this is an admin-initiated "sync now" click, so
// it deliberately bypasses the published-project mirror freeze (feedSync.ts)
// the nightly cron respects — an admin who clicks this wants a real re-pull,
// images included, regardless of publish status.
export async function runSync(formData: FormData) {
  const dev = String(formData.get("dev") ?? "");
  try {
    if (dev && dev !== "all") await syncDeveloper(dev, { mirror: true, forceMirror: true });
    else await syncAll({ mirror: true, forceMirror: true });
  } catch (e) {
    // No message slot in this plain form (see developments/page.tsx and
    // developers/[id]/page.tsx) — an uncaught throw here would crash the whole
    // page render into Next's redacted digest instead of just failing this
    // sync, so log the real cause server-side and let the page render as-is.
    console.error(`runSync(${dev || "all"}) failed:`, syncErrorMessage(e));
  }
  revalidatePath("/admin/developments");
}

// Manually create a development for a developer WITHOUT a feed. It gets a "manual"
// adapter key + a synthetic feedKey; everything else (override editor, PDF import,
// units, gallery) works exactly like a synced development.
export async function createManualDevelopment(developerAccountId: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!developerAccountId || !name) return;
  const acct = await prisma.developerAccount.findUnique({ where: { id: developerAccountId } });
  if (!acct) return;
  const pid = randomUUID();
  const d = await prisma.development.create({
    data: {
      developerAccountId,
      dev: "manual",
      feedProjectId: pid,
      feedKey: `manual:${pid}`,
      developerName: name,
      publicName: name,
      developer: acct.name,
      publishStatus: "draft",
    },
  });
  revalidatePath(`/admin/developments/developers/${developerAccountId}`);
  redirect(`/admin/developments/${d.id}`);
}
