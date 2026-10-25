import React from "react";
// @ts-ignore — jsdom ships no type declarations in this repo
import { JSDOM } from "jsdom";

/* Shared jsdom mount for the third-party tag guards (FacebookPixel,
   GoogleAdsScript, LinkedInPixel). Not a test file — `npm test` globs
   src/lib/__tests__/*.test.ts, so nothing here runs on its own.

   Why a CLIENT mount and not renderToStaticMarkup: `next/script` with
   strategy="afterInteractive" emits NOTHING during SSR whether or not a guard
   exists (measured against an unguarded copy). A server-render assertion would
   pass against the broken version and prove nothing. The injection happens on
   the client, so that is where the question has to be asked.

   READ THIS BEFORE ADDING CASES — next/script keeps a module-level LoadCache,
   a Set keyed by the SCRIPT ID rather than by the host
   (next/dist/client/script.js). One successful injection of an id makes every
   later mount of that id come back empty whatever the component decided. So
   for each component: negative hosts FIRST, on a cold cache, where a broken
   guard really does inject and really does fail; the positive host last, as
   that id's first injection. Getting this backwards is not theoretical — the
   first draft of facebookPixelHostGuard.test.ts did, and its negative cases
   passed against a guard that had been deleted. node runs each test FILE in
   its own process, which is what keeps the cache contained. */

/* The app builds with Next's automatic JSX runtime, so component files
   legitimately use JSX without importing React. Under the test runner,
   tsx/esbuild falls back to the classic transform and emits React.createElement
   — exposing React globally restores production semantics for the test. */
(globalThis as unknown as { React: typeof React }).React = React;

type Loaded = { default: React.ComponentType<any> };

/**
 * Mounts a component in a fresh document served from `url` and reports whether
 * `needle` (the vendor id) ended up anywhere in that document.
 *
 * `load` is a function rather than a module path so the caller's static
 * `import()` keeps the path alias resolvable.
 */
export async function tagReachesDomOn(url: string, load: () => Promise<Loaded>, needle: string): Promise<boolean> {
  const win = await mountComponentOn(url, load);
  return win.document.documentElement.outerHTML.includes(needle);
}

/**
 * Mounts a component in a fresh document served from `url` and hands back that
 * document's window, for tags whose effect is a global rather than markup —
 * Clarity renders null and only creates `window.clarity`.
 */
export async function mountComponentOn(
  url: string,
  load: () => Promise<Loaded>,
  props: Record<string, unknown> = {},
): Promise<any> {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url, pretendToBeVisual: true });
  const g = globalThis as unknown as Record<string, unknown>;
  g.window = dom.window;
  g.document = dom.window.document;
  // navigator is a getter-only global on Node 22; a plain assignment throws.
  Object.defineProperty(g, "navigator", { value: dom.window.navigator, configurable: true });
  g.HTMLElement = dom.window.HTMLElement;
  g.Element = dom.window.Element;
  g.Node = dom.window.Node;
  g.IS_REACT_ACT_ENVIRONMENT = true;

  const { createRoot } = await import("react-dom/client");
  const { act } = await import("react");
  const mod = await load();

  const mountPoint = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(mountPoint);
  await (act as unknown as (cb: () => Promise<void>) => Promise<void>)(async () => {
    createRoot(mountPoint).render(React.createElement(mod.default, props));
  });

  return dom.window;
}

/** The hosts no tag may ever report from. The shape of the 26 September
 *  incident plus the neighbours it generalises to. */
export const FORBIDDEN_HOSTS: readonly string[] = [
  "http://localhost:3000/en/projects/x",
  "http://127.0.0.1:3000/",
  "http://192.168.1.42:3000/",
  "https://staging.cyprusvipestates.com/",
  "http://72.60.89.239:3000/", // the VPS by IP — how a staging port gets browsed
  // A separate app with its own copies of these tags; this guard must not adopt it.
  "https://private.cyprusvipestates.com/",
];

export const PRODUCTION_HOST = "https://cyprusvipestates.com/en/projects/x";
