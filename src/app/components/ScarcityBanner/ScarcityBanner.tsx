// Shared scarcity indicator for Development cards — the merged /projects
// listing (ProjectsExplorer's Card) and client presentation property cards
// (PropertyCard) both render this from the same live unit counts, so the
// trigger/text logic can't drift between the two surfaces.
export type ScarcityLocale = "en" | "de" | "pl" | "ru";

const SCARCITY_COPY: Record<ScarcityLocale, { last: string; left: (n: number) => string }> = {
  en: { last: "Last unit available", left: (n) => `Only ${n} units left` },
  de: { last: "Letzte Einheit verfügbar", left: (n) => `Nur noch ${n} Einheiten` },
  // Polish "lokal" (unit/premises) declines lokal/lokale/lokali — 2-4 takes the
  // "few" form (lokale), 5 the "many"/genitive-plural form (lokali).
  pl: { last: "Ostatni lokal", left: (n) => `Zostało tylko ${n} ${n >= 2 && n <= 4 ? "lokale" : "lokali"}` },
  // Russian "объект" declines объект/объекта/объектов — same mod10/mod100 rule
  // used throughout this app (see formatUnitsCount in src/app/c/[token]/copy.ts).
  // available is capped at 5 by the trigger below, so the mod100 12-14
  // exclusion never actually applies here, but keeping the full rule is both
  // more obviously correct and free.
  ru: {
    last: "Последний объект",
    left: (n) => {
      const mod10 = n % 10, mod100 = n % 100;
      const word = mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14) ? "объекта" : "объектов";
      return `Осталось всего ${n} ${word}`;
    },
  },
};

export type ScarcityResult = { tier: "last" | "left"; count: number } | null;

// available/total come straight from the unit counts already loaded for the
// card DTO — no extra query. Sold-out (available === 0) is a separate concern
// (not this banner's job) and total === 0 means no unit data at all.
export function resolveScarcity(available: number, total: number): ScarcityResult {
  if (!total || available <= 0 || available > 5) return null;
  const soldRatio = (total - available) / total;
  if (soldRatio < 0.5) return null;
  return { tier: available === 1 ? "last" : "left", count: available };
}

export default function ScarcityBanner({
  available,
  total,
  locale,
  className,
}: {
  available: number;
  total: number;
  locale: string;
  className?: string;
}) {
  const result = resolveScarcity(available, total);
  if (!result) return null;
  const loc: ScarcityLocale = locale === "de" || locale === "pl" || locale === "ru" ? locale : "en";
  const copy = SCARCITY_COPY[loc];
  const text = result.tier === "last" ? copy.last : copy.left(result.count);
  return <span className={`scarcity-badge${className ? ` ${className}` : ""}`}>{text}</span>;
}
