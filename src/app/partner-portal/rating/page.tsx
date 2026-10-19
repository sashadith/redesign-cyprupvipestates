// Partner rating (phase 4b, Decision 6): the current season (countdown, prizes, own points / rank / breakdown,
// anonymised top 20 + own row) and the last ended seasons with the final rank. ACTIVE partners only.
// Isolation: the data comes from myRatingView, whose ranking rows carry no partner id, name, company or client.
import { fmt } from "@/lib/partner/i18n";
import { POINT_KINDS, countdown, seasonPrizes } from "@/lib/partner/rating";
import { myRatingView } from "@/lib/partner/ratingStore";
import { requirePartner } from "@/lib/partner/session";
import { dateFmt } from "../components/portalBits";
import { portalContext } from "../portalContext";

export default async function PartnerRating() {
  const me = await requirePartner({ active: true });
  const { t, locale } = await portalContext();
  const R = t.rating;
  const now = new Date();
  const view = await myRatingView(me.partner.id, now);
  const date = dateFmt(locale);
  const num = new Intl.NumberFormat(locale);
  const cur = view.current;

  return (
    <div className="pp-stack pp-stack-wide">
      <section className="pp-card pp-card-wide pp-card-full">
        <h1>{R.title}</h1>
        {cur ? (
          <>
            <p className="pp-rt-season">{fmt(R.season, { name: cur.name })}</p>
            <p className="pp-small pp-muted">{date.format(cur.startsAt)} – {date.format(cur.endsAt)}</p>
            {(() => {
              const c = countdown(cur.endsAt, now);
              return <p className="pp-rt-countdown">{c.ended ? R.ended : fmt(R.countdown, { days: c.days, hours: c.hours })}</p>;
            })()}
          </>
        ) : (
          <p className="pp-muted">{R.noSeason}</p>
        )}
      </section>

      {cur && (
        <>
          <section className="pp-panel" aria-labelledby="rt-mine">
            <h2 className="pp-h3" id="rt-mine">{R.yourPoints}</h2>
            <dl className="pp-figures pp-rt-figures">
              <div>
                <dt>{R.yourPoints}</dt>
                <dd className="pp-figure">{num.format(cur.ranking.myPoints)}</dd>
              </div>
              <div>
                <dt>{R.yourRank}</dt>
                <dd className="pp-figure">
                  {cur.ranking.myRank ? fmt(R.rankOf, { rank: cur.ranking.myRank, total: cur.ranking.total }) : "–"}
                </dd>
              </div>
            </dl>
            {cur.ranking.myPoints === 0 && <p className="pp-small pp-muted">{R.noPoints}</p>}
            <h3 className="pp-rt-sub">{R.breakdown}</h3>
            <dl className="pp-figures">
              {POINT_KINDS.map((k) => (
                <div key={k}>
                  <dt>{R.kinds[k]}</dt>
                  <dd className="pp-figure-sm">{num.format(cur.ranking.myByKind[k])}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="pp-panel" aria-labelledby="rt-prizes">
            <h2 className="pp-h3" id="rt-prizes">{R.prizes}</h2>
            <p className="pp-rt-prizes">{seasonPrizes(cur.prizes, locale)}</p>
            <h3 className="pp-rt-sub">{R.rules}</h3>
            <ul className="pp-rt-rules">
              {POINT_KINDS.filter((k) => cur.pointRules[k] > 0).map((k) => (
                <li key={k}><span>{R.kinds[k]}</span> <b className="pp-figure-sm">{num.format(cur.pointRules[k])}</b></li>
              ))}
            </ul>
          </section>

          <section className="pp-panel pp-panel-flush" aria-labelledby="rt-ranking">
            <h2 className="pp-h3 pp-rt-tablehead" id="rt-ranking">{R.ranking}</h2>
            <table className="pp-table pp-rt-table">
              <thead>
                <tr><th scope="col">{R.colRank}</th><th scope="col">{R.colPartner}</th><th scope="col">{R.colCountry}</th><th scope="col">{R.colPoints}</th></tr>
              </thead>
              <tbody>
                {cur.ranking.rows.map((r, i) => (
                  <tr key={r.me ? "me" : `p${r.pseudonym ?? i}`} className={r.me ? "pp-rt-me" : undefined} aria-current={r.me ? "true" : undefined}>
                    <td className="pp-rt-rank">{r.rank ?? "–"}</td>
                    <th scope="row">{r.me ? <b>{R.you}</b> : fmt(R.pseudonym, { n: r.pseudonym ?? "" })}</th>
                    <td aria-hidden={r.flag ? undefined : true}>{r.flag || "–"}</td>
                    <td className="pp-rt-points">{num.format(r.points)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="pp-small pp-muted pp-rt-note">{R.anonymNote}</p>
          </section>
        </>
      )}

      {view.past.length > 0 && (
        <section className="pp-panel" aria-labelledby="rt-past">
          <h2 className="pp-h3" id="rt-past">{R.pastSeasons}</h2>
          <ul className="pp-rt-past">
            {view.past.map((s) => (
              <li key={s.id}>
                <span className="pp-rt-pastname">{s.name}</span>
                <span className="pp-small pp-muted">{date.format(s.startsAt)} – {date.format(s.endsAt)}</span>
                {s.rank ? (
                  <span>
                    {fmt(R.finalRank, { rank: fmt(R.rankOf, { rank: s.rank, total: s.total }) })} · {fmt(R.points, { n: num.format(s.points) })}
                  </span>
                ) : (
                  <span className="pp-muted">{R.pastNoPoints}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
