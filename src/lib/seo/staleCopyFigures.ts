// Detects figures baked into STORED copy that no longer match live data.
//
// Why this exists: DevelopmentOverride.seo (meta titles/descriptions) and
// DevelopmentOverride.description* (the long project text) are written once —
// by an admin or by the "Generate with Claude" button — and never regenerated.
// The numbers they talk about, meanwhile, move with every feed sync. Nothing
// reconciles the two, so a figure typed into that copy is correct only until
// the next unit sells.
//
// It had gone unnoticed for a long time. On 2026-08-20, an audit of all 128
// published developments carrying an override found 26 with drifted figures:
// :gravity advertising "from €981,243" against a live €360,053, :spirit
// "Only 4 exclusive apartments" where 9 were available, :upside a price
// €30,000 BELOW the real one — the commercially dangerous direction, since the
// buyer arrives expecting a price that isn't on offer.
//
// Two mechanisms now keep NEW copy clean: the generators refuse to write a
// digit (src/lib/ai/seoMeta.ts), and live figures reach the page through
// {placeholder} tokens resolved on every render (developmentSeo.ts). This
// module is the safety net for everything written before that, and for
// anything typed by hand afterwards.
import { prisma } from "@/lib/prisma";
import { resolveDevelopmentPrice } from "@/lib/developmentCard";
import { listedUnits } from "@/lib/developmentAvailability";

export type StaleFigure = {
  developmentId: string;
  slug: string;
  publicName: string;
  /** Which stored field — "descEN", "titleDE", "descriptionRU", … */
  field: string;
  kind: "price" | "count";
  /** The figure as the copy states it, e.g. "€981,243" or "4 apartments". */
  said: string;
  /** The bare number behind `said` — the identity of the finding. `said` is
      language-specific ("11 units" / "11 Einheiten" / "11 lokali"), so grouping
      on it would split one mistake into one item per language. */
  value: number;
  /** What the page actually shows today. */
  live: string;
  /** Surrounding sentence fragment, so an admin can judge without opening the record. */
  context: string;
  updatedAt: Date;
};

const SEO_FIELDS = ["titleEN", "titleDE", "titlePL", "titleRU", "descEN", "descDE", "descPL", "descRU"] as const;
const DESC_FIELDS = ["descriptionEN", "descriptionDE", "descriptionPL", "descriptionRU"] as const;

// Money with real thousands grouping ("€1.125.000", "262 400 €"). The grouping
// requirement matters: a looser pattern swallows across sentence boundaries and
// reads "€850,000. 34 units" as the single number 85,000,034.
const MONEY = /€\s?(\d{1,3}(?:[.,   ]\d{3})+)|(\d{1,3}(?:[.,   ]\d{3})+)\s?€/g;

// An integer directly followed by a word for a home, in any of the four languages.
const COUNT = /(\d{1,4})\s+(units?|homes?|apartments?|villas?|residences?|Einheiten|Wohnungen|Villen|Apartments|lokali|lokale|jednostek|apartament\w*|wille|willi|квартир\w*|вилл\w*|объект\w*|резиденц\w*|апартамент\w*)/gi;

// A price in this copy is not always THE price. Real example that this list
// exists for: velaro-homes' description mentions "a furniture package available
// from €45,000 plus VAT" — a genuine, correct figure that has nothing to do
// with the from-price, and would otherwise be reported as a €930,000 error.
// This is a heuristic, not a proof: it kills the class of false positive we
// have actually seen, and the Action Center's snooze is the escape hatch for
// any it misses. Matched against the text shortly before the amount.
//
// The LEADING boundary is load-bearing. Without it "rent" matches inside
// "cur|rent|ly", which silently suppressed a real finding: :glow advertised
// "prices currently starting from €320,000" against a live €316,000 and the
// rule stayed quiet about it. It also stops "vat" matching inside "pri|vat|e".
//
// There is deliberately NO trailing boundary. These words compound and inflect:
// German "Möbelpaket", Polish "pakiet mebli", Russian "пакет мебели" — a
// trailing boundary blocks every one of them, and velaro-homes' furniture
// package (the false positive this list exists for) came back in three of its
// four languages the moment one was added.
//
// \b would not do — it is ASCII-only, and half these words are Cyrillic; the
// \p{L} escape is not available either (this project's tsconfig sets no target,
// so the /u flag is rejected), hence the explicit letter class below, which
// covers Latin, the German/Polish diacritics and Cyrillic.
const LETTER = "A-Za-zÀ-ÖØ-öø-ÿĀ-ſА-Яа-яЁё";
const NOT_A_FROM_PRICE = new RegExp(
  `(?<![${LETTER}])(furniture|package|paket|pakiet|möbel|mebl|мебел|пакет|vat|mwst|deposit|anzahlung|reservation|reservierung|fee|geb[üu]hr|op[łl]at|сбор|взнос|per (month|year)|pro (monat|jahr)|monthly|rent|miete|najem|аренд)`,
  "i",
);

const num = (s: string) => Number(String(s).replace(/[^\d]/g, ""));
const fmt = (n: number) => `€${n.toLocaleString("en-US")}`;
const tidy = (s: string) => s.replace(/\s+/g, " ").trim();
const contextAround = (text: string, index: number, span = 60) =>
  tidy(text.slice(Math.max(0, index - span), Math.min(text.length, index + span)));

/**
 * Scan one stored field. `livePrice` is the price the PAGE shows (already run
 * through resolveDevelopmentPrice), not the raw Development.priceFrom column —
 * the point is to compare against what a visitor actually reads.
 */
