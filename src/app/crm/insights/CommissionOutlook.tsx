import { OUTLOOK_WEIGHT, type CommissionOutlook } from "@/lib/crm/insights/outlook";
import { columnPath, eur, monthChartGeometry, monthLabel } from "@/lib/crm/insights/pageModel";

// Series colours (CI): earned = champagne, developer paid = bronze. Both carry identity next to
// a legend; text never wears them. Champagne is 2.5:1 on the card, so the legend, the per-column
// tooltips and the table below carry the values (dataviz contrast relief).
const EARNED = "#C29A5E";
const DEV_PAID = "#8E6B3D";

export function CommissionOutlookSection({ outlook, periodLabel }: { outlook: CommissionOutlook & { truncated: boolean }; periodLabel: string }) {
  const t = outlook.totals;
  const weightPct = Math.round(OUTLOOK_WEIGHT * 100);
  const cards = [
    { label: "Expected", sub: "Reserved, not yet earned", value: t.expected },
    { label: "Earned", sub: "Awaiting developer payment", value: t.earned },
    { label: "Developer paid", sub: "Awaiting partner payout, if any", value: t.developerPaid },
    { label: "Paid out", sub: `In the period (${periodLabel})`, value: t.paidOutInPeriod },
    { label: "Partner commissions owed", sub: "Earned or developer paid, with a partner share", value: outlook.partnerOwed },
  ];
  return (
    <section className="crm-in-section" aria-labelledby="crm-in-outlook">
      <div className="crm-in-head">
        <h2 id="crm-in-outlook">Commission outlook</h2>
        <p className="crm-muted">Our commission by stage today. Cancelled deals are left out.</p>
      </div>
      {outlook.truncated && <p className="crm-notice">Only the newest 20,000 deals are counted.</p>}
      <dl className="crm-in-cards">
        {cards.map((c) => (
          <div key={c.label} className="crm-in-card">
            <dt>{c.label}</dt>
            <dd>{eur(c.value)}</dd>
            <dd className="sub">{c.sub}</dd>
          </div>
        ))}
      </dl>
      <p className="crm-in-estimate">
        Expected in pipeline: <b className="crm-in-num">{eur(t.expected)}</b> (weighted <b className="crm-in-num">{eur(outlook.weightedExpected)}</b> at {weightPct} %).{" "}
        <span className="crm-muted">Estimate only: a flat {weightPct} % weight, no contract dates assumed.</span>
      </p>
      <MonthlyChart months={outlook.months} />
    </section>
  );
}

function MonthlyChart({ months }: { months: CommissionOutlook["months"] }) {
  const g = monthChartGeometry(months);
  const first = months[0]?.month;
  const last = months[months.length - 1]?.month;
  return (
    <figure className="crm-in-chart">
      <figcaption>
        <b>Last 12 months</b>
        <span className="crm-muted"> · our commission by month it was earned, and by month the developer paid</span>
      </figcaption>
      {g.empty ? (
        <p className="crm-notice">No commission was earned or paid by a developer in the last 12 months.</p>
      ) : (
        <>
          <ul className="crm-in-legend" aria-label="Legend">
            <li><i style={{ background: EARNED }} aria-hidden="true" /> Earned</li>
            <li><i style={{ background: DEV_PAID }} aria-hidden="true" /> Developer paid</li>
          </ul>
          <div className="crm-in-chartscroll">
            <svg viewBox={`0 0 ${g.width} ${g.height}`} role="img" aria-labelledby="crm-in-chart-t crm-in-chart-d" className="crm-in-svg">
              <title id="crm-in-chart-t">Commission earned and developer paid per month</title>
              <desc id="crm-in-chart-d">
                Paired columns from {first ? monthLabel(first) : ""} to {last ? monthLabel(last) : ""}; earned on the left, developer paid on the right, both from the same baseline. The table below lists every value.
              </desc>
              {g.ticks.map((tk) => (
                <g key={tk.value}>
                  <line x1={g.plot.left} x2={g.plot.right} y1={tk.y} y2={tk.y} className={tk.value === 0 ? "base" : "grid"} />
                  <text x={g.plot.left - 8} y={tk.y} className="tick" textAnchor="end" dominantBaseline="middle">{tk.label}</text>
                </g>
              ))}
              {g.bars.map((b) => (
                <g key={b.month} className="col">
                  {b.earned && <path d={columnPath(b.earned, true)} fill={EARNED} />}
                  {b.developerPaid && <path d={columnPath(b.developerPaid, true)} fill={DEV_PAID} />}
                  <text x={b.cx} y={g.plot.bottom + 18} className="tick" textAnchor="middle">{b.label}</text>
                  {b.showYear && <text x={b.cx} y={g.plot.bottom + 33} className="tick year" textAnchor="middle">{b.month.slice(0, 4)}</text>}
                  {/* Hit target: the whole band, larger than the column, with a native tooltip. */}
                  <rect x={b.band.x} y={g.plot.top} width={b.band.width} height={g.plot.bottom - g.plot.top} className="hit">
                    <title>{`${monthLabel(b.month)}: earned ${eur(b.earnedValue)}, developer paid ${eur(b.developerPaidValue)}`}</title>
                  </rect>
                </g>
              ))}
            </svg>
          </div>
        </>
      )}
      <details className="crm-in-details">
        <summary>Show as table</summary>
        <div className="crm-in-tablewrap">
          <table className="crm-in-table">
            <thead>
              <tr>
                <th scope="col">Month</th>
                <th scope="col" className="num">Earned</th>
                <th scope="col" className="num">Developer paid</th>
              </tr>
            </thead>
            <tbody>
              {months.map((m) => (
                <tr key={m.month}>
                  <th scope="row">{monthLabel(m.month)}</th>
                  <td className="num money">{eur(m.earned)}</td>
                  <td className="num money">{eur(m.developerPaid)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
