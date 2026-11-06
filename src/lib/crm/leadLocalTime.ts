import { COUNTRIES, countryOf, countryOfPhone, internationalDigits } from "./countryInfo";

// The lead's local time (2026-11-04): which IANA zone the lead lives in, what time it is there, and
// whether that is a good moment to call. Display only — nothing is ever moved or scheduled by it.
// Pure and client-safe (the cockpit's follow-up control formats with it in the browser).
//
// Zone, in this order: one picked by hand on the lead (Lead.timeZone) > the form's country of
// residence > the phone's calling code. A country with several zones (US, Canada, Russia, Australia,
// …) gives no zone but the list to pick from, shown as "zone unclear".

export type LeadZone =
  | { zone: string; source: "lead" | "country" | "phone"; country: string | null }
  | { zone: null; reason: "ambiguous"; country: string; options: string[] }
  | { zone: null; reason: "unknown" };

export function isTimeZone(zone: string | null | undefined): zone is string {
  if (!zone) return false;
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

// Countries whose zones really split the population; elsewhere the extra zones are outlying islands
// (Spain's Canaries, Portugal's Azores) and the first zone is taken.
const SPLIT_COUNTRIES = new Set(["US", "CA", "RU", "AU", "BR", "MX", "KZ"]);

const NORTH_AMERICA = Array.from(new Set(COUNTRIES.filter((c) => c.dial === "1").flatMap((c) => c.zones)));

export function leadZone(l: { timeZone?: string | null; countryOfResidence?: string | null; phone?: string | null }): LeadZone {
  if (isTimeZone(l.timeZone)) return { zone: l.timeZone, source: "lead", country: countryOf(l.countryOfResidence)?.name ?? null };
  const home = countryOf(l.countryOfResidence);
  if (home) {
    return home.zones.length === 1 || !SPLIT_COUNTRIES.has(home.iso)
      ? { zone: home.zones[0], source: "country", country: home.name }
      : { zone: null, reason: "ambiguous", country: home.name, options: home.zones };
  }
  const byPhone = countryOfPhone(l.phone);
  if (byPhone) {
    return byPhone.zones.length === 1 || !SPLIT_COUNTRIES.has(byPhone.iso)
      ? { zone: byPhone.zones[0], source: "phone", country: byPhone.name }
      : { zone: null, reason: "ambiguous", country: byPhone.name, options: byPhone.zones };
  }
  if (internationalDigits(l.phone)?.startsWith("1")) return { zone: null, reason: "ambiguous", country: "United States / Canada", options: NORTH_AMERICA };
  return { zone: null, reason: "unknown" };
}

// ── Call window ─────────────────────────────────────────────────────────────

// Configuration, not code: CRM_CALL_GREEN, CRM_CALL_AMBER ("HH:MM-HH:MM", comma-separated) and
// CRM_CALL_WORKDAYS ("1-5", 1 = Monday … 7 = Sunday) override these defaults. Anything outside the
// green and amber spans, and every non-workday, is red.
export const DEFAULT_CALL_WINDOW = { green: "09:00-20:00", amber: "08:00-09:00,20:00-21:00", workdays: "1-5" };

export type CallWindow = { green: [number, number][]; amber: [number, number][]; workdays: number[] };
export type CallLight = "green" | "amber" | "red";

const minutes = (hhmm: string): number | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m || Number(m[1]) > 24 || Number(m[2]) > 59) return null;
  return Number(m[1]) * 60 + Number(m[2]);
};

function spans(v: string | undefined, fallback: string): [number, number][] {
  const parse = (s: string) => s.split(",").map((part) => part.split("-").map(minutes)).filter((p): p is [number, number] => p.length === 2 && p[0] != null && p[1] != null && p[0] < p[1]);
  const out = v ? parse(v) : [];
  return out.length ? out : parse(fallback);
}

function days(v: string | undefined, fallback: string): number[] {
  const parse = (s: string) => s.split(",").flatMap((part) => {
    const [a, b] = part.split("-").map((x) => Number(x.trim()));
    if (!Number.isInteger(a) || a < 1 || a > 7) return [];
    const end = Number.isInteger(b) && b >= a && b <= 7 ? b : a;
    return Array.from({ length: end - a + 1 }, (_, i) => a + i);
  });
  const out = v ? parse(v) : [];
  return out.length ? out : parse(fallback);
}

export function parseCallWindow(env: { green?: string; amber?: string; workdays?: string } = {}): CallWindow {
  return {
    green: spans(env.green, DEFAULT_CALL_WINDOW.green),
    amber: spans(env.amber, DEFAULT_CALL_WINDOW.amber),
    workdays: days(env.workdays, DEFAULT_CALL_WINDOW.workdays),
  };
}

