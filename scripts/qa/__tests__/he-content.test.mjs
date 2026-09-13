// Tests for the Hebrew content-pack tooling (Hebrew localization Phase 5,
// Task 1): the pure validators in scripts/he-content/lib.mjs, the
// read-only-ness of scripts/he-content/export-en.mjs, and the
// scripts/he-content/seed.mjs "site-documents" planner/applier.
//
// Run: node --test scripts/qa/__tests__/he-content.test.mjs
// (also picked up by `npm test`'s scripts/qa/__tests__/*.test.mjs glob.)
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { mirrorCheck, isHeLinkRewrite, styleCheck, linkCheck, metaCheck, walkStrings, STYLE_RULES, orphanMarkDefs } from "../../he-content/lib.mjs";
import { collectLinks, valueAtPath } from "../he-content-check.mjs";
import { planSiteDocuments, planSeed, applyPlan, stripPackMetadata } from "../../he-content/seed.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..", "..");

// ─── mirrorCheck ────────────────────────────────────────────────────────────

test("mirrorCheck: matching structures pass", () => {
  const en = { title: "Apartments in Cyprus", count: 3, active: true, tags: ["Sale", "Investment"] };
  const he = { title: "דירות בקפריסין", count: 3, active: true, tags: ["מכירה", "השקעה"] };
  assert.deepEqual(mirrorCheck(en, he), []);
});

test("mirrorCheck: missing key in he fails", () => {
  const en = { title: "Apartments", excerpt: "Short text" };
  const he = { title: "דירות" };
  const violations = mirrorCheck(en, he);
  assert.ok(violations.some((v) => v.includes("excerpt") && v.includes("missing key")));
});

test("mirrorCheck: extra key in he fails", () => {
  const en = { title: "Apartments" };
  const he = { title: "דירות", extra: "לא אמור להיות כאן" };
  const violations = mirrorCheck(en, he);
  assert.ok(violations.some((v) => v.includes("extra") && v.includes("extra key")));
});

test("mirrorCheck: array length drift fails", () => {
  const en = { items: ["one", "two", "three"] };
  const he = { items: ["אחד", "שתיים"] };
  const violations = mirrorCheck(en, he);
  assert.ok(violations.some((v) => v.includes("array length mismatch")));
});

test("mirrorCheck: changed _key fails", () => {
  const en = { blocks: [{ _key: "abc123", _type: "block", text: "Hello world" }] };
  const he = { blocks: [{ _key: "zzz999", _type: "block", text: "שלום עולם" }] };
  const violations = mirrorCheck(en, he);
  assert.ok(violations.some((v) => v.includes("_key") && v.includes("identical")));
});

test("mirrorCheck: EN letters but HE empty fails", () => {
  const en = { title: "Apartments for sale" };
  const he = { title: "" };
  const violations = mirrorCheck(en, he);
  assert.ok(violations.some((v) => v.includes("empty")));
});

test("mirrorCheck: EN letters but HE has no Hebrew script fails", () => {
  const en = { title: "Apartments for sale" };
  const he = { title: "Apartments for sale (draft)" }; // untranslated — Latin only, and not a byte-identical keep
  const violations = mirrorCheck(en, he);
  assert.ok(violations.some((v) => v.includes("no Hebrew script")));
});

test("mirrorCheck: identical _type/style/marks/href/slug/url pass through untouched", () => {
  const en = {
    _type: "block",
    style: "h2",
    slug: "limassol",
    url: "https://example.com/x",
    children: [{ _type: "span", text: "Hello", marks: ["strong"], _key: "abc" }],
  };
  const he = {
    _type: "block",
    style: "h2",
    slug: "limassol",
    url: "https://example.com/x",
    children: [{ _type: "span", text: "שלום", marks: ["strong"], _key: "abc" }],
  };
  assert.deepEqual(mirrorCheck(en, he), []);
});

test("mirrorCheck: numbers/booleans must be identical", () => {
  const en = { count: 5, active: true };
  const he = { count: 6, active: false };
  const violations = mirrorCheck(en, he);
  assert.equal(violations.filter((v) => v.includes("identical")).length, 2);
});

test("mirrorCheck: both null/undefined at a path is fine (e.g. optional fields)", () => {
  assert.deepEqual(mirrorCheck({ excerpt: null }, { excerpt: null }), []);
});

// ─── styleCheck ─────────────────────────────────────────────────────────────

