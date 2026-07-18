import { prisma } from "@/lib/prisma";
import type { ActionItem } from "./types";

// Filters out items the admin snoozed and whose snooze hasn't expired yet.
// The only persisted state the Action Center has — items themselves are
// always computed fresh (see index.ts).
export async function filterSnoozed(items: ActionItem[]): Promise<ActionItem[]> {
  if (!items.length) return items;
  const active = await prisma.actionCenterSnooze.findMany({
    where: { itemId: { in: items.map((i) => i.id) }, snoozedUntil: { gt: new Date() } },
    select: { itemId: true },
  });
  const snoozed = new Set(active.map((s) => s.itemId));
  return items.filter((i) => !snoozed.has(i.id));
}

export async function snoozeItem(itemId: string, days: number, userId?: string) {
  const snoozedUntil = new Date(Date.now() + days * 86_400_000);
  await prisma.actionCenterSnooze.create({ data: { itemId, snoozedUntil, userId } });
}
