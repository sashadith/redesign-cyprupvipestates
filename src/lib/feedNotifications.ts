import { sendTelegramMessage } from "@/lib/telegram";
import { sendEmail } from "@/lib/sendEmail";
import { DEV_ACCOUNT } from "@/lib/feedSync";
import { absUrl } from "./indexnow";

/* Inventory-change notifications for the 4am feed-sync cron (see
   src/app/api/cron/feed-sync/route.ts) — the event-driven half of the
   "unlisted" scheme, docking into the existing generic sendTelegramMessage/
   sendEmail helpers (already used elsewhere, e.g. booking-reminders) rather
   than building new transport. All text here is admin/internal-facing (the
   Telegram group + Sascha's inbox), so English only per project convention —
   distinct from the client-facing src/app/c/[token]/copy.ts strings. */

export function devLabel(dev: string): string {
  return DEV_ACCOUNT[dev]?.name || dev;
}

export type RemovedUnitLine = {
  // Carried since the digest links each development; the sync's UnitChangeLine
  // has always provided it, the old count-only message just never used it.
  developmentId: string;
  development: string;
  ref: string;
  label: string;
};

const MAX_LISTED_LINES = 15;

function unitLine(l: RemovedUnitLine): string {
  return `- ${l.development} — ${l.label || l.ref}`;
}

const pluralUnit = (n: number) => (n === 1 ? "unit" : "units");
const pluralIs = (n: number) => (n === 1 ? "is" : "are");




/* ── One digest instead of one email per developer ──────────────────────────
   The nightly run used to send a separate message per developer per event
   type, each carrying a bare count ("Domenica Group: 10 new units awaiting
   review") with no way to tell WHICH units without opening the admin and
   hunting. Four developers with new units meant four emails saying almost
   nothing.

   This builds a single message covering every developer, itemized and linked.
   Ordering is deliberate: what is BLOCKED comes first (nothing was written and
   it needs a decision), then removals (the live catalogue already changed),
   then new units (drafts waiting, no urgency). Within each section developers
   are alphabetical and units keep their in-project order, so the same feed
   produces the same email twice running and a diff between two mornings is
   readable. */

export type NewUnitLine = RemovedUnitLine;

export type FeedDigestInput = {
  newUnits: { dev: string; lines: NewUnitLine[] }[];
  removed: { dev: string; lines: RemovedUnitLine[]; nowSoldOut: string[] }[];
  blocked: { dev: string; missing: number; total: number; message?: string }[];
};

const devUrl = (dev: string) => absUrl(`/admin/developments?dev=${encodeURIComponent(dev)}`);
const projectUrl = (id: string) => absUrl(`/admin/developments/${id}`);

