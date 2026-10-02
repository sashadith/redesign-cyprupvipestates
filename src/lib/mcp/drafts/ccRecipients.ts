// CC recipients of an MCP email draft (2026-10-02): leads that came through a
// partner get the partner in copy. The list is fixed when the draft is created
// — shown in the operator's preview, stored on the draft, and sent verbatim —
// so what was approved is exactly what goes out.

export const MAX_CC = 5;

// Deliberately strict: one plain address per entry. Anything that could carry a
// second recipient or a header (comma, semicolon, angle brackets, whitespace,
// line breaks) is rejected rather than parsed.
const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:".]+(\.[^\s@<>()[\]\\,;:".]+)*\.[A-Za-z]{2,}$/;

export const isPlainEmail = (s: string) => s.length <= 254 && EMAIL_RE.test(s);

export type CcCheck = { ok: true; cc: string[] } | { ok: false; message: string };

/** Validates and normalises (trims) a CC list against the lead's own address.
 *  Order is kept; comparisons ignore case. */
export function checkCcRecipients(cc: readonly string[] | null | undefined, leadEmail: string): CcCheck {
  const list = (cc ?? []).map((a) => String(a ?? "").trim());
  if (list.length > MAX_CC) return { ok: false, message: `At most ${MAX_CC} CC recipients.` };
  const lead = leadEmail.trim().toLowerCase();
  const seen = new Set<string>();
  for (const a of list) {
    if (!isPlainEmail(a)) return { ok: false, message: `Not a valid email address for CC: "${a}".` };
    const key = a.toLowerCase();
    if (key === lead) return { ok: false, message: `${a} is the lead's own address — it is already the recipient, it cannot also be in CC.` };
    if (seen.has(key)) return { ok: false, message: `${a} is listed twice in CC.` };
    seen.add(key);
  }
  return { ok: true, cc: list };
}
