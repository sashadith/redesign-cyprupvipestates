/* The optional qualifiers: property interest, budget range, timeline.
 *
 * The VALUES are a contract with the lead handler, not free text. /api/leads
 * maps them through fixed lookup tables (route.ts, "Qualification fields"):
 *
 *   BUDGETS["200000-500000"] -> [200000, 500000]  -> Lead.budgetMin/budgetMax
 *   TIMELINES["1y"]          -> "ONE_YEAR"        -> Lead.timeline (enum)
 *   PROP_TYPES               -> whitelist filter  -> Lead.propertyTypeInterest
 *
 * A value that misses by one character is silently dropped to null — no error,
 * no log, the lead just arrives unqualified. So the values live here once and
 * every form reads them, rather than being retyped per form.
 *
 * "Office" is deliberately in the list: the stock holds 68 units typed Office
 * plus ~50 more commercial ones. It had to be added in three more places to
 * survive the trip — the handler's whitelist, the admin's LEAD_PROP_TYPES, and
 * the matcher's TYPE_ALIASES — because each of those filters unknown types out
 * without complaining.
 *
 * Only the LABELS are localized; the values stay English on the wire.
 * All three fields are optional everywhere, and the labels say so, because in
 * the forms that show them every other field is required. */

/* Order is display order. "Under €200k" sits last on purpose: the list should
   open on the ranges that matter most, not on the smallest one. */
export const BUDGET_VALUES = [
  "200000-500000",
  "500000-1000000",
  "1000000-2000000",
  "2000000-",
  "0-200000",
] as const;

export const PROPERTY_VALUES = ["Villa", "Townhouse", "Apartment", "Penthouse", "Office"] as const;

/* Four steps, not five: the 3- and 6-month options were splitting the same
   intent. "2y" is new and needs LeadTimeline.TWO_YEARS in the database —
   without it the handler maps it to a value Postgres rejects and the lead is
   lost. THREE_MONTHS and SIX_MONTHS stay in the enum and in the admin: four
   existing leads carry them. */
export const TIMELINE_VALUES = ["now", "1y", "2y", "exploring"] as const;

type Copy = {
  budgetLabel: string;
  propertyLabel: string;
  timelineLabel: string;
  choose: string;
  budgets: Record<(typeof BUDGET_VALUES)[number], string>;
  properties: Record<(typeof PROPERTY_VALUES)[number], string>;
  timelines: Record<(typeof TIMELINE_VALUES)[number], string>;
};

const COPY: Record<"en" | "de" | "pl" | "ru", Copy> = {
  en: {
    budgetLabel: "Budget range (optional)",
    propertyLabel: "Property interest (optional)",
    timelineLabel: "Timeline (optional)",
    choose: "Please choose…",
    budgets: {
      "200000-500000": "€200k – €500k",
      "500000-1000000": "€500k – €1M",
      "1000000-2000000": "€1M – €2M",
      "2000000-": "€2M+",
      "0-200000": "Under €200k",
    },
    properties: { Villa: "Villa", Townhouse: "Townhouse", Apartment: "Apartment", Penthouse: "Penthouse", Office: "Office" },
    timelines: {
      now: "Ready to buy now",
      "1y": "Within a year",
      "2y": "Within 2 years",
      exploring: "Just exploring",
    },
  },
  de: {
    budgetLabel: "Budget (optional)",
    propertyLabel: "Objekt-Interesse (optional)",
    timelineLabel: "Zeitrahmen (optional)",
    choose: "Bitte wählen…",
    budgets: {
      "200000-500000": "200.000 – 500.000 €",
      "500000-1000000": "500.000 – 1 Mio. €",
      "1000000-2000000": "1 – 2 Mio. €",
      "2000000-": "Über 2 Mio. €",
      "0-200000": "Unter 200.000 €",
    },
    properties: { Villa: "Villa", Townhouse: "Reihenhaus", Apartment: "Wohnung", Penthouse: "Penthouse", Office: "Büro" },
    timelines: {
      now: "Sofort kaufbereit",
      "1y": "Innerhalb eines Jahres",
      "2y": "Innerhalb von 2 Jahren",
      exploring: "Ich sehe mich um",
    },
  },
  pl: {
    budgetLabel: "Budżet (opcjonalnie)",
    propertyLabel: "Rodzaj nieruchomości (opcjonalnie)",
    timelineLabel: "Termin (opcjonalnie)",
    choose: "Wybierz…",
    budgets: {
      "200000-500000": "200 000 – 500 000 €",
      "500000-1000000": "500 000 – 1 mln €",
      "1000000-2000000": "1 – 2 mln €",
      "2000000-": "Powyżej 2 mln €",
      "0-200000": "Poniżej 200 000 €",
    },
    properties: { Villa: "Willa", Townhouse: "Dom szeregowy", Apartment: "Apartament", Penthouse: "Penthouse", Office: "Biuro" },
    timelines: {
      now: "Gotowy do zakupu",
      "1y": "W ciągu roku",
      "2y": "W ciągu 2 lat",
      exploring: "Tylko się rozglądam",
    },
  },
  ru: {
    budgetLabel: "Бюджет (необязательно)",
    propertyLabel: "Тип недвижимости (необязательно)",
    timelineLabel: "Сроки (необязательно)",
    choose: "Выберите…",
    budgets: {
      "200000-500000": "200 000 – 500 000 €",
      "500000-1000000": "500 000 – 1 млн €",
      "1000000-2000000": "1 – 2 млн €",
      "2000000-": "Более 2 млн €",
      "0-200000": "До 200 000 €",
    },
    properties: { Villa: "Вилла", Townhouse: "Таунхаус", Apartment: "Квартира", Penthouse: "Пентхаус", Office: "Офис" },
    timelines: {
      now: "Готов купить сейчас",
      "1y": "В течение года",
      "2y": "В течение 2 лет",
      exploring: "Присматриваюсь",
    },
  },
};

