import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyReferrer, classifyUtmSource, blogPathInfo, aggregateViews, NETWORKS, NOT_SET, type ViewRow } from "@/lib/blog/socialTraffic";

test("referrer hosts classify by exact domain or subdomain — never by bare suffix", () => {
  assert.equal(classifyReferrer("linkedin.com"), "linkedin");
  assert.equal(classifyReferrer("www.linkedin.com"), "linkedin");
  assert.equal(classifyReferrer("lnkd.in"), "linkedin");
  assert.equal(classifyReferrer("x.com"), "x");
  assert.equal(classifyReferrer("t.co"), "x");
  assert.equal(classifyReferrer("mobile.twitter.com"), "x");
  assert.equal(classifyReferrer("com.linkedin.android"), "linkedin"); // Android app referrer, as stored at ingestion
  assert.equal(classifyReferrer("com.twitter.android"), "x");
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

test("blog paths resolve to locale + slug; the legacy /en/ prefix counts as en; non-blog paths are null", () => {
  assert.deepEqual(blogPathInfo("/blog/apartment-or-villa-in-cyprus"), { locale: "en", slug: "apartment-or-villa-in-cyprus" });
  assert.deepEqual(blogPathInfo("/de/blog/wohnung-oder-villa/"), { locale: "de", slug: "wohnung-oder-villa" });
  assert.deepEqual(blogPathInfo("/en/blog/x"), { locale: "en", slug: "x" }); // Lead.pageSource can carry the legacy prefix
  assert.equal(blogPathInfo("/he/blog/x"), null);
  assert.equal(blogPathInfo("/blog"), null);
  assert.equal(blogPathInfo("/projects/x"), null);
});

test("Threads, Bluesky and Substack referrers classify by domain, subdomain and Android app", () => {
  assert.equal(classifyReferrer("threads.com"), "threads");
  assert.equal(classifyReferrer("threads.net"), "threads");
  assert.equal(classifyReferrer("l.threads.com"), "threads"); // Threads' outbound link shim
  assert.equal(classifyReferrer("www.threads.net"), "threads");
  assert.equal(classifyReferrer("com.instagram.barcelona"), "threads"); // Threads Android app
  assert.equal(classifyReferrer("bsky.app"), "bluesky");
  assert.equal(classifyReferrer("go.bsky.app"), "bluesky");
  assert.equal(classifyReferrer("xyz.blueskyweb.app"), "bluesky");
  assert.equal(classifyReferrer("substack.com"), "substack");
  assert.equal(classifyReferrer("cyprusinsider.substack.com"), "substack");
  assert.equal(classifyReferrer("com.substack.app"), "substack");
  // bare-suffix look-alikes never match
  assert.equal(classifyReferrer("notthreads.com"), null);
  assert.equal(classifyReferrer("evilsubstack.com"), null);
  assert.equal(classifyReferrer("bsky.app.example.com"), null);
  assert.equal(classifyReferrer("com.instagram.android"), null); // Instagram is not Threads
});

test("utm_source names map to the new networks too", () => {
  assert.equal(classifyUtmSource("Threads"), "threads");
  assert.equal(classifyUtmSource("bsky"), "bluesky");
  assert.equal(classifyUtmSource("bluesky"), "bluesky");
  assert.equal(classifyUtmSource("substack"), "substack");
});

const key = () => "A";
const v = (o: Partial<ViewRow>): ViewRow => ({ path: "/blog/a", referrer: null, visitorHash: "h1", ...o });

test("old rows without UTM still count by referrer, in totals and per locale", () => {
  const r = aggregateViews(
    [v({ referrer: "linkedin.com" }), v({ referrer: "go.bsky.app", visitorHash: "h2" }), v({ path: "/de/blog/a", referrer: "l.threads.com" }), v({ path: "/pl/blog/a", referrer: "x.substack.com" })],
    key,
  );
  const a = r.perArticle.get("A")!;
  assert.deepEqual(NETWORKS.map((n) => a.all[n].visits), [1, 0, 1, 1, 1]);
  assert.equal(a.byLocale.get("de")!.threads.visits, 1);
  assert.equal(a.byLocale.get("pl")!.substack.visits, 1);
  assert.equal(a.byLocale.get("en")!.bluesky.visits, 1);
  assert.equal(r.totals.all.bluesky.visits, 1);
  assert.equal(a.utm.bySource.size, 0); // nothing tagged → no UTM groups
});

test("a tagged view counts ONLY by UTM — by source and by campaign, never in its referrer group", () => {
  const r = aggregateViews(
    [
      v({ referrer: "linkedin.com", utmSource: "LinkedIn", utmCampaign: "October-Guide" }),
      v({ referrer: "linkedin.com", utmSource: "linkedin", utmCampaign: "october-guide", visitorHash: "h2" }),
      v({ referrer: null, utmSource: "newsletter", utmMedium: "email" }), // no campaign
      v({ referrer: "linkedin.com" }), // untagged → referrer
    ],
    key,
  );
  const a = r.perArticle.get("A")!;
  assert.equal(a.all.linkedin.visits, 1);
  assert.deepEqual(Object.fromEntries(Array.from(a.utm.bySource, ([k, c]) => [k, [c.visits, c.hashes.size]])), { linkedin: [2, 2], newsletter: [1, 1] });
  assert.deepEqual(Object.fromEntries(Array.from(a.utm.byCampaign, ([k, c]) => [k, c.visits])), { "october-guide": 2, [NOT_SET]: 1 });
  assert.equal(r.totals.utm.bySource.get("linkedin")!.visits, 2);
  assert.equal(r.totals.all.linkedin.visits, 1);
});

test("views on other pages or unknown articles are not counted", () => {
  const r = aggregateViews([v({ path: "/projects/x", referrer: "linkedin.com" }), v({ referrer: "linkedin.com" })], () => null);
  assert.equal(r.perArticle.size, 0);
  assert.equal(r.totals.all.linkedin.visits, 0);
});
