import React from "react";
import { prisma } from "@/lib/prisma";
import type { Translation } from "@/types/homepage";

import Header from "@/app/components/Header/Header";
import Footer from "@/app/components/Footer/Footer";
import WhatsAppButton from "@/app/components/WhatsAppButton/WhatsAppButton";
import Form from "@/app/preview-home/sections/Form";

import HeroMedia from "@/app/preview-project/HeroMedia";
import Benefits from "@/app/preview-project/Benefits";
import areaLibrary from "@/app/preview-project/areas.json";
import PlanGrid from "@/app/preview-project/PlanGrid";
import PropertyMapBlock from "@/app/preview-project/PropertyMapBlock";
import UnitsView from "@/app/preview-project/UnitsView";
import type { ProjectVM } from "@/app/preview-project/feeds";
import { splitDescriptionParagraphs } from "@/lib/text";
import { resolveDevelopmentType } from "@/lib/developmentCard";
import DistancesStrip from "@/app/components/DistancesStrip/DistancesStrip";
import { computeAvailability, resolveAvailabilityStatusLabel, resolveStageLabel } from "@/lib/developmentAvailability";
import { developmentCopy } from "@/lib/developmentCopy";
import { getAlternativeDevelopments } from "@/lib/developmentAlternatives";
import AlternativesBlock from "@/app/preview-project/AlternativesBlock";
import type { GoldPhrase } from "@/lib/developmentCopy";

// Shared render body for both the SEO-facing slug route (the Development
// branch of src/app/[lang]/projects/[slug]/page.tsx) and the admin-only
// query-string preview route (src/app/[lang]/preview-project/page.tsx).
// `banner`, when given, renders the "Preview / internal name / dev switcher"
// strip — the public slug route omits it entirely (no reason to expose
// internal feed names or a "Preview" label on an indexable page).

const fmtPrice = (n: number | null | undefined, cur = "EUR", priceOnRequest = "Price on request") =>
  n == null ? priceOnRequest : `${cur === "EUR" ? "€" : cur + " "}${n.toLocaleString("en-US")}`;

// Renders a GoldPhrase (developmentCopy.ts) with its accent word wrapped in
// the site's existing .it gold-shimmer class (preview-home/tokens.css) —
// same component/class as the neighbourhood heading below, not a new one.
const goldPhrase = (h: GoldPhrase) => (
  <>{h.lead}<span className="it">{h.gold}</span>{h.trail}</>
);

const LocationPin = () => (
  <svg viewBox="0 0 24 24" fill="none">
    <path d="M12 21.5s6.8-6.1 6.8-11.1a6.8 6.8 0 1 0-13.6 0c0 5 6.8 11.1 6.8 11.1Z" stroke="currentColor" strokeWidth="1.3" />
    <circle cx="12" cy="10.2" r="2.7" fill="currentColor" />
  </svg>
);

