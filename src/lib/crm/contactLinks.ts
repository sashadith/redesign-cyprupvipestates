// Contact links on the lead cockpit (CRM v2, 2026-10-18). Pure. Phone and email
// are typed by the lead, so a link is only built from a value that cannot
// smuggle extra parts (mailto headers, a different path) into the URL.

// A plain address only: no ?, &, #, whitespace, quotes or angle brackets.
const PLAIN_EMAIL = /^[^\s?&#<>"'@]+@[^\s?&#<>"'@]+\.[^\s?&#<>"'@]+$/;

export function safeMailto(email: string | null | undefined): string | null {
  const e = email?.trim();
  return e && PLAIN_EMAIL.test(e) ? `mailto:${e}` : null;
}

// Digits for https://wa.me/<digits>: international format without "+" or a leading "00".
export function waDigits(phone: string | null | undefined): string | null {
  const d = (phone ?? "").replace(/\D/g, "").replace(/^00/, "");
  return d.length >= 6 ? d : null;
}
