// Every Server Action in developments/actions.ts checks the session itself.
//
// A Server Action is reachable as a plain POST with a Next-Action header; the
// (panel) layout's login check never runs before it. middleware.ts excludes
// /admin from its matcher and nginx's /admin block only proxies, so until
// 2026-10-16 anyone could run runSync, create a development or change a sync
// interval without logging in. The guard is one line per action and easy to
// leave off a new one, so this reads the source and fails on an export
// without it. No DB, no Next runtime.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(join(process.cwd(), "src/app/admin/(panel)/developments/actions.ts"), "utf8");

/** Body of each `export async function` — up to the next top-level declaration. */
function exportedBodies(): { name: string; body: string }[] {
  const re = /^export async function (\w+)\(/gm;
  const starts = Array.from(src.matchAll(re)); // not a spread: the build typechecks tests without downlevelIteration (TS2802)
  return starts.map((m, i) => {
    const end = i + 1 < starts.length ? starts[i + 1].index! : src.length;
    return { name: m[1], body: src.slice(m.index!, end) };
  });
}

test("developments/actions.ts: the guard re-checks the user in the DB", () => {
  const helper = src.slice(src.indexOf("async function requireActiveUser"));
  assert.match(helper, /await auth\(\)/);
  assert.match(helper, /prisma\.user\.findUnique\(\{ where: \{ id: uid \}, select: \{ isActive: true \} \}\)/);
  assert.match(helper, /!user \|\| !user\.isActive/);
});

test("developments/actions.ts: every exported action calls requireActiveUser() before doing anything", () => {
  const actions = exportedBodies();
  assert.ok(actions.length >= 8, `expected the 8 known actions, found ${actions.length}`);
  for (const { name, body } of actions) {
    const guard = body.indexOf("await requireActiveUser()");
    assert.notEqual(guard, -1, `${name} has no session check`);
    // Nothing that reads input or touches the DB/sync may precede the guard.
    const before = body.slice(body.indexOf("{"), guard);
    assert.doesNotMatch(before, /prisma\.|formData\.|sync\w*\(|writeKuutioDraft|previewDriveFolders/, `${name} does work before its session check`);
  }
});
