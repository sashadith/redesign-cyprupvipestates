/** Partner portal e-mails — pure builders (no I/O). Plain text + minimal HTML (CI-styled, logo only), no tracking. */
import { CLASSIC_EMAIL_THEME, type EmailTheme } from "@/lib/design/theme";
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

export type EmailParts = {
  subject: string;
  greeting: string | null;
  intro: string;
  /** Optional quoted block under the intro (e.g. a message from us): escaped, newlines kept. */
  quote?: string | null;
  button: string;
  link: string;
  notes: string[];
  signature: string;
  /** Projects listed under the intro (PROJECT_NEWS): a linked title and plain lines each. */
  items?: EmailItem[];
  /** Under the card: tagline, a few portal links (partnerFooter). Absent = no footer. */
  footer?: EmailFooter;
};

export type EmailItem = { title: string; href: string; lines: string[] };
export type EmailFooter = { tagline: string; links: { label: string; href: string }[]; settings: { label: string; href: string } | null };

/** Our WhatsApp, as on the public site's contact block. */
export const PARTNER_WHATSAPP_URL = "https://wa.me/35799278285";

/**
 * Footer of every partner mail (2026-10-31): the tagline, links to the portal, submitting a client, all projects
 * and our WhatsApp, and the notification settings. `brand` = the tagline only (verify / reset, before a login exists).
 */
export function partnerFooter(locale: PartnerLocale, mode: "full" | "brand" = "full"): EmailFooter {
  const f = dict(locale).mail.footer;
  if (mode === "brand") return { tagline: f.tagline, links: [], settings: null };
  const base = partnerBaseUrl();
  return {
    tagline: f.tagline,
    links: [
      { label: f.portal, href: base },
      { label: f.submit, href: `${base}/submit` },
      { label: f.projects, href: `${base}/projects` },
      { label: f.whatsapp, href: PARTNER_WHATSAPP_URL },
    ],
    settings: { label: f.settings, href: `${base}/profile#settings` },
  };
}

/** The CI partner mail layout (logo, paper card, bronze button). Every value is escaped here. */
export function renderPartnerEmail(p: EmailParts, theme: EmailTheme = CLASSIC_EMAIL_THEME): BuiltEmail {
  const quote = p.quote ? p.quote.replace(/\r\n?/g, "\n") : null;
  const items = p.items ?? [];
  const itemsText = items.map((it) => [it.title, it.href, ...it.lines].join("\n")).join("\n\n");
  const f = p.footer;
  const footerText = f
    ? [`— ${f.tagline}`, ...f.links.map((l) => `${l.label}: ${l.href}`), f.settings ? `${f.settings.label}: ${f.settings.href}` : null]
        .filter((x): x is string => !!x)
        .join("\n")
    : null;
  const text = [p.greeting, p.intro, quote, itemsText, `${p.button}: ${p.link}`, ...p.notes, p.signature, footerText]
    .filter((x): x is string => !!x)
    .join("\n\n");
  // CI (light): paper #F5F1E8 page, #FBF9F3 card, ink #221C15 text, bronze #8E6B3D button (white label 4.9:1),
  // champagne #C29A5E only as a decorative rule. Inline styles + a solid rule: mail clients drop gradients and <style>.
  const para = (s: string) => `<p style="margin:0 0 16px">${escapeHtml(s).replace(/\n/g, "<br>")}</p>`;
  const logo = `${partnerBaseUrl()}/crm/brand/logo-full.png`;
  const T = theme;
  const r16 = `${T.radius}px`;
  const r4 = `${Math.round((4 * T.radius) / 16)}px`;
  const small = `${Math.round((T.base * 13) / 15)}px`;
  const html =
    `<!doctype html><html><body style="margin:0;padding:32px 16px;background:${T.page};font-family:Arial,Helvetica,sans-serif;color:${T.text};font-size:${T.base}px;line-height:1.6">` +
    `<div style="max-width:520px;margin:0 auto">` +
    `<div style="text-align:center;padding:0 0 24px"><img src="${escapeHtml(logo)}" width="250" height="35" alt="Cyprus VIP Estates" style="display:inline-block;border:0;width:250px;height:35px"></div>` +
    `<div style="background:${T.card};border:1px solid ${T.border};border-radius:${r16};padding:32px 28px">` +
    (p.greeting ? para(p.greeting) : "") +
    para(p.intro) +
    (quote
      ? `<div style="margin:0 0 16px;padding:12px 16px;background:${T.page};border-left:3px solid ${T.gold};border-radius:${r4}">${escapeHtml(quote).replace(/\n/g, "<br>")}</div>`
      : "") +
    items
      .map(
        (it) =>
          `<div style="margin:0 0 20px;padding:0 0 0 14px;border-left:3px solid ${T.gold}">` +
          `<p style="margin:0 0 4px;font-weight:bold"><a href="${escapeHtml(it.href)}" style="color:${T.accent};text-decoration:none">${escapeHtml(it.title)}</a></p>` +
          it.lines.map((l) => `<p style="margin:0 0 2px">${escapeHtml(l)}</p>`).join("") +
          `</div>`,
      )
      .join("") +
    `<p style="margin:24px 0 16px"><a href="${escapeHtml(p.link)}" style="display:inline-block;background:${T.accent};color:${T.onAccent.toLowerCase()};text-decoration:none;font-weight:bold;letter-spacing:0.03em;padding:13px 24px;border-radius:${r16}">${escapeHtml(p.button)}</a></p>` +
    `<p style="margin:0 0 20px;font-size:${small};color:${T.muted};word-break:break-all">${escapeHtml(p.link)}</p>` +
    `<div style="height:1px;line-height:1px;font-size:0;background:${T.gold};margin:0 0 20px">&nbsp;</div>` +
    p.notes.map(para).join("") +
    para(p.signature) +
    `</div>` +
    (f
      ? `<div style="text-align:center;padding:24px 8px 0;font-size:${small};color:${T.muted}">` +
        `<p style="margin:0 0 10px;font-size:${T.base}px;color:${T.text};font-weight:bold">${escapeHtml(f.tagline)}</p>` +
        (f.links.length
          ? `<p style="margin:0 0 10px">${f.links
              .map((l) => `<a href="${escapeHtml(l.href)}" style="color:${T.accent};text-decoration:none">${escapeHtml(l.label)}</a>`)
              .join(" &nbsp;·&nbsp; ")}</p>`
          : "") +
        (f.settings ? `<p style="margin:0"><a href="${escapeHtml(f.settings.href)}" style="color:${T.muted}">${escapeHtml(f.settings.label)}</a></p>` : "") +
        `</div>`
      : "") +
    `</div></body></html>`;
  return { subject: p.subject, text, html };
}

