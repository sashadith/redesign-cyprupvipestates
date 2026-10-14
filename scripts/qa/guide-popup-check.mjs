#!/usr/bin/env node
/* Guard for the guide popup (src/app/components/GuideCta/GuideGet.tsx, popup mode), used by the cards on the guides page.

   Asked 2026-10-14: clicking "get the guide" must open the form in a popup, not expand the card in place. Mounts the real
   component in jsdom (the form itself is a stand-in that records its props, it has its own checks) and drives it:

     - the button opens a dialog in <body> with the form, the card itself does not grow;
     - the close button closes it, and reopening shows the form again;
     - a successful submit (a /api/guides/ link) swaps the popup to the download, and reopening after a close keeps it;
     - a link that is not under /api/guides/ is ignored;
     - without the `popup` prop the old in-place behaviour is unchanged (the in-article offer relies on it).

     node scripts/qa/guide-popup-check.mjs

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
  console.error("esbuild and jsdom are needed (both are transitive dependencies).");
  process.exit(2);
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const tmp = realpathSync(mkdtempSync(join(tmpdir(), "qa-gp-")));
process.on("exit", () => rmSync(tmp, { recursive: true, force: true }));

/* The stand-in lives inside the repo too (outside it, bare `react` does not resolve). */
const formStub = join(ROOT, `.qa-gp-form-${process.pid}.jsx`);
writeFileSync(formStub, `
import React from "react";
export const handle = { props: null };
export default function FormStub(props) { handle.props = props; return React.createElement("div", { "data-testid": "form" }, "FORM"); }
`);
process.on("exit", () => rmSync(formStub, { force: true }));
const entryPath = join(ROOT, `.qa-gp-entry-${process.pid}.jsx`);
const bundlePath = join(ROOT, `.qa-gp-bundle-${process.pid}.mjs`);
process.on("exit", () => { rmSync(entryPath, { force: true }); rmSync(bundlePath, { force: true }); });
writeFileSync(entryPath, `
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import GuideGet from ${JSON.stringify(join(ROOT, "src/app/components/GuideCta/GuideGet.tsx"))};
import { GUIDE_UI } from ${JSON.stringify(join(ROOT, "src/lib/guides/registry.ts"))};
import { handle } from ${JSON.stringify(formStub)};
export { React, createRoot, act, GuideGet, GUIDE_UI, handle };
`);
const out = await build({
  entryPoints: [entryPath], bundle: true, platform: "browser", format: "esm", write: false, jsx: "automatic", loader: { ".js": "jsx" },
  define: { "process.env.NODE_ENV": '"development"' },
  plugins: [{ name: "stubs", setup(b) { b.onResolve({ filter: /FormMinimalBlockComponent$/ }, () => ({ path: formStub })); } }],
});
writeFileSync(bundlePath, out.outputFiles[0].text);

const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "https://example.test/guides", pretendToBeVisual: true });
const win = dom.window;
win.matchMedia = () => ({ matches: false, media: "", addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent() { return false; } });
for (const k of ["window", "document", "HTMLElement", "Event", "KeyboardEvent", "MouseEvent", "Node", "getComputedStyle", "matchMedia", "requestAnimationFrame", "cancelAnimationFrame", "MutationObserver"]) {
  Object.defineProperty(globalThis, k, { value: k === "window" ? win : win[k], configurable: true, writable: true });
}
Object.defineProperty(globalThis, "navigator", { value: win.navigator, configurable: true });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const { React, createRoot, act, GuideGet, GUIDE_UI, handle } = await import(bundlePath);

let failures = 0;
function check(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { console.log(`  ok   ${name}`); return; }
  failures++;
  console.log(`  FAIL ${name}\n       expected ${e}\n       actual   ${a}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ui = GUIDE_UI.en;
const doc = win.document;
const host = () => doc.getElementById("root");
const dialog = () => doc.querySelector(".gdm");
const click = async (el) => { await act(async () => { el.dispatchEvent(new win.MouseEvent("click", { bubbles: true })); }); };
let root;
async function mount(props) {
  await act(async () => { root = createRoot(host()); root.render(React.createElement(GuideGet, { id: "cost-of-buying", ui, form: {}, lang: "en", buttonClass: "gds__btn", ...props })); });
}
async function unmount() { await act(async () => { root.unmount(); }); await sleep(30); }

console.log("popup mode");
await mount({ popup: { title: "The True Cost", cover: { src: "/c.jpg", width: 10, height: 14 } } });
check("closed: only the button, no dialog", [host().querySelectorAll("button").length, dialog() === null], [1, true]);
await click(host().querySelector("button.gds__btn"));
check("click opens a dialog in body, outside the card", [dialog() !== null, host().contains(dialog())], [true, false]);
check("dialog holds the form and the guide title", [!!doc.querySelector("[data-testid=form]"), doc.querySelector(".gdm__title")?.textContent], [true, "The True Cost"]);
check("form is wired to the guide", handle.props.guideId, "cost-of-buying");
check("the card did not expand", host().querySelectorAll("[data-testid=form], .guidecta__formbox").length, 0);
await click(doc.querySelector(".gdm__close"));
await sleep(400);
check("close removes the dialog", dialog(), null);
await click(host().querySelector("button.gds__btn"));
check("reopen shows the form again", !!doc.querySelector("[data-testid=form]"), true);
await act(async () => { handle.props.onFormSubmitSuccess({ guide: { url: "https://evil.test/x.pdf" } }); });
check("a link outside /api/guides/ is ignored", [!!doc.querySelector("[data-testid=form]"), doc.querySelector(".gdm__download") === null], [true, true]);
await act(async () => { handle.props.onFormSubmitSuccess({ guide: { url: "/api/guides/cost-of-buying?lang=en&t=abc" } }); });
check("success swaps to the download", [doc.querySelector(".gdm__download")?.getAttribute("href"), doc.querySelector("[data-testid=form]") === null], ["/api/guides/cost-of-buying?lang=en&t=abc", true]);
await click(doc.querySelector(".gdm__close"));
await sleep(400);
await click(host().querySelector("button.gds__btn"));
check("reopening after success keeps the download", doc.querySelector(".gdm__download") !== null, true);
await unmount();
await sleep(400);

console.log("inline mode (no popup prop)");
await mount({});
await click(host().querySelector("button.gds__btn"));
check("click expands in place, no dialog", [host().querySelector("[data-testid=form]") !== null, dialog()], [true, null]);
await unmount();

console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
