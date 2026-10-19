import test from "node:test";
import assert from "node:assert/strict";
import { inlineStylesheets } from "../homeInline";

const A = '<link rel="stylesheet" href="/_next/static/css/aaa111.css" data-precedence="next"/>';
const B = '<link rel="stylesheet" href="/_next/static/css/bbb222.css" data-precedence="next"/>';

test("replaces each Next stylesheet link with an inline style, keeping order", () => {
  const html = `<head>${A}${B}</head><body>x</body>`;
  const css: Record<string, string> = { "/_next/static/css/aaa111.css": ".a{color:red}", "/_next/static/css/bbb222.css": ".b{margin:0}" };
  const out = inlineStylesheets(html, (h) => css[h]);
  assert.equal(
    out,
    '<head><style data-href="/_next/static/css/aaa111.css" data-precedence="next">.a{color:red}</style>' +
      '<style data-href="/_next/static/css/bbb222.css" data-precedence="next">.b{margin:0}</style></head><body>x</body>',
  );
});

test("leaves the tag alone when the file is unreadable or the CSS is unsafe to inline", () => {
  const html = `${A}${B}`;
  const out = inlineStylesheets(html, (h) => (h.includes("aaa") ? null : "a{}</style><script>x</script>"));
  assert.equal(out, html);
});

test("ignores other links (preload, external, non-next css)", () => {
  const html = '<link rel="preload" as="style" href="/_next/static/css/aaa111.css"/><link rel="stylesheet" href="https://x.test/a.css"/>';
  assert.equal(inlineStylesheets(html, () => "p{}"), html);
});