export default async function ProjectPageBody({
  p, lang, params, translations, banner,
}: {
  p: ProjectVM & { slug?: string | null };
  lang: string;
  params: { lang: string };
  translations: Translation[];
  banner?: React.ReactNode;
}) {
  const t = developmentCopy(lang);
  const avail = p.units.filter((u) => u.status === "available");
  // p.priceFrom is already fully resolved (override -> Development.priceFrom ->
  // cheapest available unit) by resolveDevelopmentPrice() in mapRowToVM — see
  // src/lib/developmentCard.ts, the single source of truth every surface
  // (this page, DevelopmentSchema, the merged /projects listing card) must use.
  const priceFrom = p.priceFrom;
  const types = resolveDevelopmentType(p.category, p.units).split(" · ").filter(Boolean);
  const benefits = (p.amenities?.length ? p.amenities : Array.from(new Set(p.units.flatMap((u) => u.features)))).filter(Boolean);
  // Neighbourhood text: prefer the APPROVED area description from the DB in the
  // page's language (English fallback); otherwise the static demo library.
  const slugOfArea = (a: string) => a.toLowerCase().replace(/ph/g, "f").replace(/[^a-z]/g, "");
  const areaRow = p.area ? await prisma.areaDescription.findFirst({ where: { areaSlug: slugOfArea(p.area), status: "approved" } }) : null;
  const areaCol = ({ en: "textEN", de: "textDE", pl: "textPL", ru: "textRU" } as Record<string, string>)[params.lang] ?? "textEN";
  const areaText = areaRow ? ((areaRow as any)[areaCol] || areaRow.textEN) : null;
  const areaInfo = areaText
    ? { name: p.area, text: areaText as string }
    : (areaLibrary as Record<string, { title?: string; text: string }>)[p.area];
  const locSeen = new Set<string>();
  const locCols = ([
    p.district && { name: p.district, tag: t.tagDistrict },
    p.town && { name: p.town, tag: t.tagLocality },
    p.area && { name: p.area, tag: t.tagArea },
  ].filter(Boolean) as { name: string; tag: string }[])
    // drop levels that repeat the same place (normalise ph→f so "Paphos" === "Pafos")
    .filter((c) => { const k = c.name.toLowerCase().replace(/ph/g, "f").replace(/[^a-z]/g, ""); return locSeen.has(k) ? false : (locSeen.add(k), true); });
  // Sold-out is computed from live unit data ONLY — never from stage/status
  // text (see src/lib/developmentAvailability.ts for why). Availability and
  // construction stage are resolved as two independent facts — a project can
  // be fully sold out and still mid-construction (or vice versa).
  const { soldOut: isSold } = computeAvailability(p.units);
  const availabilityLabel = resolveAvailabilityStatusLabel(isSold, lang);
  const stageLabel = resolveStageLabel(p.stage, p.status, lang);
  // Slug-less admin preview (feed rendered before a Development row/slug exists,
  // see src/app/[lang]/preview-project/page.tsx) has no DB row to rank against.
  const alternatives = p.slug ? await getAlternativeDevelopments(p.slug, lang) : [];

  // Plot / build-area ranges, computed from the currently AVAILABLE units (not
  // sold/reserved) — values aren't always suffixed "m²" at the source, so extract
  // the leading number rather than trusting the raw string.
  const numOf = (v: string) => { const m = (v || "").replace(",", ".").match(/[\d.]+/); return m ? parseFloat(m[0]) : null; };
  const rangeM2 = (vals: (number | null)[]) => {
    const nums = vals.filter((n): n is number => n != null && n > 0);
    if (!nums.length) return null;
    const lo = Math.min(...nums), hi = Math.max(...nums);
    return lo === hi ? `${lo} m²` : `${lo}–${hi} m²`;
  };
  const plotRange = rangeM2(avail.map((u) => numOf(u.areaPlot)));
  const builtRange = rangeM2(avail.map((u) => numOf(u.areaBuilt)));

  // facts panel — only rows that actually have data
  const facts = [
    { label: t.factLocation, value: p.location },
    types.length ? { label: t.factPropertyType, value: types.join(", ") } : null,
    p.units.length ? { label: t.factUnits, value: `${p.units.length}${avail.length !== p.units.length ? ` ${t.factUnitsAvailable(avail.length)}` : ""}` } : null,
    { label: t.factStatus, value: availabilityLabel },
    stageLabel ? { label: t.factConstructionStage, value: stageLabel } : null,
    plotRange ? { label: t.factPlot, value: plotRange } : null,
    builtRange ? { label: t.factBuildArea, value: builtRange } : null,
    p.completion ? { label: t.factCompletion, value: p.completion } : null,
    p.energy ? { label: t.factEnergyRating, value: p.energy } : null,
    // "Total units" from the feed is redundant with the "Units" fact above — drop it.
    // Extra facts are free-text from the feed/admin (no fixed key set), so they
    // can't be localized via a static dictionary — shown as authored.
    ...(p.extraFacts ?? []).filter((f) => !/^\s*total\s+units\s*$/i.test(f.label)),
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <>
      <Header params={params} translations={translations} />
      <main className="pp" data-theme="dark">
        <div className="pp-atmos" aria-hidden><span /><span /><span /></div>

        {banner}

        {/* ---------- FULL-WIDTH HERO (video loop if set, else image gallery) ---------- */}
        <header className="pp-hero">
          <HeroMedia images={p.gallery} alt={p.publicName} galleryLabel={t.galleryLabel(p.gallery.filter(Boolean).length)} openGalleryLabel={t.openGallery} lang={lang} videoUrl={p.heroVideo} />
          <div className="pp-hero__scrim" aria-hidden />
          <div className="pp-hero__overlay">
            <div className="pp-wrap">
              <div className="pp-eyebrow">
                <span className={`pp-badge pp-badge--${isSold ? "sold" : "ok"}`}>{isSold ? t.soldOut : (stageLabel ?? t.unitStatus.available)}</span>
                <span className="pp-loc">{p.location}</span>
              </div>
              <h1 className="pp-title">{p.publicName}</h1>
              <div className="pp-hero__stats">
                <div className="pp-hero__price"><b>{priceFrom != null ? fmtPrice(priceFrom, p.currency, t.priceOnRequest) : "—"}</b><span>{priceFrom != null ? (isSold ? t.heroFromSoldOut : `${t.heroFrom}${p.vatApplies !== false ? ` · ${t.vatSuffix}` : ""}`) : t.heroFrom}</span></div>
                <div><b>{types.join(" · ") || "—"}</b><span>{t.heroType}</span></div>
                {p.units.length > 0 && <div><b>{avail.length}{avail.length !== p.units.length && <small>/{p.units.length}</small>}</b><span>{t.heroAvailable}</span></div>}
              </div>
            </div>
          </div>
        </header>

        {/* ---------- SOLD OUT: hint + alternatives + enquiry form ----------
            Bündel 1 (2026-07-31), corrected 2026-08-01: hint text and the
            alternatives grid read as one continuous block (no panel frame,
            no gap — see .pp-soldout in project.css), and the CTA is the real
            enquiry form at this position, not a teaser linking further down.
            "Sold out" is derived from isSold (computeAvailability) only —
            see the comment above isSold. Alternatives use the same corrected
            ranking funnel on every project page (developmentAlternatives.ts). */}
        {isSold && (
          <>
            <section className="pp-wrap pp-section pp-soldout">
              <h2 className="pp-h2">{goldPhrase(t.soldOutBannerHeadline)}</h2>
              <p className="pp-desc pp-soldout__lead">{t.soldOutBannerBody}</p>
            </section>

            <AlternativesBlock cards={alternatives} lang={lang} heading={t.alternativesHeading} prominent />

            <div id="enquiry" className="pp-soldout-enquiry">
              <Form lang={lang} title={goldPhrase(t.offMarketCtaHeadline)} subtitle={t.offMarketCtaBody} showQuestionField />
            </div>
          </>
        )}

        {/* ---------- ABOUT + HIGHLIGHTS ---------- */}
        <section className="pp-wrap pp-section pp-about">
          <div className="pp-about__main">
            {p.description && (
              <>
                <h2 className="pp-h2">{t.aboutHeading}</h2>
                {splitDescriptionParagraphs(p.description).map((lines, i) => (
                  <p key={i} className="pp-desc">
                    {lines.map((line, j) => (
                      <React.Fragment key={j}>
                        {line}
                        {j < lines.length - 1 && <br />}
                      </React.Fragment>
                    ))}
                  </p>
                ))}
              </>
            )}
          </div>
          <aside className="pp-about__side">
            <div className="pp-panel">
              <div className="pp-panel__facts">
                {facts.map((f) => (
                  <div className="pp-fact" key={f.label}><span>{f.label}</span><b>{f.value}</b></div>
                ))}
              </div>
              {benefits.length > 0 && (
                <div className="pp-panel__amen">
                  <div className="pp-panel__label">{t.amenitiesHeading}</div>
                  <Benefits items={benefits} />
                </div>
              )}
            </div>
          </aside>
        </section>

        <div className="pp-wrap"><hr className="shimmer pp-rule" /></div>

        {/* ---------- PLANS & RENDERS ---------- */}
        {(p.plans.length > 0 || p.renders.length > 0) && (
          <section className="pp-wrap pp-section">
            <h2 className="pp-h2">{t.plansHeading} <span className="pp-count">{p.plans.length + p.renders.length}</span></h2>
            <PlanGrid images={[...p.renders, ...p.plans]} lang={lang} />
          </section>
        )}

        {/* ---------- THE NEIGHBOURHOOD ---------- */}
        {locCols.length > 0 && (
          <section className="pp-wrap pp-section">
            <div className={areaInfo ? "pp-panel pp-hood" : "pp-hood pp-hood--bare"}>
              {areaInfo && <span className="pp-hood__pin" aria-hidden><LocationPin /></span>}
              <h2 className="pp-h2 pp-hood__loc">
                {locCols.map((c, i) => (
                  <React.Fragment key={c.tag}>
                    {i > 0 && <span className="pp-loc-dot" aria-hidden>·</span>}
                    <span className="pp-loc-col"><span className={`pp-loc-name${i === locCols.length - 1 ? " it" : ""}`}>{c.name}</span><span className="pp-loc-tag">{c.tag}</span></span>
                  </React.Fragment>
                ))}
                {!areaInfo && <span className="pp-hood__pin-inline" aria-hidden><LocationPin /></span>}
              </h2>
              {areaInfo && <p className="pp-desc">{areaInfo.text}</p>}
            </div>
          </section>
        )}

        {/* ---------- DISTANCES ---------- */}
        {p.distances && (
          <section className="pp-wrap pp-section">
            <h2 className="pp-h2">{t.distancesHeading}</h2>
            <DistancesStrip distances={p.distances} lang={lang} />
          </section>
        )}

        {/* ---------- FULL-WIDTH MAP ---------- */}
        {p.center && (
          <section className="pp-mapsection">
            <PropertyMapBlock lat={p.center.lat} lng={p.center.lng} locale={lang} />
          </section>
        )}

        {/* ---------- UNITS ---------- */}
        {p.units.length > 0 && (
          <section className="pp-wrap pp-section pp-units-sec">
            <div className="pp-units-head">
              <h2 className="pp-h2">{isSold ? t.unitsHeadingSoldOut : t.unitsHeading}</h2>
              <p className="pp-hint" style={{ margin: 0 }}>{t.unitsSubAvailable(avail.length)}{p.units.length !== avail.length ? t.unitsSubSold(p.units.length - avail.length) : ""}</p>
            </div>
            <UnitsView units={p.units} lang={lang} />
          </section>
        )}

        {/* Sold-out projects already rendered their enquiry form above, right
            after the alternatives grid (see the isSold block) — never twice
            on one page. */}
        {!isSold && (
          <>
            <div id="enquiry">
              <Form lang={lang} />
            </div>

            {/* Same alternatives ranking, shown dezent below the enquiry form
                rather than prominently under a (non-existent) sold-out hint.
                Correction 2026-07-31: form belongs above this strip, not below. */}
            {alternatives.length > 0 && (
              <AlternativesBlock cards={alternatives} lang={lang} heading={t.alternativesHeading} prominent={false} />
            )}
          </>
        )}
      </main>
      <Footer params={params} />
      <WhatsAppButton lang={lang} />
    </>
  );
}
