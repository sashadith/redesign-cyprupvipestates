// Social-media monitoring over Typefully — the pure half. No network, no
// database, and `now` is always passed in, so every rule below is testable
// at an exact instant (src/lib/__tests__/socialMonitor.test.ts).
//
// The failure this exists to surface: a weekly Claude routine writes "planned"
// drafts into Typefully, and a planned draft NEVER publishes until Sascha
// confirms it. An unconfirmed draft does not error, does not notify — it just
// silently does not go out. So the rules look at planned drafts by date:
//   - date within 72h → still time to confirm (ACTION, URGENT inside 12h)
//   - date already passed (last 7 days) → it was missed (URGENT)
// plus Typefully's own publish errors, and the API itself being unreachable,
// which is its own item and never folded into "nothing to report".
//
// Times are Cyprus wall-clock: CYPRUS_TZ is "Asia/Nicosia", the canonical
// IANA name of the zone the brief calls Europe/Nicosia (an alias of it).
import type { ActionItem } from "@/lib/actionCenter/types";
import { CYPRUS_TZ, cyprusWallTimeToUtc, formatInZone } from "@/lib/booking/timezone";
import { TYPEFULLY_SOCIAL_SET_ID, type DraftListResult, type TypefullyDraft } from "./typefully";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
export const UNCONFIRMED_WINDOW_MS = 72 * HOUR;
export const UNCONFIRMED_URGENT_MS = 12 * HOUR;
export const MISSED_LOOKBACK_MS = 7 * DAY;
export const DIGEST_UNCONFIRMED_MS = 48 * HOUR;

const PLATFORMS: [key: string, label: string][] = [
  ["x", "X"], ["x_article", "X Article"], ["linkedin", "LinkedIn"], ["threads", "Threads"],
  ["bluesky", "Bluesky"], ["mastodon", "Mastodon"], ["substack", "Substack"],
];

export function draftLink(id: number): string {
  return `https://typefully.com/?d=${id}&a=${TYPEFULLY_SOCIAL_SET_ID}`;
}

export function draftTitle(d: TypefullyDraft): string {
  const raw = (d.draft_title || d.preview || "").replace(/\s+/g, " ").trim();
  if (!raw) return `Draft #${d.id}`;
  // By code point, never by UTF-16 unit: cutting an emoji in half leaves a lone
  // surrogate, which Telegram rejects — and that throw would take the whole
  // morning digest (email included) down with it.
  const chars = Array.from(raw);
  return chars.length > 80 ? `${chars.slice(0, 79).join("")}…` : raw;
}

/* Every `<platform>_post_enabled: true`, in a fixed order; an unknown platform
   the API adds later is still listed, by its own key. */
export function platformsOf(d: TypefullyDraft): string[] {
  const enabled = Object.keys(d).filter((k) => k.endsWith("_post_enabled") && d[k] === true).map((k) => k.replace(/_post_enabled$/, ""));
  const known = PLATFORMS.filter(([k]) => enabled.includes(k)).map(([, label]) => label);
  const unknown = enabled.filter((k) => !PLATFORMS.some(([p]) => p === k));
  return [...known, ...unknown];
}

const platformText = (d: TypefullyDraft) => platformsOf(d).join(", ") || "no platform selected";
const at = (d: TypefullyDraft) => (d.scheduled_date ? new Date(d.scheduled_date) : null);
const cyprusDateTime = (date: Date) => formatInZone(date, CYPRUS_TZ); // "Tue, 06 Oct, 09:30"
const cyprusTime = (date: Date) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: CYPRUS_TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
const sinceOf = (d: TypefullyDraft, fallback: Date) => {
  const t = d.updated_at || d.created_at;
  const parsed = t ? new Date(t) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : fallback;
};

