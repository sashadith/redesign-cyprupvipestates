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

// Data-only sync (fast, ~15s). Image mirroring runs as its own job (cron), so a
// button click never blocks on downloads.
export async function runSync(formData: FormData) {
  const dev = String(formData.get("dev") ?? "");
  if (dev && dev !== "all") await syncDeveloper(dev);
  else await syncAll();
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
