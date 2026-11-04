import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import React from "react";
// @ts-ignore — jsdom ships no type declarations in this repo
import { JSDOM } from "jsdom";

/* Does the pixel report a client navigation?
 *
 * Before this component it could not. `fbq('track', 'PageView')` sits inline in
 * the snippet FacebookPixel renders, so it runs once per DOCUMENT load, and on
 * this site most page changes are App Router navigations where the snippet
 * never runs again. Meta therefore heard about the landing page and nothing
 * after it, while AnalyticsTracker beaconed on every navigation — and the gap
 * between the two counts (129 against 188 on 2026-10-23) was being read as
 * ad-blocker attrition.
 *
 * Source text cannot answer this: whether the effect skips the first render and
 * fires on the second is behaviour. So this mounts the real component in jsdom
 * and navigates it, the harness react-component-qa-harness describes.
 */

(globalThis as unknown as { React: typeof React }).React = React;

type Call = unknown[];

const mount = (first: string) => mountWith(first, true);

async function mountWith(first: string, withFbq: boolean) {
  const dom = new JSDOM(`<!doctype html><html><body><div id="root"></div></body></html>`, {
    url: `https://cyprusvipestates.com${first}`,
    pretendToBeVisual: true,
  });
  const g = globalThis as unknown as Record<string, unknown>;
  g.window = dom.window;
  g.document = dom.window.document;
  Object.defineProperty(g, "navigator", { value: dom.window.navigator, configurable: true });
  g.HTMLElement = dom.window.HTMLElement;
  g.Element = dom.window.Element;
  g.Node = dom.window.Node;
  g.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
  g.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
  g.IS_REACT_ACT_ENVIRONMENT = true;

  const calls: Call[] = [];
  if (withFbq) {
    (dom.window as unknown as { fbq?: (...a: unknown[]) => void }).fbq = (...a: unknown[]) => void calls.push(a);
  }

  const { createRoot } = await import("react-dom/client");
  const { act } = await import("react");
  const Tracker = (await import("@/app/components/MetaPageViewTracker/MetaPageViewTracker")).default;
  // usePathname() reads the router context; without it the effect bails on a
  // null pathname and the test would pass having exercised nothing.
  const { PathnameContext } = await import("next/dist/shared/lib/hooks-client-context.shared-runtime");

  const root = createRoot(dom.window.document.getElementById("root")!);
  const actAsync = act as unknown as (cb: () => Promise<void>) => Promise<void>;
  const render = async (path: string) => {
    await actAsync(async () => {
      root.render(
        React.createElement(
          PathnameContext.Provider as unknown as React.ComponentType<{ value: string; children?: React.ReactNode }>,
          { value: path },
          // Children as the THIRD argument, never a prop: `next build` lints
          // src/ including __tests__, where react/no-children-prop is an error.
          // It broke a production build on 2026-10-22.
          React.createElement(Tracker),
        ),
      );
    });
  };
  await render(first);
  return { calls, navigate: render };
}

const pageViews = (calls: Call[]) => calls.filter((c) => c[0] === "track" && c[1] === "PageView");

test("a cold load reports nothing — the inline snippet already did", () => {
  // The whole risk of this component: double-counting every landing page is
  // worse than the gap it closes.
  return mount("/en").then(({ calls }) => {
    assert.deepEqual(calls, [], "the first render fired a PageView on top of the snippet's");
  });
});

test("a client navigation reports exactly one PageView", async () => {
  const { calls, navigate } = await mount("/en");
  await navigate("/en/projects/x");
  assert.equal(pageViews(calls).length, 1);
  assert.deepEqual(pageViews(calls)[0], ["track", "PageView"]);
});

test("two navigations report two", async () => {
  const { calls, navigate } = await mount("/en");
  await navigate("/en/projects/x");
  await navigate("/en/blog");
  assert.equal(pageViews(calls).length, 2);
});

test("coming back to a page already seen reports it again", async () => {
  // A→B→A is three views to Meta and three to our own tracker. Deduplicating
  // the return would re-open the gap this exists to close.
  const { calls, navigate } = await mount("/en");
  await navigate("/en/projects/x");
  await navigate("/en");
  assert.equal(pageViews(calls).length, 2);
});

test("a re-render with the same path reports nothing twice", async () => {
  const { calls, navigate } = await mount("/en");
  await navigate("/en/projects/x");
  await navigate("/en/projects/x");
  assert.equal(pageViews(calls).length, 1, "an unchanged path counted as a navigation");
});

test("PageView carries no eventID", async () => {
  // Pinned deliberately: no Conversions API copy of PageView will ever exist,
  // so a deduplication key on it is dead weight. metaEventId.test.ts holds the
  // source-level half of this.
  const { calls, navigate } = await mount("/en");
  await navigate("/en/projects/x");
  assert.equal(pageViews(calls)[0].length, 2, "PageView gained extra arguments");
});

test("with the pixel suppressed, navigating does nothing and throws nothing", async () => {
  // The host guard and the consent gate both mean window.fbq can be absent.
  // This runs on every navigation, so an unguarded call would throw on every
  // page change of a dev machine or a visitor who declined.
  const { calls, navigate } = await mountWith("/en", false);
  await assert.doesNotReject(() => navigate("/en/projects/x"));
  assert.deepEqual(calls, []);
});

/* ── where it is mounted ────────────────────────────────────────────────── */

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

test("it renders in BOTH trees, inside the consent gate", () => {
  // One tree is easy to forget, and the homepage is the one that matters most.
  // MetaViewContentTracker's own history is the warning: it existed for a year
  // in a place the rendered branch never reached.
  const layout = read("src/app/[lang]/layout.tsx");
  const atLayout = layout.indexOf("<MetaPageViewTracker");
  assert.ok(atLayout > 0, "[lang]/layout.tsx does not render MetaPageViewTracker");
  assert.ok(
    layout.indexOf("{hasAnalytics && (") < atLayout && atLayout < layout.indexOf("{!hasAnalytics"),
    "the tracker sits outside the consent gate in [lang]/layout.tsx",
  );

  const consent = read("src/app/components/ConsentScripts/ConsentScripts.tsx");
  const atConsent = consent.indexOf("<MetaPageViewTracker");
  assert.ok(atConsent > 0, "ConsentScripts does not render MetaPageViewTracker — the static homepage never reports navigations");
  assert.ok(
    consent.indexOf("hasAnalytics ? (") < atConsent && atConsent < consent.indexOf(") : ("),
    "the tracker sits outside the consent branch in ConsentScripts",
  );
});
