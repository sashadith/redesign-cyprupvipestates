import Link from "next/link";
import { fmt } from "@/lib/partner/i18n";
import { parsePeriod, periodQuery } from "@/lib/partner/commissions";
import { myCommissions } from "@/lib/partner/scope";
import { requirePartner } from "@/lib/partner/session";
import { CommissionsTable, periodLabel } from "../../components/commissionsBits";
import { CommissionFigures, dateFmt } from "../../components/portalBits";
import { portalContext } from "../../portalContext";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Printable commission report (Decision 6): the browser's "Save as PDF", no server PDF. Print CSS: portal.css. */
export default async function PartnerCommissionsReport({ searchParams }: { searchParams: SP }) {
  const me = await requirePartner({ active: true });
  const { t, locale } = await portalContext();
  const C = t.commissions;
  const period = parsePeriod({ period: one(searchParams.period), from: one(searchParams.from), to: one(searchParams.to) });
  const data = await myCommissions(me.partner.id, period);
  const partnerName = me.partner.company?.trim() || `${me.partner.firstName} ${me.partner.lastName}`.trim();

  return (
    <div className="pp-stack pp-stack-wide pp-report">
      <p className="pp-small pp-back pp-noprint"><Link href={`/commissions${periodQuery(period)}`}>← {C.back}</Link></p>
      <section className="pp-card pp-card-wide pp-card-full">
        <h1>{C.reportTitle}</h1>
        <dl className="pp-dl pp-report-meta">
          <div><dt>{C.partnerLabel}</dt><dd>{partnerName}</dd></div>
          <div><dt>{C.period}</dt><dd>{periodLabel(t, locale, period)}</dd></div>
        </dl>
        <p className="pp-small pp-muted">{fmt(C.reportCreated, { date: dateFmt(locale).format(new Date()) })}</p>
        <p className="pp-small pp-muted pp-noprint">{C.printHint}</p>
      </section>

      <section className="pp-panel" aria-label={C.totals}>
        <h2 className="pp-h3">{C.totals}</h2>
        <CommissionFigures t={t} locale={locale} totals={data.totals} />
      </section>

      {data.truncated && <p className="pp-alert pp-alert-info">{C.truncated}</p>}

      {data.rows.length === 0 ? (
        <section className="pp-panel"><p className="pp-muted">{C.empty}</p></section>
      ) : (
        <>
          <section className="pp-panel pp-panel-flush">
            <CommissionsTable t={t} locale={locale} rows={data.rows} links={false} />
          </section>
          {data.rows.some((r) => r.stage === "CANCELLED") && <p className="pp-small pp-muted">{C.cancelledNote}</p>}
        </>
      )}
    </div>
  );
}
