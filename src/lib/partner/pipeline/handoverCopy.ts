import { STATUS_LABEL, type LeadStatusValue } from "@/lib/crm/leadStatus";
import type { PartnerLocale } from "@/lib/partner/i18n";

// The texts of a partner's handover request (partner pipeline, 2026-11-05). Pure: no
// prisma, no dictionaries, so the portal's client form can import it. The warning is
// the partner's (four languages, the portal's formal address); the Telegram is the
// manager's (English, CRM side).

const WARNING: Record<PartnerLocale, string> = {
  en: "Do you really want to hand this client over now? They are not at the viewing stage yet. Once you confirm, the client moves from Fix to Handover and your commission drops from {fix} % to {handover} %.",
  de: "Wollen Sie den Kunden wirklich jetzt übergeben? Er ist noch nicht bei der Besichtigung. Nach der Bestätigung wird er von Fix auf Handover umgestellt, Ihre Provision sinkt von {fix} % auf {handover} %.",
  pl: "Czy na pewno chcą Państwo przekazać tego klienta już teraz? Nie jest on jeszcze na etapie oglądania. Po potwierdzeniu klient zostanie przeniesiony z Fix na Handover, a Państwa prowizja spadnie z {fix} % do {handover} %.",
  ru: "Вы действительно хотите передать этого клиента сейчас? Он ещё не на этапе просмотра. После подтверждения клиент будет переведён с Fix на Handover, и Ваша комиссия снизится с {fix} % до {handover} %.",
};

const share = (locale: PartnerLocale, n: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 2, useGrouping: false }).format(n);

/** The warning before an early handover (before the viewing stage), with the partner's real shares. */
export function handoverWarning(locale: PartnerLocale, fixShare: number, handoverShare: number): string {
  return (WARNING[locale] ?? WARNING.en).replace("{fix}", share(locale, fixShare)).replace("{handover}", share(locale, handoverShare));
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export type HandoverAlertInput = {
  partnerName: string; client: string; stage: LeadStatusValue; note: string | null; downgrade: boolean; url: string;
};

// "Handover requested by partner {partner}: {client}, stage {stage}." (+ the downgrade flag), the note, the CRM link.
export function handoverAlertHtml(a: HandoverAlertInput): string {
  const head = `Handover requested by partner ${a.partnerName}: ${a.client}, stage ${STATUS_LABEL[a.stage]}.`
    + (a.downgrade ? " (downgrade to Handover on acceptance)" : "");
  const note = a.note?.trim();
  return [esc(head), ...(note ? [`Note: ${esc(note)}`] : []), `<a href="${esc(a.url)}">Open the lead in the CRM</a>`].join("\n");
}