function scanField(
  text: string,
  livePrice: number | null,
  available: number,
  listed: number,
  publicName: string,
): Array<Pick<StaleFigure, "kind" | "said" | "value" | "live" | "context">> {
  const out: Array<Pick<StaleFigure, "kind" | "said" | "value" | "live" | "context">> = [];
  if (!text || !text.trim()) return out;

  if (livePrice != null) {
    let m: RegExpExecArray | null;
    const re = new RegExp(MONEY.source, "g");
    while ((m = re.exec(text)) !== null) {
      const value = num(m[1] ?? m[2] ?? "");
      // Below €10,000 is never a Cyprus from-price — it's a fee, a deposit or a
      // furniture package, and comparing it would only generate noise.
      if (!value || value < 10_000 || value === livePrice) continue;
      if (NOT_A_FROM_PRICE.test(text.slice(Math.max(0, m.index - 70), m.index))) continue;
      out.push({ kind: "price", said: fmt(value), value, live: fmt(livePrice), context: contextAround(text, m.index) });
    }
  }

  let c: RegExpExecArray | null;
  const cre = new RegExp(COUNT.source, "gi");
  while ((c = cre.exec(text)) !== null) {
    const value = num(c[1]);
    // Either reading is legitimate — copy says "N available" or "N homes in
    // total" — so only flag a number that matches NEITHER.
    if (!value || value === available || value === listed) continue;
    // The digit may belong to the project's NAME rather than to a count.
    // "Abiete 2 apartments offer an exceptional living experience" reads as a
    // count of two and was reported as one; the development is called Abiete 2.
    // Same shape guards Glow 2, Avalon Gardens 2, Roseland Villas 1 and every
    // other numbered project. Checked by asking whether the word before the
    // number, plus the number, is part of the name.
    const beforeWord = text.slice(0, c.index).match(new RegExp(`([${LETTER}0-9'’-]+)\\s*$`))?.[1];
    if (beforeWord && publicName.toLowerCase().includes(`${beforeWord.toLowerCase()} ${value}`)) continue;
    out.push({
      kind: "count",
      said: tidy(c[0]),
      value,
      live: `${available} available / ${listed} listed`,
      context: contextAround(text, c.index),
    });
  }
  return out;
}

/**
 * Every published development whose stored copy contradicts its live data.
 * Read-only; runs a single query with the unit rows already needed for the
 * price/count resolution.
 */
export async function getStaleCopyFigures(): Promise<StaleFigure[]> {
  const devs = await prisma.development.findMany({
    where: { publishStatus: "published", supersedesProjects: { none: { status: "PUBLISHED" } }, slug: { not: null } },
    select: {
      id: true, slug: true, publicName: true, priceFrom: true, priceTo: true,
      override: {
        select: {
          seo: true, updatedAt: true,
          descriptionEN: true, descriptionDE: true, descriptionPL: true, descriptionRU: true,
        },
      },
      units: { select: { status: true, price: true } },
    },
  });

  const findings: StaleFigure[] = [];
  for (const d of devs) {
    const ov = d.override;
    if (!ov) continue;
    const listed = listedUnits(d.units);
    const available = listed.filter((u) => u.status === "available").length;
    const { priceFrom } = resolveDevelopmentPrice(d.priceFrom, d.priceTo, d.units);

    const seo = (ov.seo && typeof ov.seo === "object" ? ov.seo : {}) as Record<string, unknown>;
    const fields: Array<[string, string]> = [
      ...SEO_FIELDS.map((k) => [k, typeof seo[k] === "string" ? (seo[k] as string) : ""] as [string, string]),
      ...DESC_FIELDS.map((k) => [k, ov[k] ?? ""] as [string, string]),
    ];

    for (const [field, text] of fields) {
      for (const hit of scanField(text, priceFrom, available, listed.length, d.publicName)) {
        findings.push({
          developmentId: d.id,
          slug: d.slug as string,
          publicName: d.publicName,
          field,
          updatedAt: ov.updatedAt,
          ...hit,
        });
      }
    }
  }
  return findings;
}

/**
 * One finding per development + kind, since a wrong price is invariably wrong in
 * all four languages at once and eight near-identical rows would drown the
 * Action Center. `fields` names every field that carries it.
 */
export type StaleCopyGroup = {
  developmentId: string;
  slug: string;
  publicName: string;
  kind: "price" | "count";
  said: string;
  value: number;
  live: string;
  context: string;
  fields: string[];
  updatedAt: Date;
};

export function groupStaleFigures(findings: StaleFigure[]): StaleCopyGroup[] {
  const byKey = new Map<string, StaleCopyGroup>();
  for (const f of findings) {
    // Keyed on the NUMBER, not on `said`: one wrong count appears as "11 units",
    // "11 Einheiten", "11 lokali" and "11 квартир" across the eight stored
    // fields, and keying on the matched text would file each as its own item —
    // 74 items for the 20 developments that actually have a problem. The number
    // is still part of the key so that editing the copy to a DIFFERENT wrong
    // number produces a new item rather than silently inheriting a snooze.
    const key = `${f.developmentId}:${f.kind}:${f.value}`;
    const existing = byKey.get(key);
    if (existing) { if (!existing.fields.includes(f.field)) existing.fields.push(f.field); }
    else byKey.set(key, { ...f, fields: [f.field] });
  }
  return Array.from(byKey.values());
}
