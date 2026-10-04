import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPreviewEmail } from "@/lib/mcp/drafts/previewEmail";

const p = buildPreviewEmail({
  leadName: "Max <Muster>", leadEmail: "max@example.com", subject: "Your villa shortlist", body: "Dear Max,\n\nhere it is.",
  signatureHtml: "<p>Sascha</p>", approvalCode: "7K3PQ2", expiresAtLabel: "08.09.2026 13:00",
});

test("subject carries the DRAFT marker and the code", () => {
  assert.equal(p.subject, "[DRAFT] Your villa shortlist");
});

test("html has the header box with recipient, code and instructions, then the exact rendered email", () => {
  assert.match(p.html, /Draft for Max &lt;Muster&gt;/);
  assert.match(p.html, /To: max@example\.com/);
  assert.match(p.html, /Approval code: <strong>7K3PQ2<\/strong>/);
  assert.match(p.html, /Freigabe 7K3PQ2/);
  assert.match(p.html, /Expires 08\.09\.2026 13:00 Cyprus/);
  assert.ok(p.html.indexOf("Approval code") < p.html.indexOf("Dear Max"), "header comes before the body");
  assert.ok(p.html.endsWith("<p>Sascha</p>"), "body + signature rendered exactly as the real send");
});

test("text version carries the same essentials", () => {
  assert.match(p.text, /7K3PQ2/);
  assert.match(p.text, /max@example\.com/);
  assert.match(p.text, /Dear Max,/);
});