function apiFailureItems(results: DraftListResult[], now: Date): ActionItem[] {
  const failures = results.filter((r): r is Extract<DraftListResult, { ok: false }> => !r.ok);
  if (!failures.length) return [];
  const f = failures[0];
  if (f.status === null && /TYPEFULLY_API_KEY/.test(f.message)) {
    return [{
      // Its own id: "dismiss forever" on a missing key must not also hide every
      // future real outage (social-api-unreachable) from the Action Center.
      id: "social-api-key-missing",
      severity: "ACTION",
      category: "SOCIAL",
      title: "Typefully API key is not configured",
      description: "TYPEFULLY_API_KEY is missing from the server environment, so planned and failed social posts cannot be checked.",
      deepLink: "https://typefully.com/",
      since: now,
    }];
  }
  return [{
    id: "social-api-unreachable",
    severity: "ACTION",
    category: "SOCIAL",
    title: `Typefully API unreachable${f.status !== null ? ` (HTTP ${f.status})` : ""}`,
    description: `Social posts cannot be checked until this is fixed: ${f.message}`.slice(0, 300),
    deepLink: "https://typefully.com/",
    since: now,
  }];
}

/** Action Center items from the two lists the rules need. */
export function socialActionItems(input: { planned: DraftListResult; errored: DraftListResult }, now: Date): ActionItem[] {
  const items: ActionItem[] = apiFailureItems([input.planned, input.errored], now);
  const t = now.getTime();

  if (input.planned.ok) {
    for (const d of input.planned.drafts) {
      const when = at(d);
      if (!when || Number.isNaN(when.getTime())) continue;
      const delta = when.getTime() - t;
      if (delta >= 0 && delta <= UNCONFIRMED_WINDOW_MS) {
        items.push({
          id: `social-unconfirmed:${d.id}`,
          severity: delta <= UNCONFIRMED_URGENT_MS ? "URGENT" : "ACTION",
          category: "SOCIAL",
          title: `Social post not confirmed: "${draftTitle(d)}"`,
          description: `Planned for ${cyprusDateTime(when)} (Cyprus) on ${platformText(d)}. It will not publish until it is confirmed in Typefully.`,
          deepLink: draftLink(d.id),
          since: sinceOf(d, now),
        });
      } else if (delta < 0 && -delta <= MISSED_LOOKBACK_MS) {
        items.push({
          id: `social-missed:${d.id}`,
          severity: "URGENT",
          category: "SOCIAL",
          title: `Social post missed: "${draftTitle(d)}"`,
          description: `Was planned for ${cyprusDateTime(when)} (Cyprus) on ${platformText(d)} and never confirmed, so it did not go out.`,
          deepLink: draftLink(d.id),
          since: when,
        });
      }
    }
  }

  if (input.errored.ok) {
    for (const d of input.errored.drafts) {
      const when = at(d);
      items.push({
        id: `social-publish-error:${d.id}`,
        severity: "URGENT",
        category: "SOCIAL",
        title: `Social post failed to publish: "${draftTitle(d)}"`,
        description: `Typefully reports a publishing error${when ? ` for ${cyprusDateTime(when)} (Cyprus)` : ""} on ${platformText(d)}.`,
        deepLink: draftLink(d.id),
        since: sinceOf(d, now),
      });
    }
  }
  return items;
}

/* ── Morning digest ─────────────────────────────────────────────────────── */

function cyprusYmd(date: Date): { y: number; m: number; d: number; weekday: number } {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: CYPRUS_TZ, year: "numeric", month: "numeric", day: "numeric", weekday: "short" }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { y: Number(get("year")), m: Number(get("month")), d: Number(get("day")), weekday };
}

/** UTC range [start, end) of Cyprus calendar days `fromOffset`..`toOffset` (exclusive) relative to `now`'s day. */
function cyprusDayRange(now: Date, fromOffset: number, toOffset: number): [Date, Date] {
  const { y, m, d } = cyprusYmd(now);
  // Date.UTC inside cyprusWallTimeToUtc rolls day overflow into the next month/year.
  return [cyprusWallTimeToUtc(y, m, d + fromOffset, 0, 0), cyprusWallTimeToUtc(y, m, d + toOffset, 0, 0)];
}

