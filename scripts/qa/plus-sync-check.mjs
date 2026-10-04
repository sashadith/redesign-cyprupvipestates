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
/* The "Location:" footers of all 32 lists, 2026-09-26. The district is the
   last part that is one of the site's five districts, in the site's spelling;
   anything else is left for the admin (no town→district map exists in src/lib). */
check("location: Platy - Nicosia", S.splitLocation("Platy - Nicosia"), { town: "Platy", district: "Nicosia" });
check("location: a street address before a comma is no town (Plus 92)",
  S.splitLocation("Georgiou Griva Digeni 29, Larnaca"), { town: null, district: "Larnaca" });
check("location: a town alone, no district (Plus 85)", S.splitLocation("Lefkara"), { town: "Lefkara", district: null });
check("location: a street alone is neither town nor district", S.splitLocation("Makariou Avenue 12"), { town: null, district: null });
check("location: an unknown last part is never a district", S.splitLocation("Universal - Tala"), { town: null, district: null });
check("location: the district is matched case-insensitively, stored in the site's spelling",
  S.splitLocation("kiti, LARNACA"), { town: "kiti", district: "Larnaca" });
check("location: a part that only CONTAINS a district name is not one", S.splitLocation("Paphos Gate - Limassol"), { town: "Paphos Gate", district: "Limassol" });
check("location: the district is the LAST known district", S.splitLocation("Paphos - Limassol"), { town: "Paphos", district: "Limassol" });
check("location: a long single part is not a town", S.splitLocation("Near The Old Town Square"), { town: null, district: null });
/* Review: a bare hyphen inside a place name is not a separator. A dash
   separates only with whitespace on at least one side, or when what follows
   it is a known district ("Agios Tychonas-Limassol"). */
check("location: a hyphenated town keeps its hyphen", S.splitLocation("Kato-Polemidia - Limassol"), { town: "Kato-Polemidia", district: "Limassol" });
check("location: a hyphenated town alone, no district", S.splitLocation("Pyla-Voroklini"), { town: "Pyla-Voroklini", district: null });
check("location: a bare hyphen before a district still separates, any case", S.splitLocation("Agios Tychonas-limassol"), { town: "Agios Tychonas", district: "Limassol" });
check("location: a dash with whitespace on one side separates",
  [S.splitLocation("Universal -Tala"), S.splitLocation("Universal- Tala")], [{ town: null, district: null }, { town: null, district: null }]);
check("location: en and em dashes separate even without spaces",
  [S.splitLocation("Livadia–Larnaca"), S.splitLocation("Pyla—Voroklini")], [{ town: "Livadia", district: "Larnaca" }, { town: null, district: null }]);
check("location: a comma separates without spaces", S.splitLocation("Pyla,Voroklini"), { town: null, district: null });
check("location note: a hyphenated town alone asks for its district",
  S.locationNote({ key: "70-71", location: "Pyla-Voroklini", storedDistrict: null }), '70-71: district unknown for location "Pyla-Voroklini" — set it in the admin');
check("location: empty", [S.splitLocation(null), S.splitLocation("  ")], [{ town: null, district: null }, { town: null, district: null }]);
const LN = (o) => S.locationNote({ key: "85", location: "Lefkara", storedDistrict: null, ...o });
check("location note: district unknown", LN({}), '85: district unknown for location "Lefkara" — set it in the admin');
check("location note: none once the admin has set a district", LN({ storedDistrict: "Larnaca" }), null);
/* Before this fix the whole footer was stored as the district (Plus 85 holds
   "Lefkara"). That is the old parser's output, not an admin's choice, and a
   null is never written over it, so the note must keep asking. */
check("location note: a stored district that is only the footer copied still asks",
  [LN({ storedDistrict: "Lefkara" }), LN({ storedDistrict: " lefkara " })],
  ['85: district unknown for location "Lefkara" — set it in the admin', '85: district unknown for location "Lefkara" — set it in the admin']);
check("location note: none when the district is known", LN({ location: "Livadia – Larnaca" }), null);
check("location note: none without a location", LN({ location: null }), null);
check("location note: a street-only footer is named as written", LN({ location: " Makariou Avenue 12 " }), '85: district unknown for location "Makariou Avenue 12" — set it in the admin');

/* ── coordinates from the resolved Maps link ─────────────────────────────
   The pin (!3d/!4d) wins over the viewport centre (@lat,lng) — they differ. */
const P33 = "https://www.google.com/maps/place/Plus+33+Residence/@34.7626655,32.4289652,17z/data=!3m1!4b1!4m5!3m4!1s0x14e7073a5d7a1f6d:0x7f3107e95284c35b!8m2!3d34.7626611!4d32.4311539?shorturl=1";
check("pin coordinates", S.coordsFromMapsUrl(P33), { lat: 34.7626611, lng: 32.4311539 });
check("viewport as fallback", S.coordsFromMapsUrl("https://www.google.com/maps/@34.9,33.6,15z"), { lat: 34.9, lng: 33.6 });
check("?q= form", S.coordsFromMapsUrl("https://maps.google.com/?q=34.95,33.62"), { lat: 34.95, lng: 33.62 });
check("outside Cyprus is rejected", S.coordsFromMapsUrl("https://www.google.com/maps/@37.9,23.7,15z"), null);
check("no link", S.coordsFromMapsUrl(null), null);
/* M5: a resolved link can arrive percent-encoded ("%21" for "!", "%2C" for
   ","), which hides the pin from every pattern above. */
check("an encoded pin is read", S.coordsFromMapsUrl("https://www.google.com/maps/place/X/data=%213d34.7626611%214d32.4311539"), { lat: 34.7626611, lng: 32.4311539 });
check("an encoded ?q= pair is read", S.coordsFromMapsUrl("https://maps.google.com/?q=34.95%2C33.62"), { lat: 34.95, lng: 33.62 });
check("a malformed escape does not throw, the raw link is still read", S.coordsFromMapsUrl("https://www.google.com/maps/@34.9,33.6,15z?x=%E0%A4%A"), { lat: 34.9, lng: 33.6 });
/* Dry run 2026-09-26: two short links resolve to a /maps/search/<lat>,<lng>
   URL with no pin, no q= and no @ (Plus 82, House Kiti). */
check("/maps/search/ with '+' (Plus 82)",
  S.coordsFromMapsUrl("https://www.google.com/maps/search/34.916252,+33.634789?entry=tts&g_ep=EgoyMDI1MDkyMy4wIPu8ASoASAFQAw%3D%3D&skid=abc"), { lat: 34.916252, lng: 33.634789 });
check("/maps/search/ with '+' (House Kiti)",
  S.coordsFromMapsUrl("https://www.google.com/maps/search/34.837319,+33.576316?coh=225991&entry=tts"), { lat: 34.837319, lng: 33.576316 });
