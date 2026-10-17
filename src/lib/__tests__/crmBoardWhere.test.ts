import { test } from "node:test";
import assert from "node:assert/strict";
import { boardWhere } from "@/lib/crm/boardWhere";
import { leadAccessWhere, type CrmUser } from "@/lib/crm/access";
import { EXCLUDE_NEWSLETTER } from "@/lib/crm/leadBucket";

const now = new Date("2026-10-18T12:00:00Z");
const user: CrmUser = { id: "u1", role: "EDITOR", isOwner: false, isActive: true, canSeeColleagues: false, canEditColleagues: false };
const ands = (f: "all" | "mine" | "stale") => (boardWhere(user, f, now) as { AND: unknown[] }).AND;

test("access scope, soft delete, assignment and newsletter exclusion are always applied", () => {
  const a = ands("all");
  assert.ok(a.some((x) => JSON.stringify(x) === JSON.stringify(leadAccessWhere(user))));
  assert.ok(a.includes(EXCLUDE_NEWSLETTER));
  const base = a.find((x) => (x as { deletedAt?: unknown }).deletedAt === null) as { assignedToId: unknown };
  assert.deepEqual(base.assignedToId, { not: null });
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
