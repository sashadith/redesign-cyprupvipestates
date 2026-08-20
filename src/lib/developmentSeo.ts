// SEO fundamentals for the new Development pipeline: a stable, sprechender slug
// and auto-generated per-language title/description, so every future "Publish"
// meets basic ranking prerequisites with zero manual admin work. Admins can still
// override slug/title/description per project — see DevelopmentOverride.seo.
//
// Kept deliberately simple/safe across languages: EN/DE support a fixed bed-count
// compound ("3-bed Villa" / "3-Zimmer-Villa") because neither inflects with the
// numeral. PL/RU skip the bed-count adjective in the TITLE (Polish/Russian type
// nouns have gender-dependent adjective endings — villa/apartment/house don't
// share one — so a single generic template risks producing an ungrammatical
// title; better a safe, always-correct title without it). Bed/unit counts still
// appear in the DESCRIPTION for all languages via a "count: N" phrasing that
// sidesteps noun-number agreement entirely.
import { prisma } from "@/lib/prisma";
import type { ProjectVM } from "@/app/preview-project/feeds";
import { listedUnits } from "@/lib/developmentAvailability";

export const TITLE_MAX = 60;
export const DESC_MAX = 160;

// The "prod-only switch": the new Development pages carry the full SEO
// machinery (per-project title/description, canonical, hreflang, structured
// data), but stay noindex until this is flipped — set NEW_PROJECTS_INDEXABLE
// =true in the production env at cutover time. Set true 2026-07-17, alongside
// the route rename from the interim /preview-project/[slug] to /projects/[slug]
// (now the SAME route legacy Project pages use — see that page's dispatch-
// order comment). Staging keeps its own nginx X-Robots-Tag backstop
// regardless, so this never needs per-domain logic.
export const NEW_PROJECTS_INDEXABLE = process.env.NEW_PROJECTS_INDEXABLE === "true";

// ---------- slug ----------

function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

/** Base slug from a project's public name — not guaranteed unique on its own. */
export function developmentSlug(publicName: string): string {
  return slugify(publicName) || "development";
}

/**
 * Unique slug for a development: base slug, deduped with -2/-3/… against
 * existing rows. Pass the development's own id (if it already has one) so a
 * re-save doesn't collide with itself.
 */
export async function uniqueDevelopmentSlug(publicName: string, selfId?: string): Promise<string> {
  const base = developmentSlug(publicName);
  let candidate = base;
  let n = 2;
  // small table (hundreds of rows) — a loop of unique-lookups is simple and fine.
  for (;;) {
    const hit = await prisma.development.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!hit || hit.id === selfId) return candidate;
    candidate = `${base}-${n++}`;
  }
}

// ---------- type/beds helpers ----------

type Lang = "en" | "de" | "pl" | "ru";
const LANGS: Lang[] = ["en", "de", "pl", "ru"];
const asLang = (l: string): Lang => (LANGS.includes(l as Lang) ? (l as Lang) : "en");

const TYPE_LABEL: Record<string, Record<Lang, string>> = {
  villa: { en: "Villa", de: "Villa", pl: "Willa", ru: "Вилла" },
  apartment: { en: "Apartment", de: "Wohnung", pl: "Apartament", ru: "Квартира" },
  house: { en: "House", de: "Haus", pl: "Dom", ru: "Дом" },
  townhouse: { en: "Townhouse", de: "Reihenhaus", pl: "Dom szeregowy", ru: "Таунхаус" },
  generic: { en: "Property", de: "Immobilie", pl: "Nieruchomość", ru: "Недвижимость" },
};

function typeKeyOf(raw: string): keyof typeof TYPE_LABEL {
  const t = raw.toLowerCase();
  if (t.includes("villa")) return "villa";
  if (t.includes("apart") || t.includes("flat")) return "apartment";
  if (t.includes("town")) return "townhouse";
  if (t.includes("house") || t.includes("bungalow")) return "house";
  return "generic";
}

// The unit population every auto-generated title/description describes: the
// LISTED units, i.e. what a visitor actually finds on the page. Units that
// vanished from the developer's feed must not put a type or a bed count into a
// search snippet that the page itself never shows. Falls back to all units when
// nothing is listed any more, for the same reason resolveDevelopmentType does
// (developmentCard.ts): a withdrawn development keeps the type it was built as
// rather than degrading to "generic".
function describedUnits(vm: ProjectVM): ProjectVM["units"] {
  const listed = listedUnits(vm.units);
  return listed.length ? listed : vm.units;
}

/** Single dominant type across units, or "generic" if mixed/empty. */
function typesLabel(vm: ProjectVM, lang: Lang): string {
  const keys = Array.from(new Set(describedUnits(vm).map((u) => (u.type ? typeKeyOf(u.type) : null)).filter(Boolean))) as (keyof typeof TYPE_LABEL)[];
  const key = keys.length === 1 ? keys[0] : "generic";
  return TYPE_LABEL[key][lang];
}

