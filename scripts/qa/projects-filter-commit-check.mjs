#!/usr/bin/env node
/* Guard for the price filters in the /projects explorer
   (src/app/preview-projects/ProjectsExplorer.tsx).

   Reported 2026-09-16: "wenn ich im eingabefeld max budget 600000 eingebe
   passiert nichts, auch wenn ich enter drücke passiert nichts, erst wenn ich
   das feld verlasse wird das suchergebnis aktualisiert."

   Both price boxes were wired to onBlur ALONE — no onChange, no onKeyDown —
   while every other control in that bar commits on change. Enter had nothing
   to fall back on either: the boxes sit in a plain <div>, outside the search
   <form> further down, so there was no implicit form submission.

   This mounts the real component in jsdom and drives it like a person would,
   because the three ways a budget can be committed (type, Enter, leave) are
   behaviour, not source text. The two constraints that pull against each
   other, and that a naive fix breaks, are pinned here as well:

     - typing must NOT fire a query per keystroke (it waits PRICE_COMMIT_MS);
     - a commit must NOT clobber what the person is still typing, which is why
       the boxes stay uncontrolled and lost their remounting `key`.

     node scripts/qa/projects-filter-commit-check.mjs

   Exits non-zero on the first failed assertion. */
import { writeFileSync, mkdtempSync, rmSync, realpathSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

let build, JSDOM;
try {
  ({ build } = await import("esbuild"));
  ({ JSDOM } = await import("jsdom"));
} catch {
  console.error("esbuild and jsdom are needed (both are transitive dependencies).\n  npm i -D esbuild jsdom   — or run this check from a tree where they are present.");
  process.exit(2);
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
/* realpath matters: on macOS mkdtemp hands back /var/..., esbuild resolves a
   normal import to the real /private/var/..., and a path returned straight
   from a plugin is not resolved at all — so the same stub would be bundled
   TWICE and the component would record its navigations into a different copy
   of the array than the one asserted on here. */
const tmp = realpathSync(mkdtempSync(join(tmpdir(), "qa-px-")));
process.on("exit", () => rmSync(tmp, { recursive: true, force: true }));

/* --- stand-ins for the framework the component talks to ------------------ */
const w = (name, src) => { const p = join(tmp, name); writeFileSync(p, src); return p; };

const navStub = w("nav.js", `
export const state = { pathname: "/en/projects", search: "", calls: [] };
export const useRouter = () => ({
  replace: (url) => { state.calls.push(url); },
  push: (url) => { state.calls.push(url); },
  prefetch: () => {}, refresh: () => {}, back: () => {}, forward: () => {},
});
export const usePathname = () => state.pathname;
export const useSearchParams = () => new URLSearchParams(state.search);
`);
const dynStub = w("dyn.js", `export default function dynamic() { return function Dyn() { return null; }; }`);
const nullStub = w("null.js", `export default function Null() { return null; }`);

const STUBS = [
  [/^next\/navigation$/, navStub],
  [/^next\/dynamic$/, dynStub],
  [/^next\/image$/, nullStub],
  [/^next\/link$/, nullStub],
  [/ProjectsMap$/, nullStub],
];

/* The entry has to live inside the repo or node cannot resolve react from it. */
const entryPath = join(ROOT, `.qa-px-entry-${process.pid}.jsx`);
const bundlePath = join(ROOT, `.qa-px-bundle-${process.pid}.mjs`);
process.on("exit", () => { rmSync(entryPath, { force: true }); rmSync(bundlePath, { force: true }); });
const entry = (() => { writeFileSync(entryPath, `
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import Explorer from ${JSON.stringify(join(ROOT, "src/app/preview-projects/ProjectsExplorer.tsx"))};
import { state } from ${JSON.stringify(navStub)};
export { React, createRoot, act, Explorer, state };
`); return entryPath; })();

const out = await build({
  entryPoints: [entry], bundle: true, platform: "browser", format: "esm", write: false,
  jsx: "automatic", loader: { ".js": "jsx" },
  define: { "process.env.NODE_ENV": '"development"' },
  plugins: [{
    name: "stubs",
    setup(b) {
      for (const [filter, path] of STUBS) b.onResolve({ filter }, () => ({ path }));
    },
  }],
});
writeFileSync(bundlePath, out.outputFiles[0].text);

/* --- a browser to run it in ---------------------------------------------- */
const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
  url: "https://example.test/en/projects", pretendToBeVisual: true,
});
const win = dom.window;
win.matchMedia = () => ({ matches: false, media: "", addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent() { return false; } });
for (const k of ["window", "document", "HTMLElement", "HTMLInputElement", "Event", "KeyboardEvent", "FocusEvent", "MouseEvent", "Node", "getComputedStyle", "matchMedia", "requestAnimationFrame", "cancelAnimationFrame"]) {
  Object.defineProperty(globalThis, k, { value: k === "window" ? win : win[k], configurable: true, writable: true });
}
Object.defineProperty(globalThis, "navigator", { value: win.navigator, configurable: true });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const { React, createRoot, act, Explorer, state } = await import(bundlePath);