check("/maps/search/ without '+'", S.coordsFromMapsUrl("https://www.google.com/maps/search/34.916252,33.634789"), { lat: 34.916252, lng: 33.634789 });
check("/maps/search/ percent-encoded (%2C%20)", S.coordsFromMapsUrl("https://www.google.com/maps/search/34.916252%2C%2033.634789?entry=tts"), { lat: 34.916252, lng: 33.634789 });
check("/maps/search/ percent-encoded (%2C+)", S.coordsFromMapsUrl("https://www.google.com/maps/search/34.916252%2C+33.634789"), { lat: 34.916252, lng: 33.634789 });
check("/maps/search/ outside Cyprus is still rejected", S.coordsFromMapsUrl("https://www.google.com/maps/search/37.9,+23.7"), null);
check("/maps/search/ south of Cyprus is rejected too", S.coordsFromMapsUrl("https://www.google.com/maps/search/31.2,+33.0"), null);
check("the pin still wins over /maps/search/",
  S.coordsFromMapsUrl("https://www.google.com/maps/search/34.9,+33.6/data=!3d34.7626611!4d32.4311539"), { lat: 34.7626611, lng: 32.4311539 });
check("/maps/search/ wins over the viewport centre",
  S.coordsFromMapsUrl("https://www.google.com/maps/search/34.916252,+33.634789/@34.95,33.70,15z"), { lat: 34.916252, lng: 33.634789 });
/* Plus 87 resolves to a Plus Code, not coordinates. It is not decoded. */
const P87 = "https://www.google.com/maps?q=WJPP+7FG+Plus+87,+New+Marina+Larnaca,+Larnaca&ftid=0x14e0831d4f8a1b2f:0x3c1b7e3ad4e5b6a1";
check("a Plus Code link yields no coordinates", S.coordsFromMapsUrl(P87), null);
/* Review M1: the note must not repeat every night once a pin is stored —
   the connector's own (Development) or the one an admin set
   (DevelopmentOverride, which is where the admin's map-location save writes).
   A link that could not be fetched at all says so in its own words. */
const MN = (o) => S.mapsLinkNote({ key: "87", mapsUrl: P87, resolved: true, coords: null, storedPin: false, ...o });
check("a resolved Maps link without coordinates, no stored pin: the note", MN({}), "87: no coordinates in the Maps link — set the pin in the admin");
check("…a stored pin silences it", MN({ storedPin: true }), null);
check("…read coordinates leave none", MN({ coords: { lat: 34.7626611, lng: 32.4311539 } }), null);
check("…no Maps link leaves none", MN({ mapsUrl: null, resolved: false }), null);
check("a link that could not be resolved has its own wording", MN({ resolved: false }), "87: Maps link could not be resolved this run");
check("…and a stored pin silences that too", MN({ resolved: false, storedPin: true }), null);
check("stored pin: the connector's own", S.hasStoredPin({ latitude: 34.9, longitude: 33.6, override: null }), true);
check("stored pin: the admin's override", S.hasStoredPin({ latitude: null, longitude: null, override: { latitude: 34.9, longitude: 33.6 } }), true);
check("stored pin: half a pin is none", S.hasStoredPin({ latitude: 34.9, longitude: null, override: { latitude: null, longitude: 33.6 } }), false);
check("stored pin: a project not stored yet has none", S.hasStoredPin(undefined), false);

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
/* (a) is unchanged by the line layouts below: the whole list, exactly. */
check("(a) Plus 33: the whole list, exactly", d, { facts: [
  "Luxurious Design", "4-Floors Building", "2-Bedroom Apartments", "2-Bedroom Penthouse with Large Terrace",
  "Common Swimming Pool", "6 minutes from the Beach", "Strategical Location", "Facing Universal Elementary School",
  "4 minutes from AUB - Paphos Campus",
], energy: "A" });
/* Dry run 2026-09-26: two more layouts on the developer's site.
   (b) Plus 87: the label, then sibling <p>s that each start with ". ". The
   five lines are the whole block; the empty <p>&nbsp;</p> after them ends it. */
const d87 = S.projectDetails(readFileSync("scripts/qa/fixtures/plus/plus-87-page.html", "utf8"));
check("(b) Plus 87: the '. ' lines after the label, exactly", d87, { facts: [
  "1, 2 & 3 Bedroom Apartments",
  "Apartments with Roof Terraces",
  "Ideal for Rental",
  "Few Meters from the New Marina & Port",
  "Proximity to the City Center",
], energy: null });
/* (c) Plus 60: no label. The facts are the '. ' lines of the <div> right
   before div.downloadBtns; the last one wraps onto a <p> that starts with a
   non-breaking space. Nine facts; the OVERVIEW & LIFESTYLE prose is not read. */
const d60 = S.projectDetails(readFileSync("scripts/qa/fixtures/plus/plus-60-page.html", "utf8"));
check("(c) Plus 60: the '. ' lines of the div before the buttons, exactly", d60, { facts: [
  "5 Luxurious Villas",
  "4-Bedroom Villas",
  "Private Gardens",
  "Roof Terraces",
  "Optional Private Pool",
  "Calm & Green Surrounding",
  "2 minutes from the Highway",
  "3 minutes from the Beach",
  "3 minutes from Amathus, Mediterranean & Four Seasons Hotels",
], energy: null });
check("(c) …the overview prose is never read", d60.facts.some((f) => /agios tychonas|luxury experience|units remaining/i.test(f)), false);
/* Captured 2026-09-26: four more pages, all read in the <div> right before
   div.downloadBtns, all yielding nothing before this change.
   (d) Plus 88: an unbolded label ("<p><u>Project Details</u></p>", no colon),
   then eight "•" lines, then empty <p>&nbsp;</p>s. */
const d88 = S.projectDetails(readFileSync("scripts/qa/fixtures/plus/plus-88-page.html", "utf8"));
check("(d) Plus 88: the '•' lines after an unbolded label, exactly", d88, { facts: [
  "2 Blocks",
  "1 & 2 Bedroom Apartments",
  "Apartments with Large Terraces",
  "Facing Metro Supermarket",
  "2 minutes from American Academy Larnaca",
  "4 minutes from Ermou Street",
  "5 minutes from Finikoudes Beach",
  "Ideal For Rent",
], energy: null });
check("(d) Plus 88: the overview prose is never read", d88.facts.some((f) => /downtown|prelaunch|heart of the city/i.test(f)), false);
/* (e) Plus 56: no label; the box opens with a <ul> of six <li>s, the last
   the energy class. */
