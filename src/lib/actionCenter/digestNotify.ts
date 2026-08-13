import { prisma } from "@/lib/prisma";
import type { ActionItem } from "./types";

// Which URGENT/ACTION items the daily digest (src/app/api/cron/action-digest/
// route.ts) has already surfaced in full text at least once, and when it last
// did so. 2026-08-13: action-digest was already running and sending every
// day, but capped the visible text at the first 10 items sorted oldest-first
// — with 50-86 open items most days, a genuinely new problem (Salt missing
// from the BBF feed) could sit past that cutoff, folded into "...and N more",
// for weeks without ever once being named. Reusing CronRunLog rather than a
// new table/migration: same trick shouldNotifyFailureStreak (src/lib/
// cronLog.ts) already uses for its own per-job throttle marker, just keyed
// per-item instead of per-job (`digest-item:<itemId>`, a namespace that can
// never collide with a real cron job name). No purge needed yet — at a few
// dozen rows/day this table is still trivial at any retention horizon.
const KEY = (itemId: string) => `digest-item:${itemId}`;
export const REMINDER_THROTTLE_DAYS = 7;

export type DigestClassification = {
  fresh: ActionItem[]; // never shown before — always surfaced in full, uncapped
  recurring: ActionItem[]; // shown before, due for a weekly reminder — also uncapped
  quiet: number; // shown before, reminded recently — deliberately not repeated today
};

// Classifies + immediately records fresh/recurring as "shown now" (so a
// concurrent or retried run doesn't double-count) — deliberately not split
// into a separate "mark" step the caller could forget to call.
export async function classifyForDigest(items: ActionItem[]): Promise<DigestClassification> {
  if (!items.length) return { fresh: [], recurring: [], quiet: 0 };

  const rows = await prisma.cronRunLog.findMany({
    where: { job: { in: items.map((i) => KEY(i.id)) } },
    orderBy: { ranAt: "desc" },
    select: { job: true, ranAt: true },
  });
  const lastShown = new Map<string, Date>();
  for (const r of rows) if (!lastShown.has(r.job)) lastShown.set(r.job, r.ranAt); // desc order → first hit is latest

  const fresh: ActionItem[] = [];
  const recurring: ActionItem[] = [];
  let quiet = 0;
  const toMark: ActionItem[] = [];

  for (const item of items) {
    const last = lastShown.get(KEY(item.id));
    if (!last) {
      fresh.push(item);
      toMark.push(item);
    } else if (Date.now() - last.getTime() >= REMINDER_THROTTLE_DAYS * 86_400_000) {
      recurring.push(item);
      toMark.push(item);
    } else {
      quiet++;
    }
  }

  await Promise.all(toMark.map((i) => prisma.cronRunLog.create({ data: { job: KEY(i.id), ok: true } }).catch(() => {}) ));

  return { fresh, recurring, quiet };
}

// Splits a list of pre-formatted lines into Telegram-safe chunks (hard limit
// 4096 chars/message) — a header repeats on every chunk after the first so
// each message stands alone. maxLen leaves headroom for the header + footer.
export function chunkLines(header: string, lines: string[], maxLen = 3800): string[] {
  if (!lines.length) return [];
  const chunks: string[] = [];
  let current = header;
  let currentHasLines = false;
  for (const line of lines) {
    const candidate = current + "\n" + line;
    if (candidate.length > maxLen && currentHasLines) {
      chunks.push(current);
      current = header + "\n" + line;
      currentHasLines = true;
    } else {
      current = candidate;
      currentHasLines = true;
    }
  }
  if (currentHasLines) chunks.push(current);
  return chunks;
}
