import { test } from "node:test";
import assert from "node:assert/strict";
import { readOpenWaConfig } from "@/lib/openwa/config";
import { McpConfigError } from "@/lib/mcp/publicOrigin";

const ok = {
  OPENWA_BASE_URL: "http://127.0.0.1:2785",
  OPENWA_API_KEY: "owa_k1_abc",
  OPENWA_SESSION_ID: "942ae236-9ca9-4b07-9f41-e3c9d4dfb7bb",
  OPENWA_DAILY_SEND_CAP: "20",
};

test("readOpenWaConfig: a complete environment parses", () => {
  const c = readOpenWaConfig(ok as unknown as NodeJS.ProcessEnv);
  assert.equal(c.baseUrl, "http://127.0.0.1:2785");
  assert.equal(c.apiKey, "owa_k1_abc");
  assert.equal(c.dailySendCap, 20);
});

test("readOpenWaConfig: each missing variable is named in the error", () => {
  for (const key of Object.keys(ok)) {
    const env = { ...ok } as Record<string, string>;
    delete env[key];
    assert.throws(
      () => readOpenWaConfig(env as unknown as NodeJS.ProcessEnv),
      (e: unknown) => e instanceof McpConfigError && (e as Error).message.includes(key),
      `${key} missing should name ${key}`,
    );
  }
});

test("readOpenWaConfig: a non-numeric or zero cap is refused", () => {
  assert.throws(() => readOpenWaConfig({ ...ok, OPENWA_DAILY_SEND_CAP: "many" } as unknown as NodeJS.ProcessEnv), McpConfigError);
  assert.throws(() => readOpenWaConfig({ ...ok, OPENWA_DAILY_SEND_CAP: "0" } as unknown as NodeJS.ProcessEnv), McpConfigError);
});