export const greet = (template: string, name: string | undefined) => {
  const n = (name ?? "").trim();
  if (!n && template.includes("{name}")) return null;
  return fmt(template, { name: n });
};

export function buildVerifyEmail(locale: PartnerLocale, link: string, name?: string, theme: EmailTheme = CLASSIC_EMAIL_THEME): BuiltEmail {
  const t = dict(locale).mail;
  return renderPartnerEmail({
    subject: t.verify.subject,
    greeting: greet(t.verify.greeting, name),
    intro: t.verify.intro,
    button: t.verify.button,
    link,
    notes: [t.verify.validity, t.verify.ignore],
    signature: t.signature,
    footer: partnerFooter(locale, "brand"),
  }, theme);
}

export function buildResetEmail(locale: PartnerLocale, link: string, name?: string, theme: EmailTheme = CLASSIC_EMAIL_THEME): BuiltEmail {
  const t = dict(locale).mail;
  return renderPartnerEmail({
    subject: t.reset.subject,
    greeting: greet(t.reset.greeting, name),
    intro: t.reset.intro,
    button: t.reset.button,
    link,
    notes: [t.reset.validity, t.reset.ignore],
    signature: t.signature,
    footer: partnerFooter(locale, "brand"),
  }, theme);
}

/** `submitLink` (notifications v2): the portal's submit page, named as the next step together with the Telegram tip. */
export function buildApprovedEmail(locale: PartnerLocale, name: string, loginLink: string, theme: EmailTheme = CLASSIC_EMAIL_THEME, submitLink?: string): BuiltEmail {
  const t = dict(locale).mail;
  return renderPartnerEmail({
    subject: t.approved.subject,
    greeting: greet(t.approved.greeting, name),
    intro: t.approved.intro,
    button: t.approved.button,
    link: loginLink,
    notes: submitLink ? [fmt(t.approved.nextStep, { url: submitLink }), t.approved.telegram] : [],
    signature: t.signature,
    footer: partnerFooter(locale),
  }, theme);
}

/** Office Telegram notice for a newly verified registration (HTML parse mode → values escaped). */
export function buildRegistrationNotice(p: { company: string | null; firstName: string; lastName: string; country: string }): string {
  const who = p.company?.trim() || `${p.firstName} ${p.lastName}`.trim();
  return `New partner registration: ${escapeHtml(who)}, ${escapeHtml(p.country)} → /crm/partners`;
}

/**
 * "Your bank details were changed" mail to the partner. Carries only the last 4 of the IBAN and the
 * time of the change — never the IBAN itself or any other bank/billing value.
 */
export function buildBankChangedEmail(
  locale: PartnerLocale,
  i: { name?: string; ibanLast4: string; changedAt: Date },
  theme: EmailTheme = CLASSIC_EMAIL_THEME,
): BuiltEmail {
  const t = dict(locale).mail;
  const when = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Nicosia" }).format(i.changedAt);
  return renderPartnerEmail({
    subject: t.bankChanged.subject,
    greeting: greet(t.bankChanged.greeting, i.name),
    intro: fmt(t.bankChanged.intro, { last4: String(i.ibanLast4).slice(-4) }),
    button: t.bankChanged.button,
    link: `${partnerBaseUrl()}/profile`,
    notes: [fmt(t.bankChanged.changedOn, { date: when }), t.bankChanged.warning],
    signature: t.signature,
    footer: partnerFooter(locale),
  }, theme);
}