const d56 = S.projectDetails(readFileSync("scripts/qa/fixtures/plus/plus-56-page.html", "utf8"));
check("(e) Plus 56: the unlabelled <ul> before the buttons, exactly", d56, { facts: [
  "High-End Residential Project",
  "Two-Floor Building",
  "2 & 3 Bedroom Apartments",
  "200 meters from Franco Cypriot School",
  "Fast & Easy Access to Public Services",
], energy: "A" });
check("(e) Plus 56: the overview prose is never read", d56.facts.some((f) => /beautifully designed|perfectly adequate/i.test(f)), false);
/* (e) Plus 79: the same layout, three <li>s. The page does have facts. */
const d79 = S.projectDetails(readFileSync("scripts/qa/fixtures/plus/plus-79-page.html", "utf8"));
check("(e) Plus 79: the unlabelled <ul> before the buttons, exactly", d79, { facts: [
  "1 & 2 Bedroom Apartments",
  "Apartments with Roof Terraces",
  "Few minutes from the New Marina & Port",
], energy: null });
/* (f) Plus 67-68-69: the label in a <span> ("Project Details:"), an empty
   <p>&nbsp;</p>, the first ". " line, another empty <p>, six more ". " lines
   (each wrapped in <span>s), then empty <p>s and two video <p>s. */
const d67 = S.projectDetails(readFileSync("scripts/qa/fixtures/plus/plus-67-68-69-page.html", "utf8"));
check("(f) Plus 67-68-69: the '. ' lines across empty <p>s, exactly", d67, { facts: [
  "Quiet & Residential Area",
  "3 Buildings",
  "1, 2 & 3 Bedroom Apartments",
  "Penthouses with Roof Terraces",
  "3 minutes from the Highway",
  "6 minutes from the Beach",
  "10 minutes from Amathus Beach Hotel",
], energy: null });
check("(f) Plus 67-68-69: the overview prose is never read", d67.facts.some((f) => /parekklisia|luxurious project|ideal for rental/i.test(f)), false);
/* The line rule on synthetic pages: all three markers, a continuation, the
   energy line pulled out as for a list, and a stop at the first other element. */
const dLines = S.projectDetails('<div><p><strong>Project Details:</strong></p><p>. One &amp; a half</p><p>&nbsp; wrapped</p><p>• Two</p><p>- Three</p><p>. Energy Efficiency Category: B</p><h3>Other</h3><p>. Not this</p></div>');
check("(b) markers '.', '•', '-'; a continuation joins its fact; stops at the first other element", dLines, { facts: ["One & a half wrapped", "Two", "Three"], energy: "B" });
check("(b) the label's own <strong> sibling, no wrapping <p>",
  S.projectDetails('<div><strong>Project Details:</strong><p>. Alpha</p><p>. Beta</p></div>').facts, ["Alpha", "Beta"]);
check("(b) the lines win over a later, unrelated <ul> in the same box",
  S.projectDetails('<div><p><strong>Project Details:</strong></p><p>. Alpha</p><p>. Beta</p><p>&nbsp;</p><ul><li>Menu item</li></ul></div>').facts, ["Alpha", "Beta"]);
check("(b) a bare marker with nothing after it ends the block",
  S.projectDetails('<div><p><strong>Project Details:</strong></p><p>. Alpha</p><p>.&nbsp;</p><p>. Beta</p></div>').facts, ["Alpha"]);
/* Review I1: only a line whose raw text starts with a non-breaking space is
   a wrapped fact. Any other unmarked line ends the list and is not glued on. */
check("(b) an unmarked prose line after the facts ends the list, it is not glued on",
  S.projectDetails('<div><p><strong>Project Details:</strong></p><p>. Alpha</p><p>. Beta</p><p>Contact us today for a viewing.</p><p>. Gamma</p></div>'),
  { facts: ["Alpha", "Beta"], energy: null });
check("(b) an unmarked energy line is not read, and does not swallow the fact before it",
  S.projectDetails('<div><p><strong>Project Details:</strong></p><p>. Alpha</p><p>. Beta</p><p>Energy Efficiency Category: A</p></div>'),
  { facts: ["Alpha", "Beta"], energy: null });
check("(c) the same rule in the box before the buttons",
  S.projectDetails('<section><div><p>. First</p><p>. Second</p><p>Call us today.</p></div><div class="downloadBtns"></div></section>').facts, ["First", "Second"]);
check("(b) leading ordinary whitespace is not a wrap marker",
  S.projectDetails('<div><p><strong>Project Details:</strong></p><p>. Alpha</p><p>\n  Contact us today.</p></div>').facts, ["Alpha"]);
check("(b) a U+00A0 character (not only &nbsp;) also marks a wrapped line",
  S.projectDetails('<div><p><strong>Project Details:</strong></p><p>. Alpha and</p><p>\u00a0Omega</p></div>').facts, ["Alpha and Omega"]);
check("(b) a text line before any fact is not a continuation: nothing is read",
  S.projectDetails('<div><p><strong>Project Details:</strong></p><p>Some prose</p><p>. Late fact</p></div>'), { facts: [], energy: null });
const btns = (inner) => `<section><h1>OVERVIEW &amp; LIFESTYLE</h1><p>. Prose that looks like a line</p><p>. And another</p></section><section><div>${inner}</div><div class="downloadBtns"><input type="button" value="Brochure"></div></section>`;
check("(c) a single marker line before the buttons is not a block", S.projectDetails(btns("<p>. Only one</p><p>&nbsp;</p>")), { facts: [], energy: null });
check("(c) two marker lines are", S.projectDetails(btns("<p>. First</p><p>. Second</p>")).facts, ["First", "Second"]);
check("(c) only the div IMMEDIATELY before the buttons is read",
  S.projectDetails('<section><div><p>. First</p><p>. Second</p></div><p>between</p><div class="downloadBtns"></div></section>'), { facts: [], energy: null });
check("(c) the box before the buttons must be a <div>",
  S.projectDetails('<main><section><p>. First</p><p>. Second</p></section><div class="downloadBtns"></div></main>'), { facts: [], energy: null });
check("neither layout: nothing, even with a buttons div after prose",
  S.projectDetails(btns("<p>Welcome to the project.</p><p>Call us today.</p>")), { facts: [], energy: null });
/* The rules behind (d)-(f), on synthetic pages. */
check("(d) a label with a colon in a <span> is a label too",
  S.projectDetails(btns('<p><span>Project Details:</span></p><p>. Only one</p>')).facts, ["Only one"]);
check("(d) after a label one line is enough; without one it is not",
  [S.projectDetails(btns('<p>Project Details</p><p>• One</p>')).facts, S.projectDetails(btns('<p>• One</p>')).facts], [["One"], []]);
check("(d) a label that is not the Project Details label ends it",
  S.projectDetails(btns('<p>Features</p><p>. First</p><p>. Second</p>')), { facts: [], energy: null });
