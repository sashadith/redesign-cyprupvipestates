// Design settings live preview: the srcdoc + draft-style helpers for the CRM / portal panes, and
// the owner-guarded email preview core (controller ruling R8: pure core, injected deps).
import { test } from "node:test";
import assert from "node:assert/strict";
import { draftStyleText, toPreviewSrcdoc } from "../../app/crm-preview/previewSrcdoc";
import { makeDesignActions, OWNER_ONLY, type DesignStore } from "../../app/crm/settings/design/actionsCore";
import { CLASSIC, DEFAULT_GLOBAL, WEBSITE, cssVars } from "../design/theme";

// Shaped like a Next.js App Router response: stylesheet + font preload links, script preloads,
// external and inline (RSC payload) scripts.
const PAGE = [
  '<!DOCTYPE html><html lang="en" class="crm-html"><head><meta charSet="utf-8"/>',
  '<link rel="stylesheet" href="/_next/static/css/app.css" data-precedence="next"/>',
  '<link rel="preload" href="/_next/static/media/font.woff2" as="font" crossorigin="" type="font/woff2"/>',
  '<link rel="preload" as="script" fetchPriority="low" href="/_next/static/chunks/webpack.js"/>',
  '<link rel="modulepreload" href="/_next/static/chunks/main.js"/>',
  '<script src="/_next/static/chunks/main-app.js" async=""></script>',
  '<title>CRM preview</title></head><body class="crm-app antialiased">',
  '<header class="crm-top">Sample</header>',
  '<script>(self.__next_f=self.__next_f||[]).push([0])</script>',
  '<SCRIPT type="text/javascript">\nalert(1)\n</SCRIPT></body></html>',
].join("");

test("toPreviewSrcdoc strips every script and script preload, keeps styles, fonts and markup", () => {
  const out = toPreviewSrcdoc(PAGE);
  assert.doesNotMatch(out, /<script/i);
  assert.doesNotMatch(out, /as="script"|modulepreload|__next_f|alert\(1\)/);
  assert.match(out, /<link rel="stylesheet" href="\/_next\/static\/css\/app\.css"/);
  assert.match(out, /as="font"/);
  assert.match(out, /<header class="crm-top">Sample<\/header>/);
  assert.match(out, /<title>CRM preview<\/title>/);
});

test("toPreviewSrcdoc puts <base href=\"/\"> first in <head>, once", () => {
  const out = toPreviewSrcdoc(PAGE);
  assert.match(out, /<head><base href="\/">\s*<meta charSet="utf-8"\/>/);
  assert.equal(toPreviewSrcdoc(out), out);
  assert.equal(out.match(/<base /g)?.length, 1);
  assert.match(toPreviewSrcdoc('<html><head lang="x"><title>t</title></head></html>'), /<head lang="x"><base href="\/">/);
});

test("draftStyleText wraps real cssVars output in :root{}", () => {
  const vars = cssVars(WEBSITE, DEFAULT_GLOBAL);
  assert.equal(draftStyleText(vars), `:root{${vars}}`);
  assert.equal(draftStyleText(cssVars(CLASSIC, DEFAULT_GLOBAL)), `:root{${cssVars(CLASSIC, DEFAULT_GLOBAL)}}`);
});

test("draftStyleText rejects text that could close the rule or the <style> element", () => {
  for (const vars of ["--ds-page:#FFF}body{display:none", "--ds-page:#FFF</style><script>x()</script>", "a{b", "x>y"]) {
    assert.equal(draftStyleText(vars), null, vars);
  }
});

const store = new Proxy({}, { get: () => async () => { throw new Error("store must not be called"); } }) as DesignStore;
const OWNER = { id: "u1", name: "Owner", email: "o@x", isOwner: true };
const STAFF = { id: "u2", name: "Staff", email: "s@x", isOwner: false };
function actions(user: typeof OWNER | null) {
  return makeDesignActions({ getUser: async () => user, store, revalidate: () => assert.fail("no revalidate"), baseUrl: () => "https://partner.test" });
}

test("previewEmail is owner only", async () => {
  for (const u of [STAFF, null]) assert.deepEqual(await actions(u).previewEmail(CLASSIC, DEFAULT_GLOBAL), { ok: false, error: OWNER_ONLY });
});

test("previewEmail renders the approved mail in the draft colours with the partner login link", async () => {
  const r = await actions(OWNER).previewEmail(WEBSITE, { ...DEFAULT_GLOBAL, emailBase: 18 });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.match(r.html, /https:\/\/partner\.test\/login/);
  assert.match(r.html, /Anna/);
  assert.match(r.html, new RegExp(WEBSITE.page, "i"));
  assert.match(r.html, /18px/);
});

test("previewEmail normalises junk input to Classic and the default settings", async () => {
  const junk = await actions(OWNER).previewEmail({ page: "red;}</style>", card: 7 } as unknown, { emailBase: 999, headingFont: "<x>" } as unknown);
  const classic = await actions(OWNER).previewEmail(CLASSIC, DEFAULT_GLOBAL);
  assert.equal(junk.ok, true);
  assert.deepEqual(junk, classic);
  if (junk.ok) assert.doesNotMatch(junk.html, /<\/style>"|red;/);
});
