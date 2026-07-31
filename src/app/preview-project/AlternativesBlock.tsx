import Link from "next/link";
import { localizedHref } from "@/lib/locale";
import { atSize } from "@/app/preview-project/imageSize";
import type { AlternativeCard } from "@/lib/developmentAlternatives";
import type { DevelopmentStrings } from "@/lib/developmentCopy";

const fmtPrice = (n: number | null, cur = "EUR") =>
  n == null ? null : `${cur === "EUR" ? "€" : cur + " "}${n.toLocaleString("en-US")}`;

// Shared "similar projects" grid — prominent (under the sold-out banner) or
// quiet (further down an available project's page), same component and same
// ranking result either way, just a different heading/placement/CSS modifier
// from the caller. See developmentAlternatives.ts for the ranking logic.
export default function AlternativesBlock({
  cards, lang, heading, prominent, t,
}: {
  cards: AlternativeCard[];
  lang: string;
  heading: string;
  prominent: boolean;
  t: DevelopmentStrings;
}) {
  if (!cards.length) return null;
  return (
    <section className={`pp-wrap pp-section pp-alts${prominent ? " pp-alts--prominent" : " pp-alts--quiet"}`}>
      {!prominent && <h2 className="pp-h2">{heading}</h2>}
      <div className="pp-alts__grid">
        {cards.map((c) => (
          <Link key={c.id} href={localizedHref(lang, ["projects", c.slug])} className="pp-alts__card">
            <div className="pp-alts__media">
              {c.mainImage ? <img src={atSize(c.mainImage, "medium")} alt={c.publicName} loading="lazy" /> : <span className="pp-alts__ph" />}
            </div>
            <div className="pp-alts__body">
              <h3 className="pp-alts__name">{c.publicName}</h3>
              {(c.area || c.district) && <p className="pp-alts__loc">{c.area || c.district}</p>}
              {fmtPrice(c.priceFrom, c.currency) && (
                <p className="pp-alts__price"><b>{fmtPrice(c.priceFrom, c.currency)}</b> <span>{t.heroFrom}</span></p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
