// Every column Development REQUIRES must be in the object the DOMO sync creates
// a row with (2026-11-13).
//
// Written because the first --apply run died on project one with "Argument
// `feedProjectId` is missing", after the dry run had reported 18 projects and no
// problems. The dry run could not have caught it: without a database it never
// calls create(), so a payload that is missing a required column looks exactly
// like a payload that is complete. The developer account had already been
// written by then, which is the part that makes this worth a test rather than a
// fix — a half-applied onboarding is a mess to unpick.
//
// The schema is the source of truth here, so adding a required column to
// Development fails this test instead of the next run.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

/** Scalar columns of `model Development` with no `?` and no `@default`. */
function requiredScalars(): string[] {
  const schema = read("prisma/schema.prisma");
  const start = schema.indexOf("model Development {");
  assert.notEqual(start, -1, "model Development not found");
  const body = schema.slice(start, schema.indexOf("\n}", start));
  const out: string[] = [];
  for (const line of body.split("\n").slice(1)) {
    const t = line.trim();
    if (!t || t.startsWith("//") || t.startsWith("@@")) continue;
    const m = /^(\w+)\s+(\w+)(\[\])?(\?)?/.exec(t);
    if (!m) continue;
    const [, name, type, list, optional] = m;
    if (optional || list) continue;
    if (/@default|@updatedAt|@relation/.test(t)) continue;
    // Relations are objects, not columns: their TYPE is another model.
    if (/^[A-Z]/.test(type) && !["String", "Int", "Float", "Boolean", "DateTime", "Json", "BigInt", "Decimal", "Bytes"].includes(type)) continue;
    out.push(name);
  }
  return out;
}

/** Keys of the `const fields = { … }` literal the sync builds a row from. */
function fieldsWritten(): string[] {
  const src = read("scripts/domo-sync.mjs");
  // The DEVELOPMENT's payload, not the account's — the file holds both, and the
  // account literal comes first.
  const fn = src.indexOf("async function writeProject");
  assert.notEqual(fn, -1, "writeProject was renamed or removed");
  const at = src.indexOf("const fields = {", fn);
  assert.notEqual(at, -1, "the sync no longer builds a `fields` object");
  const body = src.slice(at, src.indexOf("\n  };", at));
  // Strip comments first: they mention column names in prose.
  const clean = body.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  const keys = Array.from(clean.matchAll(/(?:^|[{,\s])([A-Za-z_]\w*)\s*:/g)).map((m) => m[1]);
  // `feedKey, dev: DEV` — shorthand properties carry no colon.
  // Array.from, not a for-of over the iterator: this tsconfig sets no `target`,
  // so iterating a RegExp match iterator directly is a TS2802 error here.
  for (const short of Array.from(clean.matchAll(/(?:^|[{,\s])([A-Za-z_]\w*)\s*(?=[,\n])/g))) {
    if (!keys.includes(short[1])) keys.push(short[1]);
  }
  return keys;
}

test("the DOMO sync writes every column Development requires", () => {
  const required = requiredScalars();
  // Sanity: the parse found the real thing, not an empty list.
  for (const known of ["dev", "feedProjectId", "feedKey", "developerName", "publicName", "developerAccountId"]) {
    assert.ok(required.includes(known), `schema parse missed the required column ${known}`);
  }
  const written = fieldsWritten();
  const missing = required.filter((c) => !written.includes(c));
  assert.deepEqual(missing, [], `required columns the sync does not write: ${missing.join(", ")}`);
});

test("feedKey and feedProjectId agree with each other", () => {
  // The schema defines feedKey as "<dev>:<feedProjectId>". Two places build it,
  // and if they drift the row is still created — just unfindable by the key the
  // next run looks it up with.
  const src = read("scripts/domo-sync.mjs");
  assert.match(src, /const feedKey = `\$\{DEV\}:\$\{project\.slug\}`/);
  assert.match(src, /feedProjectId: project\.slug/);
});

test("a renamed project's old studio name never becomes its name", () => {
  // codeName is recorded so a file can be explained, never written to a column.
  const src = read("scripts/domo-sync.mjs");
  const at = src.indexOf("const fields = {", src.indexOf("async function writeProject"));
  assert.ok(!/codeName/.test(src.slice(at, src.indexOf("\n  };", at))), "codeName must not reach a Development column");
  assert.match(src, /publicName: project\.name/);
  assert.match(src, /developerName: project\.name/);
});
