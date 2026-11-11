// Sharing a partner presentation (2026-11-11, operator choice 1): no mail leaves our system. The partner
// gets a mailto: link for their own mail program and a wa.me link, both prefilled in the presentation's
// language and signed with the partner's name. Client-safe (no server imports).
import type { PartnerDict } from "./i18n";

// Local placeholder fill: importing fmt from ./i18n would pull all four dictionaries into the client bundle.
const fmt = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (m, k: string) => v[k] ?? m);

export type ShareInput = { greetingName: string; url: string; signer: string; updated: boolean };

function text(t: PartnerDict, p: ShareInput): string {
  const B = t.presBuilder;
  return fmt(p.updated ? B.shareUpdated : B.shareBody, { name: p.greetingName, url: p.url, signer: p.signer }).trim();
}

const EMAIL_RE = /^[^\s@<>()"',;:]+@[^\s@<>()"',;:]+\.[^\s@<>()"',;:]+$/;

/** mailto: with subject and body, or null when the client has no usable email address. */
export function presentationMailto(t: PartnerDict, p: ShareInput & { email: string | null }): string | null {
  const email = p.email?.trim() ?? "";
  if (!EMAIL_RE.test(email)) return null;
  const q = `subject=${encodeURIComponent(t.presBuilder.shareSubject)}&body=${encodeURIComponent(text(t, p))}`;
  return `mailto:${encodeURIComponent(email).replace(/%40/g, "@")}?${q}`;
}

/** https://wa.me/<digits>?text=…, or null without a phone number of at least 7 digits. */
export function presentationWhatsApp(t: PartnerDict, p: ShareInput & { phone: string | null }): string | null {
  const digits = (p.phone ?? "").replace(/\D/g, "").replace(/^00/, "");
  if (digits.length < 7 || digits.length > 15) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text(t, p))}`;
}
