#!/usr/bin/env node
/* Guard for buildRestartCommand (src/lib/imageMirror.ts) — the shell the app
   spawns after mirroring a new image, to make Next re-index public/.

   Why it matters: Next indexes public/ at boot, so a file mirrored afterwards
   is invisible to next/image (the optimizer resolves a local path by fetching
   it from Next itself, bypassing the nginx rule that serves /uploads/ from
   disk). Measured 2026-09-24: a file created after boot serves 200 directly
   and 400 "The requested resource isn't a valid image" through the optimizer.
   So this restart has to happen — the only question is how it lands.

   It landed badly on 2026-09-24: "Reload units & images" on Dream Tower wrote
   the lock at 18:10:47, `pm2 restart` took BOTH cluster workers down at
   18:10:53/54, and the admin's page refetched into the gap and died with
   "Application error: a client-side exception has occurred". pm2 reload
   replaces workers one at a time instead — what deploy-prod.sh already uses on
   this app.

   The command is built as a string precisely so it can be exercised, so this
   guard RUNS it with an injected restart command rather than reading it:

     node scripts/qa/restart-command-check.mjs

   Takes ~30s — the command's own `sleep 4` and 10s poll are real. Exits
   non-zero on the first failed assertion. */
import { writeFileSync, rmSync, mkdirSync, existsSync, readFileSync, utimesSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

let build;
try {
  ({ build } = await import("esbuild"));
} catch {
  console.error("esbuild is not installed (it is only a transitive dependency).\n  npm i -D esbuild   — or run this check from a tree where it is present.");
  process.exit(2);
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const bundlePath = join(ROOT, `.qa-restart-${process.pid}.mjs`);
const out = await build({
  entryPoints: [join(ROOT, "src/lib/imageMirror.ts")],
  bundle: true, platform: "node", format: "esm", write: false, external: ["sharp"],
  banner: { js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);" },
});
writeFileSync(bundlePath, out.outputFiles[0].text);
const M = await import(bundlePath);

const work = join(tmpdir(), `qa-restart-${process.pid}`);
mkdirSync(work, { recursive: true });
process.on("exit", () => { rmSync(bundlePath, { force: true }); rmSync(work, { recursive: true, force: true }); });

let failures = 0;
function check(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { console.log(`  ok   ${name}`); return; }
  failures++;
  console.log(`  FAIL ${name}\n       expected ${e}\n       actual   ${a}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* A scenario: its own lock dir, pending file and marker. The injected command
   appends its arguments to the marker, so the marker's mere existence proves
   the reload ran and its contents prove what it was told to reload. */
let n = 0;
function scenario() {
  const id = `s${++n}`;
  const lockDir = join(work, id, "locks");
  const pending = join(work, id, "pending");
  const marker = join(work, id, "marker");
  mkdirSync(lockDir, { recursive: true });
  writeFileSync(pending, String(Date.now()));
  // The built command appends the app name as an ARGUMENT, so the stand-in has
  // to be something that can receive one — a plain redirect would record an
  // empty marker and the "names the app" assertion could never fail.
  const recorder = join(work, id, "recorder.sh");
  writeFileSync(recorder, `#!/bin/sh\nprintf '%s' "$*" > '${marker}'\n`);
  const cmd = M.buildRestartCommand("cyprusvipestates", lockDir, pending, `sh '${recorder}'`);
  return { lockDir, pending, marker, cmd, run: () => spawn("sh", ["-c", cmd], { stdio: "ignore" }) };
}
const fired = (s) => existsSync(s.marker);

/* ---- it reloads when nothing is running ---- */
{
  const s = scenario();
  s.run();
  await sleep(2500);
  check("it waits at least a moment before acting", fired(s), false);
  await sleep(4000);
  check("with no sync running it reloads", fired(s), true);
  check("…naming the app it was given", readFileSync(s.marker, "utf8").trim(), "cyprusvipestates");
  check("…and clears the pending marker first, so a later trigger is not swallowed", existsSync(s.pending), false);
}

/* ---- a sync in flight delays it, and never cancels it ----
   The 2026-08-25 incident this exists for: a Drive import writing project 11
   of 16 was killed mid-loop by another job's restart. */
{
  const s = scenario();
  const lock = join(s.lockDir, "drive-import-123-abcdef");
  writeFileSync(lock, new Date().toISOString());
  s.run();
  await sleep(9000);
  check("a running sync holds the reload back", fired(s), false);
  check("…and the pending marker stays up while it waits", existsSync(s.pending), true);
  rmSync(lock, { force: true });
  await sleep(13000);
  check("…then it reloads once that sync finishes", fired(s), true);
}

/* ---- a lock from a dead process must not hold it forever ---- */
{
  const s = scenario();
  const stale = join(s.lockDir, "dead-process-999-zzzzzz");
  writeFileSync(stale, "old");
  const old = new Date(Date.now() - 10 * 60_000);
  utimesSync(stale, old, old);
  s.run();
  await sleep(6500);
  check("a lock older than the staleness window is ignored", fired(s), true);
}

/* ---- the shape of the command itself ---- */
const cmd = M.buildRestartCommand("myapp", "/tmp/locks", "/tmp/pending");

/* The fix. pm2 runs this app in cluster mode; `restart` drops every worker at
   once, `reload` replaces them one at a time. */
check("the default is a rolling reload", /\/usr\/bin\/pm2 reload myapp$/.test(cmd), true);
check("…and NOT a hard restart", /pm2 restart/.test(cmd), false);

/* A stuck sync may delay the reload, never cancel it: the reload sits after
   `done`, outside the loop, not inside it. */
const afterLoop = cmd.slice(cmd.lastIndexOf("done;"));
check("the reload runs after the wait loop, not inside it", /pm2 reload myapp/.test(afterLoop), true);
check("the pending file is cleared before it", afterLoop.indexOf("rm -f") < afterLoop.indexOf("pm2 reload"), true);

/* 30 minutes at one poll per 10s. If MAX_RESTART_WAIT_MIN moves, this says so
   rather than letting the cap drift silently away from its comment. */
check("the wait is capped at 30 minutes of 10s polls", /\[ \$i -lt 180 \]/.test(cmd), true);
check("…polling every 10 seconds", /do sleep 10; i=\$\(\(i\+1\)\); done/.test(cmd), true);

/* Paths are interpolated into a shell string, so they have to be quoted or a
   directory with a space in it silently splits the command. */
check("the lock dir is quoted", cmd.includes("'/tmp/locks'"), true);
check("the pending file is quoted", cmd.includes("'/tmp/pending'"), true);

/* The caller must still be able to inject, which is what the tests above rely
   on — if this ever stops working the behavioural half goes quiet, not red. */
check("the restart command stays injectable, argument and all",
  M.buildRestartCommand("a", "/l", "/p", "echo hi").endsWith("echo hi a"), true);

console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
