/* The project-content checklist, as a check that runs.
 *
 *   node scripts/manual-sync/content-checklist-audit.mjs scripts/data/<dev>/content/*.json
 *
 * Each file is { slug, name, short: {en,de,pl,ru}, long: {en,de,pl,ru} }. Written for the
 * DTA onboarding (2026-10-29) and meant to be reused for the next manual developer.
 *
 * It enforces the parts of the checklist a machine can see: three short-description
 * paragraphs within the length band, a long text of at least 3000 characters excluding
 * spaces, at least four H2s with the country named in one of them, at most two lists, no
 * developer name, no exact price, and the project's own name kept out of the short
 * description. Judgement calls — whether a heading survives a cold scan, whether a section
 * earns its place — stay with the writer.
 *
 * Two regex traps are baked in because both have cost real time on this project. JS \\b is
 * ASCII-only, so an anti-slogan check written as /а не\\b/ silently never matches Cyrillic;
 * every pattern here uses a \\p{L} lookaround with the u flag instead. The same applies to
 * \\w inside the Russian proper-noun whitelist, which is why it spells suffixes as \\p{L}*. */
import fs from "node:fs";
const LANGS = ["en", "de", "pl", "ru"];
const COUNTRY = { en: /\bcyprus\b/i, de: /\bzypern\b/i, pl: /\bcypr/i, ru: /кипр/i };
// \b is ASCII-only in JS, so a Cyrillic check needs a Unicode-aware boundary.
const SLOGAN = {
  en: /(?<!\p{L})(rather than|instead of|not just|but rather)(?!\p{L})/giu,
  de: /(?<!\p{L})(statt|anstatt|nicht nur|sondern)(?!\p{L})/giu,
  pl: /(?<!\p{L})(a nie|zamiast|nie tylko|lecz)(?!\p{L})/giu,
  ru: /(?<!\p{L})(а не|вместо|не просто|а вот)(?!\p{L})/giu,
};
const BANNED = /\bDTA\b|dtagroup|DTA Group|Developing What Matters/i;
const noSpace = (s) => s.replace(/\s/g, "").length;
const TITLE = { en: true, de: true, pl: true, ru: false }; // RU headings use sentence case

let bad = 0;
for (const file of process.argv.slice(2)) {
  const d = JSON.parse(fs.readFileSync(file, "utf8"));
  console.log(`\n===== ${d.slug} =====`);
  for (const L of LANGS) {
    const short = d.short[L], long = d.long[L];
    const out = [];
    const sParas = short.split(/\n\n+/).filter(Boolean);
    if (sParas.length !== 3) out.push(`short: ${sParas.length} paragraphs, want 3`);
    const sLen = short.length;
    if (sLen < 900 || sLen > 1600) out.push(`short: ${sLen} chars, want ~1000-1500`);
    const h2 = [...long.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
    const body = long.replace(/^## .+$/gm, "");
    const bLen = noSpace(body);
    if (bLen < 3000) out.push(`long: ${bLen} chars excl. spaces, want >=3000`);
    if (h2.length < 4) out.push(`long: ${h2.length} headings`);
    if (!COUNTRY[L].test(h2.join(" "))) out.push(`long: no heading names the country`);
    const lists = (long.match(/^[-*] /gm) || []).length;
    const listBlocks = (long.match(/(?:^[-*] .+\n)+/gm) || []).length;
    if (listBlocks > 2) out.push(`long: ${listBlocks} lists, max 2`);
    for (const [name, text] of [["short", short], ["long", long]]) {
      const sl = [...text.matchAll(SLOGAN[L])].map((m) => m[0]);
      if (sl.length) out.push(`${name}: anti-slogan hits ${JSON.stringify(sl)}`);
      if (BANNED.test(text)) out.push(`${name}: names the developer`);
      if (new RegExp(`\\b${d.name.split(" ")[0]}\\b`, "i").test(short) && name === "short")
        out.push(`short: names the project ("${d.name.split(" ")[0]}")`);
    }
    if (/[€]\s?\d|\d[\d,.]*\s?(EUR|€)/.test(short + long)) out.push("exact price in the copy");
    // RU headings are sentence case: only the first word and genuine proper nouns
    // are capitalised. The whitelist is the place names and the energy grade that
    // legitimately carry a capital inside a heading.
    const RU_PROPER = /^(Кипр\p{L}*|Лимасол\p{L}*|Гермасой\p{L}*|Эрими\p{L}*|Куриона|Курион\p{L}*|Суни|Айос[-\p{L}]*|Тихонас\p{L}*|Потамос[-\p{L}]*|Старого|Старый|Порт\p{L}*|ONLY|iHOME|Level|Luma|Alti|Mandarin|Athina|А|DTA)$/u;
    if (L === "ru") for (const h of h2) {
      const words = h.split(/[\s,:]+/).slice(1).filter((w) => /^[А-ЯЁ]/.test(w) && !RU_PROPER.test(w));
      if (words.length) out.push(`ru heading Title Case: "${h}" (${words.join(", ")})`);
    }
    const label = out.length ? "FAIL" : "ok  ";
    console.log(`  ${L.toUpperCase()} ${label} short ${sLen}  long ${bLen} excl.sp  h2 ${h2.length}  lists ${listBlocks}`);
    for (const o of out) { console.log(`       - ${o}`); bad++; }
  }
}
console.log(bad ? `\n${bad} problems` : "\nall checks pass");
process.exit(bad ? 1 : 0);
