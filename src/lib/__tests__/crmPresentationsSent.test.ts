import { test } from "node:test";
import assert from "node:assert/strict";
import { sentHistory, sentLabel } from "../crm/presentations/sentHistory";
import type { PresentationListRow } from "../crm/presentations/rows";

function row(id: string, createdAt: string, items: { developmentId: string; views?: number; isFavorited?: boolean }[], over: Partial<PresentationListRow> = {}): PresentationListRow {
  return {
    id, token: id, status: "active", effectiveStatus: "active", createdAt: new Date(createdAt), expiresAt: null,
    advisorName: null, partnerName: null, viewCount: 0, uniqueDays: 0, favoritedCount: 0, lastViewedAt: null,
    items: items.map((i) => ({ developmentId: i.developmentId, developerAccountId: null, name: i.developmentId, isFavorited: i.isFavorited ?? false, views: i.views ?? 0, durationSec: 0 })),
    ...over,
  };
}

test("two selections: newest date, summed views, times 2", () => {
  const h = sentHistory([
    row("a", "2026-10-12T08:00:00Z", [{ developmentId: "d1", views: 3 }]),
    row("b", "2026-10-05T08:00:00Z", [{ developmentId: "d1", views: 2, isFavorited: true }, { developmentId: "d2" }]),
  ]);
  assert.equal(h.d1.lastSentAt.toISOString(), "2026-10-12T08:00:00.000Z");
  assert.equal(h.d1.views, 5); assert.equal(h.d1.times, 2); assert.equal(h.d1.favorited, true);
  assert.equal(h.d2.times, 1);
});

test("partner and revoked selections count; excludeId skips the edited one", () => {
  const rows = [
    row("a", "2026-10-12T08:00:00Z", [{ developmentId: "d1" }], { partnerName: "Ola K" }),
    row("b", "2026-10-05T08:00:00Z", [{ developmentId: "d1" }], { status: "revoked", effectiveStatus: "revoked" }),
  ];
  assert.equal(sentHistory(rows).d1.times, 2);
  const h = sentHistory(rows, "a");
  assert.equal(h.d1.times, 1);
  assert.equal(h.d1.lastSentAt.toISOString(), "2026-10-05T08:00:00.000Z");
});

test("sentLabel variants", () => {
  const at = new Date("2026-10-12T08:00:00Z");
  assert.equal(sentLabel({ lastSentAt: at, views: 3, favorited: true, times: 1 }), "sent 12.10. · 3 views · ♥");
  assert.equal(sentLabel({ lastSentAt: at, views: 0, favorited: false, times: 1 }), "sent 12.10.");
  assert.equal(sentLabel({ lastSentAt: at, views: 1, favorited: false, times: 1 }), "sent 12.10. · 1 view");
  assert.equal(sentLabel({ lastSentAt: at, views: 3, favorited: true, times: 2 }), "sent 2× · last 12.10. · 3 views · ♥");
  // Nicosia date, not UTC: 22:30Z on the 11th is already the 12th there.
  assert.equal(sentLabel({ lastSentAt: new Date("2026-10-11T22:30:00Z"), views: 0, favorited: false, times: 1 }), "sent 12.10.");
});
