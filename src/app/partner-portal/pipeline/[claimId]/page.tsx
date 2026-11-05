import Link from "next/link";
import { notFound } from "next/navigation";
import { utcToZonedInput } from "@/lib/tz";
import { fmt, type PartnerDict, type PartnerLocale } from "@/lib/partner/i18n";
import { PORTAL_TZ } from "@/lib/partner/pipeline/forms";
import { handoverAllowed } from "@/lib/partner/pipeline/handoverRules";
import { getPipelineClient, type PipelineClient } from "@/lib/partner/pipeline/store";
import { clientClock, waMeLink } from "@/lib/partner/pipeline/view";
import { myProjects } from "@/lib/partner/scope";
import { requirePartner } from "@/lib/partner/session";
import { HintList, LocalTime, PipelineTimeline, StageChip, dateTimeFmt, weekText } from "../../components/pipelineBits";
import {
  ClientDataForm, FollowUpForm, HandoverForm, HandoverWithdrawForm, LogForm, StageForm, ViewingForm,
} from "../../components/pipelineForms";
import { PresentationTable } from "../../components/presentationBits";
import { dateFmt, eurFmt } from "../../components/portalBits";
import { portalContext } from "../../portalContext";

function languageName(locale: PartnerLocale, code: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
}

// Read-only client details (handed over, or protection lapsed).
function ClientDetails({ t, locale, c }: { t: PartnerDict; locale: PartnerLocale; c: PipelineClient }) {
  const P = t.pipeline;
  const F = P.field;
  const l = c.lead;
  const eur = eurFmt(locale);
  const pick = <K extends string>(map: Record<K, string>, v: string | null) => (v && v in map ? map[v as K] : v);
  const rows: [string, string | null][] = [
    [F.salutation, l.salutation && l.salutation !== "UNKNOWN" ? pick(P.salutation, l.salutation) : null],
    [F.firstName, l.firstName || null],
    [F.lastName, l.lastName || null],
    [F.email, l.email],
    [F.phone, l.phone],
    [F.language, l.languagePreference ? languageName(locale, l.languagePreference) : null],
    [F.budgetMin, l.budgetMin != null ? eur.format(l.budgetMin) : null],
    [F.budgetMax, l.budgetMax != null ? eur.format(l.budgetMax) : null],
    [F.timeline, pick(P.timeline, l.timeline)],
    [F.financing, pick(P.financing, l.financing)],
    [F.nationality, l.nationality],
    [F.countryOfResidence, l.countryOfResidence],
    [F.message, l.message],
  ];
  return (
    <dl className="pp-dl">
      {rows.filter(([, v]) => v).map(([k, v]) => (
        <div key={k}><dt>{k}</dt><dd className="pp-pre">{v}</dd></div>
      ))}
    </dl>
  );
}

