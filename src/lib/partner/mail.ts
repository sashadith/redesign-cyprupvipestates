/** Partner portal e-mails — pure builders (no I/O). Plain text + minimal HTML, no tracking. */
import { dict, fmt, type PartnerLocale } from "./i18n";

export type BuiltEmail = { subject: string; text: string; html: string };

/**
 * Base URL for links in partner e-mails: the configured partner host, else the local dev host.
 * Throws in production without PARTNER_HOST — a mail must never carry a localhost link.
 */
export function partnerBaseUrl(
  env: { PARTNER_HOST?: string; NODE_ENV?: string } = process.env as { PARTNER_HOST?: string; NODE_ENV?: string },
): string {
  const host = (env.PARTNER_HOST ?? "").trim().replace(/\.$/, "").replace(/\/+$/, "");
  if (host) return `https://${host}`;
  if (env.NODE_ENV === "production") throw new Error("PARTNER_HOST is not set");
  return "http://partner.localhost:3000";
}

export function escapeHtml(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type Parts = {
  subject: string;
  greeting: string | null;
  intro: string;
  button: string;
  link: string;
  notes: string[];
  signature: string;
};

function render(p: Parts): BuiltEmail {
  const text = [p.greeting, p.intro, `${p.button}: ${p.link}`, ...p.notes, p.signature]
    .filter((x): x is string => !!x)
    .join("\n\n");
  const para = (s: string) => `<p style="margin:0 0 16px">${escapeHtml(s).replace(/\n/g, "<br>")}</p>`;
  const html =
    `<!doctype html><html><body style="margin:0;padding:24px;background:#eef2f1;font-family:Arial,Helvetica,sans-serif;color:#10302b;font-size:15px;line-height:1.5">` +
    `<div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #d5dedb;border-radius:14px;padding:24px">` +
    (p.greeting ? para(p.greeting) : "") +
    para(p.intro) +
    `<p style="margin:0 0 16px"><a href="${escapeHtml(p.link)}" style="display:inline-block;background:#1b4b43;color:#f2f7f5;text-decoration:none;font-weight:bold;padding:10px 16px;border-radius:10px">${escapeHtml(p.button)}</a></p>` +
    `<p style="margin:0 0 16px;font-size:13px;color:#5f716c;word-break:break-all">${escapeHtml(p.link)}</p>` +
    p.notes.map(para).join("") +
    para(p.signature) +
    `</div></body></html>`;
  return { subject: p.subject, text, html };
}

const greet = (template: string, name: string | undefined) => {
  const n = (name ?? "").trim();
  if (!n && template.includes("{name}")) return null;
  return fmt(template, { name: n });
};

export function buildVerifyEmail(locale: PartnerLocale, link: string, name?: string): BuiltEmail {
  const t = dict(locale).mail;
  return render({
    subject: t.verify.subject,
    greeting: greet(t.verify.greeting, name),
    intro: t.verify.intro,
    button: t.verify.button,
    link,
    notes: [t.verify.validity, t.verify.ignore],
    signature: t.signature,
  });
}

export function buildResetEmail(locale: PartnerLocale, link: string, name?: string): BuiltEmail {
  const t = dict(locale).mail;
  return render({
    subject: t.reset.subject,
    greeting: greet(t.reset.greeting, name),
    intro: t.reset.intro,
    button: t.reset.button,
    link,
    notes: [t.reset.validity, t.reset.ignore],
    signature: t.signature,
  });
}

export function buildApprovedEmail(locale: PartnerLocale, name: string, loginLink: string): BuiltEmail {
  const t = dict(locale).mail;
  return render({
    subject: t.approved.subject,
    greeting: greet(t.approved.greeting, name),
    intro: t.approved.intro,
    button: t.approved.button,
    link: loginLink,
    notes: [],
    signature: t.signature,
  });
}

/** Office Telegram notice for a newly verified registration (HTML parse mode → values escaped). */
export function buildRegistrationNotice(p: { company: string | null; firstName: string; lastName: string; country: string }): string {
  const who = p.company?.trim() || `${p.firstName} ${p.lastName}`.trim();
  return `New partner registration: ${escapeHtml(who)}, ${escapeHtml(p.country)} → /crm/partners`;
}
