import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPresentationRows, type RawPresentation } from "../crm/presentations/rows";

const NOW = new Date("2026-10-28T12:00:00Z");
const d = (s: string) => new Date(s);

function raw(over: Partial<RawPresentation> = {}): RawPresentation {
  return {
    id: "p1", token: "tok", status: "active", createdAt: d("2026-10-20T10:00:00Z"), expiresAt: d("2026-11-20T00:00:00Z"),
    advisor: { name: "Anna" }, partner: null,
    views: [], items: [],
    ...over,
  } as RawPresentation;
}
const item = (developmentId: string, o: { aliasName?: string | null; alias?: string | null; publicName?: string; fav?: boolean } = {}) => ({
  developmentId, aliasName: o.aliasName ?? null, isFavorited: o.fav ?? false,
  development: { publicName: o.publicName ?? "Pub " + developmentId, developerAccountId: "acc", override: o.alias ? { alias: o.alias } : null },
});

test("expired by date becomes effectiveStatus expired; revoked stays", () => {
  const [a, b, c] = buildPresentationRows([
    raw({ expiresAt: d("2026-10-27T00:00:00Z") }),
    raw({ id: "p2", status: "revoked", expiresAt: d("2026-10-01T00:00:00Z") }),
    raw({ id: "p3", expiresAt: null }),
  ], NOW);
  assert.equal(a.effectiveStatus, "expired"); assert.equal(a.status, "active");
  assert.equal(b.effectiveStatus, "revoked");
  assert.equal(c.effectiveStatus, "active");
});

test("per-item views and duration only from views of that development", () => {
  const [r] = buildPresentationRows([raw({
    items: [item("d1"), item("d2")],
    views: [
      { developmentId: "d1", durationSec: 30, createdAt: d("2026-10-21T10:00:00Z") },
      { developmentId: "d1", durationSec: null, createdAt: d("2026-10-21T11:00:00Z") },
      { developmentId: "d2", durationSec: 90, createdAt: d("2026-10-22T10:00:00Z") },
      { developmentId: null, durationSec: null, createdAt: d("2026-10-23T10:00:00Z") },
    ],
  })], NOW);
  assert.deepEqual(r.items.map((i) => [i.developmentId, i.views, i.durationSec]), [["d1", 2, 30], ["d2", 1, 90]]);
  assert.equal(r.viewCount, 4);
});

test("uniqueDays counts distinct UTC dates; lastViewedAt is newest", () => {
  const [r] = buildPresentationRows([raw({ views: [
    { developmentId: null, durationSec: null, createdAt: d("2026-10-21T23:30:00Z") },
    { developmentId: null, durationSec: null, createdAt: d("2026-10-21T01:00:00Z") },
    { developmentId: null, durationSec: null, createdAt: d("2026-10-22T00:10:00Z") },
  ] })], NOW);
  assert.equal(r.uniqueDays, 2);
  assert.equal(r.lastViewedAt!.toISOString(), "2026-10-22T00:10:00.000Z");
  assert.equal(buildPresentationRows([raw()], NOW)[0].lastViewedAt, null);
});

test("partner and advisor names pass through", () => {
  const [r] = buildPresentationRows([raw({ partner: { firstName: "Ola", lastName: "K" } })], NOW);
  assert.equal(r.advisorName, "Anna"); assert.equal(r.partnerName, "Ola K");
  assert.equal(buildPresentationRows([raw({ advisor: null })], NOW)[0].advisorName, null);
});

test("name precedence: aliasName, override alias, publicName; favorites counted", () => {
  const [r] = buildPresentationRows([raw({ items: [
    item("a", { aliasName: "Mine", alias: "Ov", fav: true }), item("b", { alias: "Ov" }), item("c", {}),
  ] })], NOW);
  assert.deepEqual(r.items.map((i) => i.name), ["Mine", "Ov", "Pub c"]);
  assert.equal(r.favoritedCount, 1);
  assert.equal(r.items[0].developerAccountId, "acc");
});
