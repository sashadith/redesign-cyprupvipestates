import { test } from "node:test";
import assert from "node:assert/strict";
import { renderLeadEmail } from "@/lib/crm/renderLeadEmail";

test("renders the body as escaped HTML, a spacer, then the signature; text strips tags", () => {
  const { html, text } = renderLeadEmail("Hello <Max>,\n\nline two", "<p>Best regards<br/>Sascha</p>");
  assert.match(html, /white-space:pre-wrap;">Hello &lt;Max&gt;,\n\nline two<\/div>/);
  assert.match(html, /height:16px/); // SIGNATURE_SPACER
  assert.ok(html.endsWith("<p>Best regards<br/>Sascha</p>"));
  assert.match(text, /Hello <Max>,/);
  assert.match(text, /Best regards/);
  assert.doesNotMatch(text, /<div|<p>/);
});
