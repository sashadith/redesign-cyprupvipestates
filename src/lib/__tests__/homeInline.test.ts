import test from "node:test";
import assert from "node:assert/strict";
import { deferScripts, inlineStylesheets } from "../homeInline";

const A = '<link rel="stylesheet" href="/_next/static/css/aaa111.css" data-precedence="next"/>';
const B = '<link rel="stylesheet" href="/_next/static/css/bbb222.css" data-precedence="next"/>';

test("replaces each Next stylesheet link with an inline style plus an inert (media=print) link, keeping order", () => {
  const html = `<head>${A}${B}</head><body>x</body>`;
  const css: Record<string, string> = { "/_next/static/css/aaa111.css": ".a{color:red}", "/_next/static/css/bbb222.css": ".b{margin:0}" };
  const out = inlineStylesheets(html, (h) => css[h]);
  assert.equal(
    out,
    '<head><style data-href="/_next/static/css/aaa111.css" data-precedence="next">.a{color:red}</style>' +
      '<link rel="stylesheet" href="/_next/static/css/aaa111.css" data-precedence="next" media="print"/>' +
      '<style data-href="/_next/static/css/bbb222.css" data-precedence="next">.b{margin:0}</style>' +
      '<link rel="stylesheet" href="/_next/static/css/bbb222.css" data-precedence="next" media="print"/></head><body>x</body>',
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

test("deferScripts lifts async chunk scripts and their preload into a post-paint loader, leaving everything else", () => {
  const html =
    '<head><link rel="preload" as="script" fetchPriority="low" href="/_next/static/chunks/webpack-aaa.js"/>' +
    '<link rel="preload" as="image" href="/x.png"/><script src="/_next/static/chunks/polyfills-zzz.js" noModule=""></script></head>' +
    '<body><main>hi</main><script>self.__next_f.push([1,"x"])</script>' +
    '<script src="/_next/static/chunks/webpack-aaa.js" async=""></script>' +
    '<script src="/_next/static/chunks/app/home-static/%5Blang%5D/page-bbb.js" async=""></script></body>';
  const out = deferScripts(html);
  assert.ok(!out.includes('src="/_next/static/chunks/webpack-aaa.js"'));
  assert.ok(!out.includes('rel="preload" as="script"'));
  assert.ok(out.includes('<link rel="preload" as="image" href="/x.png"/>'));
  assert.ok(out.includes('noModule=""'));
  assert.ok(out.includes('self.__next_f.push([1,"x"])'));
  const loader = out.slice(out.indexOf("<script data-cve-defer>"));
  assert.ok(loader.includes('"/_next/static/chunks/webpack-aaa.js"'));
  assert.ok(loader.includes('"/_next/static/chunks/app/home-static/%5Blang%5D/page-bbb.js"'));
  assert.ok(loader.endsWith("</script></body>"));
});

test("deferScripts is a no-op without chunk scripts or without a body", () => {
  assert.equal(deferScripts("<body>x</body>"), "<body>x</body>");
  const noBody = '<script src="/_next/static/chunks/a.js" async=""></script>';
  assert.equal(deferScripts(noBody), noBody);
});
