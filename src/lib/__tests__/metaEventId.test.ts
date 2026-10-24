import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { newMetaEventId } from "@/lib/metaEventId";

/* The ids themselves are trivial; the INVARIANTS around them are not, and they
 * are what a later Conversions API depends on. Every assertion below exists
 * because breaking it would produce double-counted conversions in a live
 * dataset rather than a failing build. */

test("two ids from the same millisecond still differ", () => {
  // Date.now() alone is not enough: two forms submitted in one tick, or one
  // visitor clicking two contact links, would share a deduplication key and
  // Meta would discard the second event as a duplicate of the first.
  const ids = new Set<string>();
  for (let i = 0; i < 2000; i++) ids.add(newMetaEventId("lead"));
  assert.equal(ids.size, 2000, "ids collided — Meta would drop events as duplicates");
});

test("the prefix names the event, so a key is readable in Events Manager", () => {
  assert.ok(newMetaEventId("lead").startsWith("lead-"));
  assert.ok(newMetaEventId("contact").startsWith("contact-"));
  assert.ok(newMetaEventId("ic").startsWith("ic-"));
  assert.ok(newMetaEventId("vc").startsWith("vc-"));
});

test("an id is short, and carries nothing about the visitor", () => {
  const id = newMetaEventId("lead");
  assert.ok(id.length <= 32, `${id.length} chars`);
  // Only the prefix, base36 time and base36 randomness. A key that embedded a
  // page, an email or a development id would ship that to Meta for every
  // visitor, including the ones whose event carries no other identifier.
  assert.match(id, /^[a-z]+-[0-9a-z]+-[0-9a-z]+$/);
});

test("it never throws — it runs inside form success handlers", () => {
  // crypto.randomUUID() needs a secure context and would throw where this must
  // not. Asserted rather than assumed, because the call site is the one place
  // an exception costs a lead that was already captured.
  assert.doesNotThrow(() => newMetaEventId("lead"));
});

/* ── the call sites ─────────────────────────────────────────────────────── */

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === "__tests__") continue;
      walk(p, out);
    } else if (/\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

const SRC = join(process.cwd(), "src");
const FILES = walk(SRC);
const rel = (p: string) => p.slice(join(process.cwd(), "").length);

/** Every `fbq("track", "<name>")` call in src/, with the 400 characters after it. */
function trackCalls(event: string): { file: string; tail: string }[] {
  const out: { file: string; tail: string }[] = [];
  const re = new RegExp(`fbq!?\\s*\\(\\s*["']track["']\\s*,\\s*["']${event}["']`, "g");
  for (const f of FILES) {
    const src = readFileSync(f, "utf8");
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) out.push({ file: rel(f), tail: src.slice(m.index, m.index + 600) });
    re.lastIndex = 0;
  }
  return out;
}

for (const event of ["Lead", "Contact", "InitiateCheckout", "ViewContent"]) {
  test(`every ${event} call carries an eventID`, () => {
    const calls = trackCalls(event);
    assert.ok(calls.length > 0, `no ${event} call sites found — the sweep is looking in the wrong place`);
    const missing = calls.filter((c) => !/\{\s*eventID:/.test(c.tail)).map((c) => c.file);
    assert.deepEqual(missing, [], `a ${event} call has no eventID: a server-side copy would double-count it`);
  });
}

test("PageView deliberately carries no eventID", () => {
  // The decision, pinned: PageView is the one event that will never be sent
  // server-side, so a deduplication key on it is dead weight. If a Conversions
  // API ever does send PageView, this test is the reminder that the browser
  // side needs an id first.
  const calls = trackCalls("PageView");
  const withId = calls.filter((c) => /\{\s*eventID:/.test(c.tail)).map((c) => c.file);
  assert.deepEqual(withId, [], "a PageView gained an eventID; see the note above");
});

test("every eventID is a fresh id built at send time", () => {
  /* The trap MetaViewContentTracker documents: an id computed during render is
   * baked into a cached server payload and then repeats across every visitor
   * served that page — a deduplication key that deduplicates strangers.
   *
   * Checked by shape rather than by position, because position needs parsing
   * and this repo has already paid for a positional check that cried wolf: an
   * `eventID` must either call the generator inline, or name a local assigned
   * from it in the 400 characters directly above. Both put the call at the send
   * site; a value arriving from anywhere else (a prop, module scope, a server
   * payload) is reported. */
  const offenders: string[] = [];
  for (const f of FILES) {
    const src = readFileSync(f, "utf8");
    const re = /eventID:\s*([A-Za-z0-9_]+\s*\(|[A-Za-z0-9_]+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) {
      const ref = m[1].replace(/\s*\($/, "");
      if (ref === "newMetaEventId") continue; // inline call
      const before = src.slice(Math.max(0, m.index - 400), m.index);
      if (new RegExp(`\\b(const|let)\\s+${ref}\\s*=\\s*newMetaEventId\\s*\\(`).test(before)) continue;
      offenders.push(`${rel(f)} (eventID: ${ref})`);
    }
  }
  assert.deepEqual(offenders, [], "an eventID does not come from a fresh newMetaEventId() at the send site");
});
