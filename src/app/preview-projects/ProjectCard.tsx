"use client";

// The project listing card — extracted from ProjectsExplorer.tsx (2026-07-31)
// so the sold-out project page's "similar projects" block (AlternativesBlock)
// can reuse the EXACT same component/markup/hover behaviour instead of a
// second hand-built card that would drift from this one over time. Any visual
// or behavioural change to the card belongs here, once, for both surfaces.
// Needs "use client" itself now (not just inherited from ProjectsExplorer,
// its original home) — AlternativesBlock renders it from the server-rendered
// ProjectPageBody, and its onMouseEnter/onMouseLeave hover handlers can't
// cross into a Server Component.
import type { ProjectsStrings } from "@/app/[lang]/projects/projectsI18n";
import ScarcityBanner from "@/app/components/ScarcityBanner/ScarcityBanner";
import { soldOutFromCounts } from "@/lib/developmentAvailability";

export type Distances = {
  beach?: string;
  restaurants?: string;
  shops?: string;
  school?: string;
  airport?: string;
  hospital?: string;
  golfCourt?: string;
  cityCenter?: string;
};

export type ProjectCardData = {
  id: string;
  title: string;
  href: string;
  image?: string;
  city: string;
  price: number | null;
  bedrooms: string;
  area: string;
  type: string;
  energy: string;
  completion: string;
  isNew: boolean;
  isFeatured: boolean;
  distances?: Distances | null;
  // null/undefined defaults to showing "+VAT" (same as the detail page) —
  // only an explicit false (admin-marked "no VAT", e.g. a renovated resale)
  // omits it.
  vatApplies?: boolean | null;
  // Development cards only (legacy Sanity-origin cards have no unit data —
  // left undefined, ScarcityBanner renders nothing without a total).
  unitsAvailable?: number;
  unitsTotal?: number;
};

// distance key → localized label (resolved from the active locale's strings)
const distLabel = (k: keyof Distances, s: ProjectsStrings): string =>
  ({
    beach: s.distBeach,
    airport: s.distAirport,
    school: s.distSchool,
    cityCenter: s.distCenter,
    hospital: s.distHospital,
    shops: s.distShops,
    golfCourt: s.distGolf,
    restaurants: s.distDining,
  })[k];

// key distances surfaced on the map popup, in priority order
const POPUP_DIST_ORDER: (keyof Distances)[] = ["beach", "airport", "school", "cityCenter", "hospital", "shops", "golfCourt", "restaurants"];
export const topDistances = (d: Distances | null | undefined, s: ProjectsStrings, n = 3) =>
  d ? POPUP_DIST_ORDER.filter((k) => d[k]).slice(0, n).map((k) => ({ label: distLabel(k, s), v: d[k] as string })) : [];

// Card footer distances: Beach · School · Golf · Airport (only those with a value).
const CARD_DIST_ORDER: (keyof Distances)[] = ["beach", "school", "golfCourt", "airport"];
const cardDistances = (d: Distances | null | undefined, s: ProjectsStrings) =>
  d ? CARD_DIST_ORDER.filter((k) => d[k]).map((k) => ({ label: distLabel(k, s), v: d[k] as string })) : [];

const fmtPrice = (p: number | null, s: ProjectsStrings) =>
  p == null ? s.priceOnRequest : `€${p.toLocaleString(s.numLocale)}`;

export function ProjectCard({
  c, active = false, onHover = () => {}, s, locale, compact = false,
}: {
  c: ProjectCardData;
  // Both optional, defaulted client-side — the map-hover-sync feature is only
  // relevant to ProjectsExplorer's own grid. A caller across the server/client
  // boundary (AlternativesBlock, rendered from the server-rendered project
  // page) must NOT pass a function prop here: Server Components can't hand
  // plain callbacks to a Client Component, only Client Components can.
  active?: boolean;
  onHover?: (id: string | null) => void;
  s: ProjectsStrings;
  locale: string;
  // Smaller card for a 4-per-row grid (the project page's alternatives strip)
  // — a pure CSS modifier (.prj--compact in projects.css), never changes the
  // base .prj rules the /projects listing itself renders with. See
  // AlternativesBlock.tsx.
  compact?: boolean;
}) {
  const soldOut = c.unitsTotal != null && soldOutFromCounts(c.unitsAvailable ?? 0, c.unitsTotal);
  return (
    <a
      className={`prj${compact ? " prj--compact" : ""}${active ? " is-active" : ""}${soldOut ? " is-sold" : ""}`}
      href={c.href}
      onMouseEnter={() => onHover(c.id)}
      onMouseLeave={() => onHover(null)}
    >
      <div className="prj__media">
        {c.image ? <img className="prj__img" src={c.image} alt={c.title} loading="lazy" /> : <div className="prj__ph" />}
        <div className="prj__shade" />
        <div className="prj__badges">
          {c.isNew && <span className="prj__badge prj__badge--new">{s.badgeNew}</span>}
          {c.isFeatured && <span className="prj__badge">{s.badgeFeatured}</span>}
          {c.unitsTotal != null && (
            soldOut
              ? <span className="prj__badge prj__badge--sold">{s.badgeSoldOut}</span>
              : <ScarcityBanner available={c.unitsAvailable ?? 0} total={c.unitsTotal} locale={locale} seedKey={c.id} />
          )}
        </div>
        {c.type && <span className="prj__type">{c.type}</span>}
        <div className="prj__info">
          <h3 className="prj__title">{c.title}</h3>
          <p className="prj__loc">{c.city}</p>
        </div>
      </div>
      <div className="prj__footer">
        <div className="prj__specrow">
          <div className="prj__specs">
            {c.bedrooms && <span>{c.bedrooms} {s.bedUnit}</span>}
            {c.area && <span>{c.area} {s.areaUnit}</span>}
            {c.energy && <span>{s.energyPrefix} {c.energy}</span>}
            {/* c.completion is already resolved to a plain year string (or "")
                server-side — see resolveCompletionYear in src/lib/text.ts.
                Never compute a Date here: parsing the free-text completion
                values Development rows can carry ("Q1 2028", "Ready", …) is
                engine-dependent, and a mismatch between the server's parse
                and the browser's during hydration caused the year to flash
                then vanish, leaving a dangling "•" separator behind (the
                outer guard was checking the raw string, not the parsed
                result). Gating on the same already-resolved string here
                means the separator and the value can never disagree. */}
            {c.completion && <span>{c.completion}</span>}
          </div>
          <div className="prj__price">
            {c.price != null && <span className="prj__price-from">{s.priceFrom}</span>}
            {fmtPrice(c.price, s)}
          </div>
        </div>
        {cardDistances(c.distances, s).length > 0 && (
          <div className="prj__dist" aria-label="Distances">
            {cardDistances(c.distances, s).map((x) => (
              <span key={x.label}><i>{x.label}</i> {x.v}<small>{s.minShort}</small></span>
            ))}
          </div>
        )}
      </div>
    </a>
  );
}
