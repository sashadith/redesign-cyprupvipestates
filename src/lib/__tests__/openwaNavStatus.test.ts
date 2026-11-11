// The OpenWA status dot on the admin nav button (2026-11-11).
//
// The dot and the Telegram watchdog read the same gateway and must not tell two
// different stories about it: a green button while the cron is alerting is
// worse than no button, because it is believed. The first test below walks
// every status the gateway can report through both and demands they agree on
// the only thing both claim to know — whether this is healthy.
//
// Nothing here opens a Prisma client or touches the gateway; openwaNavStatus
// and decideHealthAction are pure, which is why the mapping lives apart from
// the route that fetches it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { openwaNavStatus } from "@/lib/openwa/navStatus";
import { decideHealthAction, type SessionStatus } from "@/lib/openwa/sessionHealth";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

// Every status OpenWA reports, from the SessionStatus union.
const ALL: SessionStatus[] = [
  "created", "initializing", "qr_ready", "authenticating", "ready",
  "disconnected", "action_required", "failed",
];

test("the dot and the health watchdog agree on what 'healthy' means", () => {
  for (const status of ALL) {
    const nav = openwaNavStatus(status);
    const health = decideHealthAction({ status, lastError: null }, { consecutiveBad: 1, minutesSinceRestart: null });
    assert.equal(
      nav.tone === "ok",
      health.ok,
      `${status}: the nav says ${nav.tone} while the watchdog says ok=${health.ok}`,
    );
  }
  // A gateway that does not answer at all is an outage in both.
  assert.equal(openwaNavStatus(null).tone, "alarm");
  assert.equal(decideHealthAction(null, { consecutiveBad: 1, minutesSinceRestart: null }).ok, false);
});

test("the two statuses only a human can fix are the loud ones", () => {
  // qr_ready and action_required are what sessionHealth.ts sends the "pairing"
  // alert for: no restart helps, somebody has to scan a QR code. They are the
  // reason this dot exists, so they must not be amber.
  for (const status of ["qr_ready", "action_required"] as const) {
    const nav = openwaNavStatus(status);
    assert.equal(nav.tone, "alarm", `${status} must be an alarm`);
    assert.equal(nav.short, "SCAN QR", `${status} must say what to do`);
    assert.match(nav.label, /QR code/);
  }
});

test("statuses that fix themselves are amber, and no status is silent", () => {
  for (const status of ["disconnected", "created", "initializing", "authenticating"] as const) {
    assert.equal(openwaNavStatus(status).tone, "warn", `${status} must be amber, not red`);
  }
  // Healthy is the only state with no words under the label.
  assert.equal(openwaNavStatus("ready").short, "");
  for (const status of ALL.filter((s) => s !== "ready")) {
    assert.ok(openwaNavStatus(status).short.length > 0, `${status} must name itself on the button`);
  }
  // An unseen status must still be visible rather than passing for healthy.
  assert.equal(openwaNavStatus("something-new").tone, "warn");
});

test("a missing OPENWA_* configuration is not an alarm", () => {
  // A dev machine has no gateway. A red button there is an alarm nobody can
  // act on, and those are the ones that teach people to ignore the colour.
  const s = openwaNavStatus("unconfigured");
  assert.equal(s.tone, "unknown");
  assert.equal(s.short, "");
});

test("the endpoint is admin-only and separates 'unreachable' from 'unconfigured'", () => {
  const route = read("src/app/api/admin/openwa-status/route.ts");
  assert.match(route, /role !== "ADMIN"/, "the gateway's state is not an editor's business");
  assert.match(route, /isActive/, "a deactivated user must not keep reading admin data");
  // A missing variable and a dead gateway look identical from the catch block
  // unless the error type is checked; one is a red button, the other is none.
  assert.match(route, /e instanceof McpConfigError \? "unconfigured" : null/);
});

test("the sidebar asks for the status, and only where the button exists", () => {
  const src = read("src/app/admin/(panel)/Sidebar.tsx");
  assert.match(src, /fetch\("\/api\/admin\/openwa-status"/, "the hook must call the route that exists");
  assert.match(
    src,
    /useOpenWaStatus\(modulesProp\.some\(\(m\) => m\.key === "openwa"\)\)/,
    "an editor has no OpenWA button, so their browser must not poll for it",
  );
  // Fetched after mount, like the Action Center count: a decoration that blocks
  // the page it decorates cost every admin page ~2 s once already.
  assert.match(src, /useEffect\(\(\) => \{\n    if \(!enabled\) return;/);
  assert.match(src, /document\.hidden/, "a hidden tab must not poll");
  // Both nav surfaces show it — the rail (desktop) and the drawer (mobile).
  assert.equal(Array.from(src.matchAll(/statusOf\(m\)/g)).length > 1, true);
  assert.match(src, /animate-ping/, "the alarm state has to catch the eye");
});
