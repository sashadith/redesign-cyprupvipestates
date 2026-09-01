"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { syncAll, syncDeveloper } from "@/lib/feedSync";
import { syncDeveloperDrive, previewDriveFolders, type DriveSyncResult, type DriveFolderPreview } from "@/lib/driveAvailabilitySync";
import { writeKuutioDraft } from "@/lib/dropboxAvailabilitySync";
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

// Manual-sync reminder cadence (days). 0/empty clears it (null = no reminder).
// Read by the manualSyncDue() Action Center rule. For hand-synced developers like
// AGG whose prod cron can't reach the source (Cloudflare) — see the field's note
// in schema.prisma.
export async function setManualSyncReminder(developerAccountId: string, days: number) {
  const value = Number.isFinite(days) && days > 0 ? Math.round(days) : null;
  await prisma.developerAccount.update({ where: { id: developerAccountId }, data: { manualSyncReminderDays: value } });
  revalidatePath(`/admin/developments/developers/${developerAccountId}`);
}

// Stamps driveSyncedAt = now — the manual-sync reminder anchors on this, so it's
// the "I've just synced this by hand" override. The sync scripts update it too, so
// this button is only for confirming a sync done outside them.
export async function markDeveloperSyncedNow(developerAccountId: string) {
  await prisma.developerAccount.update({ where: { id: developerAccountId }, data: { driveSyncedAt: new Date() } });
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
  // Report the outcome back to the page. Without this the button was silent in
  // the one case that matters most: a sync BLOCKED by the completeness guard
  // returns a normal result with blocked:true, the old code discarded it, and
  // the page re-rendered unchanged — indistinguishable from success. Medousa
  // sat blocked from 2026-08-27 to 2026-08-31 while the operator pressed the
  // button and saw "nothing happens". An error was equally invisible: it was
  // logged server-side and swallowed.
  let outcome: string;
  try {
    const results = dev && dev !== "all"
      ? [await syncDeveloper(dev, { mirror: true, forceMirror: true })]
      : await syncAll({ mirror: true, forceMirror: true });
    const blocked = results.filter((r) => r.blocked);
    if (blocked.length) {
      // The guard's own sentence, verbatim — it already names the numbers and
      // says nothing was changed. Re-wording it here would let the two drift.
      outcome = `blocked:${blocked.map((r) => `${r.dev}: ${r.blockedMessage ?? "feed looks incomplete"}`).join(" | ")}`;
    } else {
      const created = results.reduce((n, r) => n + r.created, 0);
      const updated = results.reduce((n, r) => n + r.updated, 0);
      const failed = results.reduce((n, r) => n + r.failed, 0);
      const units = results.reduce((n, r) => n + r.unitsWritten, 0);
      outcome = `ok:${created} created, ${updated} updated, ${units} units${failed ? `, ${failed} failed` : ""}`;
    }
  } catch (e) {
    // An uncaught throw here would crash the whole page render into Next's
    // redacted digest instead of just failing this sync, so keep catching —
    // but surface it rather than only logging it.
    const message = syncErrorMessage(e);
    console.error(`runSync(${dev || "all"}) failed:`, message);
    outcome = `error:${message}`;
  }
  revalidatePath("/admin/developments");
  const qs = new URLSearchParams({ ...(dev && dev !== "all" ? { dev } : {}), sync: outcome });
  redirect(`/admin/developments?${qs.toString()}`);
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
