// "Reply all" recipients of an inbound lead email (2026-10-02): everyone else
// on the message — sender, To and CC — except the operator and the lead. Stored
// on the EMAIL_IN row as metadata.cc so a reply drafted through the connector
// can keep a partner in copy (crm_draft_email uses the latest reply's list when
// no `cc` is given). Pure: no database, no mail parsing.
import { isPlainEmail } from "@/lib/mcp/drafts/ccRecipients";

/** mailparser's AddressObject (or an array of them) — only the parts read here. */
type AddressField = { value?: { address?: string | null }[] } | { value?: { address?: string | null }[] }[] | null | undefined;

/** Stored per message; a reply draft still caps CC at its own limit. */
export const MAX_STORED_REPLY_RECIPIENTS = 10;

function addresses(field: AddressField): string[] {
  const list = Array.isArray(field) ? field : field ? [field] : [];
  return list.flatMap((f) => (f?.value ?? []).map((v) => String(v?.address ?? "").trim()).filter(Boolean));
}

/**
 * @param exclude addresses never to keep (the operator's own address, the lead's)
 * @param canon   how two addresses are compared — processInbound passes the same
 *                canonicalisation it matches leads with (Gmail dots etc.)
 */
export function replyAllRecipients(
  msg: { from?: AddressField; to?: AddressField; cc?: AddressField },
  exclude: (string | null | undefined)[],
  canon: (a: string) => string = (a) => a.trim().toLowerCase(),
): string[] {
  const skip = new Set(exclude.filter((a): a is string => !!a && !!a.trim()).map(canon));
  const out: string[] = [];
  const seen = new Set<string>();
  for (const a of [...addresses(msg.from), ...addresses(msg.to), ...addresses(msg.cc)]) {
    if (!isPlainEmail(a)) continue;
    const key = canon(a);
    if (skip.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(a);
    if (out.length >= MAX_STORED_REPLY_RECIPIENTS) break;
  }
  return out;
}
