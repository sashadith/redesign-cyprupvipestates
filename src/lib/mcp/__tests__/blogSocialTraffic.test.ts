import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyReferrer, classifyUtmSource, blogPathInfo } from "@/lib/blog/socialTraffic";

test("referrer hosts classify by exact domain or subdomain — never by bare suffix", () => {
  assert.equal(classifyReferrer("linkedin.com"), "linkedin");
  assert.equal(classifyReferrer("www.linkedin.com"), "linkedin");
  assert.equal(classifyReferrer("lnkd.in"), "linkedin");
  assert.equal(classifyReferrer("x.com"), "x");
  assert.equal(classifyReferrer("t.co"), "x");
  assert.equal(classifyReferrer("mobile.twitter.com"), "x");
  assert.equal(classifyReferrer("box.com"), null);
  assert.equal(classifyReferrer("notlinkedin.com"), null);
  assert.equal(classifyReferrer("google.com"), null);
  assert.equal(classifyReferrer(null), null);
});

test("utm_source maps linkedin / x / twitter, case-insensitively", () => {
  assert.equal(classifyUtmSource("LinkedIn"), "linkedin");
  assert.equal(classifyUtmSource("x"), "x");
  assert.equal(classifyUtmSource("twitter"), "x");
  assert.equal(classifyUtmSource("facebook"), null);
});

test("blog paths resolve to locale + slug; /en/ is never served; non-blog paths are null", () => {
  assert.deepEqual(blogPathInfo("/blog/apartment-or-villa-in-cyprus"), { locale: "en", slug: "apartment-or-villa-in-cyprus" });
  assert.deepEqual(blogPathInfo("/de/blog/wohnung-oder-villa/"), { locale: "de", slug: "wohnung-oder-villa" });
  assert.equal(blogPathInfo("/en/blog/x"), null);
  assert.equal(blogPathInfo("/he/blog/x"), null);
  assert.equal(blogPathInfo("/blog"), null);
  assert.equal(blogPathInfo("/projects/x"), null);
});