test("styleCheck: forbidden em dash (—) fails", () => {
  const violations = styleCheck("דירה מרשימה — עם נוף לים");
  assert.ok(violations.some((v) => v.includes("em dash")));
});

test("styleCheck: forbidden exclamation mark (!) fails", () => {
  const violations = styleCheck("צרו קשר עכשיו!");
  assert.ok(violations.some((v) => v.includes("exclamation")));
});

test("styleCheck: forbidden curly quotes fail", () => {
  const violations = styleCheck("הדירה ה”טובה ביותר”");
  assert.ok(violations.some((v) => v.includes("curly")));
});

test("styleCheck: forbidden slash gender form fails", () => {
  assert.ok(styleCheck("הלקוח/ה שלנו").some((v) => v.includes("slash gender form")));
  assert.ok(styleCheck("קונה/ת פוטנציאלי").some((v) => v.includes("slash gender form")));
});

test("styleCheck: forbidden banned words fail", () => {
  assert.ok(styleCheck("החתימה מתבצעת אצל נוטריון").some((v) => v.includes("notary")));
  assert.ok(styleCheck("יש חדר ממ\"ד בדירה").some((v) => v.includes("safe-room") || v.includes("Israeli safe-room")));
  assert.ok(styleCheck("כל חברות בנייה בקפריסין").some((v) => v.includes("construction-company")));
  assert.ok(styleCheck("הטופס נמצא בטעינה").some((v) => v.includes("gerund")));
  assert.ok(styleCheck("הבקשה בשליחה").some((v) => v.includes("gerund")));
  assert.ok(styleCheck("קנינו את הכול").some((v) => v.includes("plene")));
});

test("styleCheck: נדל\"ן without a gershayim fails", () => {
  const violations = styleCheck("שוק הנדלן בקפריסין");
  assert.ok(violations.some((v) => v.includes("gershayim")));
});

test("styleCheck: correctly formed string passes clean", () => {
  const violations = styleCheck('שוק הנדל"ן בקפריסין מציע דירות איכותיות למכירה.');
  assert.deepEqual(violations, []);
});

test("STYLE_RULES is a non-empty array of {id, test, message}", () => {
  assert.ok(Array.isArray(STYLE_RULES) && STYLE_RULES.length > 0);
  for (const rule of STYLE_RULES) {
    assert.equal(typeof rule.id, "string");
    assert.ok(typeof rule.test === "function" || rule.test instanceof RegExp);
    assert.equal(typeof rule.message, "string");
  }
});

// ─── linkCheck ──────────────────────────────────────────────────────────────

test("linkCheck: /de/ link is forbidden", () => {
  assert.ok(linkCheck("/de/limassol", []));
});

test("linkCheck: /pl/ and /ru/ links are forbidden", () => {
  assert.ok(linkCheck("/pl/contacts", []));
  assert.ok(linkCheck("/ru/faq", []));
});

test("linkCheck: bare /en/ link is forbidden", () => {
  assert.ok(linkCheck("/en/about-us", []));
});

test("linkCheck: /he/<pack slug> passes when the slug is in packSlugs", () => {
  assert.equal(linkCheck("/he/limassol", ["limassol", "paphos"]), null);
});

test("linkCheck: /he/<unknown slug> fails when the slug is not in packSlugs", () => {
  assert.ok(linkCheck("/he/not-a-real-page", ["limassol"]));
});

test("linkCheck: /blog/<slug> (EN article, no /he prefix) passes", () => {
  assert.equal(linkCheck("/blog/some-en-article", []), null);
});

test("linkCheck: code routes pass", () => {
  assert.equal(linkCheck("/he", []), null);
  assert.equal(linkCheck("/he/projects", []), null);
  assert.equal(linkCheck("/he/projects/some-development", []), null);
  assert.equal(linkCheck("/he/contacts", []), null);
  assert.equal(linkCheck("/he/faq", []), null);
});

test("linkCheck: mailto/tel/wa.me/absolute cyprusvipestates.com pass", () => {
  assert.equal(linkCheck("mailto:info@cyprusvipestates.com", []), null);
  assert.equal(linkCheck("tel:+35700000000", []), null);
  assert.equal(linkCheck("https://wa.me/35700000000", []), null);
  assert.equal(linkCheck("https://cyprusvipestates.com/he/limassol", []), null);
});