/** Server side: the window from the environment. In the browser these are unset, so the defaults apply. */
export function callWindowFromEnv(): CallWindow {
  const env: Record<string, string | undefined> = typeof process !== "undefined" ? process.env : {};
  return parseCallWindow({ green: env.CRM_CALL_GREEN, amber: env.CRM_CALL_AMBER, workdays: env.CRM_CALL_WORKDAYS });
}

// ── Clock ───────────────────────────────────────────────────────────────────

const WEEKDAY: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

function parts(at: Date, zone: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: zone, weekday: "short", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(at).map((x) => [x.type, x.value]),
  );
  return { weekday: p.weekday as string, y: Number(p.year), m: Number(p.month), d: Number(p.day), hh: Number(p.hour), mm: Number(p.minute) };
}

/** "London" from "Europe/London", "St Johns" from "America/St_Johns". */
export const zoneCity = (zone: string) => (zone.split("/").pop() ?? zone).replace(/_/g, " ");

export function callLight(at: Date, zone: string, w: CallWindow): CallLight {
  const p = parts(at, zone);
  if (!w.workdays.includes(WEEKDAY[p.weekday])) return "red";
  const t = p.hh * 60 + p.mm;
  const inside = (s: [number, number][]) => s.some(([a, b]) => t >= a && t < b);
  return inside(w.green) ? "green" : inside(w.amber) ? "amber" : "red";
}

export type LocalClock = { zone: string; city: string; time: string; weekday: string; light: CallLight };

export function localClock(zone: string, now: Date, w: CallWindow): LocalClock {
  const p = parts(now, zone);
  return { zone, city: zoneCity(zone), time: `${String(p.hh).padStart(2, "0")}:${String(p.mm).padStart(2, "0")}`, weekday: p.weekday, light: callLight(now, zone, w) };
}

export const LIGHT_LABEL: Record<CallLight, string> = { green: "good time to call", amber: "borderline time to call", red: "not a time to call" };

// ── Follow-up dates ─────────────────────────────────────────────────────────

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_MS = 86_400_000;
const dd = (n: number) => String(n).padStart(2, "0");

/** ISO week of the date in `tz` (the CRM's Nicosia by default), with its Monday and Friday as UTC-midnight dates of that calendar day. */
export function isoWeek(at: Date, tz = "Asia/Nicosia"): { week: number; monday: Date; friday: Date } {
  const p = parts(at, tz);
  const day = Date.UTC(p.y, p.m - 1, p.d);
  const wd = WEEKDAY[p.weekday];
  const thursday = new Date(day + (4 - wd) * DAY_MS);
  const jan1 = Date.UTC(thursday.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((thursday.getTime() - jan1) / DAY_MS + 1) / 7);
  const monday = new Date(day - (wd - 1) * DAY_MS);
  return { week, monday, friday: new Date(monday.getTime() + 4 * DAY_MS) };
}

/** "KW 45 (02 - 06 Nov)": ISO week of the date in `tz` (the CRM's Nicosia by default), Monday to Friday. */
export function weekLabel(at: Date, tz = "Asia/Nicosia"): string {
  const { week, monday: mon, friday: fri } = isoWeek(at, tz);
  const range = mon.getUTCMonth() === fri.getUTCMonth()
    ? `${dd(mon.getUTCDate())} - ${dd(fri.getUTCDate())} ${MONTH[fri.getUTCMonth()]}`
    : `${dd(mon.getUTCDate())} ${MONTH[mon.getUTCMonth()]} - ${dd(fri.getUTCDate())} ${MONTH[fri.getUTCMonth()]}`;
  return `KW ${week} (${range})`;
}

/** The follow-up instant on the lead's clock: "07:00 Thu in London". */
export function followUpLeadTime(at: Date, zone: string): string {
  const p = parts(at, zone);
  return `${dd(p.hh)}:${dd(p.mm)} ${p.weekday} in ${zoneCity(zone)}`;
}

// ── One summary for the MCP rows and the Telegram lines ─────────────────────

export type LeadTimeSummary =
  | { zone: string; source: "lead" | "country" | "phone"; time: string; weekday: string; callLight: CallLight; text: string }
  | { zone: null; status: "zone unclear"; country: string; options: string[]; text: string }
  | { zone: null; status: "unknown"; text: string };

export function leadTimeSummary(l: { timeZone?: string | null; countryOfResidence?: string | null; phone?: string | null }, now: Date, w: CallWindow): LeadTimeSummary {
  const z = leadZone(l);
  if (!("reason" in z)) {
    const c = localClock(z.zone, now, w);
    return { zone: z.zone, source: z.source, time: c.time, weekday: c.weekday, callLight: c.light, text: `${c.weekday} ${c.time} in ${c.city} (${LIGHT_LABEL[c.light]})` };
  }
  if (z.reason === "ambiguous") return { zone: null, status: "zone unclear", country: z.country, options: z.options, text: `Zone unclear (${z.country}): pick it on the lead` };
  return { zone: null, status: "unknown", text: "Local time unknown (no country, no international phone number)" };
}
