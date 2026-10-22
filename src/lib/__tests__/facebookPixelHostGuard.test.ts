import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
// @ts-ignore — jsdom ships no type declarations in this repo
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/* See src/lib/trackingHost.ts for the incident these assertions protect: the
   Meta pixel id is compiled into the bundle, so a dev server reported straight
   into the live dataset — 310 events from `localhost` in one hour on
   26 September, 30 of them InitiateCheckout, against 69 in the whole 28-day
   window. trackingHost.test.ts covers the host decision as a function; this
   file mounts the real component and asks whether the tag reaches the DOM.

   Why a client mount and not renderToStaticMarkup: `next/script` with
   strategy="afterInteractive" emits NOTHING during SSR whether or not the
   guard exists (measured — an unguarded copy returns an empty string too). A
   server-render assertion here would pass against the broken version and would
   therefore prove nothing. The injection happens on the client, so that is
   where the question has to be asked. */

(globalThis as unknown as { React: typeof React }).React = React;

const PIXEL_ID = "1238429281352397";
const SRC = join(process.cwd(), "src/app/components/FacebookPixel/FacebookPixel.tsx");

/** Mounts FacebookPixel in a fresh document served from `url`, and reports
 *  whether the pixel ended up in that document. */
async function pixelReachesDomOn(url: string): Promise<boolean> {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url, pretendToBeVisual: true });
  const g = globalThis as any;
  g.window = dom.window;
  g.document = dom.window.document;
  // navigator is a getter-only global on modern Node; assigning it throws.
  Object.defineProperty(g, "navigator", { value: dom.window.navigator, configurable: true });
  g.HTMLElement = dom.window.HTMLElement;
  g.Element = dom.window.Element;
  g.Node = dom.window.Node;
  g.IS_REACT_ACT_ENVIRONMENT = true;

  const { createRoot } = await import("react-dom/client");
  const { act } = await import("react");
  const mod = await import("@/app/components/FacebookPixel/FacebookPixel");

  const mountPoint = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(mountPoint);
  await (act as unknown as (cb: () => Promise<void>) => Promise<void>)(async () => {
    createRoot(mountPoint).render(React.createElement(mod.default));
  });

  return dom.window.document.documentElement.outerHTML.includes(PIXEL_ID);
}

/* ORDER MATTERS. `next/script` keeps a module-level LoadCache — a Set keyed by
   the SCRIPT ID, not by the host (next/dist/client/script.js) — and suppresses
   every injection after the first one for that id. Every mount here uses the
   same id, so one successful injection makes all later mounts come back empty
   no matter what the component decided. Put the positive case first and the
   negatives are worthless: they pass against a guard that was deleted
   (measured — that is how this test was wrong on its first draft).
   So: negatives first, on a cold cache, where a broken guard really does
   inject and really does fail them. The positive then runs as the first
   injection in the process and still proves production reports.
   Do not reorder, and do not add a mount above this test. node runs each test
   FILE in its own process, which is what keeps the cache contained. */
test("the guard decides whether the tag reaches the page", async () => {
  // The exact shape of the 26 September incident, plus the neighbours it
  // generalises to. Cold cache: only the guard can keep these empty.
  for (const url of [
    "http://localhost:3000/en/projects/x",
    "http://127.0.0.1:3000/",
    "http://192.168.1.42:3000/",
    "https://staging.cyprusvipestates.com/",
    "http://72.60.89.239:3000/", // the VPS by IP — how a staging port gets browsed
    // A separate repo with its own pixel copy; this guard must not adopt it.
    "https://private.cyprusvipestates.com/",
  ]) {
    assert.equal(await pixelReachesDomOn(url), false, `${url} wrote into the production dataset`);
  }

  // Last, and the first injection in this process — see the note above.
  assert.equal(
    await pixelReachesDomOn("https://cyprusvipestates.com/en/projects/x"),
    true,
    "production stopped reporting",
  );
});

test("the component asks isTrackingHost about the browser's own hostname", () => {
  const src = readFileSync(SRC, "utf8");
  assert.ok(/from "@\/lib\/trackingHost"/.test(src), "the host allowlist is no longer imported");
  assert.ok(
    /isTrackingHost\(\s*window\.location\.hostname\s*\)/.test(src),
    "the guard no longer reads the hostname the browser is actually on",
  );
  // The host must be resolved in an effect with the state starting at false:
  // a `typeof window === "undefined"` shortcut during render would make server
  // and client disagree on the first pass instead of both rendering nothing.
  assert.ok(/useState\(false\)/.test(src), "the initial state is no longer 'not allowed'");
  assert.ok(/useEffect\(\(\) => \{\s*setAllowed\(/.test(src), "the hostname is no longer resolved in an effect");
});
