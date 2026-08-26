import { prisma } from "@/lib/prisma";
import type { ActionItem } from "../types";

const MIN = 60_000;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

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
  // These two are plain VPS crontab scripts (cvp-db-backup.sh /
  // cvp-uploads-backup.sh), not app cron routes — they write their own
  // cron_run_logs row directly via psql (2026-08-04, after a 3-week-silent
  // "backup suspiciously small" failure only ever reached a log file nobody
  // was watching — see DEPLOYMENT.md's tar-over-symlink entry).
  { job: "db-backup", label: "db-backup", expectedMs: 24 * HOUR },
  { job: "uploads-backup", label: "uploads-backup", expectedMs: 7 * 24 * HOUR },
  // 2026-08-13 (GROSSER AUFTRAG Teil 4) — the rest of the crontab was never
  // added here, so a job that stopped firing entirely (as opposed to firing
  // and failing) had no "cron didn't run at all" detection the way
  // feed-sync/drive-sync/the backups already did.
  { job: "action-digest", label: "action-digest", expectedMs: 24 * HOUR },
  { job: "gsc-sync", label: "gsc-sync", expectedMs: 24 * HOUR },
  { job: "psi-sync", label: "psi-sync", expectedMs: 24 * HOUR },
  { job: "seo-advisor", label: "seo-advisor", expectedMs: 7 * 24 * HOUR },
  { job: "email-inbound", label: "email-inbound", expectedMs: 5 * MIN },
  { job: "booking-reminders", label: "booking-reminders", expectedMs: 5 * MIN },
  // 2026-08-26 — added the day kuutio-sync got its `0 3 * * *` crontab entry,
  // exactly as that route's own comment said it would be. DAILY here even
  // though Kuutio's driveSyncInterval is weekly: this watches whether the
  // cron FIRED, and a not-due night still writes its own ok row. The gap this
  // closes is the one nobody saw for 13 days — a Dropbox developer that no
  // scheduled job was responsible for at all.
  { job: "kuutio-sync", label: "kuutio-sync", expectedMs: 24 * HOUR },
  // 2026-08-26 — registered together WITH the Korantina SharePoint adapter, not
  // after its first silent night. Same reasoning as kuutio-sync above: DAILY,
  // because this watches whether the cron FIRED (a not-due night still writes an
  // ok row), and syncAllDrives deliberately skips SharePoint accounts, so this
  // route is the only thing responsible for Korantina's 18 projects.
  { job: "korantina-sync", label: "korantina-sync", expectedMs: 24 * HOUR },
];

// 2026-08-11 (analytics bot-traffic incident) — two exact user-agent strings
// quietly made up 27% of counted PageView traffic for over a month before
// anyone noticed (one via the existing isbot()/prefetch filters missing it
// entirely, since they mimicked ordinary Chrome/Safari instead of announcing
// themselves as crawlers). Rather than a blacklist that risks false
// positives on a real, coincidentally-popular browser build (rejected —
// tested, unacceptable false-positive rate), this only ever surfaces a
// candidate for a human to judge; it never touches `isBot` itself.
//
// Threshold derivation (see the investigation this rule came from): both
// known incidents peaked at 32%/50% trailing-7-day share of all counted
// traffic with 96-98% concentration in one or two countries OTHER than the
// site's own top market; simulated against 54 days of (post-cleanup) real
// traffic, share>=20% + non-home-market concentration>=85% produced ZERO
// false positives, while the highest ordinary/legitimate UA share seen in
// that window topped out around 16%. The site's own #1 country is excluded
// from the concentration check (not hardcoded) because it legitimately
// dominates almost every real UA on a single-market-heavy site — a bot
// signature reads as unusual concentration in countries OTHER than the
// normal home market, not just "concentrated" per se.
const DOMINANT_UA_SHARE_THRESHOLD = 0.20;
const DOMINANT_UA_CONCENTRATION_THRESHOLD = 0.85;
const DOMINANT_UA_MIN_OTHER_COUNTRY_ROWS = 15;
const DOMINANT_UA_MIN_WINDOW_ROWS = 30; // below this, any share/concentration number is noise

async function dominantUserAgentRule(): Promise<ActionItem[]> {
  const since7d = new Date(Date.now() - 7 * DAY);
  const rows = await prisma.pageView.findMany({
    where: { isBot: false, isPrefetch: false, isTest: false, createdAt: { gte: since7d } },
    select: { userAgent: true, country: true, createdAt: true },
  });
  if (rows.length < DOMINANT_UA_MIN_WINDOW_ROWS) return [];

  const byCountryOverall = new Map<string, number>();
  for (const r of rows) if (r.country) byCountryOverall.set(r.country, (byCountryOverall.get(r.country) ?? 0) + 1);
  const homeMarket = Array.from(byCountryOverall.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const byUA = new Map<string, typeof rows>();
  for (const r of rows) {
    const ua = r.userAgent ?? "(none)";
    if (!byUA.has(ua)) byUA.set(ua, []);
    byUA.get(ua)!.push(r);
  }

  const items: ActionItem[] = [];
  for (const [ua, uaRows] of Array.from(byUA.entries())) {
    if (ua === "(none)") continue;
    const share = uaRows.length / rows.length;
    if (share < DOMINANT_UA_SHARE_THRESHOLD) continue;
    const otherCountryRows = uaRows.filter((r: (typeof rows)[number]) => r.country && r.country !== homeMarket);
    if (otherCountryRows.length < DOMINANT_UA_MIN_OTHER_COUNTRY_ROWS) continue;
    const byCountry = new Map<string, number>();
    for (const r of otherCountryRows) byCountry.set(r.country!, (byCountry.get(r.country!) ?? 0) + 1);
    const top2 = Array.from(byCountry.entries()).sort((a, b) => b[1] - a[1]).slice(0, 2);
    const concentration = top2.reduce((s, [, c]) => s + c, 0) / otherCountryRows.length;
    if (concentration < DOMINANT_UA_CONCENTRATION_THRESHOLD) continue;

    const pct = Math.round(share * 100);
    const countries = top2.map(([c]) => c).join(" and ");
    const earliestInWindow = uaRows.reduce((min: Date, r: (typeof rows)[number]) => (r.createdAt < min ? r.createdAt : min), uaRows[0].createdAt);
    items.push({
      id: `dominant-ua:${ua}`,
      severity: "ACTION",
      category: "SYSTEM",
      title: `A single browser signature is ${pct}% of traffic — bot?`,
      description: `${pct}% of the last 7 days' counted page views share one exact user agent, mostly from ${countries}. If this is automated traffic, add it to the bot filter (isBot).`,
      deepLink: "/admin/analytics",
      since: earliestInWindow,
    });
  }
  return items;
}

export async function systemRules(): Promise<ActionItem[]> {
  const items: ActionItem[] = [];
  const now = Date.now();
  items.push(...(await dominantUserAgentRule()));
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
