// The Developments module declares its pages twice, and the two copies drifted
// apart twice.
//
// layout.tsx's buildModules() drives the collapsed icon rail. Sidebar.tsx's
// DevelopmentsNavPanel is a hand-written list — it has to be, because the panel
// above it is the developer list rather than a page list — and it is the only
// one a user actually sees, because the panel is expanded by default.
//
// Publishing Queue was in `pages` and not in the panel: reachable only by
// typing its URL. A comment was added saying "anything added to that module's
// pages has to be added here too". On 2026-10-10 Xellex Bridge was added to
// `pages` and not to the panel, its active state was verified against
// resolveActive() — which governs the rail, not the panel — and the navigation
// was declared working. The operator could not find the link.
//
// A comment did not hold these together, so this does. Reads the two sources
// and compares them; no DB, no React.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(process.cwd(), "src/app/admin/(panel)", p), "utf8");

/** hrefs of the `developments` module as declared in buildModules(). */
function hrefsFromLayout(): string[] {
  const src = read("layout.tsx");
  const start = src.indexOf('key: "developments"');
  assert.notEqual(start, -1, "the developments module disappeared from buildModules()");
  const pagesAt = src.indexOf("pages: [", start);
  const end = src.indexOf("],", pagesAt);
  assert.ok(pagesAt !== -1 && end > pagesAt, "could not read the developments module's pages array");
  return Array.from(src.slice(pagesAt, end).matchAll(/href: "([^"]+)"/g)).map((m) => m[1]);
}

/** hrefs the hand-written DevelopmentsNavPanel actually renders. */
function hrefsFromPanel(): string[] {
  const src = read("Sidebar.tsx");
  const start = src.indexOf("function DevelopmentsNavPanel");
  assert.notEqual(start, -1, "DevelopmentsNavPanel was renamed or removed");
  const end = src.indexOf("export default function Sidebar", start);
  return Array.from(src.slice(start, end).matchAll(/simple\("([^"]+)"/g)).map((m) => m[1]);
}

test("every Developments page in the rail is also in the visible panel", () => {
  const rail = hrefsFromLayout();
  const panel = hrefsFromPanel();
  assert.ok(rail.length > 0 && panel.length > 0, "one of the two lists came back empty — the parse broke, not the nav");
  const missing = rail.filter((h) => panel.indexOf(h) === -1);
  assert.deepEqual(
    missing, [],
    `declared in layout.tsx but not rendered by DevelopmentsNavPanel, so reachable only by typing the URL: ${missing.join(", ")}`,
  );
});

test("the visible panel does not render a page the module never declared", () => {
  const rail = hrefsFromLayout();
  const panel = hrefsFromPanel();
  const extra = panel.filter((h) => rail.indexOf(h) === -1);
  assert.deepEqual(extra, [], `rendered in the panel but missing from the rail: ${extra.join(", ")}`);
});

test("Xellex Bridge specifically — it publishes a catalogue to a second domain", () => {
  // Named rather than left to the set comparison: an operator who cannot find
  // this screen cannot stop a delivery that is already running.
  assert.ok(hrefsFromPanel().indexOf("/admin/feeds/bridge") !== -1, "the Xellex Bridge link is not in the visible sidebar");
});
