import { test } from "node:test";
import assert from "node:assert/strict";
import { decideHealthAction, healthAlertText } from "@/lib/openwa/sessionHealth";

const never = { minutesSinceRestart: null };

test("ready → ok, nothing to do", () => {
  assert.deepEqual(decideHealthAction({ status: "ready", lastError: null }, { consecutiveBad: 0, ...never }), { ok: true, restart: false, alert: null });
});

test("the 2026-10-17 case: failed → restart at once, no alert on the first sighting", () => {
  const obs = { status: "failed", lastError: "WhatsApp Web is connected but its event bridge never attached" };
  assert.deepEqual(decideHealthAction(obs, { consecutiveBad: 1, ...never }), { ok: false, restart: true, alert: null });
});

test("still failed after the restart → alert; no second restart inside the cooldown", () => {
  const obs = { status: "failed", lastError: null };
  assert.deepEqual(decideHealthAction(obs, { consecutiveBad: 2, minutesSinceRestart: 5 }), { ok: false, restart: false, alert: "down" });
  assert.deepEqual(decideHealthAction(obs, { consecutiveBad: 4, minutesSinceRestart: 16 }), { ok: false, restart: true, alert: "down" });
});

test("disconnected and unknown statuses are treated like failed", () => {
  for (const status of ["disconnected", "something-new"]) {
    assert.equal(decideHealthAction({ status, lastError: null }, { consecutiveBad: 1, ...never }).restart, true);
  }
});

test("QR / action required → never restart (it would not help), alert the operator", () => {
  for (const status of ["qr_ready", "action_required"]) {
    assert.deepEqual(decideHealthAction({ status, lastError: null }, { consecutiveBad: 1, ...never }), { ok: false, restart: false, alert: "pairing" });
  }
});

test("initializing is normal for a while; stuck for 3 runs → restart + alert", () => {
  const obs = { status: "initializing", lastError: null };
  assert.deepEqual(decideHealthAction(obs, { consecutiveBad: 2, ...never }), { ok: false, restart: false, alert: null });
  assert.deepEqual(decideHealthAction(obs, { consecutiveBad: 3, ...never }), { ok: false, restart: true, alert: "down" });
});

test("gateway unreachable → nothing to restart; alert once it lasts", () => {
  assert.deepEqual(decideHealthAction(null, { consecutiveBad: 1, ...never }), { ok: false, restart: false, alert: null });
  assert.deepEqual(decideHealthAction(null, { consecutiveBad: 2, ...never }), { ok: false, restart: false, alert: "down" });
});

test("alert texts: pairing explains what to do, down escapes the gateway error", () => {
  assert.match(healthAlertText("pairing", { status: "qr_ready", lastError: null }, false), /Linked devices/);
  const down = healthAlertText("down", { status: "failed", lastError: "<x>" }, true);
  assert.match(down, /&lt;x&gt;/);
  assert.match(down, /automatic restart was just attempted/);
  assert.match(healthAlertText("recovered", null, false), /back/);
  assert.match(healthAlertText("down", { status: "failed", lastError: null }, false, "WhatsApp gateway returned HTTP 400."), /restart failed: WhatsApp gateway returned HTTP 400/);
});