/** "3" if every unit has the same bed count, "2–4" if it varies, null if unknown. */
function bedsRange(vm: ProjectVM): string | null {
  const nums = describedUnits(vm).map((u) => Number(String(u.beds).match(/\d+/)?.[0])).filter((n) => Number.isFinite(n) && n > 0);
  if (!nums.length) return null;
  const lo = Math.min(...nums), hi = Math.max(...nums);
  return lo === hi ? String(lo) : `${lo}–${hi}`;
}

const LABELS: Record<Lang, { in: string; from: string; unitsAvailable: string; completion: string; cyprus: string }> = {
  en: { in: "in", from: "from", unitsAvailable: "units available", completion: "Completion", cyprus: "Cyprus" },
  de: { in: "in", from: "ab", unitsAvailable: "Einheiten verfügbar", completion: "Fertigstellung", cyprus: "Zypern" },
  pl: { in: "w", from: "od", unitsAvailable: "dostępnych jednostek", completion: "Termin realizacji", cyprus: "Cypr" },
  ru: { in: "в", from: "от", unitsAvailable: "доступных объектов", completion: "Срок сдачи", cyprus: "Кипр" },
};

const fmtPrice = (n: number) => `€${n.toLocaleString("en-US")}`;

function fit(clauses: string[], max: number, sep = " "): string {
  // Drop trailing clauses one at a time until it fits; hard-truncate as a last resort.
  for (let n = clauses.length; n > 0; n--) {
    const s = clauses.slice(0, n).join(sep);
    if (s.length <= max) return s;
  }
  return clauses[0].slice(0, max - 1) + "…";
}

// ---------- public generators ----------

export function autoMetaTitle(vm: ProjectVM, lang: string): string {
  const l = asLang(lang);
  const type = typesLabel(vm, l);
  const beds = bedsRange(vm);
  const place = [vm.area, vm.district].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(", ");
  // EN/DE: safe to compound the bed count onto the type ("3-bed Villa" / "3-Zimmer-Villa").
  // PL/RU: skip it — gendered adjective endings differ per type noun, no single safe form.
  const typeClause =
    beds && l === "en" ? `${beds}-bed ${type}` : beds && l === "de" ? `${beds}-Zimmer-${type}` : type;
  const clauses = [vm.publicName, "–", place ? `${typeClause} ${LABELS[l].in} ${place}` : typeClause];
  return fit(clauses, TITLE_MAX);
}

export function autoMetaDescription(vm: ProjectVM, lang: string): string {
  const l = asLang(lang);
  const type = typesLabel(vm, l);
  const place = [vm.area, vm.district].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(", ");
  const lbl = LABELS[l];
  const sentence1 = `${type}${place ? ` ${lbl.in} ${place}` : ""}, ${lbl.cyprus}.`;
  // Fallback total (no available unit left) counts the LISTED units only —
  // the same population the page itself shows. Counting raw rows would put a
  // number in the search snippet that is larger than anything on the page
  // (see listedUnits in developmentAvailability.ts).
  const avail = vm.units.filter((u) => u.status === "available").length || listedUnits(vm.units).length;
  const priceClause = vm.priceFrom ? ` ${lbl.from} ${fmtPrice(vm.priceFrom)}` : "";
  // EN only: "unit"/"units" inflects with the count (DE/PL/RU labels below are
  // already fixed, count-invariant nouns — "Einheiten"/"jednostek"/"объектов" —
  // real-estate convention regardless of n, so no equivalent branch needed there).
  const unitsLabel = l === "en" && avail === 1 ? "unit available" : lbl.unitsAvailable;
  const sentence2 = avail ? `${avail} ${unitsLabel}${priceClause}.` : priceClause ? `${lbl.unitsAvailable}${priceClause}.` : "";
  const sentence3 = vm.completion ? `${lbl.completion}: ${vm.completion}.` : "";
  return fit([sentence1, sentence2, sentence3].filter(Boolean), DESC_MAX);
}

// ---------- live placeholders in stored SEO text ----------
//
// Manual and AI-written overrides are stored once and never regenerated, while
// the figures they talk about move with every feed sync. On 2026-08-20 all six
// AI-written projects had drifted — Royal Residences still advertised "13
// exclusive units available" on a page that says SOLD OUT, :salt named a price
// €26,600 above the real one. Banning figures outright (see the no-digit rule in
// src/lib/ai/seoMeta.ts) fixes correctness but costs the search snippet its most
// clickable element.
//
// So stored text may carry a placeholder instead of a figure, resolved against
// live data on every render: write "from {priceFrom}" and the reader always sees
// today's price. The stored string stays figure-free, which is exactly what the
// generator's guard enforces — the two mechanisms are designed to fit together.
// Defined in its own import-free module so the admin editor (a client component)
// can name the same tokens without pulling this file — and Prisma — into the
// browser bundle. Re-exported here so the resolver and its constant stay together.
export { SEO_PLACEHOLDERS } from "@/lib/seoPlaceholders";
import { SEO_PLACEHOLDERS } from "@/lib/seoPlaceholders";