/* --- assertions ----------------------------------------------------------- */
let failures = 0;
function check(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { console.log(`  ok   ${name}`); return; }
  failures++;
  console.log(`  FAIL ${name}\n       expected ${e}\n       actual   ${a}`);
}

const STRINGS_LOCALE = "en";
const baseFilters = { city: "", propertyType: "", priceFrom: null, priceTo: null, bedrooms: "", q: "", sort: "" };
const props = (over = {}) => ({
  cards: [], markers: [], total: 0, page: 1, totalPages: 1,
  locale: STRINGS_LOCALE, filters: { ...baseFilters, ...(over.filters ?? {}) },
  ...over,
});

let root = null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function mount(over) {
  state.calls.length = 0;
  const host = win.document.getElementById("root");
  await act(async () => { root = createRoot(host); root.render(React.createElement(Explorer, props(over))); });
  return host;
}
async function rerender(over) {
  await act(async () => { root.render(React.createElement(Explorer, props(over))); });
}
async function unmount() { await act(async () => { root.unmount(); }); }

const boxes = () => Array.from(win.document.querySelectorAll(".px__price input"));
const minBox = () => boxes()[0];
const maxBox = () => boxes()[1];

const nativeValue = Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, "value").set;
async function type(el, value) {
  await act(async () => {
    el.focus();
    nativeValue.call(el, value);
    el.dispatchEvent(new win.Event("input", { bubbles: true }));
  });
}
async function pressEnter(el) {
  await act(async () => { el.dispatchEvent(new win.KeyboardEvent("keydown", { key: "Enter", bubbles: true })); });
}
/* blur() alone: jsdom already emits the focusout that React's onBlur listens
   for, so dispatching one as well makes the handler run twice and would hide
   a genuine double-commit. */
async function leave(el) {
  await act(async () => { el.blur(); });
}
/* The debounce runs on real timers, so waiting is the honest way to observe
   it. 250 ms is comfortably under PRICE_COMMIT_MS, 1100 ms comfortably over —
   if that constant is ever raised past a second, these two will say so. */
const BEFORE = 250, AFTER = 1100;
const last = () => state.calls[state.calls.length - 1] ?? null;
const param = (key) => { const u = last(); return u == null ? null : new URLSearchParams(u.split("?")[1] ?? "").get(key); };

/* The component has to mount at all before any of this means anything. */
await mount();
check("the bar renders both price boxes", boxes().length, 2);

/* 1. Typing: the reported first half. It must land — but not per keystroke. */
await type(maxBox(), "600000");
await sleep(BEFORE);
check("typing does not fire a query per keystroke", state.calls.length, 0);
await sleep(AFTER - BEFORE);
check("typing a max budget applies itself", param("priceTo"), "600000");
check("…with exactly one navigation", state.calls.length, 1);
await unmount();

