// deploy-prod.sh refuses to START a deploy in the windows before the heavy
// nightly syncs (2026-10-15; gsc-sync died on 2026-10-14 under a concurrent
// build). Runs the real script with --check-window and a faked UTC clock — no
// git, no SSH, nothing deployed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "deploy-prod.sh");
const run = (hhmm, extra = {}) =>
  spawnSync("bash", [SCRIPT, "--check-window"], { env: { ...process.env, CVP_DEPLOY_NOW_UTC: hhmm, CVP_DEPLOY_IGNORE_QUIET: "", ...extra }, encoding: "utf8" });

test("refused from 20 min before feed-sync until drive-sync is done (03:40–04:40 UTC)", () => {
  for (const t of ["0340", "0359", "0400", "0430", "0439"]) assert.equal(run(t).status, 98, t);
  for (const t of ["0339", "0440"]) assert.equal(run(t).status, 0, t);
});

test("refused around gsc-sync (05:10–05:40 UTC)", () => {
  for (const t of ["0510", "0530", "0539"]) assert.equal(run(t).status, 98, t);
  for (const t of ["0509", "0540", "1200", "0000", "2359"]) assert.equal(run(t).status, 0, t);
});

test("the refusal names the window and the next allowed start", () => {
  const r = run("0525");
  assert.match(r.stdout, /05:10–05:40 UTC \(gsc-sync 05:30\)/);
  assert.match(r.stdout, /Next allowed start: 05:40 UTC/);
});

test("CVP_DEPLOY_IGNORE_QUIET=1 overrides, loudly", () => {
  const r = run("0530", { CVP_DEPLOY_IGNORE_QUIET: "1" });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /deploying anyway/);
});
