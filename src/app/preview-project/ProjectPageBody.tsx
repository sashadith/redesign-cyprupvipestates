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
import { computeAvailability, listedUnits, resolveAvailabilityStatusLabel, resolveStageLabel } from "@/lib/developmentAvailability";
import { renderInsightsBlock } from "@/app/preview-insights/insightsBlocks";
import { developmentCopy } from "@/lib/developmentCopy";
import { getAlternativeDevelopments } from "@/lib/developmentAlternatives";
import AlternativesBlock from "@/app/preview-project/AlternativesBlock";
import type { GoldPhrase } from "@/lib/developmentCopy";
import { fmtPrice, bidiIsolate, ltrIsolate, localeDir } from "@/lib/locale";
import { hePlaceList } from "@/lib/hePlaces";
import { heFeedLabel } from "@/lib/heFeedVocab";
import Bdi from "@/app/components/Bdi";

// Shared render body for both the SEO-facing slug route (the Development
// branch of src/app/[lang]/projects/[slug]/page.tsx) and the admin-only
// query-string preview route (src/app/[lang]/preview-project/page.tsx).
// `banner`, when given, renders the "Preview / internal name / dev switcher"
// strip — the public slug route omits it entirely (no reason to expose
// internal feed names or a "Preview" label on an indexable page).

/* Leptos's XML ships its own distance block (Airport / Sea / Shops / Healthcare /
   Education). We compute distances ourselves from the project's coordinates
   (src/lib/developmentDistances.ts) and render them in the Distances strip further
   down, so the feed's copy is redundant — and it disagrees: across the 44 Leptos
   developments carrying it, 92 of 117 comparable values differ from ours (Apollo
   Beach Villas: feed says 30 min to the airport, computed says 24).

   Suppressed at render rather than deleted from the row, so a re-sync cannot
   quietly bring them back. Scoped by adapter key rather than by label alone, so
   another feed introducing a legitimate "Shops" fact stays unaffected. */
const LEPTOS_FEED_DISTANCES = new Set(["airport", "sea", "shops", "healthcare", "education"]);

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

/* Trust strip item: a figure and what it refers to. Every item carries a figure
   now (Sascha, 2026-10-03) — 287 / same day / 0 € — where before only the first
   one did and the other two read as leftover text. A figure that is not a
   short figure ("287", "24h", "0 €") is set in the full display size; anything
   longer would push the sentence out of the card and is set smaller. */
const TrustItem = ({ fig, text }: { fig: string; text: string }) => (
  <div className="pp-plate pp-plate--bronze pp-trust__item">
    <b className={fig.length <= 5 ? "" : "pp-trust__fig--word"}>{fig}</b>
    <span>{text}</span>
  </div>
);