/* 2. Enter: the reported second half, and the reason this was filed. */
await mount();
await type(maxBox(), "600000");
await pressEnter(maxBox());
check("Enter applies the budget at once", param("priceTo"), "600000");
check("…without waiting for the debounce", state.calls.length, 1);
check("…and without needing to leave the box", win.document.activeElement === maxBox(), true);
await sleep(AFTER);
check("…and Enter cancels the pending commit, so it fires once", state.calls.length, 1);
await unmount();

/* 3. Leaving the box still works — that was the ONLY way before, and people
      who learned it must not lose it. */
await mount();
await type(maxBox(), "450000");
await leave(maxBox());
check("leaving the box still applies the budget", param("priceTo"), "450000");
check("…once, not twice", state.calls.length, 1);
await unmount();

/* 4. The min box is wired the same way. It was the same one-line omission, so
      it is the one most likely to be fixed on one side only. */
await mount();
await type(minBox(), "200000");
await pressEnter(minBox());
check("the min budget commits on Enter too", param("priceFrom"), "200000");
await unmount();
await mount();
await type(minBox(), "200000");
await sleep(AFTER);
check("…and on typing", param("priceFrom"), "200000");
await unmount();

/* 5. Clearing a budget has to remove the param, not set it to an empty one. */
await mount({ filters: { priceTo: 600000 } });
await type(maxBox(), "");
await pressEnter(maxBox());
check("clearing the box drops the parameter", param("priceTo"), null);
check("…and does navigate rather than doing nothing", state.calls.length, 1);
await unmount();

/* 6. setParam's own contract: a filter change resets paging and the map bbox,
      or the visitor lands on page 3 of a result set that now has one page. */
/* the url has to carry them BEFORE the mount — setParam closes over the
   search params it read at render time, so setting them afterwards would
   assert against an empty url and pass no matter what. */
state.search = "page=3&north=35&south=34&east=33&west=32";
await mount();
await type(maxBox(), "600000");
await pressEnter(maxBox());
check("a new budget drops the page number", param("page"), null);
check("…and the map bbox", param("north"), null);
state.search = "";
await unmount();

/* 7. The half-typed-number hazard. A commit round-trips through the server and
      comes back as new props; if the box took its value from those props it
      would jump back to the committed number while the person types the next
      digit. This is why the boxes are uncontrolled and why their `key` had to
      go — a `key` bound to the URL value remounts the box and drops focus. */
await mount();
await type(maxBox(), "600000");
await pressEnter(maxBox());
await type(maxBox(), "6000000");                 // still focused, still typing
await rerender({ filters: { priceTo: 600000 } }); // the commit comes back
check("a commit does not overwrite a half-typed number", maxBox().value, "6000000");
check("…and does not steal focus from the box", win.document.activeElement === maxBox(), true);
await unmount();

/* 8. The other direction: when the URL changes underneath an idle box — Back
      button, a shared link — the box must follow it. */
await mount({ filters: { priceTo: 600000 } });
check("a budget in the url shows in the box", maxBox().value, "600000");
await rerender({ filters: { priceTo: 300000 } });
check("an unfocused box follows the url", maxBox().value, "300000");
await rerender({ filters: {} });
check("…and empties when the budget is dropped", maxBox().value, "");
await unmount();

/* 9. Reset clears everything. The boxes are uncontrolled now, so clearing the
      url alone does not empty them, and a commit still in flight would put the
      old budget straight back.

      To be precise about what these two pin: the sync effect above would also
      empty the boxes once the cleared url round-trips back as props, so this
      is about doing it AT ONCE — no flash of a budget the visitor just
      cleared. The pending-commit assertion below is the load-bearing one. */
await mount();
await type(minBox(), "200000");
await type(maxBox(), "600000");
await act(async () => { win.document.querySelector(".px__reset").dispatchEvent(new win.MouseEvent("click", { bubbles: true })); });
check("reset empties the min box", minBox().value, "");
check("reset empties the max box", maxBox().value, "");
const afterReset = state.calls.length;
await sleep(AFTER);
check("reset cancels a commit that was still pending", state.calls.length, afterReset);
check("…and the last navigation is the cleared url", last(), "/en/projects");
await unmount();

console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
