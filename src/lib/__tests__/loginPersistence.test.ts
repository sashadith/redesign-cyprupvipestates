import { test } from "node:test";
import assert from "node:assert/strict";
import {
  REMEMBER_MS, SHORT_SESSION_MS, adminSessionExpired, partnerSessionMs, partnerSessionWasRemembered, wantsRemember,
} from "@/lib/loginPersistence";

const H = 3_600_000;

test("checkbox values: only a ticked box counts as remember", () => {
  assert.equal(wantsRemember("on"), true);
  assert.equal(wantsRemember("true"), true);
  assert.equal(wantsRemember(true), true);
  for (const v of [undefined, null, "", "false", "off", false, "1"]) assert.equal(wantsRemember(v), false, String(v));
});

test("admin, unticked: still in at 7h59, out at 8h — the old fixed lifetime", () => {
  const loginAt = 1_000_000;
  assert.equal(adminSessionExpired({ remember: false, loginAt }, loginAt + 8 * H - 60_000), false);
  assert.equal(adminSessionExpired({ remember: false, loginAt }, loginAt + 8 * H), true);
});

test("admin, ticked: the 8h cut never applies (the 30-day JWT expiry does)", () => {
  assert.equal(adminSessionExpired({ remember: true, loginAt: 0 }, 29 * 24 * H), false);
});

test("partner session length: 30 days ticked, 8 hours unticked", () => {
  assert.equal(partnerSessionMs(true), 30 * 24 * H);
  assert.equal(partnerSessionMs(false), 8 * H);
  assert.equal(REMEMBER_MS, partnerSessionMs(true));
  assert.equal(SHORT_SESSION_MS, partnerSessionMs(false));
});

test("partner: a re-created session keeps the kind it replaces (password change)", () => {
  const createdAt = new Date("2026-10-26T08:00:00Z");
  assert.equal(partnerSessionWasRemembered({ createdAt, expiresAt: new Date(createdAt.getTime() + REMEMBER_MS) }), true);
  assert.equal(partnerSessionWasRemembered({ createdAt, expiresAt: new Date(createdAt.getTime() + SHORT_SESSION_MS) }), false);
});
