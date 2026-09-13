// Hebrew display labels for the RAW feed/DB vocabulary that reaches a page
// untranslated — property types ("Villa", "Apartment"), unit statuses
// ("Available", "Reserved") and the bedroom summary resolveBedRange() produces
// ("", "Studio", "3", "1-3").
//
// Pass B, "Systemic" #1: the hebrew page currently ends where the copy table
// ends. A listing card says "Villa" while the facts panel under it says "וילה",
// the unit table's status column is the only Latin column on an RTL page, and
// the card's bedroom chip reads "1 חדרי שינה" / "Studio חדרי שינה". None of
// that is fixable inside a copy table, because the values are data, not copy.
//
// Deliberately DISPLAY-ONLY and `he`-ONLY: the English values keep driving
// filtering, sorting and matching (matchesPropertyTypeFilter in
// developmentCard.ts compares against the English resolveDevelopmentType()
// output), and every LTR locale renders byte-identically to before. An unknown
// value falls back to the raw string, bidi-isolated — never to a guess.
//
// Terms come from he-glossary.md §2; Pass B Must fix #10 settled the gender:
// a unit status describes a יחידה (fem.), so the pill reads "זמינה"/"שמורה",
// while DEVELOPMENT_STRINGS.he.unitStatus.available stays masculine "זמין"
// because there it labels the PROJECT in the hero badge.
import { bidiIsolate, ltrIsolate } from "@/lib/locale";

const norm = (raw: string): string =>
  String(raw ?? "")
    .toLowerCase()
    .replace(/[\s _-]+/g, " ")
    .trim();

/** Normalised raw feed value → Hebrew display label (he-glossary.md §2). */
export const HE_FEED_VOCAB: Record<string, string> = {
  // ---- property types ----
  apartment: "דירה",
  apartments: "דירות",
  flat: "דירה",
  villa: "וילה",
  villas: "וילות",
  house: "בית פרטי",
  "detached house": "בית פרטי",
  "detached villa": "וילה",
  townhouse: "בית טורי",
  "town house": "בית טורי",
  "semi detached": "בית דו משפחתי",
  "semi detached house": "בית דו משפחתי",
  penthouse: "פנטהאוז",
  duplex: "דופלקס",
  maisonette: "דופלקס",
  bungalow: "בונגלו",
  studio: "סטודיו",
  plot: "מגרש",
  land: "קרקע",
  commercial: "נכס מסחרי",
  office: "משרד",
  shop: "חנות",
  property: "נכס",

  // ---- unit statuses (subject is יחידה — feminine) ----
  available: "זמינה",
  reserved: "שמורה",
  sold: "נמכרה",
  "under offer": "בהצעה",
  unlisted: "לא בתצוגה",
};

/**
 * Hebrew label for one raw feed value, or the raw value FSI-isolated when we
 * have no approved term for it. Call ONLY on the `he` render path.
 */
export function heFeedLabel(raw: string): string {
  const value = String(raw ?? "").trim();
  if (!value) return "";
  return HE_FEED_VOCAB[norm(value)] ?? bidiIsolate(value);
}

/**
 * Hebrew bedroom summary for resolveBedRange()'s output
 * (src/lib/developmentCard.ts: "" | "Studio" | "3" | "1-3").
 *
 * Hebrew is NOT count-invariant, so "1 חדרי שינה" is simply ungrammatical
 * (Pass B, Must fix #9) and the numeral for one is written out and postposed.
 * A range keeps Western digits with a PLAIN hyphen — the en dash is banned in
 * `he` (styleguide §3) — inside an LRI…PDI run so the RTL paragraph can't
 * visually swap "2-4" into "4-2".
 *   ""       → ""
 *   "Studio" → "סטודיו"            (no unit word — a studio has no bedroom)
 *   "1"      → "חדר שינה אחד"
 *   "3"      → "3 חדרי שינה"
 *   "1-3"    → "⁦1-3⁩ חדרי שינה"
 */
export function heBedrooms(range: string): string {
  const v = String(range ?? "").trim();
  if (!v) return "";
  if (/^st(udio)?$/i.test(v)) return "סטודיו";
  const single = v.match(/^(\d+)$/);
  if (single) {
    const n = Number(single[1]);
    if (n === 0) return "סטודיו";
    return n === 1 ? "חדר שינה אחד" : `${n} חדרי שינה`;
  }
  const span = v.match(/^(\d+)\s*[-–—]\s*(\d+)$/);
  if (span) return `${ltrIsolate(`${span[1]}-${span[2]}`)} חדרי שינה`;
  return bidiIsolate(v);
}
