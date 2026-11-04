import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/* The host guard (2026-10-22) means five vendor globals can now be absent on a
   dev machine that previously always had them: fbq, gtag, lintrk, dataLayer
   and clarity. A caller that assumed one exists would throw where it used to
   work, and the thing that breaks would be a form submit — the worst place for
   it.
   advertisingTagHostGuard.test.ts pins the lintrk callers by name. This file
   sweeps the whole of src/ for the other four, so a NEW unguarded call site
   fails the suite rather than being found by a visitor.

   The check is POSITIONAL and works on CHARACTER distance, not lines: a guard
   mentioning the global must appear in the ~600 characters of source directly
   before the call. Both of those choices were forced by real code in this repo,
   and getting them wrong produced four false alarms on the first draft:

     - Co-occurrence anywhere in the file is not enough, and pinning one
       spelling is worse. trackBrochureOpen.ts guards via a local
       (`const fbq = (window as …).fbq; if (typeof fbq !== "function") return;`)
       and a test demanding the literal `window.fbq` failed it.
     - Line-by-line fails on a guard that spans lines — the Form* components
       write `if (\n typeof window !== "undefined" &&\n typeof (window as
       any).lintrk === "function"\n ) {` — and on a guard that shares its line
       with the call, as GuideGet.tsx and QualificationForm.tsx do.

   A test that reports correct code is a test someone will silence rather than
   fix, so the self-test at the bottom pins what it must still catch. */

const SRC = join(process.cwd(), "src");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === "__tests__") continue;
      walk(p, out);
    } else if (/\.tsx?$/.test(name)) {
      out.push(p);
    }
  }
  return out;
}

const FILES = walk(SRC);
const rel = (p: string) => p.slice(join(process.cwd(), "").length);

const isComment = (line: string) => /^\s*(\/\/|\*|\/\*)/.test(line);

/** How much source before a call may hold its guard. Long enough for a guard
 *  broken across four lines, short enough that an unrelated mention elsewhere
 *  in the function cannot stand in for one. */
const GUARD_WINDOW = 600;

/**
 * Is EVERY call of `name` in `src` preceded by an existence check for it?
 *
 * Every call, not just the first: a file with one guarded and one unguarded
 * call site is exactly the regression this is meant to catch.
 *
 * KNOWN LIMIT, accepted deliberately: the window is character distance, so a
 * guard in a *different* function that happens to sit within GUARD_WINDOW of
 * the call counts as one. Distinguishing that needs the enclosing block, i.e.
 * parsing, which is more than a lint-shaped test should carry — and the
 * practical case it would miss is a file that guards its other call sites,
 * which is not the failure mode worth this much machinery. The cases below
 * record which shapes are and are not caught.
 */
export function callIsGuarded(src: string, callRe: RegExp, name: string): boolean {
  const all = new RegExp(callRe.source, callRe.flags.includes("g") ? callRe.flags : callRe.flags + "g");
  // `[^;{}]*` deliberately crosses newlines but not statement or block
  // boundaries, which is what lets a multi-line `if (…)` match while a guard
  // belonging to a different statement does not.
  const guards = [
    new RegExp(`\\bif\\s*\\([^;{}]*\\b${name}\\b`),
    new RegExp(`\\btypeof\\b[^;{}]*\\b${name}\\b`),
  ];
  let m: RegExpExecArray | null;
  while ((m = all.exec(src)) !== null) {
    const before = src.slice(Math.max(0, m.index - GUARD_WINDOW), m.index);
    if (!guards.some((g) => g.test(before))) return false;
  }
  return true; // no call sites, or all of them guarded
}

/**
 * Files that call `name` without an existence check close in front of it.
 *
 * `owner` is the component that CREATES the global and therefore cannot be
 * expected to check for it first.
 */
function unguardedCallers(callRe: RegExp, name: string, owner: string): string[] {
  const offenders: string[] = [];
  for (const f of FILES) {
    if (f.endsWith(owner)) continue;
    const src = readFileSync(f, "utf8");
    if (!callRe.test(src)) continue;
    if (!callIsGuarded(src, new RegExp(callRe.source), name)) offenders.push(rel(f));
  }
  return offenders;
}

