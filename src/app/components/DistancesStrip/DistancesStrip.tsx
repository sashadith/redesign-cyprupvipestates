// Full 8-category auto-computed distances strip — Development detail page
// (full variant) and client presentation overlay (compact variant). Values
// come straight from Development.distances (already computed — see
// src/lib/developmentDistances.ts), never recomputed at render time. Visually
// matches the legacy PropertyDistances component's category set/order/wording
// (src/app/components/PropertyDistances/PropertyDistances.tsx), adapted to
// this redesign's thin-line SVG icon language (src/app/preview-project/amenityIcons.tsx)
// instead of the legacy's PNG image files, and to the dark/champagne token system.
import React from "react";

export type DistancesValue = Partial<{
  beach: number; restaurants: number; shops: number; airport: number;
  hospital: number; school: number; cityCenter: number; golf: number;
}>;

type Category = keyof DistancesValue;

const ORDER: Category[] = ["beach", "restaurants", "shops", "airport", "hospital", "school", "cityCenter", "golf"];

const Svg = ({ children }: { children: React.ReactNode }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

const ICONS: Record<Category, React.ReactNode> = {
  beach: <Svg><path d="M2 16c1.5 0 1.5-1.2 3-1.2S6.5 16 8 16s1.5-1.2 3-1.2S12.5 16 14 16s1.5-1.2 3-1.2S18.5 16 20 16M2 20c1.5 0 1.5-1.2 3-1.2S6.5 20 8 20s1.5-1.2 3-1.2S12.5 20 14 20s1.5-1.2 3-1.2S18.5 20 20 20" /><circle cx="17" cy="7" r="3" /></Svg>,
  restaurants: <Svg><path d="M6 3v7a2 2 0 0 0 4 0V3M8 10v11M16 3c-1.5 0-2.5 2-2.5 4.5S15 11 16 11v10" /></Svg>,
  shops: <Svg><path d="M4 7h16l-1 12H5L4 7Z" /><path d="M9 7V5a3 3 0 0 1 6 0v2" /></Svg>,
  airport: <Svg><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4 20-7Z" /></Svg>,
  hospital: <Svg><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></Svg>,
  school: <Svg><path d="M12 3 2 8l10 5 10-5-10-5Z" /><path d="M6 10v5c0 1.5 3 3 6 3s6-1.5 6-3v-5" /></Svg>,
  cityCenter: <Svg><path d="M4 21V9l4-3 4 3v12M13 21V6l4-3 4 3v15M4 21h17" /></Svg>,
  golf: <Svg><path d="M6 21V4M6 4l8 3-8 3" /><ellipse cx="6" cy="21" rx="4" ry="1.2" /></Svg>,
};

type DistancesLocale = "en" | "de" | "pl" | "ru";

// Wording matches the legacy PropertyDistances component's own inline
// translations exactly (including its "Golf court" — not "course" — and its
// DE "Supermarket" for the Shops label) so the same categories read
// identically to a visitor who's seen a legacy project page.
const COPY: Record<DistancesLocale, { labels: Record<Category, string>; min: string }> = {
  en: { labels: { beach: "Beach", restaurants: "Restaurants", shops: "Shops", airport: "Airport", hospital: "Hospital", school: "School", cityCenter: "City center", golf: "Golf court" }, min: "min" },
  de: { labels: { beach: "Strand", restaurants: "Restaurants", shops: "Supermarket", airport: "Flughafen", hospital: "Klinik", school: "Schule", cityCenter: "Zentrum", golf: "Golfplatz" }, min: "min" },
  pl: { labels: { beach: "Plaża", restaurants: "Restauracje", shops: "Sklepy", airport: "Lotnisko", hospital: "Szpital", school: "Szkoła", cityCenter: "Centrum miasta", golf: "Pole golfowe" }, min: "min" },
  ru: { labels: { beach: "Пляж", restaurants: "Рестораны", shops: "Супермаркет", airport: "Аэропорт", hospital: "Больница", school: "Школа", cityCenter: "Центр города", golf: "Поле для гольфа" }, min: "мин" },
};

export default function DistancesStrip({
  distances,
  lang,
  variant = "full",
}: {
  distances: DistancesValue | null | undefined;
  lang: string;
  variant?: "full" | "compact";
}) {
  if (!distances) return null;
  const present = ORDER.filter((k) => distances[k] != null);
  if (!present.length) return null;
  const loc: DistancesLocale = lang === "de" || lang === "pl" || lang === "ru" ? lang : "en";
  const c = COPY[loc];

  return (
    <div className={`dist-strip${variant === "compact" ? " dist-strip--compact" : ""}`}>
      {present.map((k) => (
        <div className="dist-strip__item" key={k}>
          <span className="dist-strip__ic">{ICONS[k]}</span>
          <span className="dist-strip__text">
            <span className="dist-strip__label">{c.labels[k]}</span>
            <span className="dist-strip__value">{distances[k]} {c.min}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
