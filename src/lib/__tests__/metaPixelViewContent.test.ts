// Where the Meta pixel's ViewContent lives, and what it sends.
//
// The component existed since 2025 and fired on nothing. It sat in
// src/app/[lang]/projects/[slug]/page.tsx AFTER the branch that renders a
// Development and returns, so all 370 published developments rendered without
// it. Meta's own dataset confirmed it: seven days, ~900 PageView, 5
// InitiateCheckout, 2 Lead, 1 Contact, and ZERO ViewContent.
//
// Nothing failed. No error, no type complaint, no empty page — the tracker was
// simply unreachable, and the only way to notice was to ask Meta what it had
// received. These assertions are the cheap version of that question.
//
// Reads the source; no DB, no React, no network.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const TRACKER = "src/app/components/MetaViewContentTracker/MetaViewContentTracker.tsx";
const BODY = "src/app/preview-project/ProjectPageBody.tsx";
const PAGE = "src/app/[lang]/projects/[slug]/page.tsx";

test("the tracker renders from ProjectPageBody, which the development branch returns", () => {
  assert.ok(
    /<MetaViewContentTracker/.test(read(BODY)),
    "ProjectPageBody no longer renders MetaViewContentTracker — the 370 published developments " +
    "stop reporting which property was viewed, and no test or type error says so.",
  );
});

test("it is NOT in the page behind the development branch's return", () => {
  // That is where it was, and where it was unreachable. Putting it back there
  // would silence every development again.
  assert.equal(
    /MetaViewContentTracker/.test(read(PAGE)), false,
    "[lang]/projects/[slug]/page.tsx references MetaViewContentTracker again. The development " +
    "branch returns before reaching it, so it would fire only for legacy projects — ids that " +
    "exist in no catalog.",
  );
});

test("content_type is Meta's real-estate vertical, not an invented word", () => {
  const src = read(TRACKER);
  assert.ok(/content_type:\s*"home_listing"/.test(src), 'content_type must be "home_listing"');
  assert.equal(
    /content_type:\s*"property"/.test(src), false,
    '"property" is not a Meta vertical — a catalog would never match these events',
  );
});

test("eventID goes in fbq's fourth argument, not inside the payload", () => {
  const src = read(TRACKER);
  // Inside the payload it is an inert custom parameter and the deduplication
  // against a Conversions API send would silently not happen.
  assert.ok(/\{\s*eventID:/.test(src), "eventID must be passed as the separate fourth argument");
  assert.equal(
    /content_type[\s\S]{0,400}?eventID:\s*\w+,?\s*\n\s*content_name/.test(src), false,
    "eventID appears to be inside the event payload",
  );
});

test("the id sent to Meta is the row UUID, never the vendor's feedProjectId", () => {
  // `ProjectVM.id` is feedProjectId. It changes when a project moves source,
  // and it is not what the catalog or the Xellex bridge key on — ids that
  // disagree match nothing while both sides look healthy.
  const body = read(BODY);
  assert.ok(/contentId=\{p\.developmentId\}/.test(body), "contentId must be p.developmentId");
  assert.equal(/contentId=\{p\.id\}/.test(body), false, "contentId must not be p.id (feedProjectId)");
  assert.ok(
    /developmentId:\s*d\.id/.test(read("src/lib/developmentRender.ts")),
    "mapRowToVM no longer exposes developmentId as the row's own id",
  );
});
