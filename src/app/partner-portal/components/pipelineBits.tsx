// Server-rendered building blocks of the partner pipeline (2026-11-05): the board card, the
// lead's local clock with the call light, the hints and the history. Everything is worded from
// flags and keys in the partner's language; no stored English text is shown.
import Link from "next/link";
import type { LeadTimeSummary } from "@/lib/crm/leadLocalTime";
import type { LeadStatusValue } from "@/lib/crm/leadStatus";
import { fmt, type PartnerDict, type PartnerLocale } from "@/lib/partner/i18n";
import type { PartnerHints, PipelineCard } from "@/lib/partner/pipeline/store";
import type { TimelineEntry } from "@/lib/partner/pipeline/timeline";
import { clientClock, weekRange } from "@/lib/partner/pipeline/view";
import { Chip, dateFmt } from "./portalBits";

export const dateTimeFmt = (locale: PartnerLocale) =>
  new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Nicosia" });

export function stageTone(s: LeadStatusValue): "stage" | "closed" | "lost" | "sold" {
  return s === "CLOSED" ? "sold" : s === "LOST" ? "lost" : s === "KEEP_CONTACT" ? "closed" : "stage";
}

export function StageChip({ t, status }: { t: PartnerDict; status: LeadStatusValue }) {
  return <Chip label={t.pipeline.stage[status]} tone={stageTone(status)} />;
}

/** The lead's clock now, with the call light (green / amber / red), or why it is not known. */
export function LocalTime({ t, locale, lt, now }: { t: PartnerDict; locale: PartnerLocale; lt: LeadTimeSummary; now: Date }) {
  const P = t.pipeline;
  if (lt.zone === null) {
    return <span className="pp-localtime pp-muted">{lt.status === "zone unclear" ? fmt(P.zoneUnclear, { country: lt.country }) : P.zoneUnknown}</span>;
  }
  const c = clientClock(lt.zone, now, locale);
  return (
    <span className="pp-localtime">
      <span className={`pp-light pp-light-${lt.callLight}`} aria-hidden="true" />
      {fmt(P.localTime, c)}
      <span className="pp-sr"> ({P.light[lt.callLight]})</span>
    </span>
  );
}

/** "Week 45, 02 Nov to 06 Nov" for a follow-up date (Cyprus week, Monday to Friday). */
export function weekText(t: PartnerDict, locale: PartnerLocale, at: Date): string {
  const w = weekRange(at);
  const d = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", timeZone: "UTC" });
  return fmt(t.pipeline.week, { n: w.week, from: d.format(w.monday), to: d.format(w.friday) });
}

export function PipelineCardItem({ t, locale, c, now }: { t: PartnerDict; locale: PartnerLocale; c: PipelineCard; now: Date }) {
  const K = t.pipeline.card;
  const date = dateFmt(locale);
  const dt = dateTimeFmt(locale);
  return (
    <li className="pp-pcard">
      <Link href={`/pipeline/${encodeURIComponent(c.claimId)}`} className="pp-pcard-name">{c.name || "—"}</Link>
      <span className="pp-pcard-stage"><StageChip t={t} status={c.status} /></span>
      {c.handedOver ? (
        <span className="pp-pcard-line pp-muted">{c.ourTeam ? K.ourTeam : K.handedOver}</span>
      ) : (
        <>
          {c.expired && <span className="pp-pcard-line"><Chip label={K.expired} tone="lost" /></span>}
          <span className={`pp-pcard-line${c.overdue ? " pp-overdue" : ""}`}>
            {c.nextFollowUpAt ? fmt(K.followUp, { date: dt.format(c.nextFollowUpAt) }) : <span className="pp-muted">{K.noFollowUp}</span>}
            {c.overdue && <> · <strong>{K.overdue}</strong></>}
          </span>
          <span className="pp-pcard-line"><LocalTime t={t} locale={locale} lt={c.localTime} now={now} /></span>
        </>
      )}
      <span className="pp-pcard-line pp-muted">{c.lastEntryAt ? fmt(K.lastEntry, { date: date.format(c.lastEntryAt) }) : K.noEntry}</span>
    </li>
  );
}

export function HintList({ t, hints, zoneUnclear }: { t: PartnerDict; hints: PartnerHints; zoneUnclear: boolean }) {
  const H = t.pipeline.hint;
  const items = [
    hints.emailInvalid ? H.emailInvalid : null,
    hints.phoneType === "landline" ? H.landline : null,
    hints.budgetCurrencyUnverified ? H.budgetCurrency : null,
    hints.nameEmailMismatch ? fmt(H.nameEmail, { part: hints.nameEmailMismatch }) : null,
    zoneUnclear ? H.zone : null,
  ].filter((x): x is string => !!x);
  if (!items.length) return null;
  return (
    <div className="pp-alert pp-alert-info" role="note">
      <strong>{t.pipeline.hintsTitle}</strong>
      <ul className="pp-hints">{items.map((s) => <li key={s}>{s}</li>)}</ul>
    </div>
  );
}

function entryLabel(t: PartnerDict, e: TimelineEntry, dt: Intl.DateTimeFormat): string {
  const E = t.pipeline.entry;
  switch (e.kind) {
    case "status":
      if (!e.status) return E.system;
      return e.status === "LOST" && e.lostReason
        ? fmt(E.statusLost, { reason: t.pipeline.lostReason[e.lostReason] })
        : fmt(E.status, { stage: t.pipeline.stage[e.status] });
    case "call": return e.callOutcome ? fmt(E.callOutcome, { outcome: t.pipeline.callOutcome[e.callOutcome] }) : E.call;
    case "note": return E.note;
    case "email": return e.inbound ? E.emailIn : E.emailOut;
    case "whatsapp": return e.inbound ? E.whatsappIn : E.whatsappOut;
    case "message": return E.message;
    case "presentation":
      return e.event === "PRESENTATION_CREATED" ? E.presCreated
        : e.event === "PRESENTATION_VIEWED" ? E.presViewed
          : e.event === "PRESENTATION_FAVORITE" ? E.presFavorite : E.presOther;
    default:
      if (e.event === "follow_up") return e.eventAt ? fmt(E.followUp, { date: dt.format(e.eventAt) }) : E.followUpCleared;
      if (e.event === "viewing_date" && e.eventAt) return fmt(E.viewing, { date: dt.format(e.eventAt) });
      if (e.event === "lead_edit") return E.leadEdit;
      if (e.event === "handover_requested") return E.handoverRequested;
      if (e.event === "handover_withdrawn") return E.handoverWithdrawn;
      if (e.event === "handover_accepted") return E.handoverAccepted;
      if (e.event === "partner_lead_taken_over") return E.takenOver;
      if (e.event === "keep_fix_on") return E.keepFixOn;
      if (e.event === "keep_fix_off") return E.keepFixOff;
      return E.system;
  }
}

export function PipelineTimeline({ t, locale, entries }: { t: PartnerDict; locale: PartnerLocale; entries: TimelineEntry[] }) {
  const P = t.pipeline;
  if (!entries.length) return <p className="pp-muted">{P.historyEmpty}</p>;
  const dt = dateTimeFmt(locale);
  return (
    <ol className="pp-timeline">
      {entries.map((e) => (
        <li key={`${e.kind}-${e.id}`}>
          <time dateTime={e.at.toISOString()}>{dt.format(e.at)}</time>
          <span>
            {entryLabel(t, e, dt)}
            {e.by && <span className="pp-muted"> · {fmt(P.by, { name: e.by })}</span>}
            {e.subject && <span className="pp-cell-sub">{e.subject}</span>}
            {e.text && <span className="pp-message">{e.text}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}
