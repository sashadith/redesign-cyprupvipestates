"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { syncAll, syncDeveloper } from "@/lib/feedSync";
import { syncDeveloperDrive, type DriveSyncResult } from "@/lib/driveAvailabilitySync";
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
