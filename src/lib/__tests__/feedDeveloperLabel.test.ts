/* Which string becomes the PUBLIC developer label on a feed-sourced project.

   Until 2026-10-09 feedSync took it from the vendor's own feed (vm.developer).
   Those strings are inconsistent: some already match the developer's own public
   page ("Aristo Developers", "Medousa Developers"), others give a short form the
   page spells out — "Domenica" against a page titled "Domenica Group" (23
   published projects), "Mito" against "Mito Developers" (4) — so a project page
   named its developer differently from that developer's own page.

   The linked public page's title now wins. Safe because DeveloperAccount is a
   1:1 proxy for the brand here: checked against production on 2026-10-09, every
   account+adapter held exactly ONE distinct developer value and no feed mixed
   two. An unlinked account (null) keeps the feed's value, so nothing changes
   where there is no reviewed page to trust.

   Pure function only — no DB, no React. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { developmentRow } from "@/lib/feedSync";

// developmentRow only reads these for the assertions below; the rest of ProjectVM
// is irrelevant to the developer rule.
const vm = (developer: string | null) =>
  ({ publicName: "Some Project", developerName: "Some Project", developer, units: [] }) as any;

const label = (feedValue: string | null, publicLabel: string | null) =>
  developmentRow(vm(feedValue), "domenica", "proj-1", "acct-1", publicLabel).developer;

test("the linked public page title beats the feed's own developer string", () => {
  // The two real cases this was written for.
  assert.equal(label("Domenica", "Domenica Group"), "Domenica Group");
  assert.equal(label("Mito", "Mito Developers"), "Mito Developers");
  // And it stays a no-op where the feed already agreed.
  assert.equal(label("Aristo Developers", "Aristo Developers"), "Aristo Developers");
});

test("an account with no linked page keeps the feed's value, exactly as before", () => {
  assert.equal(label("Island Blue", null), "Island Blue");
  assert.equal(label("Pafilia", null), "Pafilia");
});

test("a feed with no developer at all still yields null, never an empty string", () => {
  /* The column is nullable and the project page tests `p.developer` for
     truthiness before printing the line or the JSON-LD seller — "" would be
     falsy too, but null is what the schema means. */
  assert.equal(label(null, null), null);
  assert.equal(label("", null), null);
  // …and a linked page can supply one the feed never had.
  assert.equal(label(null, "Domenica Group"), "Domenica Group");
});

test("the rest of the row is untouched by the label rule", () => {
  const row = developmentRow(vm("Domenica"), "domenica", "proj-1", "acct-1", "Domenica Group");
  assert.equal(row.feedKey, "domenica:proj-1");
  assert.equal(row.developerAccountId, "acct-1");
  // developerName is the project-side name and must NOT pick up the brand.
  assert.equal(row.developerName, "Some Project");
  assert.equal(row.publicName, "Some Project");
});
