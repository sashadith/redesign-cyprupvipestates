import { test } from "node:test";
import assert from "node:assert/strict";
// @ts-ignore — jsdom ships no type declarations in this repo (the jsdom QA harnesses are .mjs)
import { JSDOM } from "jsdom";
import {
  readLandingParams, mergeFirstTouch, marketingConsentFrom, attributionTag, parseAttribution,
  captureAttribution, getAttribution, onMarketingConsentChanged, ATTRIBUTION_COOKIE,
} from "@/lib/attribution";
import { attributionOf } from "@/lib/mcp/leadDetail";

/* Partner attribution (2026-09-28): a partner links to
   https://cyprusvipestates.com/?utm_source=alfitouri and every lead that
   follows — on any page, via any form or the WhatsApp button — must carry it. */

test("landing params: utm_*, click ids and the partner ?ref=; an external referrer only", () => {
  assert.deepEqual(readLandingParams("?utm_source=alfitouri&utm_medium=partner&ref=ALF1", "", "cyprusvipestates.com"),
    { utmSource: "alfitouri", utmMedium: "partner", attributionRef: "ALF1" });
  assert.deepEqual(readLandingParams("", "https://www.google.com/", "cyprusvipestates.com"), { referrer: "https://www.google.com/" });
  assert.deepEqual(readLandingParams("", "https://cyprusvipestates.com/projects", "cyprusvipestates.com"), {});
  assert.deepEqual(readLandingParams("?utm_source=%20%20", "", "x"), {}, "a blank value is no value");
});

test("first touch: the stored campaign wins; a later visit without parameters overwrites nothing", () => {
  const partner = { utmSource: "alfitouri" };
  assert.deepEqual(mergeFirstTouch(partner, { utmSource: "google" }), partner);
  assert.deepEqual(mergeFirstTouch(partner, {}), partner);
  assert.deepEqual(mergeFirstTouch(partner, { referrer: "https://x.com/" }), partner);
  assert.equal(mergeFirstTouch(null, {}), null);
});

test("a referrer-only first touch gives way to the first campaign, keeping the referrer", () => {
  // Arrived from Google, then clicked the partner's link in the same visit.
  assert.deepEqual(mergeFirstTouch({ referrer: "https://www.google.com/" }, { utmSource: "alfitouri" }),
    { utmSource: "alfitouri", referrer: "https://www.google.com/" });
  assert.deepEqual(mergeFirstTouch({ referrer: "https://a.com/" }, { referrer: "https://b.com/" }), { referrer: "https://a.com/" });
});

test("consent: only an explicit marketing:true counts", () => {
  const enc = (o: object) => encodeURIComponent(JSON.stringify(o));
  assert.equal(marketingConsentFrom(enc({ necessary: true, analytics: true, marketing: true })), true);
  assert.equal(marketingConsentFrom(JSON.stringify({ marketing: true })), true, "unencoded JSON works too");
  assert.equal(marketingConsentFrom(enc({ necessary: true, analytics: true, marketing: false })), false);
  assert.equal(marketingConsentFrom(null), false);
  assert.equal(marketingConsentFrom("garbage%"), false);
});

test("WhatsApp tag: utm_source and ref, never repeated when the page URL already has them", () => {
  assert.equal(attributionTag({ utmSource: "alfitouri" }, "https://cyprusvipestates.com/projects/x"), " (utm_source=alfitouri)");
  assert.equal(attributionTag({ utmSource: "alfitouri", attributionRef: "ALF1" }, "https://c.com/"), " (utm_source=alfitouri, ref=ALF1)");
  assert.equal(attributionTag({ utmSource: "alfitouri" }, "https://c.com/?utm_source=alfitouri"), "");
  assert.equal(attributionTag({ referrer: "https://www.google.com/" }, "https://c.com/"), "", "a referrer alone is no tag");
  assert.equal(attributionTag(null), "");
});

test("server: the partner ref reaches the lead next to the utm fields", () => {
  const a = parseAttribution({ utmSource: " alfitouri ", attributionRef: "ALF1", utmMedium: "" });
  assert.equal(a.utmSource, "alfitouri");
  assert.equal(a.attributionRef, "ALF1");
  assert.equal(a.utmMedium, null);
});

test("crm_get_lead attribution block: fixed keys, null when unknown", () => {
  assert.deepEqual(attributionOf({ utmSource: "alfitouri", utmMedium: null, utmCampaign: null, attributionRef: "ALF1", referrer: null }),
    { utmSource: "alfitouri", utmMedium: null, utmCampaign: null, ref: "ALF1", referrer: null });
});

/* ── the whole journey in a browser ─────────────────────────────────────── */

function browser(url: string, referrer = "") {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", referrer ? { url, referrer } : { url });
  const g = globalThis as any;
  g.window = dom.window; g.document = dom.window.document; g.location = dom.window.location;
  return {
    dom,
    go(next: string) { dom.reconfigure({ url: next }); },
    consent(marketing: boolean) {
      dom.window.document.cookie = `cookieConsent=${encodeURIComponent(JSON.stringify({ necessary: true, analytics: marketing, marketing }))}; Path=/`;
    },
    attrCookie() { return dom.window.document.cookie.split("; ").find((c: string) => c.startsWith(ATTRIBUTION_COOKIE + "=")) ?? null; },
    newVisit() { dom.window.sessionStorage.clear(); }, // browser closed, cookies kept
  };
}

test("journey: partner link → another page → enquiry keeps the partner (no consent needed within the visit)", () => {
  const b = browser("https://cyprusvipestates.com/?utm_source=alfitouri", "https://alfitouri.example/");
  captureAttribution();
  b.go("https://cyprusvipestates.com/projects/dream-tower");
  captureAttribution();
  assert.equal(getAttribution().utmSource, "alfitouri");
  assert.equal(b.attrCookie(), null, "no 90-day cookie without marketing consent");
});

test("journey: with marketing consent the partner survives a new visit days later", () => {
  const b = browser("https://cyprusvipestates.com/?utm_source=alfitouri&ref=ALF1");
  captureAttribution();
  b.consent(true); onMarketingConsentChanged();
  assert.ok(b.attrCookie(), "cookie written right after consent");
  assert.match(b.attrCookie()!, /alfitouri/);
  b.newVisit();
  b.go("https://cyprusvipestates.com/de/kontakte");
  captureAttribution();
  const a = getAttribution();
  assert.deepEqual([a.utmSource, a.attributionRef], ["alfitouri", "ALF1"]);
});

test("journey: a later visit with other parameters does not overwrite the stored partner", () => {
  const b = browser("https://cyprusvipestates.com/?utm_source=alfitouri");
  b.consent(true);
  captureAttribution();
  b.newVisit();
  b.go("https://cyprusvipestates.com/?utm_source=google&utm_medium=cpc");
  captureAttribution();
  assert.equal(getAttribution().utmSource, "alfitouri");
});

test("journey: refusing marketing consent removes the 90-day cookie", () => {
  const b = browser("https://cyprusvipestates.com/?utm_source=alfitouri");
  b.consent(true); captureAttribution();
  assert.ok(b.attrCookie());
  b.consent(false); onMarketingConsentChanged();
  assert.equal(b.attrCookie(), null);
  assert.equal(getAttribution().utmSource, "alfitouri", "the current visit still knows it (session only)");
});
