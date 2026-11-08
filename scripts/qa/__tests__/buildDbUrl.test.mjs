// The build-time pool cap must land on the URL exactly once (2026-11-08).
//
// deploy-prod.sh caps Prisma's pool for `next build` only — one worker per CPU,
// each with its own pool. The cap used to be appended blindly, which was fine
// until the SERVING pool was raised by putting connection_limit=15 into the real
// .env: a blind append then produced the parameter twice and left the winner to
// whichever parser read it. These cases pin "strip, then set once".
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "build-db-url.sh");
const run = (url, ...rest) => {
  const r = spawnSync("bash", [SCRIPT, url, ...rest], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
};
const BASE = "postgresql://u:p@h:5433/db";

test("an existing cap is replaced, never duplicated", () => {
  const out = run(`${BASE}?schema=public&connection_limit=15&pool_timeout=20`);
  assert.equal(out, `${BASE}?schema=public&connection_limit=5&pool_timeout=30`);
  assert.equal(out.match(/connection_limit=/g).length, 1, "exactly one connection_limit");
  assert.equal(out.match(/pool_timeout=/g).length, 1, "exactly one pool_timeout");
});

test("other parameters survive, in any position", () => {
  assert.equal(run(`${BASE}?schema=public`), `${BASE}?schema=public&connection_limit=5&pool_timeout=30`);
  // The stripped parameter sat FIRST — the leftover "?&" must not survive.
  assert.equal(run(`${BASE}?connection_limit=15&schema=public`), `${BASE}?schema=public&connection_limit=5&pool_timeout=30`);
  assert.ok(!run(`${BASE}?connection_limit=15&schema=public`).includes("?&"));
});

test("a URL left with no query string gets ? and not &", () => {
  assert.equal(run(BASE), `${BASE}?connection_limit=5&pool_timeout=30`);
  assert.equal(run(`${BASE}?connection_limit=15`), `${BASE}?connection_limit=5&pool_timeout=30`);
  assert.ok(!run(`${BASE}?connection_limit=15`).includes("?&"));
});

test("the password and the rest of the URL are passed through untouched", () => {
  // Deliberately NOT parsed as a URL object anywhere: re-encoding a password
  // with special characters would silently produce a URL that cannot connect.
  const hairy = "postgresql://user:p%40ss%2Fword!@host:5433/db?schema=public&connection_limit=15";
  assert.ok(run(hairy).startsWith("postgresql://user:p%40ss%2Fword!@host:5433/db?schema=public&"));
});

test("the limits are overridable, so the caller owns the numbers", () => {
  assert.equal(run(`${BASE}?schema=public`, "9", "45"), `${BASE}?schema=public&connection_limit=9&pool_timeout=45`);
});

test("a missing URL is a hard error, never a silently empty one", () => {
  const r = spawnSync("bash", [SCRIPT], { encoding: "utf8" });
  assert.notEqual(r.status, 0);
});
