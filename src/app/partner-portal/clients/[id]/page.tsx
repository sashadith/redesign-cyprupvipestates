import Link from "next/link";
import { notFound } from "next/navigation";
import { RESPONSE_KEYS, type SubmissionView } from "@/lib/partner/clientDto";
import { fmt, type PartnerDict, type PartnerLocale } from "@/lib/partner/i18n";
import { getMyClient, myClientPresentations } from "@/lib/partner/scope";
import { requirePartner } from "@/lib/partner/session";
import { PresentationTable } from "../../components/presentationBits";
import { Chip, ContactCard, StageBar, chipTone, dateFmt, eurFmt, tr } from "../../components/portalBits";
import { portalContext } from "../../portalContext";

function languageName(locale: PartnerLocale, code: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
}

function SubmissionList({ t, locale, s }: { t: PartnerDict; locale: PartnerLocale; s: SubmissionView }) {
  const S = t.submit;
  const eur = eurFmt(locale);
  const contactMode = {
    DIRECT: S.contactDirect, VIA_PARTNER: S.contactViaPartner, VIA_PARTNER_REP: S.contactViaPartnerRep, VIA_CLIENT_REP: S.contactViaClientRep,
  };
  const rows: [string, string | null][] = [
    [t.clients.name, `${s.firstName} ${s.lastName ?? ""}`.trim() || null],
    [S.email, s.email],
    [S.phone, s.phone],
    [S.language, s.language ? languageName(locale, s.language) : null],
    [S.budgetMin, s.budgetMin != null ? eur.format(s.budgetMin) : null],
    [S.budgetMax, s.budgetMax != null ? eur.format(s.budgetMax) : null],
    [S.modeTitle, s.mode ? (s.mode === "FIX" ? S.tabFix : S.tabHandover) : null],
    [S.projects, s.projects.length ? s.projects.join(", ") : null],
    [S.projectsText, s.projectsText],
    [S.contactModeTitle, s.contactMode ? contactMode[s.contactMode] : null],
    [S.repName, s.repName],
    [S.repPhone, s.repPhone],
    [S.comment, s.comment],
  ];
  return (
    <dl className="pp-dl">
      {rows.filter(([, v]) => v).map(([k, v]) => (
        <div key={k}><dt>{k}</dt><dd className="pp-pre">{v}</dd></div>
      ))}
    </dl>
  );
}

export default async function PartnerClient({ params }: { params: { id: string } }) {
  const me = await requirePartner({ active: true });
  const { t, locale } = await portalContext();
  const [c, presentations] = await Promise.all([getMyClient(me.partner.id, params.id), myClientPresentations(me.partner.id, params.id)]);
  if (!c) notFound();
  const C = t.clients;
  const date = dateFmt(locale);
  const eur = eurFmt(locale);

  const head = (
    <section className="pp-card pp-card-wide pp-card-full">
      <p className="pp-small pp-back"><Link href="/clients">← {C.back}</Link></p>
      <p className="pp-eyebrow">{fmt(C.submittedOn, { date: date.format(c.submittedAt) })}</p>
      <h1>{c.name || "—"}</h1>
      <Chip label={tr(locale, c.chipKey)} tone={chipTone(c.chipKey)} />
    </section>
  );

  if (c.kind === "submission") {
    return (
      <div className="pp-stack">
        {head}
        <p className={`pp-alert ${c.state === "IN_REVIEW" ? "pp-alert-info" : "pp-alert-neutral"}`} role="status">{tr(locale, c.stateKey)}</p>
        <section className="pp-panel">
          <h2 className="pp-h3">{C.submissionTitle}</h2>
          <SubmissionList t={t} locale={locale} s={c.submission} />
        </section>
      </div>
    );
  }

  const contact =
    c.contact.kind === "owner"
      ? { name: c.contact.name, email: c.contact.email, phone: c.contact.phone }
      : c.contact.kind === "office"
        ? { name: C.office, email: c.contact.email, phone: c.contact.phone }
        : null;

  return (
    <div className="pp-stack">
      {head}

      <section className="pp-panel">
        <h2 className="pp-h3">{C.progressTitle}</h2>
        <StageBar locale={locale} step={c.stage.step} label={C.progressTitle} />
        {c.lostKey && <p className="pp-small">{fmt(C.lostReason, { reason: tr(locale, c.lostKey) })}</p>}
        <ul className="pp-facts">
          {c.response && <li>{tr(locale, RESPONSE_KEYS[c.response.unit], { n: c.response.n })}</li>}
          <li>{c.protection.expired ? C.protectionExpired : fmt(C.protectedUntil, { date: date.format(c.protection.until) })}</li>
        </ul>
      </section>

      {contact ? (
        <ContactCard title={C.contactTitle} c={contact} />
      ) : (
        <section className="pp-panel pp-contact">
          <h2 className="pp-h3">{C.contactTitle}</h2>
          <p className="pp-muted">{C.contactPending}</p>
        </section>
      )}

      <section className="pp-panel">
        <h2 className="pp-h3">{C.timelineTitle}</h2>
        {c.milestones.length ? (
          <ol className="pp-timeline">
            {c.milestones.map((m, i) => (
              <li key={`${m.key}-${m.at.getTime()}-${i}`}>
                <time dateTime={m.at.toISOString()}>{date.format(m.at)}</time>
                <span>
                  {tr(locale, m.key, m.vars)}
                  {m.body && <span className="pp-message">{m.body}</span>}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="pp-muted">{C.noMilestones}</p>
        )}
      </section>

      {c.deals.length > 0 && (
        <section className="pp-panel">
          <h2 className="pp-h3">{C.dealsTitle}</h2>
          <ul className="pp-deals">
            {c.deals.map((d) => (
              <li key={d.id}>
                <p className="pp-deal-title">
                  {d.project ?? "—"}
                  {d.unit && <span className="pp-muted"> · {fmt(C.dealUnit, { unit: d.unit })}</span>}
                </p>
                <dl className="pp-deal-figs">
                  <div><dt>{C.dealPrice}</dt><dd>{eur.format(d.price)}</dd></div>
                  <div>
                    <dt>{C.dealCommission}</dt>
                    <dd>{d.commission != null ? <span className="pp-figure-sm">{eur.format(d.commission)}</span> : <span className="pp-muted">{C.beingCalculated}</span>}</dd>
                  </div>
                  <div>
                    <dt>{C.status}</dt>
                    <dd>{t.commission[d.status]}{d.statusAt && <> · {date.format(d.statusAt)}</>}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        </section>
      )}

      {presentations.length > 0 && (
        <section className="pp-panel pp-panel-flush" aria-labelledby="client-pres-title">
          <h2 className="pp-h3 pp-panel-pad" id="client-pres-title">
            {t.presentations.title} <span className="pp-muted">({presentations.length})</span>
          </h2>
          <PresentationTable t={t} locale={locale} items={presentations} showClient={false} />
        </section>
      )}

      <details className="pp-panel pp-details">
        <summary className="pp-h3">{C.submissionTitle}</summary>
        <SubmissionList t={t} locale={locale} s={c.submission} />
      </details>
    </div>
  );
}
