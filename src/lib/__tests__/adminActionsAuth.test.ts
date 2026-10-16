// Every Server Action in the admin "use server" files below checks the session
// itself.
//
// A Server Action is reachable as a plain POST with a Next-Action header; the
// (panel) layout's login check never runs before it. middleware.ts excludes
// /admin from its matcher and nginx's /admin block only proxies, so until
// 2026-10-16 anyone could run runSync, publish a development, upload images,
// trigger an app restart or approve an SEO suggestion without logging in. The
// guard is one line per action and easy to leave off a new one, so this reads
// the source and fails on an export without it. No DB, no Next runtime.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// File → how many exported actions it had when the guard was added.
const FILES: [string, number][] = [
  ["src/app/admin/(panel)/developments/actions.ts", 8],
  ["src/app/admin/(panel)/developments/[id]/actions.ts", 21],
  ["src/app/admin/(panel)/developments/areas/actions.ts", 2],
  ["src/app/admin/(panel)/content/projects/overlaps/actions.ts", 3],
  ["src/app/admin/(panel)/analytics/seo/advisor/actions.ts", 3],
];

// Anything that reads input, touches the DB, syncs, calls Claude or restarts
// the app — none of it may run before the session check.
const WORK = /prisma\.|formData\.|sync\w*\(|writeKuutioDraft|previewDriveFolders|generate\w*\(|scheduleAppRestart|saveSeoPromptTemplate|groupIds\(|updateSuggestion\(/;

/** Body of each `export async function` — up to the next top-level declaration. */
function exportedBodies(src: string): { name: string; body: string }[] {
  const re = /^export async function (\w+)\(/gm;
  const starts = Array.from(src.matchAll(re)); // not a spread: the build typechecks tests without downlevelIteration (TS2802)
  return starts.map((m, i) => {
    const end = i + 1 < starts.length ? starts[i + 1].index! : src.length;
    return { name: m[1], body: src.slice(m.index!, end) };
  });
}

for (const [file, known] of FILES) {
  const src = readFileSync(join(process.cwd(), file), "utf8");
  const short = file.replace("src/app/admin/(panel)/", "");

  test(`${short}: the guard re-checks the user in the DB`, () => {
    const at = src.indexOf("async function requireActiveUser");
    assert.notEqual(at, -1, "no requireActiveUser() helper");
    const helper = src.slice(at);
    assert.match(helper, /await auth\(\)/);
    assert.match(helper, /prisma\.user\.findUnique\(\{ where: \{ id: uid \}, select: \{ isActive: true \} \}\)/);
    assert.match(helper, /!user \|\| !user\.isActive/);
  });

  test(`${short}: every exported action calls requireActiveUser() before doing anything`, () => {
    // Arrow-function exports would slip past exportedBodies().
    assert.doesNotMatch(src, /^export const \w+ = async/m, "export actions as `export async function` so this test sees them");
    const actions = exportedBodies(src);
    assert.ok(actions.length >= known, `expected the ${known} known actions, found ${actions.length}`);
    for (const { name, body } of actions) {
      const guard = body.indexOf("await requireActiveUser()");
      assert.notEqual(guard, -1, `${name} has no session check`);
      const before = body.slice(body.indexOf("{"), guard);
      assert.doesNotMatch(before, WORK, `${name} does work before its session check`);
    }
  });
}