export default async function ProjectPageBody({
  p, lang, params, translations, banner,
}: {
  p: ProjectVM & { slug?: string | null; promoBlocks?: any[] };
  lang: string;
  params: { lang: string };
  translations: Translation[];
  banner?: React.ReactNode;
}) {
  const t = developmentCopy(lang);
  const avail = p.units.filter((u) => u.status === "available");
  // Every unit COUNT on this page is taken over the listed population —
  // the same one UnitsView renders below (see listedUnits in
  // developmentAvailability.ts). Counting p.units raw made the fact panel
  // claim more units than the list underneath it actually shows
  // (GALAXY RESIDENCES: "29 Units" over a list of 27, 2026-08-19).
  const listed = listedUnits(p.units);
  // p.priceFrom is already fully resolved (override -> Development.priceFrom ->
  // cheapest available unit) by resolveDevelopmentPrice() in mapRowToVM — see
  // src/lib/developmentCard.ts, the single source of truth every surface
  // (this page, DevelopmentSchema, the merged /projects listing card) must use.
  const priceFrom = p.priceFrom;
  // resolveDevelopmentType() returns the FEED's English vocabulary ("Villa ·
  // Apartment") and must keep doing so — matchesPropertyTypeFilter and every
  // city+type landing page match against it. Localize at the render site only,
  // and only for `he`, where a Latin "Villa" in the hero sits right above the
  // Hebrew type filter that says "וילה" (Pass B, systemic #1).
  const types = resolveDevelopmentType(p.category, p.units)
    .split(" · ")
    .filter(Boolean)
    .map((x) => (lang === "he" ? heFeedLabel(x) : x));
  // Same story for the place string ("Peyia, Paphos"): raw feed text, shown
  // twice (hero eyebrow + facts panel). Transliterated per he-glossary.md §1
  // for `he`, unknown parts kept Latin and bidi-isolated.
  const locationLabel = lang === "he" ? hePlaceList(p.location) : p.location;
  const benefits = (p.amenities?.length ? p.amenities : Array.from(new Set(p.units.flatMap((u) => u.features)))).filter(Boolean);
  // Neighbourhood text: prefer the APPROVED area description from the DB in the
  // page's language (English fallback); otherwise the static demo library.
  const slugOfArea = (a: string) => a.toLowerCase().replace(/ph/g, "f").replace(/[^a-z]/g, "");
  const areaRow = p.area ? await prisma.areaDescription.findFirst({ where: { areaSlug: slugOfArea(p.area), status: "approved" } }) : null;
  const areaCol = ({ en: "textEN", de: "textDE", pl: "textPL", ru: "textRU", he: "textHE" } as Record<string, string>)[params.lang] ?? "textEN";
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

  /* The whole stored copy, nothing filtered. The distances table and the short
     location section it sits in were dropped at render this morning as
     duplicates of the DistancesStrip; they are back by request (2026-10-03) —
     the strip has since moved up under the area block and this copy now sits
     below the form as reading matter and crawler depth, so the repetition costs
     a reader nothing. The render-time filter that did the dropping was deleted
     with them (src/lib/promoDistances.ts, 2026-10-04); git history has it if the
     duplication ever becomes a problem again. */
  const promoBlocks = Array.isArray(p.promoBlocks) ? p.promoBlocks : [];
  // Trust strip figure — the live count of published developments, the same
  // population /projects lists; never a typed number that goes stale.
  const projectCount = await prisma.development.count({ where: { publishStatus: "published" } });

  // Plot / build-area ranges, computed from the currently AVAILABLE units (not
  // sold/reserved) — values aren't always suffixed "m²" at the source, so extract
  // the leading number rather than trusting the raw string.
  const numOf = (v: string) => { const m = (v || "").replace(",", ".").match(/[\d.]+/); return m ? parseFloat(m[0]) : null; };
  const rangeM2 = (vals: (number | null)[]) => {
    const nums = vals.filter((n): n is number => n != null && n > 0);
    if (!nums.length) return null;
    const lo = Math.min(...nums), hi = Math.max(...nums);
    const s = lo === hi ? `${lo} m²` : `${lo}–${hi} m²`;
    // A two-number range with an en dash, left unisolated, gets visually
    // reordered by the surrounding RTL paragraph ("49–75 m²" renders as
    // "75–49 m²") — same failure mode ltrIsolate() already fixes for
    // resolveBedRange()'s output via heBedrooms() (src/lib/heFeedVocab.ts).
    return localeDir(lang) === "rtl" ? ltrIsolate(s) : s;
  };
  const plotRange = rangeM2(avail.map((u) => numOf(u.areaPlot)));
  const builtRange = rangeM2(avail.map((u) => numOf(u.areaBuilt)));

  // facts panel — only rows that actually have data
  const facts = [
    { label: t.factLocation, value: locationLabel },
    types.length ? { label: t.factPropertyType, value: types.join(", ") } : null,
    listed.length ? { label: t.factUnits, value: `${listed.length}${avail.length !== listed.length ? ` ${t.factUnitsAvailable(avail.length)}` : ""}` } : null,
    { label: t.factStatus, value: availabilityLabel },
    stageLabel ? { label: t.factConstructionStage, value: stageLabel } : null,
    plotRange ? { label: t.factPlot, value: plotRange } : null,
    builtRange ? { label: t.factBuildArea, value: builtRange } : null,
    p.completion ? { label: t.factCompletion, value: p.completion } : null,
    p.energy ? { label: t.factEnergyRating, value: p.energy } : null,
    // "Total units" from the feed is redundant with the "Units" fact above — drop it.
    // Extra facts are free-text from the feed/admin (no fixed key set), so they
    // can't be localized via a static dictionary — shown as authored.
    ...(p.extraFacts ?? []).filter(
      (f) =>
        !/^\s*total\s+units\s*$/i.test(f.label) &&
        !(p.dev === "leptos" && LEPTOS_FEED_DISTANCES.has(f.label.trim().toLowerCase())),
    ),
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
                <span className="pp-loc">{locationLabel}</span>
              </div>
              <h1 className="pp-title">{p.publicName}</h1>
              <div className="pp-hero__stats">
                {/* No price at all (every unit "price on request", e.g. Zeus Penthouse)
                    used to render "— from"; say so in words, with no dangling "from". */}
                {priceFrom != null ? (
                  <div className="pp-hero__price"><b><Bdi ltr>{fmtPrice(priceFrom, lang, p.currency)}</Bdi></b><span>{isSold ? t.heroFromSoldOut : `${t.heroFrom}${p.vatApplies !== false ? ` · ${localeDir(lang) === "rtl" ? bidiIsolate(t.vatSuffix) : t.vatSuffix}` : ""}`}</span></div>
                ) : (
                  <div className="pp-hero__price"><b>{isSold ? "—" : t.priceOnRequest}</b></div>
                )}
                <div><b>{types.join(" · ") || "—"}</b><span>{t.heroType}</span></div>
                {listed.length > 0 && <div><b>{avail.length}{avail.length !== listed.length && <small>/{listed.length}</small>}</b><span>{t.heroAvailable}</span></div>}
                {/* Completion / build stage is a top-3 buying criterion off-plan — surfaced in the hero, not only in the facts panel (2026-10-03). */}
                {(p.completion || stageLabel) && <div><b>{p.completion || stageLabel}</b><span>{t.heroCompletion}</span></div>}
              </div>
              {/* The page had no CTA pointing at the form at all — the hero now
                  offers the two next steps a buyer actually takes (2026-10-03). */}
              {/* The home page's hero buttons, same classes (Sascha, 2026-10-03):
                  .btn .btn--glass, frosted, gold rim on hover. The <span> is not
                  decoration — .btn draws its sheen on an absolutely positioned
                  ::before, and `.btn > *` is what lifts the label above it; a
                  bare text node would sit under the sweep. */}
              {!isSold && (
                <div className="pp-hero__cta">
                  <a className="btn btn--glass" href="#enquiry"><span>{t.heroCtaConsult}</span></a>
                  {listed.length > 0 && <a className="btn btn--glass" href="#units"><span>{t.heroCtaUnits}</span></a>}
                </div>
              )}
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
            {/* AlternativesBlock renders null once `alternatives` is empty
                (fewer than MIN_ALTERNATIVES genuine matches even at the
                loosest stage — developmentAlternatives.ts) — found 2026-08-06
                on 3 real sold-out projects (Celestia, absolute-villas, Neon
                Homes): the lead text's original closing "...and are still
                open:" pointed at nothing, since this section always rendered
                regardless. Swap to a colon-free closer in that case (no
                promise of cards below), and give the section back the same
                padding-bottom the (now-absent) alternatives section would
                have contributed, so the gap to the enquiry form stays the
                same either way — see .pp-soldout--no-alts in project.css. */}
            <section className={`pp-wrap pp-section pp-soldout${alternatives.length === 0 ? " pp-soldout--no-alts" : ""}`}>
              <h2 className="pp-h2">{goldPhrase(t.soldOutBannerHeadline)}</h2>
              <p className="pp-desc pp-soldout__lead">{alternatives.length > 0 ? t.soldOutBannerBody : t.soldOutBannerBodyNoAlternatives}</p>
            </section>

            <AlternativesBlock cards={alternatives} lang={lang} heading={t.alternativesHeading} prominent />

            <div id="enquiry">
              <Form lang={lang} title={goldPhrase(t.offMarketCtaHeadline)} subtitle={t.offMarketCtaBody} showQuestionField showQualifiers />
            </div>
          </>
        )}

        {/* ---------- ABOUT + HIGHLIGHTS ----------
            Short, factual copy + facts panel only. The long admin-authored promo
            text was tested up here on 2026-10-03 and moved back out the same day
            (conversion review): it pushed the unit prices — the reason most
            visitors came — a screen further down. It now renders after the
            enquiry form, see PROMOTIONAL CONTENT below. */}
        <section className="pp-wrap pp-section pp-about pp-about--flow">
          {/* Before the text, not after it: a float only pushes content that
              follows it in the DOM. Reading order pays for it — the facts panel
              is now announced ahead of the description. */}
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
        </section>

        {/* ---------- UNITS (moved up from below the map, 2026-10-03) ----------
            Prices are what a buyer arriving from search came for; five blocks
            between the hero and the first price was a scroll too many. Plans,
            neighbourhood and map follow for whoever wants them — and still end
            at the form. Sold-out pages don't render this block at all (Sascha,
            2026-08-24): every price cell would read "—"/"Reserved" and the
            page's real next step (alternatives + form) already sits under the
            hero. SEO-neutral — UnitsView emits no internal links and nothing
            anchors here except the hero's own "View units" button. */}
        {!isSold && listed.length > 0 && (
          <section className="pp-wrap pp-section pp-units-sec" id="units">
            {/* Heading + availability line live inside UnitsView, which renders
                them in one row with the view switch. */}
            <UnitsView units={p.units} lang={lang} projectName={p.publicName} />
          </section>
        )}

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
                    {/* The DISTRICT/LOCALITY/AREA caption is drawn by CSS from
                        data-tag, not rendered as a child: inside an <h2> it
                        became part of the heading's text and glued itself to the
                        place name ("PaphosDistrict"). See .pp-loc-col::after. */}
                    <span className="pp-loc-col" data-tag={c.tag}><span className={`pp-loc-name${i === locCols.length - 1 ? " it" : ""}`}>{c.name}</span></span>
                  </React.Fragment>
                ))}
                {!areaInfo && <span className="pp-hood__pin-inline" aria-hidden><LocationPin /></span>}
              </h2>
              {areaInfo && <p className="pp-desc">{areaInfo.text}</p>}
            </div>
          </section>
        )}

        {/* ---------- DISTANCES ----------
            Directly under the area block (Sascha, 2026-10-03): the figures
            belong with the text about where the place is, and the map then
            closes the group. One rendering for every project — it used to sit
            inside the map section, with a second headed copy for the projects
            that have no coordinates. */}
        {p.distances && (
          <section className="pp-wrap pp-section pp-dist-sec">
            <DistancesStrip distances={p.distances} lang={lang} />
          </section>
        )}

        {/* ---------- MAP ---------- */}
        {p.center && (
          <section className="pp-mapsection">
            <PropertyMapBlock lat={p.center.lat} lng={p.center.lng} locale={lang} />
          </section>
        )}

        {/* Sold-out projects already rendered their enquiry form above, right
            after the alternatives grid (see the isSold block) — never twice
            on one page. */}
        {!isSold && (
          <>
            {/* ---------- TRUST STRIP (2026-10-03) ----------
                The one place the page proves anything right before the ask:
                a live figure (published projects) and two promises the form's
                own success copy already makes ("usually the same day"). */}
            <section className="pp-wrap pp-trust">
              <TrustItem fig={String(projectCount)} text={t.trustProjects(projectCount).replace(/^\d+\s*/, "")} />
              <TrustItem fig={t.trustReplyFig} text={t.trustReply} />
              <TrustItem fig={t.trustFreeFig} text={t.trustFree} />
            </section>

            <div id="enquiry">
              <Form lang={lang} title={goldPhrase(t.enquiryHeadline(p.publicName))} showQualifiers />
            </div>

            {/* Same alternatives ranking, shown dezent below the enquiry form
                rather than prominently under a (non-existent) sold-out hint.
                Correction 2026-07-31: form belongs above this strip, not below.
                Swapped ahead of the promo copy 2026-10-03: a reader who did not
                fill in the form is better served by three other projects than
                by more prose about this one. */}
            {alternatives.length > 0 && (
              <AlternativesBlock cards={alternatives} lang={lang} heading={t.alternativesHeading} prominent={false} />
            )}

            {/* ---------- PROMOTIONAL CONTENT ----------
                Long-form, admin-authored (PromoBlocksField/BlockEditor), rendered
                with renderInsightsBlock like a blog body. Last on the page on
                purpose (2026-10-03): it is SEO depth for the crawler and reading
                matter for the few who scroll past the ask — it must never sit
                between a visitor and the prices. Empty until an admin writes
                one. */}
            {promoBlocks.length > 0 && (
              <section className="pp-wrap pp-section pp-promo-sec">
                {/* A third cloud: ::before and ::after are already the other two,
                    so this one needs an element of its own — the same way the
                    page-wide atmosphere is built (.pp-atmos span). */}
                <span className="pp-promo-cloud" aria-hidden />
                <div className="pp-promo">{promoBlocks.map((block) => renderInsightsBlock(block))}</div>
              </section>
            )}
          </>
        )}
      </main>
      <Footer params={params} />
      <WhatsAppButton lang={lang} />
    </>
  );
}