export const NO_WEEK_DRAFTS_LINE = "No social drafts for this week — the Sunday routine may not have run.";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const linked = (d: TypefullyDraft) => `<a href="${draftLink(d.id)}">${esc(draftTitle(d))}</a>`;
const byDate = (a: TypefullyDraft, b: TypefullyDraft) => (at(a)?.getTime() ?? 0) - (at(b)?.getTime() ?? 0);
const inRange = (d: TypefullyDraft, from: number, to: number) => {
  const w = at(d)?.getTime();
  return w !== undefined && !Number.isNaN(w) && w >= from && w < to;
};

export type SocialDigestInput = {
  scheduled: DraftListResult;
  planned: DraftListResult;
  errored: DraftListResult;
  /** Plain drafts ("draft" status), fetched on Mondays only for the "no drafts this
   *  week" check. Together with scheduled/planned/error that covers every status
   *  that can carry a Tue–Fri date at 08:00 on a Monday: "published" and
   *  "publishing" are by definition dated now or earlier. */
  rest?: DraftListResult[];
};

/** The digest's "📣 SOCIAL" section — [] when there is nothing to report. */
export function socialDigestLines(input: SocialDigestInput, now: Date): string[] {
  const t = now.getTime();
  const body: string[] = [];

  const failures = [input.scheduled, input.planned, input.errored, ...(input.rest ?? [])].filter((r) => !r.ok) as Extract<DraftListResult, { ok: false }>[];
  if (failures.length) {
    const f = failures[0];
    body.push(`⚠️ Typefully API ${f.status !== null ? `returned HTTP ${f.status}` : "unreachable"} — social posts could not be checked (${esc(f.message.slice(0, 120))}).`);
  }

  const [todayStart, todayEnd] = cyprusDayRange(now, 0, 1);
  if (input.scheduled.ok) {
    for (const d of input.scheduled.drafts.filter((x) => inRange(x, todayStart.getTime(), todayEnd.getTime())).sort(byDate)) {
      body.push(`• Today ${cyprusTime(at(d)!)} · ${esc(platformText(d))} · ${linked(d)}`);
    }
  }

  if (input.planned.ok) {
    const planned = [...input.planned.drafts].sort(byDate);
    for (const d of planned.filter((x) => inRange(x, t - MISSED_LOOKBACK_MS, t))) {
      body.push(`• 🔴 Missed, never confirmed · ${cyprusDateTime(at(d)!)} · ${esc(platformText(d))} · ${linked(d)}`);
    }
    for (const d of planned.filter((x) => inRange(x, t, t + DIGEST_UNCONFIRMED_MS + 1))) {
      body.push(`• ⚠️ Not confirmed · ${cyprusDateTime(at(d)!)} · ${esc(platformText(d))} · ${linked(d)}`);
    }
  }

  if (input.errored.ok) {
    for (const d of [...input.errored.drafts].sort(byDate)) {
      body.push(`• ❌ Publish error · ${esc(platformText(d))} · ${linked(d)}`);
    }
  }

  // Monday: anything dated Tuesday–Friday of this ISO week, in ANY status. Only
  // claimed when every list actually answered — a failed fetch is reported
  // above and must not turn into a false "the routine did not run".
  if (cyprusYmd(now).weekday === 1 && input.rest) {
    const lists = [input.scheduled, input.planned, input.errored, ...input.rest];
    if (lists.every((r) => r.ok)) {
      const [tue, sat] = cyprusDayRange(now, 1, 5);
      const any = lists.some((r) => r.ok && r.drafts.some((d) => inRange(d, tue.getTime(), sat.getTime())));
      if (!any) body.push(`• ${NO_WEEK_DRAFTS_LINE}`);
    }
  }

  return body.length ? ["", "<b>📣 SOCIAL</b>", ...body] : [];
}