check("(e) an unlabelled <ul> opening the box is read, energy pulled out",
  S.projectDetails(btns('<ul><li>Alpha</li><li>Energy Efficiency Category: B</li></ul><p>&nbsp;</p>')), { facts: ["Alpha"], energy: "B" });
check("(e) …after a label as well",
  S.projectDetails(btns('<p><u>Project Details</u></p><p>&nbsp;</p><ul><li>Alpha</li><li>Beta</li></ul>')).facts, ["Alpha", "Beta"]);
check("(e) a <ul> after unmarked prose in the box is not read",
  S.projectDetails(btns('<p>Welcome to the project.</p><ul><li>Menu</li><li>Links</li></ul>')), { facts: [], energy: null });
check("(e) a <ul> is structure enough on its own: one <li> is read",
  S.projectDetails(btns("<ul><li>Only one</li></ul>")).facts, ["Only one"]);
check("(e) an empty <ul> is nothing",
  S.projectDetails(btns('<ul><li>&nbsp;</li></ul>')), { facts: [], energy: null });
check("(f) empty <p>s between marker lines do not end the block",
  S.projectDetails(btns('<p>. First</p><p><span>&nbsp;</span></p><p>&nbsp;</p><p>. Second</p><p>&nbsp;</p>')).facts, ["First", "Second"]);
check("(f) …but prose after them does, and is not read",
  S.projectDetails(btns('<p>. First</p><p>. Second</p><p>&nbsp;</p><p>Call us today.</p><p>. Third</p>')).facts, ["First", "Second"]);
check("(f) a line after an empty <p> is never a continuation, even with a leading nbsp",
  S.projectDetails(btns('<p>. First</p><p>. Second and</p><p>&nbsp;</p><p>&nbsp; more</p>')).facts, ["First", "Second and"]);
check("(f) empty <p>s before the first marker line are skipped",
  S.projectDetails(btns('<p>&nbsp;</p><p>. First</p><p>. Second</p>')).facts, ["First", "Second"]);
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
/* M4: Plus 21 writes "0" for no uncovered veranda and 0 common area. A zero
   area is no area, and a zero-valued fact is not a fact. */
const zero = S.unitRow({ ...u, areaBuilt: 0, areaVerandaOpen: 0, areaCommon: 0, parking: "0" }, "d", 0);
check("a zero area is written as null", [zero.areaBuilt, zero.areaInternal, zero.areaVerandaOpen], [null, null, null]);
check("a zero-valued attr is omitted", zero.attrs.map((a) => a.name), ["Storage", "Total area (m²)"]);

/* F1: an admin can rename a unit's ref (saveUnits rewrites ref, keeps feedRef
   and source), so the writer anchors on feedRef, as feedSync does. */
check("a stored unit is known by its feedRef, not its edited ref", S.storedUnitKey({ ref: "A01 (sea view)", feedRef: "A01" }), "A01");
check("…falling back to ref for a row without one", [S.storedUnitKey({ ref: "A01", feedRef: null }), S.storedUnitKey({ ref: "A01", feedRef: "" })], ["A01", "A01"]);
check("…and nothing for a row with neither", S.storedUnitKey({ ref: null, feedRef: null }), null);

/* F3: the media is re-mirrored whenever the signature has not advanced (one
   file failing every night), but the content-hashed URLs come back identical;
   only a real change may schedule a restart. */
check("sameList: same URLs, same order", S.sameList(["/a", "/b"], ["/a", "/b"]), true);
check("sameList: a new order is a change", S.sameList(["/b", "/a"], ["/a", "/b"]), false);
check("sameList: a different length is a change", S.sameList(["/a"], ["/a", "/b"]), false);
check("sameList: nothing stored yet is a change", [S.sameList(["/a"], null), S.sameList(["/a"], undefined)], [false, false]);
check("sameList: an empty or unwritten fresh list is never a change", [S.sameList([], ["/a"]), S.sameList(null, ["/a"])], [true, true]);

/* Open fix 1: an empty media listing (listFolder turns an HTTP error into [])
   must never wipe stored media. The signature alone cannot say "this project
   has media": after a partial media failure it is deliberately left null. */
const keepMedia = S.keepStoredMediaOnEmptyListing ?? (() => "helper not exported");
check("empty listing, no signature, a stored gallery: keep",
  keepMedia({ images: [], plans: [], storedSig: null, storedGallery: ["/a.webp"], storedPlans: null }), true);
check("empty listing, no signature, stored plans only: keep",
  keepMedia({ images: [], plans: [], storedSig: null, storedGallery: [], storedPlans: ["/p.webp"] }), true);
check("empty listing, a stored signature alone: keep (the case the guard always covered)",
  keepMedia({ images: [], plans: [], storedSig: "sig", storedGallery: null, storedPlans: null }), true);
check("empty listing, nothing stored: do not keep (a new, empty project writes nothing harmful)",
  [keepMedia({ images: [], plans: [], storedSig: null, storedGallery: null, storedPlans: null }),
   keepMedia({ images: [], plans: [], storedSig: undefined, storedGallery: undefined, storedPlans: undefined }),
   keepMedia({ images: [], plans: [], storedSig: "", storedGallery: [], storedPlans: [] })], [false, false, false]);
check("a stored value that is not a list is not stored media",
  keepMedia({ images: [], plans: [], storedSig: null, storedGallery: {}, storedPlans: "x" }), false);
check("a listing with images is never overridden",
  keepMedia({ images: [{ id: "i" }], plans: [], storedSig: "sig", storedGallery: ["/a.webp"], storedPlans: ["/p.webp"] }), false);
check("…nor one with plans only",
  keepMedia({ images: [], plans: [{ id: "p" }], storedSig: null, storedGallery: ["/a.webp"], storedPlans: null }), false);

/* Follow-up A: listFolder turns an HTTP error into [] per SUBFOLDER, so one
   list can come back empty while the other lists fine. Per list: an empty
   fresh list over a non-empty stored one keeps the stored one, and the
   signature is held so the next run retries. */
const partial = S.partialMediaListing ?? (() => "helper not exported");
check("no images listed, a stored gallery: keep the gallery, hold the signature",
  partial({ images: [], plans: [{ id: "p" }], storedGallery: ["/a.webp"], storedPlans: ["/p.webp"] }), { keepGallery: true, keepPlans: false, holdSig: true });
check("no plans listed, stored plans: keep the plans, hold the signature",
  partial({ images: [{ id: "i" }], plans: [], storedGallery: ["/a.webp"], storedPlans: ["/p.webp"] }), { keepGallery: false, keepPlans: true, holdSig: true });
check("both lists listed: written normally",
  partial({ images: [{ id: "i" }], plans: [{ id: "p" }], storedGallery: ["/a.webp"], storedPlans: ["/p.webp"] }), { keepGallery: false, keepPlans: false, holdSig: false });
