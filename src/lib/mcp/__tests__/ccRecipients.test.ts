import { test } from "node:test";
import assert from "node:assert/strict";
import { checkCcRecipients, MAX_CC } from "@/lib/mcp/drafts/ccRecipients";
import { buildPreviewEmail } from "@/lib/mcp/drafts/previewEmail";

const LEAD = "max@example.com";

test("no CC is fine", () => {
  assert.deepEqual(checkCcRecipients(undefined, LEAD), { ok: true, cc: [] });
  assert.deepEqual(checkCcRecipients([], LEAD), { ok: true, cc: [] });
});

test("valid addresses pass, trimmed, order kept", () => {
  assert.deepEqual(checkCcRecipients([" partner@alfitouri.com ", "office@agency.co.uk"], LEAD), { ok: true, cc: ["partner@alfitouri.com", "office@agency.co.uk"] });
});

test(`at most ${MAX_CC}`, () => {
  const six = Array.from({ length: 6 }, (_, i) => `p${i}@x.com`);
  assert.equal(checkCcRecipients(six, LEAD).ok, false);
  assert.equal(checkCcRecipients(six.slice(0, 5), LEAD).ok, true);
});

test("the lead's own address can never be in CC, in any case", () => {
  const r = checkCcRecipients(["partner@alfitouri.com", "MAX@Example.com"], LEAD);
  assert.equal(r.ok, false);
  assert.match((r as any).message, /lead's own address/);
});

test("invalid or smuggling entries are rejected, not parsed", () => {
  for (const bad of ["", "partner", "partner@", "@x.com", "a@b", "a b@x.com", "a@x.com, b@y.com", "a@x.com;b@y.com", "Name <a@x.com>", "a@x.com\nBcc: evil@y.com", "a@x..com"]) {
    assert.equal(checkCcRecipients([bad], LEAD).ok, false, JSON.stringify(bad));
  }
});

test("duplicates are rejected", () => {
  assert.equal(checkCcRecipients(["p@x.com", "P@X.com"], LEAD).ok, false);
});

test("preview: CC line shown in html and text when set, absent otherwise", () => {
  const base = { leadName: "Max", leadEmail: LEAD, subject: "S", body: "Dear Max,\n\nhi.", signatureHtml: "<p>Sascha</p>", approvalCode: "7K3PQ2", expiresAtLabel: "x" };
  const withCc = buildPreviewEmail({ ...base, cc: ["partner@alfitouri.com", "a<b@x.com"] });
  assert.match(withCc.html, /CC: <strong>partner@alfitouri\.com, a&lt;b@x\.com<\/strong>/, "listed and escaped");
  assert.ok(withCc.html.indexOf("CC:") < withCc.html.indexOf("Dear Max"), "in the header, before the email");
  assert.match(withCc.text, /\nCC: partner@alfitouri\.com, a<b@x\.com\n/);
  const without = buildPreviewEmail(base);
  assert.doesNotMatch(without.html, /CC:/);
  assert.doesNotMatch(without.text, /CC:/);
});