/** Partner pipeline (2026-11-05): one FIX client — stage, follow-up, log, handover, selections, history and details. */
export default async function PipelineClientPage({ params }: { params: { claimId: string } }) {
  const me = await requirePartner({ active: true });
  const { t, locale } = await portalContext();
  const now = new Date();
  const c = await getPipelineClient(me.partner.id, params.claimId, now);
  if (!c) notFound();
  const P = t.pipeline;
  const date = dateFmt(locale);
  const dt = dateTimeFmt(locale);
  const work = c.canWork;
  const projects = work ? (await myProjects(me.partner.id)).projects.map((p) => ({ id: p.id, name: p.name, town: p.town })) : [];
  const zone = c.localTime.zone;
  const zoneUnclear = c.localTime.zone === null && c.localTime.status === "zone unclear";

  return (
    <div className="pp-stack">
      <section className="pp-card pp-card-wide pp-card-full">
        <p className="pp-small pp-back"><Link href="/pipeline">← {P.back}</Link></p>
        <p className="pp-eyebrow">{fmt(P.since, { date: date.format(c.since) })}</p>
        <h1>{c.name || "—"}</h1>
        <p className="pp-phead">
          <StageChip t={t} status={c.status} />
          {c.status === "LOST" && c.lostReason && <span className="pp-muted">{P.lostReason[c.lostReason]}</span>}
          {!c.handedOver && <LocalTime t={t} locale={locale} lt={c.localTime} now={now} />}
        </p>
      </section>

      {c.handedOver && <p className="pp-alert pp-alert-neutral" role="status">{c.ourTeam ? P.ourTeamNotice : P.handedOverNotice}</p>}
      {!c.handedOver && !work && <p className="pp-alert pp-alert-neutral" role="status">{P.expiredNotice}</p>}
      {work && <HintList t={t} hints={c.hints} zoneUnclear={zoneUnclear} />}

      {(work || (c.status === "VIEWING_SCHEDULED" && c.viewingScheduledAt)) && <section className="pp-panel" aria-labelledby="pl-stage">
        <h2 className="pp-h3" id="pl-stage">{P.stageTitle}</h2>
        {c.status === "VIEWING_SCHEDULED" && c.viewingScheduledAt && (
          <p className="pp-small">{fmt(P.viewingCurrent, { date: dt.format(c.viewingScheduledAt) })}</p>
        )}
        {work ? (
          <>
            <StageForm t={t} claimId={c.claimId} status={c.status} hasLiveDeal={c.hasLiveDeal} projects={projects} />
            {c.status === "VIEWING_SCHEDULED" && (
              <ViewingForm t={t} claimId={c.claimId} value={utcToZonedInput(c.viewingScheduledAt, PORTAL_TZ)} />
            )}
          </>
        ) : null}
      </section>}

      {!c.handedOver && (
        <section className="pp-panel" aria-labelledby="pl-follow">
          <h2 className="pp-h3" id="pl-follow">{P.followUpTitle}</h2>
          {c.nextFollowUpAt ? (
            <p className={`pp-small${c.overdue ? " pp-overdue" : ""}`}>
              {dt.format(c.nextFollowUpAt)}
              {c.overdue && <> · <strong>{P.card.overdue}</strong></>}
              <span className="pp-cell-sub">
                {weekText(t, locale, c.nextFollowUpAt)}
                {zone && <> · {fmt(P.followUpClient, clientClock(zone, c.nextFollowUpAt, locale))}</>}
              </span>
            </p>
          ) : (
            <p className="pp-small pp-muted">{P.followUpNone}</p>
          )}
          {work && <FollowUpForm t={t} locale={locale} claimId={c.claimId} value={utcToZonedInput(c.nextFollowUpAt, PORTAL_TZ)} zone={zone} />}
        </section>
      )}

      {work && (
        <section className="pp-panel" aria-labelledby="pl-log">
          <h2 className="pp-h3" id="pl-log">{P.logTitle}</h2>
          <LogForm t={t} claimId={c.claimId} />
        </section>
      )}

      {!c.handedOver && ((work && handoverAllowed(c.status)) || c.openHandover) && (
        <section className="pp-panel" aria-labelledby="pl-handover">
          <h2 className="pp-h3" id="pl-handover">{P.handover.title}</h2>
          {c.openHandover ? (
            <>
              {/* The partner keeps working the client until the manager accepts: only the waiting state shows here. */}
              <p className="pp-alert pp-alert-neutral" role="status">
                {fmt(P.handover.waiting, { date: dt.format(c.openHandover.createdAt) })}
                {c.openHandover.downgrade && <> {P.handover.waitingDowngrade}</>}
              </p>
              <HandoverWithdrawForm t={t} claimId={c.claimId} requestId={c.openHandover.id} />
            </>
          ) : (
            <>
              <p className="pp-small">{P.handover.intro}</p>
              <HandoverForm t={t} locale={locale} claimId={c.claimId} />
            </>
          )}
        </section>
      )}

      <section className="pp-panel pp-panel-flush" aria-labelledby="pl-pres">
        <div className="pp-panel-pad pp-phead-row">
          <h2 className="pp-h3" id="pl-pres">
            {P.selectionsTitle} {c.presentations.length > 0 && <span className="pp-muted">({c.presentations.length})</span>}
          </h2>
          {work && <Link href={`/presentations?client=${encodeURIComponent(c.claimId)}#pres-new-title`} className="pp-btn pp-btn-ghost">{P.newSelection}</Link>}
        </div>
        {c.presentations.length ? (
          <PresentationTable
            t={t}
            locale={locale}
            items={c.presentations}
            showClient={false}
            whatsapp={work ? {
              label: P.openWhatsApp,
              href: (url) => waMeLink(c.lead.phone, fmt(P.whatsappText, { name: c.lead.firstName, url })),
            } : undefined}
          />
        ) : (
          <p className="pp-muted pp-panel-pad">{P.selectionsEmpty}</p>
        )}
      </section>

      <section className="pp-panel" aria-labelledby="pl-history">
        <h2 className="pp-h3" id="pl-history">{P.historyTitle}</h2>
        <PipelineTimeline t={t} locale={locale} entries={c.timeline} />
      </section>

      <section className="pp-panel" aria-labelledby="pl-data">
        <h2 className="pp-h3" id="pl-data">{P.dataTitle}</h2>
        {work ? (
          <ClientDataForm t={t} claimId={c.claimId} values={{ ...c.lead }} />
        ) : (
          <ClientDetails t={t} locale={locale} c={c} />
        )}
      </section>
    </div>
  );
}
