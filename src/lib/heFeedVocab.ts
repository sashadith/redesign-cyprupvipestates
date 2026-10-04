// Hebrew display labels for the RAW feed/DB vocabulary that reaches a page
// untranslated — property types ("Villa", "Apartment"), unit statuses
// ("Available", "Reserved") and the bedroom summary resolveBedRange() produces
// ("", "Studio", "3", "1-3") — and, since Pass B S17, the amenity strings the
// presentation overlay renders as chips ("Swimming pool", "Gym", "Concierge").
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

  // ---- amenities (Pass B S17) ----
  // The presentation overlay renders one chip per raw feed amenity string, so
  // "Swimming pool" / "Gym" / "Concierge" stood in Latin among Hebrew copy.
  // Terms come from he-glossary.md §2 where it has one; the rest are the
  // standard Israeli listing terms. Feed strings arrive in every casing and
  // with hyphens/underscores, which norm() flattens — so the common variant
  // spellings each get their own key rather than a guess at run time.

  // pools
  pool: "בריכת שחייה",
  pools: "בריכות שחייה",
  "swimming pool": "בריכת שחייה",
  "swimming pools": "בריכות שחייה",
  "private pool": "בריכה פרטית",
  "private swimming pool": "בריכה פרטית",
  "communal pool": "בריכה משותפת",
  "communal swimming pool": "בריכה משותפת",
  "shared pool": "בריכה משותפת",
  "infinity pool": "בריכת אינסוף",
  "overflow pool": "בריכת אינסוף",
  "childrens pool": "בריכת ילדים",
  "kids pool": "בריכת ילדים",
  "heated pool": "בריכה מחוממת",

  // outdoor space
  garden: "גינה",
  gardens: "גינות",
  "private garden": "גינה פרטית",
  "landscaped garden": "גינון מעוצב",
  "landscaped gardens": "גינון מעוצב",
  landscaping: "גינון מעוצב",
  "communal gardens": "גינות משותפות",
  "roof garden": "מרפסת גג",
  "roof terrace": "מרפסת גג",
  roof: "גג",
  terrace: "מרפסת",
  terraces: "מרפסות",
  balcony: "מרפסת",
  balconies: "מרפסות",
  veranda: "מרפסת מקורה",
  verandas: "מרפסות מקורות",
  "covered veranda": "מרפסת מקורה",
  patio: "פטיו",
  pergola: "פרגולה",
  "bbq": "אזור מנגל",
  "bbq area": "אזור מנגל",
  barbecue: "אזור מנגל",
  "barbecue area": "אזור מנגל",
  "outdoor kitchen": "מטבח חוץ",

  // parking and storage
  parking: "חניה",
  "parking space": "חניה",
  "covered parking": "חניה מקורה",
  "underground parking": "חניה תת-קרקעית",
  "private parking": "חניה פרטית",
  storage: "מחסן",
  "storage room": "מחסן",
  "ev charger": "עמדת טעינה לרכב חשמלי",
  "ev charging": "עמדת טעינה לרכב חשמלי",
  "ev charging point": "עמדת טעינה לרכב חשמלי",

  // views and location
  "sea view": "נוף לים",
  "sea views": "נוף לים",
  "panoramic sea view": "נוף פנורמי לים",
  "panoramic view": "נוף פנורמי",
  "mountain view": "נוף להרים",
  "mountain views": "נוף להרים",
  "unobstructed view": "נוף פתוח",
  "unobstructed views": "נוף פתוח",
  "open view": "נוף פתוח",
  beachfront: "קו ראשון לים",
  "first line": "קו ראשון לים",
  "beach access": "גישה לחוף",
  "walking distance to the beach": "במרחק הליכה מהחוף",
  "walking distance to beach": "במרחק הליכה מהחוף",

  // wellness and leisure
  gym: "חדר כושר",
  fitness: "חדר כושר",
  "fitness centre": "חדר כושר",
  "fitness center": "חדר כושר",
  "fitness room": "חדר כושר",
  spa: "ספא",
  sauna: "סאונה",
  "steam room": "חדר אדים",
  jacuzzi: "ג'קוזי",
  "hot tub": "ג'קוזי",
  playground: "גן משחקים",
  "childrens playground": "גן משחקים",
  "tennis court": "מגרש טניס",
  "tennis courts": "מגרשי טניס",
  golf: "מגרש גולף",
  "golf course": "מגרש גולף",
  "golf resort": "ריזורט גולף",
  resort: "ריזורט",
  "lounge area": "פינת ישיבה",
  sunbeds: "מיטות שיזוף",
  restaurant: "מסעדה",

  // building services
  lift: "מעלית",
  lifts: "מעליות",
  elevator: "מעלית",
  elevators: "מעליות",
  concierge: "קונסיירז'",
  "concierge service": "שירות קונסיירז'",
  reception: "קבלה",
  lobby: "לובי",
  "communal areas": "שטחים משותפים",
  "management company": "חברת ניהול",

  // security
  gated: "קהילה מגודרת",
  "gated community": "קהילה מגודרת",
  "gated complex": "פרויקט מגודר",
  security: "אבטחה",
  "24 7 security": `אבטחה ${ltrIsolate("24/7")}`,
  "24/7 security": `אבטחה ${ltrIsolate("24/7")}`,
  cctv: "מצלמות אבטחה",
  "video surveillance": "מצלמות אבטחה",
  alarm: "מערכת אזעקה",
  "alarm system": "מערכת אזעקה",
  intercom: "אינטרקום",
  "video intercom": "אינטרקום עם וידאו",

  // technical fit-out
  "smart home": "בית חכם",
  "smart home system": "מערכת בית חכם",
  "home automation": "בית חכם",
  "air conditioning": "מיזוג אוויר",
  "a/c": "מיזוג אוויר",
  ac: "מיזוג אוויר",
  vrv: "מיזוג אוויר",
  vrf: "מיזוג אוויר",
  "climate control": "בקרת אקלים",
  "provision for air conditioning": "הכנה למיזוג אוויר",
  "underfloor heating": "חימום תת-רצפתי",
  "central heating": "חימום מרכזי",
  "solar panels": "פאנלים סולאריים",
  photovoltaic: "פאנלים סולאריים",
  "solar water heating": "דוד שמש",
  "double glazing": "זיגוג כפול",
  "double glazed windows": "חלונות בזיגוג כפול",
  "pressurised water": "מערכת מים בלחץ",
  "pressurized water": "מערכת מים בלחץ",
  "pressurised water system": "מערכת מים בלחץ",
  fireplace: "קמין",

  // interior
  furnished: "מרוהט",
  "fully furnished": "מרוהט במלואו",
  unfurnished: "לא מרוהט",
  "fitted kitchen": "מטבח מאובזר",
  "fitted wardrobes": "ארונות קיר",
  wardrobes: "ארונות קיר",
  "walk in wardrobe": "חדר ארונות",
  "walk in closet": "חדר ארונות",
  "en suite": "חדר רחצה צמוד",
  ensuite: "חדר רחצה צמוד",
  "en suite bathroom": "חדר רחצה צמוד",
  "guest wc": "שירותי אורחים",
  "guest toilet": "שירותי אורחים",
  "utility room": "חדר שירות",
  "laundry room": "חדר כביסה",
  "corner plot": "מגרש פינתי",
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
