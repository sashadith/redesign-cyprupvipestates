import { sendTelegramMessage } from "@/lib/telegram";
import { sendEmail } from "@/lib/sendEmail";
import { DEV_ACCOUNT } from "@/lib/feedSync";

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

export type RemovedUnitLine = { development: string; ref: string; label: string };

const MAX_LISTED_LINES = 15;

function unitLine(l: RemovedUnitLine): string {
  return `- ${l.development} — ${l.label || l.ref}`;
}

const pluralUnit = (n: number) => (n === 1 ? "unit" : "units");
const pluralIs = (n: number) => (n === 1 ? "is" : "are");

// Units no longer listed by the developer (flipped to "unlisted" this run) —
// one message per developer. `nowSoldOut` is the subset of touched
// developments that computeAvailability now reports as fully sold out as a
// direct result of this run's removals (0 available units) — surfaced as its
// own line per development, not folded into the count above it.
// Returns null when there's nothing to report — every call site already
// guards on a non-empty `lines` before calling this, but a defensive check
// here too means it's structurally impossible to ever send "0 units removed".
export function buildRemovedUnitsMessage(dev: string, lines: RemovedUnitLine[], nowSoldOut: string[]): { subject: string; text: string } | null {
  const count = lines.length;
  if (count === 0) return null;
  const label = devLabel(dev);
  const shown = lines.slice(0, MAX_LISTED_LINES);
  const more = count - shown.length;
  const text = [
    `📤 ${label} — ${count} ${pluralUnit(count)} removed from the feed`,
    `No longer listed by the developer, hidden from the catalogue:`,
    ...shown.map(unitLine),
    ...(more > 0 ? [`… and ${more} more`] : []),
    `They will be listed again automatically if they return to the feed.`,
    ...nowSoldOut.map((name) => `${name} now shows as sold out.`),
  ].join("\n");
  return { subject: `${label}: ${count} ${pluralUnit(count)} removed from the feed`, text };
}

// New units seen in the feed for the first time this run — one message per
// developer, an aggregate count only (no per-unit lines, unlike removals —
// these are new/draft rows awaiting the normal publish review, not yet a
// live catalogue change worth itemizing).
export function buildNewUnitsMessage(dev: string, count: number): { subject: string; text: string } | null {
  if (count <= 0) return null;
  const label = devLabel(dev);
  const text = `🆕 ${label} — ${count} new ${pluralUnit(count)} from the feed\nAwaiting review before they go live.`;
  return { subject: `${label}: ${count} new ${pluralUnit(count)} awaiting review`, text };
}

// Feed-completeness guard tripped (see checkFeedCompleteness in feedSync.ts)
// — nothing was written for this developer this run. `missing` is always
// >20 in practice (the guard's own threshold), but pluralize correctly
// regardless rather than assume that floor never changes.
export function buildFeedIncompleteMessage(dev: string, missing: number, total: number): { subject: string; text: string } | null {
  if (missing <= 0 || total <= 0) return null;
  const label = devLabel(dev);
  const pct = Math.round((missing / total) * 100);
  const text = `⚠️ ${label} — feed looks incomplete\n${missing} of ${total} ${pluralUnit(missing)} ${pluralIs(missing)} missing from today's feed (${pct} %). Nothing was changed — the catalogue stays as it is until this has been checked.`;
  return { subject: `${label}: feed looks incomplete — nothing changed`, text };
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
