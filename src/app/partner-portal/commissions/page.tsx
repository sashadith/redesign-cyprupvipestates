import Link from "next/link";
import { PERIOD_PRESETS, parsePeriod, periodQuery, type PeriodPreset } from "@/lib/partner/commissions";
import { myCommissions } from "@/lib/partner/scope";
import { requirePartner } from "@/lib/partner/session";
import { CommissionsTable, periodLabel } from "../components/commissionsBits";
import { CommissionFigures } from "../components/portalBits";
import { portalContext } from "../portalContext";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function PartnerCommissions({ searchParams }: { searchParams: SP }) {
  const me = await requirePartner({ active: true });
  const { t, locale } = await portalContext();
  const C = t.commissions;
  const period = parsePeriod({ period: one(searchParams.period), from: one(searchParams.from), to: one(searchParams.to) });
  const data = await myCommissions(me.partner.id, period);
  const q = periodQuery(period);
  const presetLabel: Record<PeriodPreset, string> = { "this-year": C.presetThisYear, "last-year": C.presetLastYear, all: C.presetAll };

  return (
    <div className="pp-stack pp-stack-wide">
      <section className="pp-card pp-card-wide pp-card-full">
        <h1>{C.title}</h1>
        <p className="pp-muted">{C.intro}</p>
        <div className="pp-toolbar">
          <nav className="pp-segment" aria-label={C.period}>
            {PERIOD_PRESETS.map((p) => (
              <Link
                key={p}
                href={p === "all" ? "/commissions" : `/commissions?period=${p}`}
                className="pp-segment-btn"
                aria-current={period.preset === p ? "true" : undefined}
              >
                {presetLabel[p]}
              </Link>
            ))}
          </nav>
          <form method="get" action="/commissions" className="pp-comm-range">
            <div className="pp-field">
              <label htmlFor="comm-from">{C.from}</label>
              <input id="comm-from" type="date" name="from" defaultValue={period.from ?? ""} />
            </div>
            <div className="pp-field">
              <label htmlFor="comm-to">{C.to}</label>
              <input id="comm-to" type="date" name="to" defaultValue={period.to ?? ""} />
            </div>
            <button type="submit" className="pp-btn pp-btn-ghost">{C.apply}</button>
          </form>
        </div>
        <p className="pp-small pp-muted">{C.period}: {periodLabel(t, locale, period)}</p>
        <div className="pp-cta pp-comm-actions">
          <a href={`/commissions/export.csv${q}`} className="pp-btn pp-btn-ghost" download>{C.exportCsv}</a>
          <Link href={`/commissions/report${q}`} className="pp-btn pp-btn-ghost">{C.report}</Link>
        </div>
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
            <CommissionsTable t={t} locale={locale} rows={data.rows} links />
          </section>
          {data.rows.some((r) => r.stage === "CANCELLED") && <p className="pp-small pp-muted">{C.cancelledNote}</p>}
        </>
      )}
    </div>
  );
}
