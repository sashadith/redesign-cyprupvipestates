#!/usr/bin/env node
/* Guard for the floor plans inside an expanded unit
   (src/app/preview-project/UnitsView.tsx, UnitDetails).

   Reported 2026-10-15: "die development plans in den units öffnen im neuen
   fenster und nicht wie alle anderen bilder". They were <a target="_blank">
   links to the file; every other image on the page opens the lightbox.

   Mounts the real component in jsdom, expands a unit like a person would,
   clicks its plan and checks the lightbox opens on it — in both the table
   and the cards view.

     node scripts/qa/unit-plans-lightbox-check.mjs

   Exits non-zero on the first failed assertion. */
import { writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
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
const entryPath = join(ROOT, `.qa-uplb-entry-${process.pid}.jsx`);
const bundlePath = join(ROOT, `.qa-uplb-bundle-${process.pid}.mjs`);
process.on("exit", () => { rmSync(entryPath, { force: true }); rmSync(bundlePath, { force: true }); });
writeFileSync(entryPath, `
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import UnitsView from ${JSON.stringify(join(ROOT, "src/app/preview-project/UnitsView.tsx"))};
export { React, createRoot, act, UnitsView };
`);
const out = await build({
  entryPoints: [entryPath], bundle: true, platform: "browser", format: "esm", write: false,
  jsx: "automatic", loader: { ".js": "jsx" }, define: { "process.env.NODE_ENV": '"development"' },
});
writeFileSync(bundlePath, out.outputFiles[0].text);

const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "https://example.test/en/projects/x", pretendToBeVisual: true });
const win = dom.window;
win.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }; // jsdom has none
win.matchMedia = () => ({ matches: false, media: "", addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent() { return false; } });
for (const k of ["window", "document", "HTMLElement", "Event", "KeyboardEvent", "MouseEvent", "Node", "getComputedStyle", "matchMedia", "ResizeObserver", "requestAnimationFrame", "cancelAnimationFrame"]) {
  Object.defineProperty(globalThis, k, { value: k === "window" ? win : win[k], configurable: true, writable: true });
}
Object.defineProperty(globalThis, "navigator", { value: win.navigator, configurable: true });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { React, createRoot, act, UnitsView } = await import(bundlePath);

let failures = 0;
function check(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { console.log(`  ok   ${name}`); return; }
  failures++;
  console.log(`  FAIL ${name}\n       expected ${e}\n       actual   ${a}`);
}

const PLAN = "/uploads/developments/d/planaaaaaaaaaa_medium.webp";
const unit = (ref) => ({
  ref, name: `Unit ${ref}`, label: ref, type: "apartment", status: "available", statusLabel: "Available", price: 230000, currency: "EUR",
  beds: "1", baths: "1", areaBuilt: "66", areaPlot: "", areaVeranda: "", floor: "1",
  attrs: [{ name: "Guest WC", value: "yes" }], features: [],
  photos: [`/uploads/developments/d/${ref}photoaaaaaa_medium.webp`], plans: [PLAN], coords: null, description: "",
});
const doc = win.document;
const click = async (el) => { await act(async () => { el.dispatchEvent(new win.MouseEvent("click", { bubbles: true })); }); };
const host = doc.getElementById("root");
let root;
await act(async () => { root = createRoot(host); root.render(React.createElement(UnitsView, { units: [unit("102"), unit("201")], lang: "en", projectName: "Test" })); });

async function plansOpenLightbox(view) {
  // expand the first unit
  const row = view === "table" ? doc.querySelector("tbody tr") : doc.querySelector("button.pp-uc__toggle");
  await click(row);
  const plan = doc.querySelector(".pp-uc__thumb--plan");
  check(`${view}: the plan thumbnail is there`, !!plan, true);
  if (!plan) return;
  check(`${view}: it is a button, not a link to a new tab`, [plan.tagName, plan.getAttribute("target")], ["BUTTON", null]);
  check(`${view}: no lightbox before the click`, !!doc.querySelector(".pp-lb"), false);
  await click(plan);
  const lb = doc.querySelector(".pp-lb");
  check(`${view}: the click opens the lightbox`, !!lb, true);
  check(`${view}: …on the plan itself`, !!lb?.querySelector(`img[src*="planaaaaaaaaaa"]`), true);
  await click(doc.querySelector(".pp-lb__close"));
  check(`${view}: the close button closes it`, !!doc.querySelector(".pp-lb"), false);
}

await plansOpenLightbox("table");
// switch to the cards view and try again
const cardsBtn = Array.from(doc.querySelectorAll("button")).find((b) => /cards/i.test(b.textContent ?? ""));
if (cardsBtn) {
  await click(cardsBtn);
  await plansOpenLightbox("cards");
} else { failures++; console.log("  FAIL cards toggle not found"); }

await act(async () => root.unmount());
console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
