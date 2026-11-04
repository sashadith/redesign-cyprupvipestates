import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
// @ts-ignore — jsdom ships no type declarations in this repo
import { JSDOM } from "jsdom";

/* Does cta_click actually fire?
 *
 * Over 2026-10-17 → 10-22 the live table recorded, against 421 real
 * project-page views: form_view 150, scroll_50 125, scroll_90 70, wa_click 4
 * — and cta_click ZERO. The marker is in the markup and the delegation reads
 * correct, but engagementTracking.test.ts only asserts that the source TEXT
 * contains `data-engage="cta"`; the click path had never been executed. So
 * "nobody clicks the hero button" and "the measurement cannot see the click"
 * were both still open, and they have opposite fixes.
 *
 * This executes it, against the DOM ProjectPageBody really emits — including
 * the `<span>` inside the anchor, which is the detail that could plausibly
 * break delegation: the click lands on the span, and only `closest()` walking
 * up to the anchor finds the marker. (.btn draws its sheen on an absolutely
 * positioned ::before, and `.btn > *` lifts the label above it, which is why
 * the span is there at all and cannot simply be removed.)
 */

(globalThis as unknown as { React: typeof React }).React = React;

/** The hero CTA and the enquiry container, verbatim in shape from
 *  ProjectPageBody.tsx (the classes are load-bearing for the sheen, not for
 *  the measurement — the measurement must key on the attribute alone). */
const PAGE_HTML = `
  <header>
    <div class="pp-hero__cta">
      <a class="btn btn--glass" href="#enquiry" data-engage="cta"><span>Beratung anfragen</span></a>
      <a class="btn btn--glass" href="#units"><span>Wohnungen ansehen</span></a>
    </div>
  </header>
  <main>
    <div id="enquiry" data-engage="form"><form></form></div>
  </main>
`;

type Sent = { url: string; body: string };

/** Mounts EngagementTracker over PAGE_HTML and returns a click driver plus the
 *  beacons it captured. */
async function mountTracker(): Promise<{
  sent: Sent[];
  click: (selector: string) => Promise<void>;
}> {
  const dom = new JSDOM(`<!doctype html><html><body>${PAGE_HTML}<div id="root"></div></body></html>`, {
    url: "https://cyprusvipestates.com/en/projects/x",
    pretendToBeVisual: true,
  });
  const g = globalThis as unknown as Record<string, unknown>;
  g.window = dom.window;
  g.document = dom.window.document;
  Object.defineProperty(g, "navigator", { value: dom.window.navigator, configurable: true });
  g.HTMLElement = dom.window.HTMLElement;
  g.Element = dom.window.Element;
  g.Node = dom.window.Node;
  // The tracker's scroll handler calls the BARE global requestAnimationFrame,
  // which resolves to globalThis rather than to the jsdom window — without
  // this, React swallows a ReferenceError thrown inside the effect and the
  // listeners are never attached.
  g.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
  g.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
  g.IS_REACT_ACT_ENVIRONMENT = true;

  const sent: Sent[] = [];
  const pending: Promise<void>[] = [];
  Object.defineProperty(dom.window.navigator, "sendBeacon", {
    configurable: true,
    value: (url: string, blob: Blob) => {
      pending.push(blob.text().then((body) => void sent.push({ url, body })));
      return true;
    },
  });

  const { createRoot } = await import("react-dom/client");
  const { act } = await import("react");
  const Tracker = (await import("@/app/components/EngagementTracker/EngagementTracker")).default;
  // usePathname() returns null without the router's context, and the effect
  // bails on a null pathname — so nothing would ever be wired up and the test
  // would pass for the wrong reason. Supplying the context is what makes the
  // component behave the way it does on a real page.
  const { PathnameContext } = await import("next/dist/shared/lib/hooks-client-context.shared-runtime");

  const root = createRoot(dom.window.document.getElementById("root")!);
  const actAsync = act as unknown as (cb: () => Promise<void>) => Promise<void>;
  await actAsync(async () => {
    root.render(
      React.createElement(
        PathnameContext.Provider as unknown as React.ComponentType<{ value: string; children?: React.ReactNode }>,
        { value: "/en/projects/x" },
        // Children as the THIRD argument, not a prop: `next build` runs eslint
        // over src/ including __tests__, and react/no-children-prop is an error
        // there. It broke a production build on 2026-10-22 — the worktree
        // cannot run `npx next lint` (duplicate @next/next plugin between this
        // .eslintrc.json and the main checkout's), so nothing caught it locally.
        React.createElement(Tracker, { locale: "en", contentId: "dev-uuid-1" }),
      ),
    );
  });

  const click = async (selector: string) => {
    const el = dom.window.document.querySelector(selector);
    assert.ok(el, `the test's own fixture lost ${selector}`);
    await actAsync(async () => {
      el!.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    await Promise.all(pending);
  };

  return { sent, click };
}

const types = (sent: Sent[]) => sent.map((s) => JSON.parse(s.body).type);

test("clicking the hero CTA sends cta_click", async () => {
  const { sent, click } = await mountTracker();
  // The span, not the anchor: that is where a real click lands.
  await click('[data-engage="cta"] span');
  assert.deepEqual(types(sent), ["cta_click"]);
  assert.equal(sent[0].url, "/api/analytics/event");
});

test("the beacon carries the path, locale and development id", async () => {
  const { sent, click } = await mountTracker();
  await click('[data-engage="cta"] span');
  assert.deepEqual(JSON.parse(sent[0].body), {
    path: "/en/projects/x",
    locale: "en",
    type: "cta_click",
    contentId: "dev-uuid-1",
  });
});

test("clicking the anchor itself works too", async () => {
  const { sent, click } = await mountTracker();
  await click('[data-engage="cta"]');
  assert.deepEqual(types(sent), ["cta_click"]);
});

test("a second click sends nothing — once per page view", async () => {
  const { sent, click } = await mountTracker();
  await click('[data-engage="cta"] span');
  await click('[data-engage="cta"] span');
  assert.deepEqual(types(sent), ["cta_click"], "the once-per-view guard stopped working");
});

test("the neighbouring unmarked button sends nothing", async () => {
  // The units button sits in the same container with the same classes and no
  // marker. If it reported, every count would be inflated.
  const { sent, click } = await mountTracker();
  await click('a[href="#units"] span');
  assert.deepEqual(types(sent), []);
});
