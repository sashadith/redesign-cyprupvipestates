import { STATUS_LABEL, type LeadStatusValue } from "@/lib/crm/leadStatus";

// The manager's Telegram when a partner sets his FIX client to RESERVED or CLOSED
// (partner pipeline, 2026-11-05). Pure: no prisma, no network. Internal copy, English.

export const DEAL_ALERT_STAGES: readonly LeadStatusValue[] = ["RESERVED", "CLOSED"];

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export type DealAlertInput = { partnerName: string; client: string; stage: LeadStatusValue; project: string | null; price: number | null; url: string };

// "Partner {name} set {client} to {stage}: {project}, {price} €. Please check the deal." plus the CRM link.
export function dealAlertHtml(a: DealAlertInput): string {
  const price = a.price != null ? `${a.price.toLocaleString("en-GB")} €` : "no price";
  const line = `Partner ${a.partnerName} set ${a.client} to ${STATUS_LABEL[a.stage]}: ${a.project ?? "no project"}, ${price}. Please check the deal.`;
  return `${esc(line)}\n<a href="${esc(a.url)}">Open the lead in the CRM</a>`;
}

/** Who gets it: the partner's manager when linked to the office bot, else the owner, else nobody. */
export function dealAlertChat(manager: { telegramChatId: string | null; isActive: boolean } | null, owner: { telegramChatId: string | null } | null): string | null {
  if (manager?.isActive && manager.telegramChatId) return manager.telegramChatId;
  return owner?.telegramChatId ?? null;
}
