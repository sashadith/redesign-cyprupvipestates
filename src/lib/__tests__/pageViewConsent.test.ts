import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { analyticsConsentFrom, marketingConsentFrom } from "@/lib/attribution";

/* Why this exists (2026-10-24).
 *
 * Meta recorded 129 PageView on 2026-10-23 against our own 188 real views. The
 * missing 31 % was read as ad-blocker attrition, but the pixel only renders in
 * the consent-gated branch of [lang]/layout.tsx and ConsentScripts — so the
 * same 31 % also contains everyone who declined the banner and everyone who
 * never answered it. Three different populations, one number, and opposite
 * conclusions: if most of it is refusal, a Conversions API recovers almost
 * nothing; if most of it is blocking, it recovers almost all of it.
 *
 * This column is how that gets decided with a measurement instead of a guess,
 * so the only thing that really matters here is that the three states stay
 * three states.
 *
 * No Prisma client is opened: the local DATABASE_URL tunnels to the PRODUCTION
 * database. The storage half is asserted against the source and the migration.
 */

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const ROUTE = "src/app/api/analytics/track/route.ts";

const accepted = JSON.stringify({ necessary: true, analytics: true, marketing: true });
const declined = JSON.stringify({ necessary: true, analytics: false, marketing: false });

test("an accepted banner reads true, decoded or percent-encoded", () => {
  // The two callers get this cookie from different places: document.cookie
  // hands over what js-cookie wrote, Next's cookies()/NextRequest decode first.
  assert.equal(analyticsConsentFrom(accepted), true);
  assert.equal(analyticsConsentFrom(encodeURIComponent(accepted)), true);
});

test("a declined banner reads false, decoded or percent-encoded", () => {
  assert.equal(analyticsConsentFrom(declined), false);
  assert.equal(analyticsConsentFrom(encodeURIComponent(declined)), false);
});

test("no cookie reads null — NOT false", () => {
  // The whole point. A visitor who has not answered yet has no pixel either,
  // and merging them into "declined" would overstate refusal and kill a
  // Conversions API that was actually worth building.
  assert.equal(analyticsConsentFrom(undefined), null);
  assert.equal(analyticsConsentFrom(null), null);
  assert.equal(analyticsConsentFrom(""), null);
});

test("the three states are distinguishable, which is the requirement", () => {
  const states = [analyticsConsentFrom(accepted), analyticsConsentFrom(declined), analyticsConsentFrom(null)];
  assert.deepEqual(states, [true, false, null]);
  assert.equal(new Set(states).size, 3, "two states collapsed into one");
});

test("an unreadable cookie reads null, never a decision", () => {
  // Guessing on garbage would quietly bias the measurement.
  assert.equal(analyticsConsentFrom("not json"), null);
  assert.equal(analyticsConsentFrom("%E0%A4%A"), null, "a malformed percent-escape must not throw");
  assert.equal(analyticsConsentFrom("null"), null);
  assert.equal(analyticsConsentFrom("5"), null, "a non-object is not a decision");
  assert.equal(analyticsConsentFrom("[]"), null, "an array is not a decision");
});

test("a cookie without the analytics key counts as no consent", () => {
  // Our own banner never writes this shape. If something else ever does, the
  // safe reading is "not granted" — the pixel's own gate reads it the same way
  // (`consent?.analytics === true`).
  assert.equal(analyticsConsentFrom(JSON.stringify({ necessary: true })), false);
});

test("it never throws — it runs in a route that must never fail", () => {
  for (const v of ["", "{", "%", "%%%", '{"analytics":', "\u0000"]) {
    assert.doesNotThrow(() => analyticsConsentFrom(v), `threw on ${JSON.stringify(v)}`);
  }
});

test("the existing marketing reader still behaves", () => {
  // analyticsConsentFrom was inserted into attribution.ts above the browser
  // plumbing; this is the neighbour it must not have disturbed.
  assert.equal(marketingConsentFrom(encodeURIComponent(accepted)), true);
  assert.equal(marketingConsentFrom(encodeURIComponent(declined)), false);
  assert.equal(marketingConsentFrom(null), false);
});

/* ── the storage half ───────────────────────────────────────────────────── */

test("the track route reads the consent cookie and stores the result", () => {
  const src = read(ROUTE);
  assert.ok(/analyticsConsentFrom\(req\.cookies\.get\("cookieConsent"\)\?\.value\)/.test(src),
    "the route no longer reads the consent cookie");
  assert.ok(/pageView\.create\(\{[\s\S]*?analyticsConsent,[\s\S]*?\}\)/.test(src),
    "analyticsConsent is not written to the row");
  assert.ok(src.indexOf("const analyticsConsent") < src.indexOf("pageView.create"),
    "the value is computed after the write");
});

test("the cookie's contents are never stored, only the decision", () => {
  // A route whose stated contract is "no PII" must not start keeping the raw
  // cookie, and a boolean is all the measurement needs.
  const src = read(ROUTE);
  const create = src.slice(src.indexOf("pageView.create"));
  assert.equal(/cookieConsent/.test(create.slice(0, create.indexOf("})"))), false,
    "the raw consent cookie reached the stored row");
});

test("the column is nullable with no default", () => {
  const schema = read("prisma/schema.prisma");
  assert.ok(/analyticsConsent Boolean\?/.test(schema), "the field is not nullable");

  // Comments stripped first: the migration's own prose explains why there is no
  // DEFAULT, and reading the explanation as the thing it forbids is the kind of
  // false alarm that gets a test deleted instead of fixed.
  const sql = read("prisma/migrations/20261024160000_page_view_consent/migration.sql")
    .split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  assert.ok(/ADD COLUMN "analyticsConsent" BOOLEAN/i.test(sql));
  assert.equal(/DEFAULT/i.test(sql), false,
    "a DEFAULT would turn every pre-existing row and every unanswered banner into 'declined'");
  assert.equal(/NOT NULL/i.test(sql), false, "NOT NULL would make the third state unrepresentable");
});

test("the header no longer calls the route cookieless", () => {
  // It reads one cookie now. Leaving the old word in place would make the
  // file's own stated contract false, which is how the next person gets it
  // wrong.
  const head = read(ROUTE).slice(0, 1400);
  assert.equal(/cookieless page-view tracking/.test(head), false,
    "the header still claims the route is cookieless");
  assert.ok(/cookieConsent/.test(head), "the header does not say which cookie it reads");
});
