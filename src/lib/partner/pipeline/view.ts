import { weekLabel, zoneCity } from "@/lib/crm/leadLocalTime";

// Display helpers for the partner pipeline (partner pipeline, 2026-11-05). Pure and
// client-safe. leadLocalTime words its clock and week in English; the portal formats
// the same instants in the partner's language.

const DAY_MS = 86_400_000;
const CY_TZ = "Asia/Nicosia";

/** The ISO week of `at` in Cyprus (weekLabel's week) and its Monday and Friday, as UTC-noon dates. */
export function weekRange(at: Date): { week: number; monday: Date; friday: Date } {
  const week = Number(/KW (\d+)/.exec(weekLabel(at, CY_TZ))?.[1] ?? 0);
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: CY_TZ, weekday: "short", year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(at).map((x) => [x.type, x.value]),
  );
  const wd = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(p.weekday as string);
  const noon = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), 12);
  const monday = new Date(noon - wd * DAY_MS);
  return { week, monday, friday: new Date(monday.getTime() + 4 * DAY_MS) };
}

/** The lead's clock at `at` in the partner's locale: weekday, time, city. */
export function clientClock(zone: string, at: Date, locale: string): { weekday: string; time: string; city: string } {
  const weekday = new Intl.DateTimeFormat(locale, { timeZone: zone, weekday: "short" }).format(at);
  const time = new Intl.DateTimeFormat(locale, { timeZone: zone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(at);
  return { weekday, time, city: zoneCity(zone) };
}

/**
 * wa.me link that opens WhatsApp on the partner's own device with the text filled in (nothing is
 * sent by us). An international number goes in the link; without one ("07700…" needs a country
 * code wa.me does not guess) WhatsApp lets the partner pick the chat.
 */
export function waMeLink(phone: string | null | undefined, text: string): string {
  const raw = (phone ?? "").trim();
  const intl = raw.startsWith("+") ? raw.slice(1) : raw.startsWith("00") ? raw.slice(2) : raw.startsWith("0") ? "" : raw;
  const digits = intl.replace(/\D/g, "");
  const q = `?text=${encodeURIComponent(text)}`;
  return digits.length >= 6 && digits.length <= 20 ? `https://wa.me/${digits}${q}` : `https://wa.me/${q}`;
}