// ─── metaCheck ──────────────────────────────────────────────────────────────

test("metaCheck: a 61-grapheme metaTitle fails", () => {
  const title = "א".repeat(61);
  const violations = metaCheck({ metaTitle: title });
  assert.ok(violations.some((v) => v.includes("metaTitle")));
});

test("metaCheck: a 60-grapheme metaTitle passes", () => {
  const title = "א".repeat(60);
  assert.deepEqual(metaCheck({ metaTitle: title }), []);
});

test("metaCheck: a 156-grapheme metaDescription fails, 155 passes", () => {
  const bad = "א".repeat(156);
  const good = "א".repeat(155);
  assert.ok(metaCheck({ metaDescription: bad }).length > 0);
  assert.deepEqual(metaCheck({ metaDescription: good }), []);
});

test("metaCheck: missing seo object is fine (shape problems are mirrorCheck's job)", () => {
  assert.deepEqual(metaCheck(undefined), []);
  assert.deepEqual(metaCheck(null), []);
});

// ─── walkStrings ────────────────────────────────────────────────────────────

test("walkStrings: visits every string leaf, skips non-text keys", () => {
  const seen = [];
  walkStrings(
    {
      title: "כותרת",
      _key: "should-be-skipped",
      href: "/he/should-be-skipped",
      nested: { excerpt: "תיאור קצר" },
      list: ["אחד", "שתיים"],
    },
    (s, p) => seen.push([s, p]),
  );
  const values = seen.map(([s]) => s);
  assert.ok(values.includes("כותרת"));
  assert.ok(values.includes("תיאור קצר"));
  assert.ok(values.includes("אחד") && values.includes("שתיים"));
  assert.ok(!values.includes("should-be-skipped"));
  assert.ok(!values.includes("/he/should-be-skipped"));
});

// ─── export-en.mjs is read-only (static guard) ─────────────────────────────

