// Partner news (phase 4b, Decision 7): automatic catalogue news of the last 30 days. Public catalogue data only
// plus the partner's own handover rate. ACTIVE partners only.
import { fmt } from "@/lib/partner/i18n";
import { partnerNews } from "@/lib/partner/newsStore";
import { requirePartner } from "@/lib/partner/session";
import { NewsSeen } from "../components/NewsSeen";
import { dateFmt, eurFmt } from "../components/portalBits";
import { portalContext } from "../portalContext";

export default async function PartnerNews() {
  const me = await requirePartner({ active: true });
  const { t, locale } = await portalContext();
  const N = t.news;
  const items = await partnerNews(me.partner.id, locale);
  const date = dateFmt(locale);
  const eur = eurFmt(locale);
  const pct = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });

  return (
    <div className="pp-stack pp-stack-wide">
      <NewsSeen />
      <section className="pp-card pp-card-wide pp-card-full">
        <h1>{N.title}</h1>
        <p className="pp-muted">{N.intro}</p>
      </section>
      {items.length === 0 ? (
        <section className="pp-panel"><p className="pp-muted">{N.empty}</p></section>
      ) : (
        <ul className="pp-news">
          {items.map((i) => (
            <li key={i.id} className="pp-panel pp-news-item">
              <div className="pp-news-head">
                <span className={`pp-news-kind pp-news-${i.kind}`}>{N.kinds[i.kind]}</span>
                <span className="pp-small pp-muted">{date.format(i.at)}</span>
              </div>
              <h2 className="pp-h3">{i.name}</h2>
              {i.town && <p className="pp-small pp-muted">{i.town}</p>}
              {i.priceBefore != null && i.priceFrom != null ? (
                <p>{fmt(N.priceDrop, { before: eur.format(i.priceBefore), after: eur.format(i.priceFrom) })}</p>
              ) : i.priceFrom != null ? (
                <p>{fmt(N.priceFrom, { price: eur.format(i.priceFrom) })}</p>
              ) : null}
              <p className="pp-small">{i.rate != null ? fmt(N.rate, { rate: `${pct.format(i.rate)} %` }) : N.rateOnRequest}</p>
              <p><a href={i.url} target="_blank" rel="noopener">{N.viewProject}</a></p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