const groupDigits = (n: number, sep: string) => Math.round(n).toLocaleString("en-US").replace(/,/g, sep);

// Per-language money formatting, matching the convention each locale's existing
// copy already used (EN leads with the symbol, DE/PL/RU trail it).
const PRICE_FORMAT: Record<Lang, (n: number) => string> = {
  en: (n) => `€${groupDigits(n, ",")}`,
  de: (n) => `${groupDigits(n, ".")} €`,
  pl: (n) => `${groupDigits(n, " ")} €`,
  ru: (n) => `${groupDigits(n, " ")} €`,
};

// Completion is stored free-form, and in practice almost always as "Q3 2029".
// Rendered raw, that leaves an English quarter notation sitting in Polish and
// Russian copy ("oddanie Q3 2029"), which is what the hand-written text these
// placeholders replaced got right by writing "III kw. 2029" / "3 кв. 2029".
// Anything that isn't a plain quarter-and-year passes through untouched — the
// field is free text and may hold a date, a season, or a note.
const QUARTER = /^Q([1-4])\s*(\d{4})$/i;
const ROMAN = ["I", "II", "III", "IV"];
function localizeCompletion(raw: string, l: Lang): string {
  const m = raw.match(QUARTER);
  if (!m) return raw;
  const q = Number(m[1]);
  const year = m[2];
  if (l === "pl") return `${ROMAN[q - 1]} kw. ${year}`;
  if (l === "ru") return `${q} кв. ${year}`;
  return `Q${q} ${year}`; // en/de — "Q3 2029" reads natively in both
}

function placeholderValues(vm: ProjectVM, l: Lang): Record<string, string | null> {
  const available = listedUnits(vm.units).filter((u) => u.status === "available").length;
  return {
    priceFrom: vm.priceFrom != null ? PRICE_FORMAT[l](vm.priceFrom) : null,
    // Zero is deliberately unresolvable, not "0": a sold-out project must not
    // advertise "0 units available" — the whole override falls back to the
    // auto-generated text, which handles sold-out properly.
    unitsAvailable: available > 0 ? String(available) : null,
    completion: vm.completion?.trim() ? localizeCompletion(vm.completion.trim(), l) : null,
  };
}

/**
 * Substitute {placeholder}s with live values.
 * Returns null when ANY placeholder is unknown or currently has no value — the
 * caller then falls back to the auto-generated text. Never emit a half-resolved
 * string: a stray "{priceFrom}" or a dangling "from ." in a search result is
 * worse than a plainer sentence that is always correct.
 */
export function applySeoPlaceholders(text: string, vm: ProjectVM, lang: string): string | null {
  if (!text.includes("{")) return text;
  const values = placeholderValues(vm, asLang(lang));
  let unresolved = false;
  const out = text.replace(/\{(\w+)\}/g, (_m, key: string) => {
    const v = values[key];
    if (v == null) { unresolved = true; return ""; }
    return v;
  });
  return unresolved ? null : out;
}

// ---------- override resolution ----------

export type SeoOverride = Partial<Record<`title${Uppercase<Lang>}` | `desc${Uppercase<Lang>}`, string>>;

export function resolveMetaTitle(vm: ProjectVM, lang: string, seo?: SeoOverride | null): string {
  const key = `title${asLang(lang).toUpperCase()}` as keyof SeoOverride;
  const override = (seo?.[key] || "").trim();
  if (!override) return autoMetaTitle(vm, lang);
  const resolved = applySeoPlaceholders(override, vm, lang);
  // Re-clamp after substitution: the stored string was measured with the
  // placeholder in it, and the live value has a different length.
  return resolved ? fit([resolved], TITLE_MAX) : autoMetaTitle(vm, lang);
}

export function resolveMetaDescription(vm: ProjectVM, lang: string, seo?: SeoOverride | null): string {
  const key = `desc${asLang(lang).toUpperCase()}` as keyof SeoOverride;
  const override = (seo?.[key] || "").trim();
  if (!override) return autoMetaDescription(vm, lang);
  const resolved = applySeoPlaceholders(override, vm, lang);
  return resolved ? fit([resolved], DESC_MAX) : autoMetaDescription(vm, lang);
}