export function qualifierCopy(lang: string): Copy {
  return COPY[lang as keyof typeof COPY] ?? COPY.en;
}

/* The stored enum values, in the order the admin should offer them.
   Admin copy is English by project convention (CLAUDE.md).

   The two retired steps sit at the end and are labelled as such rather than
   dropped: the edit form renders `defaultValue={lead.timeline}`, and a value
   that is not among the options makes the select fall back to the empty one —
   so omitting them would quietly wipe the timeline off the four leads that
   still carry them the first time someone opens one for editing. */
export const LEAD_TIMELINE_OPTIONS = [
  { v: "IMMEDIATE", l: "Ready to buy now" },
  { v: "ONE_YEAR", l: "Within a year" },
  { v: "TWO_YEARS", l: "Within 2 years" },
  { v: "JUST_LOOKING", l: "Just exploring" },
  { v: "THREE_MONTHS", l: "Within 3 months (retired)" },
  { v: "SIX_MONTHS", l: "Within 6 months (retired)" },
] as const;

/* Readable versions of what is STORED on a lead, for the places that show a
   lead rather than collect one: the CRM card and the team notifications.
   English, like the rest of the internal surface.

   These read the stored columns (enum, budgetMin/budgetMax), not the form's
   wire values, so they also cover leads an admin typed in by hand and the
   older leads whose bucket no longer exists in the form. */

export function leadTimelineLabel(v: string | null | undefined): string | null {
  if (!v) return null;
  return LEAD_TIMELINE_OPTIONS.find((o) => o.v === v)?.l ?? v;
}

const FINANCING_LABELS: Record<string, string> = {
  CASH: "Cash purchase",
  MORTGAGE: "Mortgage",
  UNDECIDED: "Undecided",
};
export function leadFinancingLabel(v: string | null | undefined): string | null {
  if (!v) return null;
  return FINANCING_LABELS[v] ?? v;
}

/* 200000 -> "€200k", 1000000 -> "€1M", 1500000 -> "€1.5M" */
function money(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `€${Number.isInteger(m) ? m : m.toFixed(1)}M`;
  }
  if (n >= 1_000) return `€${Math.round(n / 1_000)}k`;
  return `€${n}`;
}

/* An open-ended bucket reads as "Under X" / "X+" rather than printing a "?"
   where the missing bound would be. */
export function leadBudgetLabel(min: number | null | undefined, max: number | null | undefined): string | null {
  if (min == null && max == null) return null;
  if (min == null) return `Under ${money(max!)}`;
  if (max == null) return `${money(min)}+`;
  return `${money(min)} – ${money(max)}`;
}

/* The bucket -> [min, max] mapping, so the public form, the lead handler and
   the CRM's inline editor all cut the budget at the same places. It used to
   live as a literal inside /api/leads; a second copy anywhere would let a lead
   be filed in one bucket and read back as another. */
export const BUDGET_RANGES: Record<string, [number | null, number | null]> = {
  "0-200000": [null, 200000],
  "200000-500000": [200000, 500000],
  "500000-1000000": [500000, 1000000],
  "1000000-2000000": [1000000, 2000000],
  "2000000-": [2000000, null],
};

/* Which bucket a stored pair belongs to, for preselecting a dropdown. Returns
   "" when the lead carries a hand-entered range that matches no bucket — the
   editor then shows a "custom" option rather than silently rounding it into a
   neighbouring bucket on the next save. */
export function budgetValueFor(min: number | null | undefined, max: number | null | undefined): string {
  if (min == null && max == null) return "";
  for (const [value, [lo, hi]] of Object.entries(BUDGET_RANGES)) {
    if ((lo ?? null) === (min ?? null) && (hi ?? null) === (max ?? null)) return value;
  }
  return "custom";
}
