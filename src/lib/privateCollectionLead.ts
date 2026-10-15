// Private Collection enquiries → the CRM (2026-10-15). Replaces the Monday.com
// board the Private Collection site (private.cyprusvipestates.com, separate repo
// at /var/www/private-collection) used to write to: the company no longer works
// with Monday, so its enquiry form now posts here
// (/api/webhooks/private-collection-lead). Briefing downloads are NOT sent —
// operator's call, they stay a Telegram/WhatsApp notice on that site.
//
// Pure: parsing, value mapping and notification text. The route does the I/O.
import type { LeadPreferredChannel } from "@prisma/client";

const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The form's own slugs (private-collection app/api/lead/route.ts) → our fields. */
export const PC_BUDGETS: Record<string, { min: number | null; max: number | null; label: string }> = {
  "below-2m": { min: null, max: 2_000_000, label: "Below €2M" },
  "2-3m": { min: 2_000_000, max: 3_000_000, label: "€2–3M" },
  "3-5m": { min: 3_000_000, max: 5_000_000, label: "€3–5M" },
  "5m-plus": { min: 5_000_000, max: null, label: "€5M+" },
};
export const PC_PURPOSES: Record<string, string> = { relocation: "Relocation", holiday: "Holiday residence", investment: "Investment" };
export const PC_CHANNELS: Record<string, LeadPreferredChannel> = { call: "PHONE", whatsapp: "WHATSAPP", email: "EMAIL" };
const CHANNEL_LABEL: Record<LeadPreferredChannel, string> = { PHONE: "Call", WHATSAPP: "WhatsApp", EMAIL: "Email" };

export type PcLead = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  languagePreference: "en" | "de" | null;
  budgetKey: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  purpose: string | null;
  preferredChannel: LeadPreferredChannel | null;
  message: string | null;
};

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Validates the posted enquiry. Unknown option slugs are kept out of the
 *  mapped fields but never guessed; the raw value still reaches the timeline. */
export function parsePcLead(body: unknown): { ok: true; lead: PcLead; raw: Record<string, string> } | { ok: false; error: string } {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const firstName = str(b.firstName, 100);
  const email = str(b.email, 200).toLowerCase();
  if (!firstName) return { ok: false, error: "firstName required" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "valid email required" };
  const budgetKey = str(b.budget, 20) || null;
  const budget = budgetKey ? PC_BUDGETS[budgetKey] : undefined;
  const purposeKey = str(b.considering, 30);
  const channelKey = str(b.contact, 20);
  const locale = str(b.locale, 5).toLowerCase();
  const raw: Record<string, string> = {};
  for (const k of ["firstName", "lastName", "email", "phone", "considering", "budget", "contact", "locale", "message"]) {
    const v = str(b[k], k === "message" ? 4000 : 200);
    if (v) raw[k] = v;
  }
  return {
    ok: true,
    raw,
    lead: {
      firstName,
      lastName: str(b.lastName, 100),
      email,
      phone: str(b.phone, 40) || null,
      languagePreference: locale === "de" ? "de" : locale === "en" ? "en" : null,
      budgetKey: budget ? budgetKey : null,
      budgetMin: budget?.min ?? null,
      budgetMax: budget?.max ?? null,
      purpose: PC_PURPOSES[purposeKey] ?? null,
      preferredChannel: PC_CHANNELS[channelKey] ?? null,
      message: str(b.message, 4000) || null,
    },
  };
}

/** Timeline body: every answer, mapped where we could, raw where we could not. */
export function pcTimelineBody(l: PcLead, raw: Record<string, string>, outcome: "CREATED" | "ATTACHED"): string {
  const lines = [
    outcome === "CREATED" ? "Lead created from the Private Collection enquiry form." : "Existing lead submitted the Private Collection enquiry form again.",
    `Budget: ${l.budgetKey ? PC_BUDGETS[l.budgetKey].label : raw.budget ? `${raw.budget} (unmapped)` : "not answered"}`,
    `Purpose: ${l.purpose ?? (raw.considering ? `${raw.considering} (unmapped)` : "not answered")}`,
    `Prefers: ${l.preferredChannel ? CHANNEL_LABEL[l.preferredChannel] : raw.contact ? `${raw.contact} (unmapped)` : "not answered"}`,
    `Language: ${l.languagePreference ?? raw.locale ?? "-"}`,
  ];
  if (l.message) lines.push("", "Message:", l.message);
  return lines.join("\n");
}

/** Telegram HTML — also the source of the e-mail and WhatsApp copies. English, admin-facing. */
export function pcTelegram(l: PcLead, o: { outcome: "CREATED" | "ATTACHED"; crmLink: string; priorStatus?: string | null }): string {
  const head = o.outcome === "CREATED" ? "⚡️ <b>New Private Collection enquiry</b>" : "⚡️ <b>Existing lead sent the Private Collection enquiry again</b>";
  const lines = [
    head,
    `<b>${esc(`${l.firstName} ${l.lastName}`.trim())}</b>`,
    `Budget: ${esc(l.budgetKey ? PC_BUDGETS[l.budgetKey].label : "not answered")} · Purpose: ${esc(l.purpose ?? "not answered")} · Prefers: ${esc(l.preferredChannel ? CHANNEL_LABEL[l.preferredChannel] : "not answered")}`,
    [l.email, l.phone].filter(Boolean).map(esc).join(" · "),
  ];
  if (o.priorStatus && o.priorStatus !== "NEW") lines.push(`ℹ️ lead status is ${esc(o.priorStatus)}`);
  if (l.message) lines.push(`Message: ${esc(l.message.length > 500 ? `${l.message.slice(0, 500)}…` : l.message)}`);
  lines.push(`→ <a href="${o.crmLink}">Open in CRM</a>`);
  return lines.join("\n");
}
