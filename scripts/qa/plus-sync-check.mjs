#!/usr/bin/env node
/* Guard for the Plus Properties sync helpers (src/lib/plusPropertiesSync.ts).
   Run: node scripts/qa/plus-sync-check.mjs */
import { writeFileSync, mkdirSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";

let build;
try { ({ build } = await import("esbuild")); }
catch { console.error("esbuild is not installed (it is only a transitive dependency)."); process.exit(2); }
/* plusPropertiesSync imports @/lib/prisma, which constructs a PrismaClient at
   load. Nothing here queries; the constructor only needs a URL. .env.local is
   the LIVE database — never let this script read it. */
process.env.DATABASE_URL = "postgresql://unused:unused@127.0.0.1:1/unused";
const scratch = join(process.cwd(), "node_modules", ".plus-sync-check");
mkdirSync(scratch, { recursive: true });
process.on("exit", () => rmSync(scratch, { recursive: true, force: true }));
const out = await build({ entryPoints: ["src/lib/plusPropertiesSync.ts"], bundle: true, platform: "node", format: "esm", write: false,
  external: ["@prisma/client", ".prisma/client/default", "@anthropic-ai/sdk", "canvas", "sharp"],
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" } });
writeFileSync(join(scratch, "s.mjs"), out.outputFiles[0].text);
const S = await import(join(scratch, "s.mjs"));

let failures = 0;
const check = (name, actual, expected) => {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { console.log(`  ok   ${name}`); return; }
  failures++;
  console.log(`  FAIL ${name}\n       expected ${e}\n       actual   ${a}`);
};

/* ── identity ─────────────────────────────────────────────────────────────
   The key is the project NUMBER. File names change with every version; the
   media folders spell the same number differently. */
const K = S.projectKey;
check("price list", K("Plus 33 Universal - Paphos - Price List   2.41.xml"), "33");
check("media folder", K("Plus 33 (Universal)"), "33");
check("underscored group", K("Plus 67_68_69 Parekklisia - Limassol - Price List  3.3.xml"), "67-68-69");
check("…and its folder", K("Plus 67-68-69 (Parekklisia)"), "67-68-69");
check("hyphen pair", K("Plus 70-71 Era Area - Larnaca -Price List  5.5.xml"), "70-71");
/* "PLUS 4 - 502 Penthouse": the 502 is a unit number, not a joined project. */
check("a spaced dash never joins a unit number", K("PLUS 4 - 502 Penthouse"), "4");
check("no space after Plus", K("Plus 1(Glyfada)"), "1");
check("the house", K("House Kiti- Price List  1.2.xml"), "house-kiti");
check("unrelated file", K("Readme.docx"), null);
check("public names", [S.publicNameFor("33"), S.publicNameFor("67-68-69"), S.publicNameFor("house-kiti")], ["Plus 33", "Plus 67-68-69", "House Kiti"]);
check("feed key", S.feedKeyFor("33"), "plusproperties:33");
check("slug candidate, as publish would mint it", [S.slugCandidate("Plus 33"), S.slugCandidate("Plus 67-68-69")], ["plus-33", "plus-67-68-69"]);
check("location: town and district", S.splitLocation("Universal - Paphos"), { town: "Universal", district: "Paphos" });
check("location: en dash", S.splitLocation("Livadia – Larnaca"), { town: "Livadia", district: "Larnaca" });
check("location: district only", S.splitLocation("Larnaca"), { town: null, district: "Larnaca" });
/* Plus 60 writes it with no spaces; the district is after the LAST dash. */
check("location: no spaces round the dash", S.splitLocation("Agios Tychonas-Limassol"), { town: "Agios Tychonas", district: "Limassol" });

/* ── coordinates from the resolved Maps link ─────────────────────────────
   The pin (!3d/!4d) wins over the viewport centre (@lat,lng) — they differ. */
const P33 = "https://www.google.com/maps/place/Plus+33+Residence/@34.7626655,32.4289652,17z/data=!3m1!4b1!4m5!3m4!1s0x14e7073a5d7a1f6d:0x7f3107e95284c35b!8m2!3d34.7626611!4d32.4311539?shorturl=1";
check("pin coordinates", S.coordsFromMapsUrl(P33), { lat: 34.7626611, lng: 32.4311539 });
check("viewport as fallback", S.coordsFromMapsUrl("https://www.google.com/maps/@34.9,33.6,15z"), { lat: 34.9, lng: 33.6 });
check("?q= form", S.coordsFromMapsUrl("https://maps.google.com/?q=34.95,33.62"), { lat: 34.95, lng: 33.62 });
check("outside Cyprus is rejected", S.coordsFromMapsUrl("https://www.google.com/maps/@37.9,23.7,15z"), null);
check("no link", S.coordsFromMapsUrl(null), null);

/* ── Project Details from their website ──────────────────────────────── */
const d = S.projectDetails(readFileSync("scripts/qa/fixtures/plus/plus-33-page.html", "utf8"));
check("facts read from the list", d.facts.length, 9);
check("…in order", [d.facts[0], d.facts[4]], ["Luxurious Design", "Common Swimming Pool"]);
check("energy class pulled out", d.energy, "A");
check("…and not repeated as a fact", d.facts.some((f) => /energy/i.test(f)), false);
check("a page without the block yields nothing", S.projectDetails("<html><body><p>Hello</p></body></html>"), { facts: [], energy: null });
/* "Solar Energy Panels" also matches /energy/i but is not the class line;
   only the fact ending in a letter grade is the energy fact. */
const dSolar = S.projectDetails('<div><p><strong>Project Details:</strong></p><ul><li>Solar Energy Panels</li><li>Energy Efficiency Category: B</li></ul></div>');
check("an amenity that mentions 'energy' is not mistaken for the class line", dSolar.energy, "B");
check("…and it stays in facts, not swallowed as the energy fact", dSolar.facts, ["Solar Energy Panels"]);
/* Some pages put the <ul> directly after the <strong>, with no wrapping <p>. */
const dNoP = S.projectDetails('<div><strong>Project Details:</strong><ul><li>Fact One</li><li>Fact Two</li></ul></div>');
check("no wrapping <p>: the <ul> follows the <strong> directly", dNoP.facts, ["Fact One", "Fact Two"]);
const df = S.detailFields({ facts: ["Common Swimming Pool", "Completion: Q4 2027", "6 minutes from the Beach"], energy: "A" });
check("facts become the raw description, one per line", df.description, "Common Swimming Pool\nCompletion: Q4 2027\n6 minutes from the Beach");
check("plain facts are amenities", df.amenities, ["Common Swimming Pool", "6 minutes from the Beach"]);
check("'Label: value' facts are extra facts", df.extraFacts, [{ label: "Completion", value: "Q4 2027" }]);
check("energy class", df.energy, "A");
check("nothing read, nothing written", S.detailFields(null), {});

/* ── completeness, per project ───────────────────────────────────────────
   Plus projects hold 4 to 63 units; the feeds' floor of 20 would never fire. */
const sts = (...s) => s.map((status) => ({ status }));
check("a small project losing most units is blocked",
  S.unitsDecision({ published: false, stored: sts("available", "available", "available", "available", "sold", "sold"), fresh: sts("available", "sold") }).blocked, true);
check("…losing exactly 3 is not (the floor is strict)",
  S.unitsDecision({ published: false, stored: sts("available", "available", "available", "sold", "sold", "sold"), fresh: sts("sold", "sold", "sold") }).blocked, false);
check("published: sold units do not count",
  S.unitsDecision({ published: true, stored: sts("sold", "sold", "sold", "sold", "sold", "available"), fresh: sts("available") }).blocked, false);
check("unlisted stored units never count",
  S.unitsDecision({ published: true, stored: sts("unlisted", "unlisted", "unlisted", "unlisted", "unlisted", "available"), fresh: sts("available") }).blocked, false);
check("a first sync is never blocked", S.unitsDecision({ published: false, stored: [], fresh: sts("available") }).blocked, false);
check("the message names the numbers",
  /4 of 6 units/.test(S.unitsDecision({ published: false, stored: sts("available", "available", "available", "available", "available", "available"), fresh: sts("available", "available") }).message ?? ""), true);

check("run verdict: most requests failed", S.runVerdict({ attempted: 40, failed: 21 }).ok, false);
check("run verdict: half is not most", S.runVerdict({ attempted: 40, failed: 20 }).ok, true);
check("run verdict: nothing attempted", S.runVerdict({ attempted: 0, failed: 0 }).ok, true);

/* ── unit rows ─────────────────────────────────────────────────────────── */
const u = { ref: "A101", label: "A101", block: null, floor: "First Floor", beds: "2", baths: "2", parking: "Covered", storage: "1",
  areaBuilt: 78, areaVeranda: 35, areaVerandaOpen: null, areaRoof: null, areaGarden: null, areaCommon: 12, areaTotal: 125, areaPlot: null,
  status: "available", price: 350000 };
const row = S.unitRow(u, "dev1", 0);
check("the public table's area field is filled", [row.areaBuilt, row.areaInternal, row.areaVeranda], ["78", "78", "35"]);
check("storage is the yes/no column", row.storage, "yes");
check("'1 Roof' is a storage room (Plus 87)", S.unitRow({ ...u, storage: "1 Roof" }, "d", 0).storage, "yes");
check("'0' is none", S.unitRow({ ...u, storage: "0" }, "d", 0).storage, "no");
check("counts and extra areas go to attrs",
  row.attrs, [{ name: "Parking", value: "Covered" }, { name: "Storage", value: "1" }, { name: "Common area (m²)", value: "12" }, { name: "Total area (m²)", value: "125" }]);
check("identity", [row.ref, row.feedRef, row.source, row.developmentId], ["A101", "A101", "feed", "dev1"]);
check("a sold unit never carries a price, even if handed one", S.unitRow({ ...u, status: "sold" }, "d", 0).price, null);
const kept = { type: "Penthouse", photos: ["/x.webp"], plans: null, price: 1, status: "sold", areaBuilt: "999" };
const withKept = S.unitRow(u, "d", 0, kept);
check("a hand-set type survives", withKept.type, "Penthouse");
check("hand-set photos survive", withKept.photos, ["/x.webp"]);
check("…but the sheet owns price, status and areas", [withKept.price, withKept.status, withKept.areaBuilt], [350000, "available", "78"]);
check("nulls are not carried", "plans" in withKept, false);

console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
