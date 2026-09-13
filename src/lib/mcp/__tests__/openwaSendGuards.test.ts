import { test } from "node:test";
import assert from "node:assert/strict";
import { decideSend, nicosiaDayStart } from "@/lib/openwa/sendGuards";

const good = { leadExists: true, chatId: "447787597514@c.us", threadExists: true, sentToday: 0, dailyCap: 20 };

test("decideSend: all four guards satisfied", () => {
  assert.deepEqual(decideSend(good), { allowed: true });
});

test("decideSend: refuses an unknown or deleted lead", () => {
  const d = decideSend({ ...good, leadExists: false });
  assert.equal(d.allowed, false);
  assert.equal(d.allowed === false && d.code, "not_found");
});

test("decideSend: refuses a lead with no usable number", () => {
  const d = decideSend({ ...good, chatId: null });
  assert.equal(d.allowed === false && d.code, "validation");
});

test("decideSend: refuses when no thread exists — no cold-starting a conversation", () => {
  const d = decideSend({ ...good, threadExists: false });
  assert.equal(d.allowed === false && d.code, "validation");
  assert.match(d.allowed === false ? d.reason : "", /no existing WhatsApp conversation/i);
});

test("decideSend: the cap boundary — at the limit refuses, one below sends", () => {
  assert.equal(decideSend({ ...good, sentToday: 19, dailyCap: 20 }).allowed, true);
  const d = decideSend({ ...good, sentToday: 20, dailyCap: 20 });
  assert.equal(d.allowed === false && d.code, "rate_limited");
});

test("decideSend: a missing lead is reported before a missing number", () => {
  const d = decideSend({ ...good, leadExists: false, chatId: null });
  assert.equal(d.allowed === false && d.code, "not_found");
});

test("nicosiaDayStart: the window starts at local midnight, not UTC midnight", () => {
  // 2026-08-15 00:30 Nicosia (UTC+3 in summer) is 2026-08-14 21:30 UTC;
  // the day it belongs to must start at 2026-08-14T21:00:00Z.
  assert.equal(nicosiaDayStart(new Date("2026-08-14T21:30:00Z")).toISOString(), "2026-08-14T21:00:00.000Z");
  // Just before that instant, we are still in the previous Nicosia day.
  assert.equal(nicosiaDayStart(new Date("2026-08-14T20:59:00Z")).toISOString(), "2026-08-13T21:00:00.000Z");
});
