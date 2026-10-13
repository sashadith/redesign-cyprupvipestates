// What the admin layout is allowed to await before the page can render.
//
// The Action Center used to be computed inside the layout, so every admin page
// waited for it. Measured on the server 2026-10-13, three consecutive runs:
// 1835 / 2491 / 2065 ms — against 72 ms for all seven of the layout's own
// queries combined. One number in the nav cost two seconds on every page.
//
// It now loads from /api/admin/action-center-count after the page renders. This
// test exists because that is exactly the kind of change that quietly reverts:
// the call is a one-liner, the layout is where the nav is assembled, and putting
// it back looks like tidying up. Nothing else would notice — the page would
// simply be two seconds slower again, which is invisible in a diff.
//
// Reads the source; no DB, no React.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const layout = () => readFileSync(join(process.cwd(), "src/app/admin/(panel)/layout.tsx"), "utf8");

test("the admin layout does not await the Action Center", () => {
  const src = layout();
  assert.equal(
    /getActionCenterItems\s*\(/.test(src), false,
    "layout.tsx calls getActionCenterItems() again — that is ~2s on every admin page. " +
    "It belongs in src/app/api/admin/action-center-count/route.ts, fetched by the sidebar after render.",
  );
  assert.equal(
    /getActionCenterGrouped\s*\(/.test(src), false,
    "layout.tsx calls getActionCenterGrouped() — same cost, same problem.",
  );
});

test("the badge endpoint still exists and is session-guarded", () => {
  // If someone deletes the route, the badge silently stops appearing — the
  // sidebar swallows fetch failures on purpose, so nothing else would complain.
  const route = readFileSync(join(process.cwd(), "src/app/api/admin/action-center-count/route.ts"), "utf8");
  assert.ok(/getActionCenterItems/.test(route), "the endpoint no longer computes the count");
  assert.ok(/await auth\(\)/.test(route), "the endpoint lost its session check");
  assert.ok(/isActive/.test(route), "the endpoint no longer re-checks isActive against the DB (audit M3)");
});
