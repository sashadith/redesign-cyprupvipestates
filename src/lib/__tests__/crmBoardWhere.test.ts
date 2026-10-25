import { test } from "node:test";
import assert from "node:assert/strict";
import { boardWhere } from "@/lib/crm/boardWhere";
import { leadAccessWhere, type CrmUser } from "@/lib/crm/access";
import { EXCLUDE_NEWSLETTER } from "@/lib/crm/leadBucket";

const now = new Date("2026-10-18T12:00:00Z");
const user: CrmUser = { id: "u1", role: "EDITOR", isOwner: false, isActive: true, canSeeColleagues: false, canEditColleagues: false };
const admin: CrmUser = { ...user, id: "a1", role: "ADMIN" };
const ands = (f: "all" | "mine" | "stale", u: CrmUser = user) => (boardWhere(u, f, now) as { AND: unknown[] }).AND;

test("access scope, soft delete and newsletter exclusion are always applied", () => {
  const a = ands("all");
  assert.ok(a.some((x) => JSON.stringify(x) === JSON.stringify(leadAccessWhere(user))));
  assert.ok(a.includes(EXCLUDE_NEWSLETTER));
  assert.ok(a.some((x) => (x as { deletedAt?: unknown }).deletedAt === null));
});

test("unassigned leads are not filtered out: access scope alone decides", () => {
  // A restricted employee is limited to their own leads by leadAccessWhere; a
  // user who sees everyone also sees leads nobody owns yet.
  for (const u of [user, admin]) {
    assert.ok(!JSON.stringify(ands("all", u)).includes(`"assignedToId":{"not":null}`));
  }
  assert.ok(ands("all", user).some((x) => JSON.stringify(x) === JSON.stringify({ assignedToId: "u1" })));
  assert.ok(!ands("all", admin).some((x) => JSON.stringify(x).includes(`"assignedToId"`)));
});

test("Closed leads only appear for 90 days after their last update", () => {
  const w = ands("all").find((x) => Array.isArray((x as { OR?: unknown }).OR)) as { OR: [{ status: unknown }, { updatedAt: { gte: Date } }] };
  assert.ok(w, "closed-window condition missing");
  assert.deepEqual(w.OR[0].status, { not: "CLOSED" });
  assert.equal(w.OR[1].updatedAt.gte.getTime(), new Date("2026-07-20T12:00:00Z").getTime());
});

test("mine adds the assignee condition", () => {
  assert.ok(ands("mine").some((x) => JSON.stringify(x) === JSON.stringify({ assignedToId: "u1" })));
  assert.equal(ands("all").length + 1, ands("mine").length);
});

test("stale is decided in the query, not after the row cap", () => {
  const s = ands("stale").at(-1) as { status: unknown; createdAt: { lt: Date }; interactions: { none: { occurredAt: { gte: Date } } } };
  assert.deepEqual(s.status, { not: "CLOSED" });
  const cutoff = new Date("2026-10-11T12:00:00Z").getTime();
  assert.equal(s.createdAt.lt.getTime(), cutoff);
  assert.equal(s.interactions.none.occurredAt.gte.getTime(), cutoff);
});
