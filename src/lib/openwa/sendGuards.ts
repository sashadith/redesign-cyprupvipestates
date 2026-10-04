export type SendFacts = { leadExists: boolean; chatId: string | null; threadExists: boolean; sentToday: number; dailyCap: number };
export type SendDecision = { allowed: true } | { allowed: false; code: "not_found" | "validation" | "rate_limited"; reason: string };

// Order matters: identity first, then addressability, then the cap — so a
// message refused for any other reason is never counted against the day.
export function decideSend(f: SendFacts): SendDecision {
  if (!f.leadExists) return { allowed: false, code: "not_found", reason: "Lead not found." };
  if (!f.chatId) return { allowed: false, code: "validation", reason: "This lead has no usable phone number on file." };
  if (!f.threadExists) {
    return {
      allowed: false,
      code: "validation",
      reason: "There is no existing WhatsApp conversation with this number. This tool can only continue a thread that already exists, never start one.",
    };
  }
  if (f.sentToday >= f.dailyCap) {
    return { allowed: false, code: "rate_limited", reason: `Daily WhatsApp limit reached (${f.dailyCap} messages). It resets at midnight Cyprus time.` };
  }
  return { allowed: true };
}

const NICOSIA_PARTS_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Nicosia",
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
});

// Read `d`'s Nicosia wall-clock time back as if those same numbers were UTC.
// This is not a real instant — it's a "local time expressed as a UTC-shaped
// number" — used only as a comparable/subtractable quantity below.
function nicosiaWallClockAsUtcMs(d: Date): number {
  const parts = NICOSIA_PARTS_FMT.formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  // Intl.DateTimeFormat can return hour=24 for midnight; normalize it.
  return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
}

// The cap should reset when the operator's day does, not at 02:00 or 03:00
// local because the rows are stored in UTC. The offset must be derived from
// local midnight itself, not from `now`'s own instant: on a DST-transition
// day these can sit on opposite sides of the transition, so an offset that's
// correct for `now` can be wrong by an hour for that same day's midnight.
//
// We find the UTC instant whose Nicosia wall-clock reads as that day's
// 00:00:00 by a fixed-point search: guess an instant, format it back in
// Nicosia, measure how far the reading is from midnight, and correct by
// that gap. Repeating handles a guess landing on the far side of the
// transition from the true answer; two iterations always converge here
// because Cyprus's transition never moves more than an hour.
export function nicosiaDayStart(now: Date): Date {
  const nowParts = NICOSIA_PARTS_FMT.formatToParts(now);
  const get = (t: string) => Number(nowParts.find((p) => p.type === t)!.value);
  // Local midnight can never itself be the fall-back's repeated hour (that
  // repeat is later, around the transition point in the small hours), so no
  // explicit "first or second occurrence" tie-break is needed here.
  const targetMs = Date.UTC(get("year"), get("month") - 1, get("day"), 0, 0, 0);

  let candidateMs = targetMs;
  for (let i = 0; i < 3; i++) {
    const diff = nicosiaWallClockAsUtcMs(new Date(candidateMs)) - targetMs;
    if (diff === 0) break;
    candidateMs -= diff;
  }
  return new Date(candidateMs);
}
