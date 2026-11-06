import { isoWeek, zoneCity } from "@/lib/crm/leadLocalTime";
import { CRM_TZ } from "@/lib/crm/today";

// Display helpers for the partner pipeline (partner pipeline, 2026-11-05). Pure and
// client-safe. leadLocalTime words its clock and week in English; the portal formats
// the same instants in the partner's language.

/** The ISO week of `at` in Cyprus and its Monday and Friday (UTC-midnight dates: format them with timeZone UTC). */
export function weekRange(at: Date): { week: number; monday: Date; friday: Date } {
  return isoWeek(at, CRM_TZ);
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
