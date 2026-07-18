import { prisma } from "@/lib/prisma";
import type { ActionItem } from "../types";

const MIN = 60_000;
const HOUR = 3_600_000;

// Expected interval per cron job (see DEPLOYMENT.md's crontab block) — "URGENT"
// fires at 2x this without a successful row, which is the one failure mode a
// plain success/failure log can't see on its own: a crontab entry that stopped
// firing entirely writes NO row at all (the exact incident this rule exists
// for — see the migration-day retrospective). A failed run (row exists, ok=false)
// is always URGENT immediately, regardless of interval.
const JOBS: { job: string; label: string; expectedMs: number }[] = [
  { job: "publish-scheduled", label: "publish-scheduled", expectedMs: 5 * MIN },
  { job: "feed-sync", label: "feed-sync", expectedMs: 24 * HOUR },
  { job: "drive-sync", label: "drive-sync", expectedMs: 24 * HOUR },
];

export async function systemRules(): Promise<ActionItem[]> {
  const items: ActionItem[] = [];
  const now = Date.now();
  for (const { job, label, expectedMs } of JOBS) {
    const latest = await prisma.cronRunLog.findFirst({ where: { job }, orderBy: { ranAt: "desc" } });
    if (latest && !latest.ok) {
      items.push({
        id: `cron-health:${job}`, severity: "URGENT", category: "SYSTEM",
        title: `${label} cron failed its last run`,
        description: latest.message || "No error detail captured.",
        deepLink: "/admin", since: latest.ranAt,
      });
      continue;
    }
    const staleAfter = expectedMs * 2;
    const isStale = !latest || now - latest.ranAt.getTime() > staleAfter;
    if (isStale) {
      items.push({
        id: `cron-health:${job}`, severity: "URGENT", category: "SYSTEM",
        title: `${label} hasn't run recently — check crontab`,
        description: latest
          ? `Last successful run: ${latest.ranAt.toLocaleString("en-GB")}.`
          : "No run has ever been logged for this job.",
        // No baseline exists to know exactly when this started for a job with
        // zero history ever — using "now" for that case (best we can say is
        // "as of this check, it's missing"), the real last-run time otherwise.
        deepLink: "/admin", since: latest?.ranAt ?? new Date(now),
      });
    }
  }
  return items;
}
