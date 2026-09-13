"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  enqueueDevelopersForce,
  enqueueForceForDeveloper,
  enqueueForceForDevelopment,
  enqueueMissing,
  enqueueSample,
  type EnqueueKind,
  type QueuePrisma,
} from "@/lib/ai/heTranslateQueue";

/* Server actions for /admin/content/hebrew. They write NOTHING but
   AiGenerationQueue rows — the actual Hebrew values are written by the cron
   route on the server (src/app/api/cron/he-translate/route.ts), never from a
   click in the admin, because every row costs two Anthropic calls and a request
   that queues 200 of them must not also try to run them. */

const PATH = "/admin/content/hebrew";

// Same contract as requireSession() in src/app/admin/actions.ts (module-private
// there): a valid session AND a still-active user, re-checked against the DB so
// a deactivated account cannot keep acting for the rest of its JWT lifetime.
async function requireSession() {
  const session = await auth();
  const uid = (session?.user as { id?: string } | undefined)?.id;
  if (!session || !uid) throw new Error("Unauthorized");
  const user = await prisma.user.findUnique({ where: { id: uid }, select: { isActive: true } });
  if (!user || !user.isActive) throw new Error("Unauthorized");
  return session;
}

const db = () => prisma as unknown as QueuePrisma;

export async function enqueueMissingAction(kind: EnqueueKind): Promise<void> {
  await requireSession();
  await enqueueMissing(kind, db());
  revalidatePath(PATH);
}

export async function enqueueSampleAction(): Promise<void> {
  await requireSession();
  await enqueueSample(db());
  revalidatePath(PATH);
}

/** "Reject" on a sample row: queue the same development again, allowed to overwrite. */
export async function rejectSampleAction(developmentId: string): Promise<void> {
  await requireSession();
  await enqueueForceForDevelopment(db(), developmentId);
  revalidatePath(PATH);
}

/** Force re-enqueue of every English developer's profile — the developer-side
 * bulk force path, mirroring enqueueSampleAction's role for developments. */
export async function enqueueDevelopersForceAction(): Promise<void> {
  await requireSession();
  await enqueueDevelopersForce(db());
  revalidatePath(PATH);
}

/** "Reject → re-enqueue with force" for one developer profile (queue table row):
 * the per-developer counterpart to rejectSampleAction, and the path back into
 * the queue for a developer stuck behind a non-Hebrew sibling row. */
export async function rejectDeveloperAction(developerId: string): Promise<void> {
  await requireSession();
  await enqueueForceForDeveloper(db(), developerId);
  revalidatePath(PATH);
}
