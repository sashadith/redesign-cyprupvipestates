// The engagement beacons, and the markers they depend on.
//
// This measurement exists to answer one question: of the 4,085 real visitors
// who reached a project page in 90 days and the 12 who enquired, did the rest
// see the form and decline, or never scroll to it? Those have opposite fixes.
//
// Every failure mode here is silent. A renamed data attribute, a selector that
// stops matching after a restyle, an event type the server quietly drops — none
// of them throw, none fail a build, and all of them produce the same output: a
// zero. A zero reads as "nobody clicks this", which is indistinguishable from
// "we stopped measuring". That is what these assertions are for.
//
// Reads the source; no DB, no React, no network.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const TRACKER = "src/app/components/EngagementTracker/EngagementTracker.tsx";
const ROUTE = "src/app/api/analytics/event/route.ts";
const BODY = "src/app/preview-project/ProjectPageBody.tsx";
const WA = "src/app/components/WhatsAppButton/WhatsAppButton.tsx";

test("every event type the client sends is one the server accepts", () => {
  // A type the client fires and the server drops is the worst case: the page
  // looks instrumented, the table stays empty, and nothing anywhere complains.
  const client = Array.from(read(TRACKER).matchAll(/send\("([a-z_0-9]+)"\)/g)).map((m) => m[1]);
  const marks = Array.from(read(TRACKER).matchAll(/\[\s*0?\.\d+,\s*"([a-z_0-9]+)"\s*\]/g)).map((m) => m[1]);
  const all = Array.from(new Set([...client, ...marks]));
  const served = read(ROUTE).match(/const TYPES = new Set\(\[([^\]]+)\]\)/);
  assert.ok(served, "the server's TYPES set is gone — every event would be dropped");
  const accepted = Array.from(served[1].matchAll(/"([a-z_0-9]+)"/g)).map((m) => m[1]);
  assert.ok(all.length >= 5, `expected at least 5 client event types, found ${all.length}: ${all.join(", ")}`);
  const unknown = all.filter((t) => accepted.indexOf(t) === -1);
  assert.deepEqual(unknown, [], `client sends types the server drops: ${unknown.join(", ")}`);
});

test("the markers the tracker queries for actually exist in the page", () => {
  // The tracker finds its targets by data-engage attribute. If a marker is
  // removed or renamed during a restyle, the observer silently observes
  // nothing and the metric reads zero forever.
  const body = read(BODY);
  assert.ok(/data-engage="form"/.test(body), 'the enquiry form lost data-engage="form"');
  assert.ok(/data-engage="cta"/.test(body), 'the hero CTA lost data-engage="cta"');
  assert.ok(/data-engage="wa"/.test(read(WA)), 'the WhatsApp button lost data-engage="wa"');
  assert.ok(/querySelector\('\[data-engage="form"\]'\)/.test(read(TRACKER)), "the tracker no longer looks for the form marker");
});

test("both enquiry containers are marked, not just the one that usually renders", () => {
  // A project page renders either the sold-out form or the normal one. Marking
  // only the common case would make every sold-out page report zero form views.
  const body = read(BODY);
  const marked = (body.match(/<div id="enquiry" data-engage="form">/g) || []).length;
  const total = (body.match(/<div id="enquiry"/g) || []).length;
  assert.equal(marked, total, `${total} enquiry containers, only ${marked} marked`);
});

test("the tracker is rendered by ProjectPageBody", () => {
  assert.ok(/<EngagementTracker/.test(read(BODY)), "ProjectPageBody no longer renders EngagementTracker");
});

test("each event fires at most once per page view", () => {
  // Without this a scroll_50 count is "times anyone scrolled past half",
  // not "visitors who got halfway" — a number that looks like engagement and
  // measures restlessness.
  const src = read(TRACKER);
  assert.ok(/const sent = new Set/.test(src), "the once-per-view guard is gone");
  assert.ok(/if \(sent\.has\(type\)\) return;/.test(src), "send() no longer short-circuits on an already-sent type");
});

test("the server keeps the same privacy and bot contract as the page-view route", () => {
  const src = read(ROUTE);
  assert.ok(/isbot\(/.test(src), "bot detection dropped — engagement rates would be inflated against honest view counts");
  assert.ok(/visitorHash/.test(src) && /sha256/.test(src), "the daily-rotating visitor hash is gone");
  assert.equal(/\bip\b\s*:/.test(src), false, "an IP address must never be stored");
  assert.ok(/UUID_RE\.test\(rawId\)/.test(src), "contentId is no longer validated as a UUID — a slug would look joinable and match nothing");
});
