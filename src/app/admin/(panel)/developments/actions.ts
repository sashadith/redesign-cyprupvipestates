"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { syncAll, syncDeveloper } from "@/lib/feedSync";
import { syncDeveloperDrive, type DriveSyncResult } from "@/lib/driveAvailabilitySync";

// Manual "Sync Drive now" = full content import (rich data + description + images), force.
export async function syncDeveloperDriveAction(developerAccountId: string): Promise<DriveSyncResult> {
  const r = await syncDeveloperDrive(developerAccountId, { force: true, content: true });
  revalidatePath(`/admin/developments/developers/${developerAccountId}`);
  revalidatePath("/admin/developments");
  return r;
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
export async function runSync(formData: FormData) {
  const dev = String(formData.get("dev") ?? "");
  if (dev && dev !== "all") await syncDeveloper(dev, { mirror: true });
  else await syncAll({ mirror: true });
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