test("every dataLayer push checks that the container created it", () => {
  // GTM creates window.dataLayer. With the container suppressed there is no
  // array to push onto — `window.dataLayer.push(...)` would be a TypeError.
  assert.deepEqual(
    unguardedCallers(/dataLayer\s*\.\s*push\s*\(/, "dataLayer", "GoogleAdsScript/GoogleAdsScript.tsx"),
    [],
    "a dataLayer push has no existence check before it — it will throw once GTM is suppressed",
  );
});

test("every fbq call checks that the pixel initialised", () => {
  // `fbq!?` because a non-null assertion used to walk straight past this
  // sweep: MetaViewContentTracker spelled its call `window.fbq!("track", …)`,
  // `fbq\s*\(` did not match it, and the file reported clean for an event the
  // check had never looked at. Found 2026-10-24 while adding eventIDs.
  assert.deepEqual(
    unguardedCallers(/\bfbq!?\s*\(\s*["']track(?:Custom)?["']/, "fbq", "FacebookPixel/FacebookPixel.tsx"),
    [],
    "an fbq call has no existence check before it",
  );
});

test("every clarity call checks that the shim exists", () => {
  assert.deepEqual(
    unguardedCallers(/window\.clarity\s*\(/, "clarity", "MicrosoftClarity/MicrosoftClarity.tsx"),
    [],
    "a clarity call has no existence check before it",
  );
});

test("every lintrk call checks that the queue stub exists", () => {
  assert.deepEqual(
    unguardedCallers(/lintrk\s*\(\s*["']track["']/, "lintrk", "LinkedInPixel/LinkedInPixel.tsx"),
    [],
    "a lintrk call has no existence check before it",
  );
});

test("gtag still has no call site outside its own component", () => {
  // Not a guard requirement but a standing fact worth pinning: the Google Ads
  // tag only does `config`, there are no conversion events from it. If someone
  // adds one it needs an existence check, and this test should then be
  // rewritten into the shape of the four above rather than deleted.
  const offenders = FILES.filter((f) => !f.endsWith("GoogleAdsScript/GoogleAdsScript.tsx")).filter((f) =>
    readFileSync(f, "utf8")
      .split("\n")
      .some((l) => !isComment(l) && /(^|[^\w.])gtag\s*\(/.test(l)),
  );
  assert.deepEqual(offenders.map(rel), [], "a gtag() call site appeared; see the note above");
});

test("the check still catches what it is for, and clears what it should", () => {
  // The sweep is only worth having if it fails on the shapes it describes.
  const CALL = /\bfbq\s*\(\s*["']track["']/;
  const g = (src: string) => callIsGuarded(src, new RegExp(CALL.source), "fbq");

  // Must be REPORTED:
  assert.equal(g('export function f() {\n  window.fbq("track", "Lead", {});\n}'), false, "a bare call");
  assert.equal(
    callIsGuarded('export function f() {\n  window.fbq!("track", "Lead", {});\n}', /\bfbq!?\s*\(\s*["']track["']/, "fbq"),
    false,
    "a non-null-asserted call: the shape that used to dodge this sweep entirely",
  );
  assert.equal(
    g('export function f() {\n  window.fbq("track", "Lead", {});\n  if (window.fbq) console.log(1);\n}'),
    false,
    "a guard that sits AFTER the call — the ordering bug a co-occurrence test cannot see",
  );
  assert.equal(
    g('if (window.fbq) {\n  window.fbq("track", "A", {});\n}\n' + "x".repeat(700) + '\nwindow.fbq("track", "B", {});'),
    false,
    "a SECOND call site without its own guard — the regression the per-call sweep exists for",
  );

  // And the documented limit, asserted rather than left implicit: a guard in a
  // neighbouring function within the window is accepted. If this ever starts
  // failing, the check got stricter and that is an improvement, not a break.
  assert.equal(
    g('function a() {\n  if (window.fbq) return;\n}\nfunction b() {\n  window.fbq("track", "Lead", {});\n}'),
    true,
    "KNOWN LIMIT: character distance cannot see function boundaries",
  );

  // Must be CLEARED — every shape that actually occurs in this repo:
  assert.equal(g('if (window.fbq) {\n  window.fbq("track", "Lead", {});\n}'), true, "the common shape");
  assert.equal(
    g('if (typeof window !== "undefined" && window.fbq) {\n  window.fbq("track", "Lead", {});\n}'),
    true,
    "FormStandard and friends",
  );
  assert.equal(
    g('if (typeof window !== "undefined" && (window as any).fbq) (window as any).fbq("track", "Lead", {});'),
    true,
    "QualificationForm: guard and call on one line",
  );
  assert.equal(
    g('const fbq = (window as unknown as { fbq?: (...a: unknown[]) => void }).fbq;\nif (typeof fbq !== "function") return;\nfbq("trackCustom", "FormOpen", {});'),
    true,
    "trackBrochureOpen: guarded through a local",
  );
  assert.equal(
    g('if (\n  typeof window !== "undefined" &&\n  typeof (window as any).fbq === "function"\n) {\n  (window as any).fbq("track", "Lead", {});\n}'),
    true,
    "a guard broken across four lines",
  );
});