check("nothing stored: written normally, whatever is empty",
  [partial({ images: [], plans: [{ id: "p" }], storedGallery: null, storedPlans: null }),
   partial({ images: [{ id: "i" }], plans: [], storedGallery: [], storedPlans: undefined })],
  [{ keepGallery: false, keepPlans: false, holdSig: false }, { keepGallery: false, keepPlans: false, holdSig: false }]);
check("a stored value that is not a list is not kept",
  partial({ images: [], plans: [], storedGallery: {}, storedPlans: "x" }), { keepGallery: false, keepPlans: false, holdSig: false });

/* M6 + open fix 2: a stored project whose price list is gone this run. A
   project that already has feed units got them from a price list; if it now
   has only a PDF (or nothing), re-gathering it as "pdf-only" would freeze its
   units with no signal and rewrite its row. Such a project is skipped whole
   and raised as an alarm. A project that never had feed units (Plus 4, 29, 72:
   PDF-only from the start) keeps being written as a presentation page, and
   one absent altogether is only noted, as before. */
const missing = S.missingPriceListDecision ?? (() => "helper not exported");
const st = (key, hasFeedUnits) => ({ key, hasFeedUnits });
check("had feed units, only a PDF this run: skip and alarm",
  missing({ xmlKeys: ["33"], pdfKeys: ["57"], stored: [st("57", true)] }), { skip: ["57"], noteOnly: [] });
check("had feed units, nothing at all this run: skip and alarm (M6, same rule)",
  missing({ xmlKeys: ["33"], pdfKeys: [], stored: [st("57", true)] }), { skip: ["57"], noteOnly: [] });
check("never had feed units, PDF this run: written as today (neither list)",
  missing({ xmlKeys: ["33"], pdfKeys: ["4", "29", "72"], stored: [st("4", false), st("29", false), st("72", false)] }), { skip: [], noteOnly: [] });
check("never had feed units, nothing this run: only the note (M6, as before)",
  missing({ xmlKeys: ["33"], pdfKeys: [], stored: [st("57", false)] }), { skip: [], noteOnly: ["57"] });
check("a price list this run: neither list, with or without feed units",
  missing({ xmlKeys: ["33", "87"], pdfKeys: ["33"], stored: [st("33", true), st("87", false)] }), { skip: [], noteOnly: [] });
check("a new PDF-only project that is not stored: neither list",
  missing({ xmlKeys: ["33"], pdfKeys: ["99"], stored: [] }), { skip: [], noteOnly: [] });
check("a mixed folder sorts each stored key on its own",
  missing({ xmlKeys: ["33"], pdfKeys: ["4", "57"], stored: [st("33", true), st("4", false), st("57", true), st("60", true), st("61", false)] }),
  { skip: ["57", "60"], noteOnly: ["61"] });
check("the note and the alarm message",
  [S.missingPriceListNote?.("57"), S.absentProjectNote?.("61"), S.MISSING_PRICE_LIST],
  ["57: price list missing from the folder this run — nothing changed", "61: no price list in the folder this run — left as it is", "price list missing from the folder this run — nothing changed"]);

/* F4b: the cron summary carries the counts and the first notes, clipped, and
   stays far below Telegram's 4096-character limit. */
const long = "x".repeat(1000);
const sum = S.summarizePlusRun({ ok: true, reason: null, dryRun: false, projects: 35, created: 2, units: 400,
  failed: [long, long, long, long], blocked: ["57: 4 of 6 units are missing"], notes: [`33: ${long}`, "57: b", "87: c", "60: d"], plan: [] });
check("summary: the counts", sum.includes("4 failed, 1 blocked, 4 note(s)"), true);
check("summary: the first three notes are named", [sum.includes("33: xxx"), sum.includes("57: b"), sum.includes("87: c"), sum.includes("60: d")], [true, true, true, false]);
check("summary: each item is clipped to about 150 characters", sum.includes("x".repeat(160)), false);
check("summary: well under 4096 characters", sum.length < 2000, true);

/* ── the writer's wiring ──────────────────────────────────────────────────
   The writer talks to Drive and the database, so its guarantees are checked
   on the source; the decisions it delegates are tested above. */
const src = readFileSync("src/lib/plusPropertiesSync.ts", "utf8");
check("writer exported", typeof S.syncPlusProperties, "function");
check("gather finishes before any write: the verdict gates the write loop",
  src.indexOf("runVerdict({ attempted") < src.indexOf("prisma.development.create"), true);