test("export-en.mjs never calls a mutating Prisma method or raw SQL", () => {
  const src = fs.readFileSync(path.join(ROOT, "scripts", "he-content", "export-en.mjs"), "utf8");
  const forbidden = [/\.create\(/, /\.update\(/, /\.upsert\(/, /\.delete\(/, /\.deleteMany\(/, /\.updateMany\(/, /\$executeRaw/, /\$queryRaw/];
  for (const re of forbidden) {
    assert.doesNotMatch(src, re, `export-en.mjs must not contain ${re}`);
  }
  assert.match(src, /READ-ONLY EXPORT/);
});

// ─── seed.mjs: planSiteDocuments / planSeed / applyPlan ────────────────────

test("planSiteDocuments: inserts a row with no existing he row", () => {
  const rows = [{ type: "homepage", data: { title: "בית" } }];
  const plan = planSiteDocuments(rows, []);
  assert.equal(plan.length, 1);
  assert.equal(plan[0].action, "insert");
  assert.equal(plan[0].sanityId, "homepage-he");
});

test("planSiteDocuments: updates when existing he data differs", () => {
  const rows = [{ type: "homepage", data: { title: "בית חדש" } }];
  const existing = [{ type: "homepage", language: "he", sanityId: "homepage-he", data: { title: "בית ישן" } }];
  const plan = planSiteDocuments(rows, existing);
  assert.equal(plan[0].action, "update");
});

test("planSiteDocuments: skips (unchanged) when existing he data matches", () => {
  const rows = [{ type: "homepage", data: { title: "בית" } }];
  const existing = [{ type: "homepage", language: "he", sanityId: "homepage-he", data: { title: "בית" } }];
  const plan = planSiteDocuments(rows, existing);
  assert.equal(plan[0].action, "skip");
  assert.match(plan[0].reason, /unchanged/);
});

test("planSiteDocuments: a non-he row for the same type is an expected sibling, never a refusal", () => {
  // SiteDocument is @@unique([type, language]) — one row per language per
  // type — so the de sibling of "homepage" is normal, not a clash.
  const rows = [{ type: "homepage", data: { title: "בית" } }];
  const existing = [{ type: "homepage", language: "de", sanityId: "homepage-de", data: { title: "Startseite" } }];
  const plan = planSiteDocuments(rows, existing);
  assert.equal(plan[0].action, "insert", plan[0].reason);
  assert.equal(plan[0].sanityId, "homepage-he");
});

test("planSiteDocuments: all four LTR siblings present — every row plans an insert, zero refusals", () => {
  const types = ["homepage", "header", "footer", "blogPage"];
  const rows = types.map((type) => ({ type, data: { title: `כותרת ${type}` } }));
  const existing = types.flatMap((type) =>
    ["en", "de", "pl", "ru"].map((language) => ({ type, language, sanityId: `${type}-${language}`, data: { title: `${type} ${language}` } })),
  );
  const plan = planSiteDocuments(rows, existing);
  assert.equal(plan.length, 4);
  assert.equal(plan.filter((p) => p.action === "refuse").length, 0);
  assert.deepEqual(
    plan.map((p) => p.action),
    ["insert", "insert", "insert", "insert"],
  );
  assert.deepEqual(
    plan.map((p) => p.sanityId),
    types.map((t) => `${t}-he`),
  );

  // …and with the he rows also present, the plan targets those, not the siblings.
  const withHe = [...existing, ...types.map((type) => ({ type, language: "he", sanityId: `${type}-he`, data: { title: "ישן" } }))];
  const updatePlan = planSiteDocuments(rows, withHe);
  assert.equal(updatePlan.filter((p) => p.action === "update").length, 4);
});

test("planSiteDocuments: accepts the { siteDocuments } envelope the real loader returns", () => {
  const rows = [{ type: "homepage", data: { title: "בית" } }];
  const plan = planSiteDocuments(rows, { siteDocuments: [{ type: "homepage", language: "he", sanityId: "homepage-he", data: { title: "בית" } }] });
  assert.equal(plan[0].action, "skip");
});

test("planSeed: dispatches to planSiteDocuments for kind site-documents", () => {
  const plan = planSeed({ kind: "site-documents", rows: [{ type: "footer", data: { copyright: "©" } }] }, []);
  assert.equal(plan[0].action, "insert");
});

// Task 9 completed every other kind (faq, case-studies, singlepages,
// legal-check) — see scripts/qa/__tests__/he-seed.test.mjs for their
// planner/applier coverage. This file keeps only the Task 1 site-documents
// coverage plus the pure validators (mirrorCheck/styleCheck/linkCheck/
// metaCheck/walkStrings) it was written for.
test("planSeed: an empty pack for every kind produces an empty plan", () => {
  for (const kind of ["faq", "case-studies", "singlepages", "legal-check"]) {
    assert.deepEqual(planSeed({ kind, rows: [] }, {}), []);
  }
});

test("applyPlan: throws if a refuse entry is present, without writing anything", async () => {
  const calls = [];
  const fakePrisma = { siteDocument: { upsert: async (args) => calls.push(args) } };
  const plan = [{ kind: "site-documents", key: "homepage", action: "refuse", reason: "x" }];
  await assert.rejects(() => applyPlan(plan, fakePrisma), /refusing to apply/);
  assert.equal(calls.length, 0);
});

test("applyPlan: upserts insert/update entries and skips skip entries", async () => {
  const calls = [];
  const fakePrisma = { siteDocument: { upsert: async (args) => calls.push(args) } };
  const plan = [
    { kind: "site-documents", key: "homepage", action: "insert", sanityId: "homepage-he", data: { title: "בית" } },
    { kind: "site-documents", key: "footer", action: "skip", reason: "unchanged" },
  ];
  await applyPlan(plan, fakePrisma);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].where, { type_language: { type: "homepage", language: "he" } });
  assert.deepEqual(calls[0].create, { sanityId: "homepage-he", type: "homepage", language: "he", data: { title: "בית" } });
});

test("stripPackMetadata: removes review/translationGroupSlugEn/parentSlug, keeps everything else", () => {
  const stripped = stripPackMetadata({
    title: "בית",
    review: "pending",
    translationGroupSlugEn: "homepage",
    parentSlug: null,
    data: { x: 1 },
  });
  assert.deepEqual(stripped, { title: "בית", data: { x: 1 } });
});


test("orphanMarkDefs: a markDef no span references is a dead link; a referenced one passes", () => {
  const dead = { _type: "block", markDefs: [{ _key: "abc", _type: "link", href: "/he/faq" }], children: [{ _type: "span", text: "x", marks: [] }] };
  const live = { _type: "block", markDefs: [{ _key: "abc", _type: "link", href: "/he/faq" }], children: [{ _type: "span", text: "x", marks: ["abc"] }] };
  assert.equal(orphanMarkDefs({ contentBlocks: [dead] }).length, 1);
  assert.deepEqual(orphanMarkDefs({ contentBlocks: [live] }), []);
});

test("linkCheck: query strings are ignored and the EN partners page is allowed", () => {
  assert.equal(linkCheck("/he/projects?city=Paphos", []), null);
  assert.equal(linkCheck("/partners", []), null);
  assert.ok(linkCheck("/he/partners", []));
});

// ─── collectLinks: absolute URLs in suffix-detected link keys ───────────────
// Regression for the operator-precedence hole: `isLinkKey(k) && … &&
// v.startsWith("/") || (k === "href" || k === "url") && …` collected a
// *Destination/link key ONLY when its value was relative, and mirrorCheck
// skips link keys too — so an absolute URL there was validated by nothing.

test("collectLinks: a planted absolute /de/ URL in a *Destination key is collected and rejected", () => {
  const json = { form: { agreementLinkDestination: "https://cyprusvipestates.com/de/agb" } };
  const links = collectLinks(json);
  assert.deepEqual(links, [{ href: "https://cyprusvipestates.com/de/agb", path: "form.agreementLinkDestination" }]);
  const v = linkCheck(links[0].href, []);
  assert.ok(v, "an absolute /de/ URL must be a violation");
  assert.match(v, /must be a \/he route/);
  // Not even an identical EN source value excuses the site's own host.
  assert.ok(linkCheck(links[0].href, [], links[0].href));
});

test("collectLinks: absolute URLs in every link-key shape are collected", () => {
  const json = {
    socialLinks: [{ link: "https://www.instagram.com/x/" }],
    nested: { imageUrl: "https://cdn.example.com/a.png", href: "/he/faq", buttonLinkDestination: "https://example.com/x" },
  };
  assert.deepEqual(
    collectLinks(json).map((l) => l.path),
    ["socialLinks[0].link", "nested.imageUrl", "nested.href", "nested.buttonLinkDestination"],
  );
});

test("linkCheck: an off-site absolute URL passes only when byte-identical to the EN source", () => {
  const social = "https://www.instagram.com/cyprusvipestates/";
  assert.equal(linkCheck(social, [], social), null);
  assert.ok(linkCheck(social, [], null), "no EN source value ⇒ violation");
  assert.ok(linkCheck(social, [], "https://www.instagram.com/someone-else/"), "differing EN value ⇒ violation");
  assert.equal(linkCheck("https://private.cyprusvipestates.com/en", [], "https://private.cyprusvipestates.com/en"), null);
});

test("valueAtPath: resolves the dotted/indexed paths collectLinks produces", () => {
  const en = { socialLinks: [{ link: "a" }, { link: "b" }], deep: { rows: [[{ url: "c" }]] } };
  assert.equal(valueAtPath(en, "socialLinks[1].link"), "b");
  assert.equal(valueAtPath(en, "deep.rows[0][0].url"), "c");
  assert.equal(valueAtPath(en, "socialLinks[9].link"), undefined);
  assert.equal(valueAtPath(en, "nope.nope"), undefined);
});

test("mirrorCheck: empty EN string allows empty HE (spacer spans)", () => {
  assert.deepEqual(mirrorCheck({ t: "" }, { t: "" }), []);
});

test("mirrorCheck: identical letter strings are a recorded keep, not a violation", () => {
  const stats = { keptIdentical: [] };
  assert.deepEqual(mirrorCheck({ category: "villa", name: "Cap St Georges" }, { category: "villa", name: "Cap St Georges" }, "", stats), []);
  assert.deepEqual(stats.keptIdentical, ["category", "name"]);
});

test("mirrorCheck: href may be the /he rewrite of the EN link, nothing else", () => {
  assert.deepEqual(mirrorCheck({ href: "/en/projects" }, { href: "/he/projects" }), []);
  assert.deepEqual(mirrorCheck({ href: "/contacts" }, { href: "/he/contacts" }), []);
  // Retargeting to another page is mirrorCheck-neutral; the allow-list is linkCheck's job.
  assert.deepEqual(mirrorCheck({ href: "/villas-in-cyprus" }, { href: "/he/villas-cyprus" }), []);
  assert.ok(linkCheck("/de/projects", []));
  assert.equal(isHeLinkRewrite("https://cyprusvipestates.com/en/faq", "/he/faq"), true);
});
