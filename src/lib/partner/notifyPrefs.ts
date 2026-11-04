// Partner notification preferences (notifications v2, 2026-10-30). Pure, no I/O.
// Per-type switches (portal profile + Telegram bot menu) and Telegram quiet hours. The same rules are used
// by the planner (no row for a switched-off type), the sender (re-check at send time) and both UIs.
import type { NotificationKind } from "./notify";

/** The switchable groups, in display order. Decisions, payouts, bank and tier messages are always on. */
export const NOTIFY_SWITCHES = ["notifyClients", "notifyNewProjects", "notifyProjectUpdates", "notifyReminders"] as const;
export type NotifySwitch = (typeof NOTIFY_SWITCHES)[number];
export type NotifySwitches = Record<NotifySwitch, boolean>;

const SWITCH_OF: Partial<Record<NotificationKind, NotifySwitch>> = {
  STAGE: "notifyClients",
  MESSAGE: "notifyClients",
  MATCH: "notifyClients",
  PRESENTATION_OPENED: "notifyClients",
  PROJECT_NEWS: "notifyNewProjects",
  WATCH: "notifyProjectUpdates",
  PROTECTION_ENDING: "notifyReminders",
  CLIENT_QUIET: "notifyReminders",
};

/** The switch that governs a kind, or null when the kind is always sent. */
export function switchOf(kind: NotificationKind): NotifySwitch | null {
  return SWITCH_OF[kind] ?? null;
}

export const SWITCHED_OFF_ERROR = "switched off";

/** "switched off" when the partner turned the kind's group off (all channels), else null. */
export function switchGate(kind: NotificationKind, p: NotifySwitches): string | null {
  const k = switchOf(kind);
  return k && !p[k] ? SWITCHED_OFF_ERROR : null;
}

// ── Quiet hours (Telegram only) ─────────────────────────────────────────────

export const QUIET_TZ = "Asia/Nicosia";
/** Offered in the bot and the portal; [from, to] whole hours, Cyprus time. */
export const QUIET_PRESETS: readonly (readonly [number, number])[] = [[22, 8], [21, 8], [23, 7], [20, 9], [22, 7]];

const isHour = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 23;

/** Stored pair → [from, to], or null when quiet hours are off (or the pair is invalid/empty). */
export function quietWindow(from: unknown, to: unknown): [number, number] | null {
  return isHour(from) && isHour(to) && from !== to ? [from, to] : null;
}

/** "22-8" → [22, 8]; "off" → null; anything else → undefined (invalid). Accepts only the presets. */
export function parseQuietPreset(v: unknown): [number, number] | null | undefined {
  if (v === "off") return null;
  if (typeof v !== "string") return undefined;
  const m = /^(\d{1,2})-(\d{1,2})$/.exec(v);
  if (!m) return undefined;
  const pair = [Number(m[1]), Number(m[2])] as [number, number];
  return QUIET_PRESETS.some(([f, t]) => f === pair[0] && t === pair[1]) ? pair : undefined;
}

export const quietKey = (w: [number, number] | null) => (w ? `${w[0]}-${w[1]}` : "off");

/** Hour of day (0–23) in Cyprus. */
export function cyprusHour(at: Date): number {
  return Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: QUIET_TZ }).format(at));
}

/** Inside the window? from > to wraps midnight (22–8 = 22:00 … 07:59). */
export function inQuietHours(at: Date, w: [number, number] | null): boolean {
  if (!w) return false;
  const h = cyprusHour(at);
  const [from, to] = w;
  return from < to ? h >= from && h < to : h >= from || h < to;
}

/**
 * The instant the window ends (the next full hour in Cyprus that equals `to`), or null when `at` is not
 * inside it. Cyprus offsets are whole hours, so stepping full UTC hours lands on full Cyprus hours.
 */
export function quietEndsAt(at: Date, w: [number, number] | null): Date | null {
  if (!w || !inQuietHours(at, w)) return null;
  const t = new Date(at);
  t.setUTCMinutes(0, 0, 0);
  for (let i = 0; i < 26; i++) {
    t.setUTCHours(t.getUTCHours() + 1);
    if (cyprusHour(t) === w[1]) return new Date(t);
  }
  return null;
}

/** "22:00–08:00" */
export function quietLabel(w: [number, number] | null, offLabel: string): string {
  if (!w) return offLabel;
  const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;
  return `${hh(w[0])}–${hh(w[1])}`;
}
