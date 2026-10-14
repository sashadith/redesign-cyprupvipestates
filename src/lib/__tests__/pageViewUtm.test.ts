import { test } from "node:test";
import assert from "node:assert/strict";
import { extractUtm, utmFromBody, hasUtm, UTM_MAX } from "@/lib/analytics/pageViewUtm";

test("a URL with extra query parameters yields exactly the three UTM fields", () => {
  const u = extractUtm(
    "https://cyprusvipestates.com/blog/a?fbclid=IwAR123&utm_source=linkedin&gclid=Cj0&utm_medium=social&utm_term=villa&utm_content=hero&utm_campaign=oct&email=a%40b.c&ref=partner#top",
  );
  assert.deepEqual(u, { utmSource: "linkedin", utmMedium: "social", utmCampaign: "oct" });
  assert.deepEqual(Object.keys(u).sort(), ["utmCampaign", "utmMedium", "utmSource"]);
});

test("works on a bare query string and on a path with a query", () => {
  assert.deepEqual(extractUtm("?utm_source=x"), { utmSource: "x", utmMedium: null, utmCampaign: null });
  assert.deepEqual(extractUtm("/de/blog/a?utm_campaign=c1"), { utmSource: null, utmMedium: null, utmCampaign: "c1" });
});

test("no query, empty or blank values → all null", () => {
  assert.deepEqual(extractUtm("/blog/a"), { utmSource: null, utmMedium: null, utmCampaign: null });
  assert.deepEqual(extractUtm(""), { utmSource: null, utmMedium: null, utmCampaign: null });
  assert.deepEqual(extractUtm("?utm_source=&utm_medium=%20%20"), { utmSource: null, utmMedium: null, utmCampaign: null });
  assert.equal(hasUtm(extractUtm("?fbclid=1")), false);
});

test("values are trimmed and capped at 100 characters", () => {
  const long = "a".repeat(250);
  const u = extractUtm(`?utm_source=%20linkedin%20&utm_campaign=${long}`);
  assert.equal(u.utmSource, "linkedin");
  assert.equal(u.utmCampaign!.length, UTM_MAX);
});

test("a beacon body is re-validated: only the three fields, only strings, capped", () => {
  const u = utmFromBody({ utmSource: "linkedin", utmMedium: 42, utmCampaign: "c".repeat(300), utmTerm: "x", fbclid: "y", path: "/?utm_source=z" });
  assert.deepEqual(u, { utmSource: "linkedin", utmMedium: null, utmCampaign: "c".repeat(UTM_MAX) });
  assert.deepEqual(utmFromBody(null), { utmSource: null, utmMedium: null, utmCampaign: null });
});
