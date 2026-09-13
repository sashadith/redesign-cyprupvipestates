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

// The cap should reset when the operator's day does, not at 02:00 or 03:00
// local because the rows are stored in UTC. Derived from the zone's own offset
// so DST needs no table.
export function nicosiaDayStart(now: Date): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Nicosia",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  // Intl.DateTimeFormat can return hour=24 for midnight; normalize it
  const hour = get("hour") % 24;
  const localMs = Date.UTC(get("year"), get("month") - 1, get("day"), hour, get("minute"), get("second"));
  const offsetMs = localMs - now.getTime();
  const localMidnightMs = Date.UTC(get("year"), get("month") - 1, get("day"));
  return new Date(localMidnightMs - offsetMs);
}
