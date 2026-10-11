import { test } from "node:test";
import assert from "node:assert/strict";
import robots from "../../app/robots";

// Google's rule: the longest matching Allow/Disallow path wins; on a tie Allow wins.
function allowed(path: string): boolean {
  const rules = robots().rules;
  const list = Array.isArray(rules) ? rules : [rules];
  let best = { len: -1, allow: true };
  for (const r of list) {
    const ua = Array.isArray(r.userAgent) ? r.userAgent : [r.userAgent ?? "*"];
    if (!ua.includes("*")) continue;
    const mk = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []);
    for (const [paths, allow] of [[mk(r.allow), true], [mk(r.disallow), false]] as const) {
      for (const p of paths) {
        if (path.startsWith(p) && (p.length > best.len || (p.length === best.len && allow))) best = { len: p.length, allow };
      }
    }
  }
  return best.allow;
}

test("old project PDFs are crawlable so Google can see the 404 and drop them", () => {
  assert.equal(allowed("/api/projects/en/atrium-apartments/pdf"), true);
  assert.equal(allowed("/api/projects/ru/anything/pdf"), true);
});

test("every other /api route and the private areas stay blocked", () => {
  for (const p of ["/api/cron/publish-scheduled", "/api/mcp", "/api/projects", "/api/other", "/admin", "/admin/content", "/c/abc123", "/_assets/x"]) {
    assert.equal(allowed(p), false, p);
  }
});

test("public pages stay crawlable", () => {
  for (const p of ["/", "/blog/rent-or-buy-property-in-cyprus", "/projects", "/de/projekte"]) assert.equal(allowed(p), true, p);
});
