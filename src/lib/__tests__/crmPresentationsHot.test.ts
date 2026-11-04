import { test } from "node:test";
import assert from "node:assert/strict";
import { hotSelections, type HotInput } from "../crm/presentations/hot";

const NOW = new Date("2026-10-28T12:00:00Z");
const ago = (h: number) => new Date(NOW.getTime() - h * 3_600_000);
const ahead = (days: number) => new Date(NOW.getTime() + days * 86_400_000);

function input(over: Partial<HotInput> = {}): HotInput {
  return {
    presentationId: "p1", leadId: "l1", leadName: "Ivan P", ownerId: "u1", ownerName: "Anna",
    status: "active", expiresAt: ahead(20), views: [], favorites: [], lastOutboundAt: null,
    projectNames: { d1: "Sea Line" },
    ...over,
  };
}

test("view 49 h ago and nothing else gives nothing", () => {
  assert.deepEqual(hotSelections([input({ views: [{ developmentId: null, durationSec: null, createdAt: ago(49) }] })], NOW), []);
});

test("recent page views are hot; opened counts page-level views only", () => {
  const [r] = hotSelections([input({ views: [
    { developmentId: null, durationSec: null, createdAt: ago(5) },
    { developmentId: null, durationSec: null, createdAt: ago(2) },
    { developmentId: "d1", durationSec: 30, createdAt: ago(1) },
  ] })], NOW);
  assert.equal(r.kind, "hot");
  assert.deepEqual(r.reasons, ["opened 2×"]);
  assert.equal(r.signalAt.getTime(), ago(1).getTime());
});

test("single open reads 'opened'; a long project view adds minutes on the project", () => {
  const [r] = hotSelections([input({ views: [
    { developmentId: null, durationSec: null, createdAt: ago(3) },
    { developmentId: "d1", durationSec: 250, createdAt: ago(2) },
  ] })], NOW);
  assert.deepEqual(r.reasons, ["opened", "4 min on Sea Line"]);
  const [short] = hotSelections([input({ views: [{ developmentId: "d1", durationSec: 65, createdAt: ago(2) }] })], NOW);
  assert.ok(short.reasons.includes("1 min on Sea Line"));
});

test("a favorite in the window is hot with a heart reason", () => {
  const [r] = hotSelections([input({ favorites: [{ name: "Sea Line", favoritedAt: ago(4) }, { name: "Old", favoritedAt: ago(100) }] })], NOW);
  assert.equal(r.kind, "hot"); assert.deepEqual(r.reasons, ["♥ Sea Line"]);
});

test("an outbound contact after the signal drops the row; before it does not", () => {
  const views = [{ developmentId: null, durationSec: null, createdAt: ago(5) }];
  assert.deepEqual(hotSelections([input({ views, lastOutboundAt: ago(1) })], NOW), []);
  assert.equal(hotSelections([input({ views, lastOutboundAt: ago(9) })], NOW).length, 1);
});

test("expired-by-date, revoked and stored-expired selections are excluded", () => {
  const views = [{ developmentId: null, durationSec: null, createdAt: ago(1) }];
  assert.deepEqual(hotSelections([input({ views, expiresAt: ago(2) }), input({ views, status: "revoked" }), input({ views, status: "expired" })], NOW), []);
});

test("expiring: recent view within a week, expiry within 3 days; not duplicated when also hot", () => {
  const old = [{ developmentId: null, durationSec: null, createdAt: ago(24 * 5) }];
  const [e] = hotSelections([input({ views: old, expiresAt: ahead(2) })], NOW);
  assert.equal(e.kind, "expiring"); assert.equal(e.signalAt.getTime(), ago(24 * 5).getTime());
  assert.deepEqual(hotSelections([input({ views: old, expiresAt: ahead(10) })], NOW), []);
  assert.deepEqual(hotSelections([input({ views: [], expiresAt: ahead(2) })], NOW), []);
  const both = hotSelections([input({ views: [...old, { developmentId: null, durationSec: null, createdAt: ago(1) }], expiresAt: ahead(2) })], NOW);
  assert.equal(both.length, 1); assert.equal(both[0].kind, "hot");
});

test("sorted by signalAt, newest first", () => {
  const rows = hotSelections([
    input({ presentationId: "a", views: [{ developmentId: null, durationSec: null, createdAt: ago(10) }] }),
    input({ presentationId: "b", views: [{ developmentId: null, durationSec: null, createdAt: ago(2) }] }),
  ], NOW);
  assert.deepEqual(rows.map((r) => r.presentationId), ["b", "a"]);
});