/** Groups a developer's unit lines by development, preserving first-seen order. */
function byDevelopment<T extends RemovedUnitLine>(lines: T[]) {
  const out = new Map<string, { name: string; id: string; lines: T[] }>();
  for (const l of lines) {
    const hit = out.get(l.developmentId);
    if (hit) hit.lines.push(l);
    else out.set(l.developmentId, { name: l.development, id: l.developmentId, lines: [l] });
  }
  return Array.from(out.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function buildFeedDigestMessage(input: FeedDigestInput): { subject: string; text: string } | null {
  const newTotal = input.newUnits.reduce((n, d) => n + d.lines.length, 0);
  const removedTotal = input.removed.reduce((n, d) => n + d.lines.length, 0);
  if (!newTotal && !removedTotal && !input.blocked.length) return null;

  const out: string[] = [];
  const sortByDev = <T extends { dev: string }>(xs: T[]) => [...xs].sort((a, b) => devLabel(a.dev).localeCompare(devLabel(b.dev)));

  if (input.blocked.length) {
    out.push(`\u26D4 NEEDS A DECISION — ${input.blocked.length} feed${input.blocked.length === 1 ? "" : "s"} refused`);
    for (const b of sortByDev(input.blocked)) {
      const pct = b.total > 0 ? Math.round((b.missing / b.total) * 100) : 0;
      out.push(`  ${devLabel(b.dev)} — ${b.missing} of ${b.total} units missing (${pct} %). Nothing was changed.`);
      out.push(`  ${devUrl(b.dev)}`);
    }
    out.push("");
  }

  if (removedTotal) {
    out.push(`\u{1F4E4} REMOVED FROM THE CATALOGUE — ${removedTotal} ${pluralUnit(removedTotal)}`);
    out.push(`  Already hidden from the public site. They return automatically if the developer lists them again.`);
    for (const d of sortByDev(input.removed)) {
      if (!d.lines.length) continue;
      out.push(`  ${devLabel(d.dev)}`);
      for (const g of byDevelopment(d.lines)) {
        out.push(`    ${g.name} (${g.lines.length})  ${projectUrl(g.id)}`);
        for (const l of g.lines.slice(0, MAX_LISTED_LINES)) out.push(`      · ${l.label || l.ref}`);
        if (g.lines.length > MAX_LISTED_LINES) out.push(`      … and ${g.lines.length - MAX_LISTED_LINES} more`);
      }
      for (const name of d.nowSoldOut) out.push(`    ${name} now shows as sold out.`);
    }
    out.push("");
  }

  if (newTotal) {
    out.push(`\u{1F195} NEW, AWAITING YOUR REVIEW — ${newTotal} ${pluralUnit(newTotal)}`);
    out.push(`  Not live yet. Open the project to check price, area and photos, then publish.`);
    for (const d of sortByDev(input.newUnits)) {
      if (!d.lines.length) continue;
      out.push(`  ${devLabel(d.dev)}`);
      for (const g of byDevelopment(d.lines)) {
        out.push(`    ${g.name} (${g.lines.length})  ${projectUrl(g.id)}`);
        for (const l of g.lines.slice(0, MAX_LISTED_LINES)) out.push(`      · ${l.label || l.ref}`);
        if (g.lines.length > MAX_LISTED_LINES) out.push(`      … and ${g.lines.length - MAX_LISTED_LINES} more`);
      }
    }
    out.push("");
  }

  // The subject has to survive a phone's notification line, so it carries the
  // counts in the order the body uses them and nothing else.
  const bits: string[] = [];
  if (input.blocked.length) bits.push(`${input.blocked.length} feed${input.blocked.length === 1 ? "" : "s"} refused`);
  if (removedTotal) bits.push(`${removedTotal} removed`);
  if (newTotal) bits.push(`${newTotal} new`);
  return { subject: `Feed sync: ${bits.join(", ")}`, text: out.join("\n").trimEnd() };
}


// Drive-sync failure (2026-08-11, Olias incident) — `dev` here is already the
// DeveloperAccount's own display name (e.g. "Olias Homes (drive)"), not a
// feed-sync dev-key, so unlike the messages above this does NOT go through
// devLabel()/DEV_ACCOUNT (that map is keyed by feed-sync's short slugs and
// wouldn't recognize a Drive developer's name). Throttled by
// shouldNotifyFailureStreak (src/lib/cronLog.ts) — fires once when the
// failure starts, then at most weekly while it continues, per developer.
export function buildDriveSyncFailureMessage(dev: string, message: string): { subject: string; text: string } | null {
  if (!message) return null;
  const text = [
    `🔌 ${dev} — Drive sync failed`,
    message,
    `It will keep retrying automatically (daily). You'll only be notified again if it's still failing in a week.`,
  ].join("\n");
  return { subject: `${dev}: Drive sync failed`, text };
}

// Generic per-cron-job failure notification (2026-08-13, GROSSER AUFTRAG
// Teil 4) — for cron routes with a single linear pipeline or a simple
// partial-failure summary, where a bespoke per-developer message (like
// buildDriveSyncFailureMessage's) isn't worth the extra code. Same throttle
// contract as every other failure message here: caller checks
// shouldNotifyFailureStreak first, calls markFailureStreakNotified after.
export function buildCronFailureMessage(job: string, message: string): { subject: string; text: string } {
  const text = [
    `⚠️ ${job} — cron failed`,
    message,
    `It will keep retrying automatically on its normal schedule. You'll only be notified again if it's still failing in a week.`,
  ].join("\n");
  return { subject: `${job}: cron failed`, text };
}

export async function sendFeedNotification(text: string, subject: string): Promise<void> {
  await sendTelegramMessage(text);
  await sendEmail({ subject, text });
}
