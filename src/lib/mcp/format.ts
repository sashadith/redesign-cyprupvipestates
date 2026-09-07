// Shapes CRM data for an LLM reader. Every tool goes through these so the
// rules from the spec hold everywhere: Cyprus time + relative label on every
// date, bodies capped, lead-authored text always under `untrusted_content`.
import { adminDateTime } from "@/lib/adminTime";

export const MAX_BODY_CHARS = 2000;
export const MAX_TIMELINE_ROWS = 30;

// "just now" / "5 min ago" / "3 h ago" / "2 days ago" / "in 4 days" — the
// coarsest unit that still reads naturally; minutes and hours never pluralise.
export function relative(d: Date, now: Date = new Date()): string {
  const diff = d.getTime() - now.getTime();
  const abs = Math.abs(diff);
  if (abs < 60_000) return diff <= 0 ? "just now" : "in 1 min";
  let label: string;
  if (abs < 3_600_000) label = `${Math.round(abs / 60_000)} min`;
  else if (abs < 86_400_000) label = `${Math.round(abs / 3_600_000)} h`;
  else {
    const days = Math.round(abs / 86_400_000);
    label = `${days} day${days === 1 ? "" : "s"}`;
  }
  return diff < 0 ? `${label} ago` : `in ${label}`;
}

export function fmtDate(d: Date | null | undefined) {
  if (!d) return null;
  return { iso: d.toISOString(), local: adminDateTime(d), relative: relative(d) };
}

export function truncateText(s: string | null | undefined, max = MAX_BODY_CHARS) {
  if (s == null) return null;
  if (s.length <= max) return { text: s, truncated: false };
  return { text: `${s.slice(0, max)}…`, truncated: true };
}

export function untrusted(s: string | null | undefined, max = MAX_BODY_CHARS) {
  if (!s) return null;
  const t = truncateText(s, max)!;
  return { untrusted_content: t.text, truncated: t.truncated };
}
