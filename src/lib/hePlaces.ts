// Hebrew place names for Cyprus — the transliteration layer the `he` locale
// needs wherever a raw Latin place string from the feeds/DB reaches a Hebrew
// page (auto-SEO title/description, listing cards, the Development page's
// location facts, "other projects in <city>").
//
// Why a table and not a generic transliterator: he-glossary.md §1 fixes ONE
// spelling per place ("פאפוס", never "פפוס") and he-keyword-map.md §2 shows the
// hebrew demand is spelled exactly that way ("וילות בפאפוס" 170/mo,
// "דירות בלימסול" 110/mo). A snippet carrying "ב-Paphos" matches none of those
// queries — see Pass B, Must fix #5. Anything NOT in this table stays Latin and
// gets bidi-isolated, which is the styleguide §4 rule for proper names we have
// no approved transliteration for (project, developer and resort brand names
// deliberately never enter this table).
//
// Keys are normalised (lower-case, trimmed, diacritics stripped, whitespace
// collapsed) and include the spelling variants the feeds actually ship
// ("Pafos", "Lemesos", "Chlorakas", "Yeroskipou", …), because the feeds are not
// consistent with each other.
import { bidiIsolate } from "@/lib/locale";

/** lower-case, diacritics stripped, whitespace collapsed — the lookup key form. */
export function normalizePlaceKey(name: string): string {
  return String(name ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // combining marks
    .toLowerCase()
    .replace(/[\s\u00a0]+/g, " ")
    .trim()
    .replace(/[.]+$/g, "")
    .trim();
}

/** Normalised Latin place key → the one approved Hebrew spelling. */
export const HE_PLACES: Record<string, string> = {
  // ---- districts / cities (he-glossary.md §1) ----
  cyprus: "קפריסין",
  paphos: "פאפוס",
  pafos: "פאפוס",
  limassol: "לימסול",
  lemesos: "לימסול",
  limasol: "לימסול",
  larnaca: "לרנקה",
  larnaka: "לרנקה",
  nicosia: "ניקוסיה",
  lefkosia: "ניקוסיה",
  famagusta: "פמגוסטה",
  ammochostos: "פמגוסטה",
  troodos: "טרודוס",
  akamas: "עכמס",

  // ---- Paphos district ----
  "kato paphos": "קאטו פאפוס",
  "kato pafos": "קאטו פאפוס",
  peyia: "פייה",
  pegeia: "פייה",
  pegia: "פייה",
  "coral bay": "קורל ביי",
  "sea caves": "סי קייבס",
  chloraka: "כלורקה",
  chlorakas: "כלורקה",
  geroskipou: "גרוסקיפו",
  yeroskipou: "גרוסקיפו",
  yeroskipos: "גרוסקיפו",
  kissonerga: "קיסונרגה",
  tala: "טאלה",
  tsada: "צאדה",
  konia: "קוניה",
  "mesa chorio": "מסה חוריו",
  "mesa choria": "מסה חוריו",
  "mesa chorion": "מסה חוריו",
  universal: "יוניברסל",
  emba: "אמבה",
  empa: "אמבה",
  mesogi: "מסוגי",
  mesoyi: "מסוגי",
  armou: "ארמו",
  kamares: "קמארס",
  anarita: "אנאריטה",
  kouklia: "קוקליה",
  "venus rock": "ונוס רוק",
  timi: "טימי",
  polis: "פוליס",
  "polis chrysochous": "פוליס",
  latchi: "לאצ'י",
  latsi: "לאצ'י",

  // ---- Limassol district ----
  germasogeia: "גרמסוגיה",
  germasoyia: "גרמסוגיה",
  yermasoyia: "גרמסוגיה",
  germasogia: "גרמסוגיה",
  "agios tychonas": "אגיוס טיכונאס",
  "agios tychon": "אגיוס טיכונאס",
  mouttagiaka: "מוטאגיאקה",
  "mesa geitonia": "מסא גיטוניה",
  neapolis: "נאפוליס",
  "agios athanasios": "אגיוס אתנסיוס",
  amathus: "אמאתוס",
  amathounta: "אמאתוס",
  zakaki: "זקאקי",
  "limassol marina": "מרינת לימסול",
  "kato polemidia": "קאטו פולמידיה",
  ypsonas: "איפסונס",
  palodia: "פאלודיה",
  erimi: "ארימי",
  kolossi: "קולוסי",
  pyrgos: "פירגוס",
  parekklisia: "פרקליסיה",
  pissouri: "פיסורי",
  episkopi: "אפיסקופי",

  // ---- Larnaca district ----
  oroklini: "אורוקליני",
  voroklini: "אורוקליני",
  pyla: "פילה",
  livadia: "ליבאדיה",
  dhekelia: "דקליה",
  dekelia: "דקליה",
  mackenzie: "מקנזי",
  aradippou: "ארדיפו",
  perivolia: "פריבוליה",
  kiti: "קיטי",

  // ---- Famagusta district (the southern, marketable part) ----
  "ayia napa": "איה נאפה",
  "agia napa": "איה נאפה",
  protaras: "פרוטארס",
  paralimni: "פראלימני",
  "ayia thekla": "איה תקלה",
  "agia thekla": "איה תקלה",
  "cape greco": "כף גרקו",
  kapparis: "קאפאריס",
  pernera: "פרנרה",
  sotira: "סוטירה",
  deryneia: "דריניה",
};

/** The approved Hebrew spelling for a place, or undefined when we have none. */
export function hePlace(name: string): string | undefined {
  const key = normalizePlaceKey(name);
  return key ? HE_PLACES[key] : undefined;
}

/**
 * Display form for one place inside Hebrew copy: the Hebrew spelling when we
 * have one, otherwise the Latin name FSI-isolated (styleguide §11.4 — a Latin
 * run inside an RTL sentence is always isolated).
 */
export function hePlaceOrIsolated(name: string): string {
  const raw = String(name ?? "").trim();
  if (!raw) return "";
  return hePlace(raw) ?? bidiIsolate(raw);
}

/**
 * Display form for a comma-separated place value ("Peyia, Paphos") — each part
 * translated on its own, rejoined with ", ". Parts we don't know stay Latin and
 * isolated, so a half-known value reads "פייה, ⁨Foo⁩" rather than falling back
 * wholesale to Latin.
 */
export function hePlaceList(csv: string): string {
  const parts = String(csv ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length) return "";
  return parts.map((p) => hePlaceOrIsolated(p)).join(", ");
}

/**
 * The BROADEST known place in a comma-separated value — i.e. the last part that
 * has an approved Hebrew spelling ("Peyia, Paphos" → "פאפוס"). The feeds order
 * these narrow-to-wide (area, district), and the district is the term that
 * carries the hebrew search volume, so this is what an SEO title/description
 * leads with. Undefined when no part is known.
 */
export function heBroadestPlace(csv: string): string | undefined {
  const hits = String(csv ?? "")
    .split(",")
    .map((p) => hePlace(p))
    .filter((v): v is string => !!v);
  return hits.length ? hits[hits.length - 1] : undefined;
}

/**
 * "in <place>" for Hebrew, with the preposition bound the way the SCRIPT of the
 * place demands — not the way the locale does (Pass B, Must fix #5):
 *   known place   → "בפאפוס"          (bound prefix, no hyphen before Hebrew)
 *   unknown place → "ב-⁨Konia, Paphos⁩" (hyphen + isolated Latin, styleguide §3)
 * Returns "" for an empty place.
 */
export function heLocative(csv: string): string {
  const raw = String(csv ?? "").trim();
  if (!raw) return "";
  const he = heBroadestPlace(raw);
  return he ? `ב${he}` : `ב-${bidiIsolate(raw)}`;
}