check("each project is isolated in its own try/catch",
  /for \(const g of toWrite\) \{\s*try \{/.test(src), true);
check("a blocked project logs ok=false", /logCronRun\(`plus-incomplete:\$\{g\.key\}`, false,/.test(src), true);
check("a clean project logs ok=true on the same key", /logCronRun\(`plus-incomplete:\$\{g\.key\}`, true,/.test(src), true);
check("published projects are frozen", /published \? freezeForPublished\(row, existing\) : row/.test(src), true);
check("drafts are rewritten, published units are unlisted not deleted",
  /deleteMany\(\{ where: \{ developmentId: dev\.id, source: "feed" \} \}\)/.test(src) && /data: \{ status: "unlisted" \}/.test(src), true);
check("sold stays sold when it leaves the list", /r\.status !== "sold" && r\.status !== "unlisted"/.test(src), true);
check("media is skipped when its signature is unchanged", /existing\?\.driveImagesModified !== media\.sig/.test(src), true);
/* Read the project row literal itself: the dry run legitimately SELECTS slugs
   to warn about clashes, so a whole-file grep for "slug:" would be wrong. */
const rowStart = src.indexOf("const row: Record<string, unknown> = {");
const rowSrc = src.slice(rowStart, src.indexOf("};", rowStart));
check("the project row is where the check looks", rowStart > 0 && /feedKey/.test(rowSrc), true);
check("the connector never writes category or slug", /\b(category|slug)\b/.test(rowSrc), false);
/* splitLocation now answers null for an unknown district: the row must carry
   district and area only when set, so a null never erases what an admin set.
   (The place goes to `area` since 2026-09-26; it went to `town` before.) */
check("district and area are written only when set",
  /\.\.\.\(area \? \{ area \} : \{\}\), \.\.\.\(district \? \{ district \} : \{\}\)/.test(rowSrc)
  && !/\b(area|town|district):\s*(?!\s*\{)/.test(rowSrc.replace(/\.\.\.\(area \? \{ area \} : \{\}\), \.\.\.\(district \? \{ district \} : \{\}\)/, "")), true);
check("the unknown-district note is raised from the plan loop (dry run too) with the stored district",
  /locationNote\(\{ key: g\.key, location: g\.project\?\.location \?\? null, storedDistrict: existing\?\.district \?\? null \}\)/.test(src)
  && src.search(/locationNote\(\{ key: g\.key/) < src.indexOf("if (opts.dryRun) return"), true);
check("…nor anything in DevelopmentOverride", /developmentOverride\./.test(src), false);
check("a dry run returns before the first write", src.indexOf("if (opts.dryRun)") < src.indexOf("prisma.development.create"), true);
check("derived state recomputed after units", /recomputeDevelopmentDerivedState\(dev\.id\)/.test(src), true);
check("the sync window is always released", /finally \{\s*release\(\);/.test(src), true);
/* R8: one bad image or plan must not fail the project, and a run that lost
   any media file must not advance the signature, or the file is never retried. */
check("a failed media file is counted, not thrown (images and plans)",
  (src.match(/catch \{ mediaFailed\+\+;/g) ?? []).length >= 2, true);
check("the media signature advances only when no file failed and no list was kept (follow-up A)",
  /mediaFailed === 0 && !holdSig \? \{ driveImagesModified: media\.sig \}/.test(src), true);
check("…and nowhere else", (src.match(/driveImagesModified: media\.sig/g) ?? []).length, 1);
/* R9: derived state does not recompute priceFrom/priceTo, so they follow the
   units write — never the row, never a blocked or PDF-only project. */
check("the project row carries no price", /\bprice(From|To)\b/.test(rowSrc), false);
const blockedAt = src.indexOf("if (decision.blocked)");
const priceAt = src.indexOf("priceFrom");
check("the price range is written only in the units branch, after the blocked check",
  blockedAt > 0 && priceAt > blockedAt && priceAt < src.indexOf("logCronRun(`plus-incomplete:${g.key}`, true,"), true);
check("…and cleared when nothing is available", /priceFrom: prices\.length \? Math\.min\(\.\.\.prices\) : null/.test(src), true);
/* A list whose every file failed keeps the row's old media, not []. */
check("an all-failed gallery is not written", /if \(!gallery\.length && imagesFailed\) gallery = null;/.test(src), true);
check("…nor all-failed plans", /if \(!plans\.length && mediaFailed > imagesFailed\) plans = null;/.test(src), true);

/* Review fix 1: a price list that could not be fetched fails its project; it
   must never be gathered as a PDF-only page (row rewritten, units skipped). */
check("a failed price-list download fails the project, like a failed parse",
  /if \(!bytes\) \{ result\.failed\.push\(`\$\{key\}: price list could not be downloaded`\); continue; \}/.test(src), true);
check("…and is never gathered with a null project", /if \(bytes\) \{/.test(src), false);
const xmlGate = src.indexOf("if (!xmlListing || !xmlFiles.length) {");
check("a failed or empty price-list folder writes nothing",
  xmlGate > src.indexOf("if (!verdict.ok)") && xmlGate < src.indexOf("const existingRows") && xmlGate < src.indexOf("if (opts.dryRun)"), true);
check("…and returns ok:false", /if \(!xmlListing \|\| !xmlFiles\.length\) \{\s*return \{ \.\.\.result, ok: false,/.test(src), true);

/* Review fix 2: a unit the admin flipped to source "manual" wins; the sheet
   neither updates it nor creates a feed twin with the same ref. */
const manualAt = src.indexOf('where: { developmentId: dev.id, source: "manual" }');
check("manual unit refs are loaded before either write path",
  manualAt > 0 && manualAt < src.indexOf("deleteMany({ where: { developmentId: dev.id") && manualAt < src.indexOf("prisma.developmentUnit.create({"), true);
check("…and filtered out of the sheet units", /\.filter\(\(\{ u \}\) => !manualRefs\.has\(u\.ref\)\)/.test(src), true);
check("drafts create only the writable units", /createMany\(\{ data: writable\.map\(/.test(src), true);
check("published updates only the writable units", /for \(const \{ u, i \} of writable\)/.test(src), true);
check("the completeness decision still reads the whole sheet", /unitsDecision\(\{ published, stored, fresh: units \}\)/.test(src), true);

/* Review fix 3: a media-folder listing failure costs the media, not the units. */
check("the media listing is wrapped and counted as a media failure",
  /try \{ media = await collectMedia\([^;]*\); \}\s*catch \{ mediaFailed\+\+;/.test(src), true);
check("…and collectMedia is never awaited bare in the write phase",
  (src.match(/await collectMedia\(/g) ?? []).length, 1);

/* Review fix 4: published media is frozen, so it is not mirrored at all. */
check("published projects skip media mirroring unless forced",
  /const mirrorMedia = !!g\.mediaFolder && \(!published \|\| !!opts\.force\);/.test(src) && /if \(mirrorMedia\) \{\s*try \{ media = await collectMedia/.test(src), true);

/* Review fix 5: a hanging website or Maps host must not hold the sync window. */
check("every fetch has a 20 s timeout",
  [(src.match(/\bfetch\(/g) ?? []).length, (src.match(/signal: AbortSignal\.timeout\(20000\)/g) ?? []).length], [2, 2]);

/* ── final-review fixes: wiring ───────────────────────────────────────── */
/* F1: the three places that match stored units to the sheet use feedRef. */
check("F1: stored feed units select feedRef", /select: \{ id: true, ref: true, feedRef: true,/.test(src), true);
check("F1: the keep map is keyed on the stored unit key", /const k = storedUnitKey\(r\); if \(k\) keep\.set\(k,/.test(src), true);
check("F1: manual units are known by the same key", /select: \{ ref: true, feedRef: true \}/.test(src) && /\)\)\.map\(storedUnitKey\)/.test(src), true);
check("F1: unlisting compares the same key", /const k = storedUnitKey\(r\);\s*if \(k && !fresh\.has\(k\)/.test(src), true);
check("F1: nothing matches on a bare stored ref any more", /r\.ref as string|fresh\.has\(r\.ref\)|\.map\(\(r\) => r\.ref\)/.test(src), false);
/* F3: only a changed list schedules a restart. */
check("F3: the stored gallery and plans are read with the rows", /select: \{ id: true, feedKey: true, publishStatus: true, driveImagesModified: true, gallery: true, plans: true,/.test(src), true);
check("F3: a restart needs a list that differs from the stored one",
  /anyNewMedia = anyNewMedia \|\| !sameList\(gallery, existing\?\.gallery\) \|\| !sameList\(plans, existing\?\.plans\);/.test(src), true);
check("F3: …not merely a non-empty one", /\(gallery\?\.length \?\? 0\) \+ \(plans\?\.length \?\? 0\) > 0/.test(src), false);
/* F4b: parser notes reach the run's notes in a real run. */
const notesAt = src.indexOf("for (const n of g.project?.notes ?? []) result.notes.push(`${g.key}: ${n}`);");
check("F4b: parser notes are pushed, prefixed with the key, in the write loop",
  notesAt > src.indexOf("if (opts.dryRun) return") && notesAt < src.indexOf("prisma.development.create"), true);
/* F5: distances follow the coordinates, as in feedSync. */
const distAt = src.indexOf("if (dev.latitude != null && dev.longitude != null) await recomputeDevelopmentDistances(dev.id);");
check("F5: distances are recomputed after the upsert when the row has coordinates",
  distAt > src.indexOf("prisma.development.create") && distAt < src.indexOf("if (g.project) {"), true);
/* M1: a fresh token per project, and an empty listing never wipes media. */
const writeAt = src.indexOf("/* ── write, one project at a time");
check("M1: the write loop takes a fresh token per project",
  writeAt > 0 && src.indexOf("const projectToken = await getAccessToken();") > writeAt, true);
check("M1: …and uses it for the listing and every download",
  [/collectMedia\(g\.mediaFolder!, projectToken,/.test(src), (src.match(/downloadFile\(\w+\.id, projectToken\)/g) ?? []).length], [true, 2]);
check("M1: an empty listing keeps the stored media and says so (open fix 1: via keepStoredMediaOnEmptyListing)",
  /if \(media && keepStoredMediaOnEmptyListing\(\{\s*images: media\.images, plans: media\.plans,\s*storedSig: existing\?\.driveImagesModified, storedGallery: existing\?\.gallery, storedPlans: existing\?\.plans,?\s*\}\)\) \{\s*result\.notes\.push\(`\$\{g\.key\}: media listing came back empty — kept the stored media`\);\s*media = null;/.test(src), true);
check("open fix 1: the signature alone no longer gates the guard",
  /!media\.plans\.length && existing\?\.driveImagesModified\)/.test(src), false);
check("open fix 1: the guard runs before gallery/plans are decided",
  src.indexOf("keepStoredMediaOnEmptyListing({") > 0 && src.indexOf("keepStoredMediaOnEmptyListing({") < src.indexOf("let gallery: string[] | null = null"), true);
/* Follow-up A: the writer asks partialMediaListing inside the mirroring
   branch, keeps each list it says to keep with a note, and holds the sig. */
const mirrorAt = src.indexOf("if (media && (opts.force || existing?.driveImagesModified !== media.sig)) {");
const partialAt = src.search(/const partial = partialMediaListing\(\{ images: media\.images, plans: media\.plans, storedGallery: existing\?\.gallery, storedPlans: existing\?\.plans \}\);/);
const allFailedAt = src.indexOf("if (!plans.length && mediaFailed > imagesFailed) plans = null;");
const keepGalleryAt = src.search(/if \(partial\.keepGallery\) \{ gallery = null; result\.notes\.push\(`\$\{g\.key\}: no images listed this run — kept the stored gallery`\); \}/);
const keepPlansAt = src.search(/if \(partial\.keepPlans\) \{ plans = null; result\.notes\.push\(`\$\{g\.key\}: no plans listed this run — kept the stored plans`\); \}/);
const holdAt = src.indexOf("holdSig = partial.holdSig;");
const restartAt = src.indexOf("anyNewMedia = anyNewMedia ||");
check("follow-up A: the writer asks partialMediaListing inside the mirroring branch",
  mirrorAt > 0 && partialAt > mirrorAt && partialAt < src.indexOf("gallery = [];", mirrorAt), true);
check("follow-up A: …keeps the stored gallery with a note, after the all-failed rule",
  keepGalleryAt > allFailedAt && keepGalleryAt < restartAt, true);
check("follow-up A: …keeps the stored plans with a note, after the all-failed rule",
  keepPlansAt > allFailedAt && keepPlansAt < restartAt, true);
check("follow-up A: …and holds the signature before the row is built",
  holdAt > allFailedAt && holdAt < src.indexOf("const row: Record<string, unknown> = {") && /let holdSig = false;/.test(src), true);
/* M2: a draft's units are replaced atomically. */
check("M2: delete and create run in one transaction",
  /await prisma\.\$transaction\(\[\s*prisma\.developmentUnit\.deleteMany\(\{ where: \{ developmentId: dev\.id, source: "feed" \} \}\),\s*\.\.\.\(writable\.length \? \[prisma\.developmentUnit\.createMany\(/.test(src), true);
/* M6: every stored Plus project is read, and the absent ones noted. */
check("M6: the stored rows are every Plus project", /const existingRows = await prisma\.development\.findMany\(\{\s*where: \{ dev: PLUS_DEV \},/.test(src), true);
check("M6: …and the absent ones are noted, the skipped ones too",
  /result\.notes\.push\(\.\.\.missing\.noteOnly\.map\(absentProjectNote\), \.\.\.missing\.skip\.map\(missingPriceListNote\)\);/.test(src), true);
/* Open fix 2: a project that had feed units and lost its price list is never
   written, and its alarm is raised only by a real run. */
const dryRunAt = src.indexOf("if (opts.dryRun) return");
const loopAt = src.indexOf("for (const g of toWrite) {");
const feedUnitsAt = src.search(/prisma\.developmentUnit\.findMany\(\{\s*where: \{ source: "feed", development: \{ dev: PLUS_DEV \} \}, select: \{ developmentId: true \}, distinct: \["developmentId"\],?\s*\}\)/);
check("fix 2: which stored projects have feed units is read once, before the dry-run return",
  feedUnitsAt > src.indexOf("const existingRows") && feedUnitsAt < dryRunAt, true);
check("fix 2: the decision gets every stored row with its has-feed-units flag",
  /stored: existingRows\.map\(\(r\) => \(\{ key: r\.feedKey\.slice\(PLUS_DEV\.length \+ 1\), hasFeedUnits: withFeedUnits\.has\(r\.id\) \}\)\)/.test(src)
  && /missingPriceListDecision\(\{\s*xmlKeys: Array\.from\(xmlKeys\), pdfKeys,/.test(src), true);
check("fix 2: the notes are pushed before the dry-run return, so a dry run reports them",
  src.indexOf("...missing.skip.map(missingPriceListNote)") > 0 && src.indexOf("...missing.skip.map(missingPriceListNote)") < dryRunAt, true);
{
  /* Dry run 2026-09-26: the "no coordinates" note is pushed where the link
     is resolved, before the dry-run return, so a dry run reports it too. */
  /* Review M1: the note needs the stored rows, so it is pushed in the plan
     loop (after existingRows, before the dry-run return), and the stored
     rows carry the admin's override pin. */
  const noteAt = src.search(/const mapsNote = mapsLinkNote\(\{ key: g\.key, mapsUrl: g\.project\?\.mapsUrl \?\? null, resolved: g\.mapsResolved, coords: g\.coords, storedPin: hasStoredPin\(existing\) \}\);\s*if \(mapsNote\) result\.notes\.push\(mapsNote\);/);
  check("maps: the note is pushed in the plan loop, with the stored row, before the dry-run return",
    noteAt > src.indexOf("const existing = byFeedKey.get(feedKeyFor(g.key));") && src.indexOf("const existing = byFeedKey.get(feedKeyFor(g.key));") > src.indexOf("const existingRows") && noteAt < dryRunAt, true);
  check("maps: …and only there", (src.match(/mapsLinkNote\(\{/g) ?? []).length, 1);
  check("maps: the stored rows carry the admin's override pin",
    /const existingRows = await prisma\.development\.findMany\(\{[^;]*latitude: true, longitude: true, override: \{ select: \{ latitude: true, longitude: true \} \}/.test(src), true);
  check("maps: the gather loop records whether the link resolved",
    /const resolved = await resolvedUrl\(g\.project\.mapsUrl\);\s*g\.mapsResolved = resolved != null;\s*g\.coords = coordsFromMapsUrl\(resolved\);/.test(src), true);
}
check("fix 2: …and the dry-run plan row says it is skipped",
  /blocked: skipKeys\.has\(g\.key\) \? MISSING_PRICE_LIST : null/.test(src), true);
check("fix 2: a dry run counts only the projects it would write",
  /if \(opts\.dryRun\) return \{ \.\.\.result, projects: toWrite\.length \};/.test(src), true);
check("fix 2: skipped keys are filtered out of what the write loop sees",
  /const skipKeys = new Set\(missing\.skip\);/.test(src) && /const toWrite = gathered\.filter\(\(g\) => !skipKeys\.has\(g\.key\)\);/.test(src), true);
check("fix 2: nothing after the dry-run return iterates the unfiltered list",
  dryRunAt > 0 && !src.slice(dryRunAt).includes("gathered"), true);
const writeCalls = [...src.matchAll(/prisma\.development\.(update|create)\(|prisma\.developmentUnit\.(update|create|createMany|deleteMany)\(|recomputeDevelopment\w+\(dev\.id\)/g)].map((m) => m.index);
check("fix 2: every Development/unit write sits inside the toWrite loop",
  loopAt > dryRunAt && writeCalls.length >= 8 && writeCalls.every((i) => i > loopAt), true);
const alarmAt = src.search(/for \(const k of missing\.skip\) await logCronRun\(`plus-incomplete:\$\{k\}`, false, MISSING_PRICE_LIST\);/);
check("fix 2: a skipped project logs ok=false on its plus-incomplete key, only in a real run",
  alarmAt > dryRunAt && alarmAt < loopAt, true);
check("fix 2: …and nothing else logs a plus-incomplete row outside the loop",
  (src.match(/logCronRun\(`plus-incomplete:/g) ?? []).length, 3);

/* ── route, account, cron health ──────────────────────────────────────────
   R10: the cron-health JOBS entry landed 2026-09-26, the day plus-sync got
   its `30 2 * * *` crontab entry (installed by the operator after deploy). */
const route = readFileSync("src/app/api/cron/plus-sync/route.ts", "utf8");
const system = readFileSync("src/lib/actionCenter/rules/system.ts", "utf8");
const jobsSrc = system.slice(system.indexOf("const JOBS"), system.indexOf("];", system.indexOf("const JOBS")));
check("cron health watches plus-sync daily",
  /\{ job: "plus-sync", label: "plus-sync", expectedMs: 24 \* HOUR \},/.test(jobsSrc), true);
check("…right after cybarco-sync, with its dated comment",
  /\{ job: "cybarco-sync", label: "cybarco-sync", expectedMs: 24 \* HOUR \},\n  \/\/ 2026-09-26 [^\n]*plus-sync[^\n]*`30 2 \* \* \*`[\s\S]*?\n  \{ job: "plus-sync"/.test(jobsSrc), true);
check("…and only once", (jobsSrc.match(/job: "plus-sync"/g) ?? []).length, 1);
check("the route no longer says the JOBS entry is still to come",
  /JOBS entry[\s\S]{0,200}is in place/.test(route.slice(0, route.indexOf("import "))) && !/Adding it now/.test(route), true);
check("route refuses without the cron secret", /key !== process\.env\.CRON_SECRET/.test(route) && /status: 401/.test(route), true);
check("route reads force and dryRun, nothing invented", [/searchParams\.get\("force"\) === "1"/.test(route), /searchParams\.get\("dryRun"\) === "1"/.test(route)], [true, true]);
check("route finds the account by its slug", /where: \{ slug: PLUS_ACCOUNT_SLUG \}/.test(route), true);
check("F4b: the route summarises with summarizePlusRun", (route.match(/summarizePlusRun\b/g) ?? []).length >= 3 && !/function summarize\(/.test(route), true);
check("a dry run is not logged as a sync", /opts\.dryRun|dryRun \?/.test(route), true);
/* Fix (review of 0896fdd4): cron health only sees that a run happened, not
   why it threw, so the catch block must notify like cybarco-sync's does, not
   just return a bare 500. */
const catchAt = route.indexOf("} catch (e) {");
const catchSrc = route.slice(catchAt);
check("the catch block notifies on a thrown error, like a failed run",
  catchAt > 0 && /shouldNotifyFailureStreak\("plus-sync"\)/.test(catchSrc) && /sendFeedNotification\(/.test(catchSrc), true);
check("the catch block's comment no longer says the JOBS entry is pending",
  !/until the plus-sync cron-health JOBS entry lands/.test(catchSrc) && /JOBS entry is in\s+(?:\/\/\s+)?place/.test(catchSrc)
  && /immediate\s+(?:\/\/\s+)?alert/.test(catchSrc), true);
const setup = readFileSync("scripts/setup-plus-properties-account.mjs", "utf8");
check("account setup is idempotent", /upsert\(/.test(setup), true);
check("…and keeps the generic Drive sync away from it", /driveSyncInterval: "off"/.test(setup) && !/driveFolderUrl:/.test(setup), true);

/* ── neighbourhood goes to `area` (admin "Area"), never `town` ("Locality") ──
   2026-09-26: the operator found every Plus neighbourhood under Locality; the
   site (every other developer, area pages, area texts) keys on `area`. */
const plusRow = src.slice(src.indexOf("const row: Record<string, unknown> = {"), src.indexOf("};", src.indexOf("const row: Record<string, unknown> = {")));
check("the footer's place is written as area", /\.\.\.\(area \? \{ area \} : \{\}\)/.test(plusRow), true);
check("…and nothing is written to town", /\btown\b/.test(plusRow), false);
check("area is frozen once set on a published project, like feedSync",
  /FROZEN_WHEN_PUBLISHED_IF_SET = \[[^\]]*"area"/.test(src), true);
check("…which needs the stored area selected", /district: true, area: true/.test(src), true);

console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
