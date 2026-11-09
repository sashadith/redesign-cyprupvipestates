/* Behaviour test for the cockpit's "New deal" (src/app/crm/components/NewDealButton.tsx
   + DealFields.tsx), 2026-11-08. Mounts the real button in jsdom with the server
   actions and next/navigation stubbed (same recipe as crm-board-dialog.test.mjs). Pins:
     - a developer and project not in our lists are sent as typed names, with the typed rate;
     - picking one of our projects sends its id and fills in its developer;
     - "Move the lead to Reserved" is offered and pre-ticked before Reserved, absent after. */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdtempSync, rmSync, realpathSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { build, stop } from "esbuild";
import { JSDOM } from "jsdom";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const tmp = realpathSync(mkdtempSync(join(tmpdir(), "qa-crm-newdeal-")));
const w = (name, src) => { const p = join(tmp, name); writeFileSync(p, src); return p; };

const navStub = w("nav.js", `export const useRouter = () => ({ refresh() {}, push() {}, replace() {}, prefetch() {}, back() {}, forward() {} });`);
const actionsStub = w("actions.js", `
export const calls = [];
export async function addDealAction(leadId, deal, move) { calls.push({ leadId, deal: JSON.parse(JSON.stringify(deal)), move }); return { ok: true, moved: move }; }
export async function searchDevelopersAction(q) { return "aristo".startsWith(q.toLowerCase()) && q ? [{ id: "acc1", value: "Aristo", label: "Aristo", hint: "5 %" }] : []; }
export async function searchDevelopmentsAction(q, acc) {
  return q === "" || "eden".startsWith(q.toLowerCase()) ? [{ id: "d1", value: "Eden Coast", label: "Eden Coast · Paphos", hint: "Aristo · 5 %", developer: { id: "acc1", name: "Aristo" } }] : [];
}
export async function typedDealNamesAction() { return []; }
`);

const entryPath = join(ROOT, `.qa-crm-newdeal-entry-${process.pid}.jsx`);
const bundlePath = join(ROOT, `.qa-crm-newdeal-bundle-${process.pid}.mjs`);
const cleanup = () => { rmSync(tmp, { recursive: true, force: true }); rmSync(entryPath, { force: true }); rmSync(bundlePath, { force: true }); };

writeFileSync(entryPath, `
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { NewDealButton } from ${JSON.stringify(join(ROOT, "src/app/crm/components/NewDealButton.tsx"))};
import { calls } from ${JSON.stringify(actionsStub)};
export { React, createRoot, act, NewDealButton, calls };
`);
try {
  const out = await build({
    entryPoints: [entryPath], bundle: true, platform: "browser", format: "esm", write: false,
    jsx: "automatic", define: { "process.env.NODE_ENV": '"development"' }, logLevel: "silent",
    plugins: [{ name: "stubs", setup(b) {
      b.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: navStub }));
      b.onResolve({ filter: /^\.\.\/actions$/ }, () => ({ path: actionsStub }));
    } }],
  });
  writeFileSync(bundlePath, out.outputFiles[0].text);
} finally {
  await stop();
  rmSync(entryPath, { force: true });
}

const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "https://crm.test/crm/leads/x", pretendToBeVisual: true });
const win = dom.window;
win.HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
win.HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
for (const k of ["window", "document", "HTMLElement", "Node", "Event", "KeyboardEvent", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame"]) {
  Object.defineProperty(globalThis, k, { value: k === "window" ? win : win[k], configurable: true, writable: true });
}
Object.defineProperty(globalThis, "navigator", { value: win.navigator, configurable: true });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.MessageChannel = class {
  constructor() {
    this.port1 = { onmessage: null, close() {} };
    this.port2 = { postMessage: (data) => setImmediate(() => this.port1.onmessage?.({ data })), close() {} };
  }
};

let mod;
try { mod = await import(bundlePath); } finally { cleanup(); }
const { React, createRoot, act, NewDealButton, calls } = mod;
after(() => win.close());

const doc = win.document;
const wait = () => act(async () => { await new Promise((r) => setTimeout(r, 300)); });
const click = (el) => act(async () => { el.dispatchEvent(new win.MouseEvent("click", { bubbles: true })); });
const type = (sel, v) => act(async () => {
  const el = doc.querySelector(sel);
  Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, "value").set.call(el, v);
  el.dispatchEvent(new win.Event("input", { bubbles: true }));
});
const submit = () => act(async () => { doc.querySelector("dialog form").dispatchEvent(new win.Event("submit", { bubbles: true, cancelable: true })); });

async function open(status) {
  calls.length = 0;
  doc.body.innerHTML = "<div id='root'></div>";
  const root = createRoot(doc.getElementById("root"));
  await act(async () => root.render(React.createElement(NewDealButton, { leadId: "L1", leadName: "Magnus", status, onDone() {} })));
  await click([...doc.querySelectorAll("button")].find((b) => b.textContent === "New deal"));
  await wait();
  return root;
}

test("typed developer and project are saved as typed, with the typed rate, and the lead moves to Reserved", async () => {
  const root = await open("OFFER");
  const box = doc.querySelector(".crm-deal-move input");
  assert.ok(box && box.checked, "move to Reserved offered and pre-ticked");
  await type("#crm-deal-dev", "Smith Developers");
  await type("#crm-deal-proj", "Sea View Villas");
  await type("#crm-price", "950 000");
  await type("#crm-rate", "4,5");
  await wait();
  assert.match(doc.querySelector('[aria-label="Developer"]').textContent, /not in our list/);
  await submit();
  await wait();
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    leadId: "L1", move: true,
    deal: { developmentId: null, projectName: "Sea View Villas", developerAccountId: null, developerName: "Smith Developers", unitLabel: null, price: 950000, ratePercent: 4.5 },
  });
  await act(async () => root.unmount());
});

test("one of our projects sends its id and fills in its developer", async () => {
  const root = await open("RESERVED");
  assert.equal(doc.querySelector(".crm-deal-move"), null, "no move offered once Reserved");
  const opt = [...doc.querySelectorAll('[aria-label="Project"] [role="option"]')].find((b) => b.textContent.startsWith("Eden Coast"));
  assert.ok(opt);
  await click(opt);
  await type("#crm-price", "412000");
  await wait();
  assert.equal(doc.querySelector("#crm-deal-dev").value, "Aristo");
  await submit();
  await wait();
  assert.deepEqual(calls[0], {
    leadId: "L1", move: false,
    deal: { developmentId: "d1", projectName: null, developerAccountId: "acc1", developerName: null, unitLabel: null, price: 412000, ratePercent: null },
  });
  await act(async () => root.unmount());
});

test("nothing is sent without developer, project and price", async () => {
  const root = await open("NEW");
  await type("#crm-deal-proj", "Sea View");
  await submit();
  await wait();
  assert.equal(calls.length, 0);
  assert.ok(doc.querySelector(".crm-dialog-error"), "the problem is shown");
  await act(async () => root.unmount());
});

test("editing the developer after picking a project drops the project's id", async () => {
  const root = await open("RESERVED");
  const opt = [...doc.querySelectorAll('[aria-label="Project"] [role="option"]')].find((b) => b.textContent.startsWith("Eden Coast"));
  await click(opt);
  await type("#crm-deal-dev", "Other Builder");
  await type("#crm-price", "300000");
  await wait();
  await submit();
  await wait();
  assert.equal(calls[0].deal.developmentId, null);
  assert.equal(calls[0].deal.projectName, "Eden Coast");
  assert.equal(calls[0].deal.developerName, "Other Builder");
  await act(async () => root.unmount());
});

test("a lost lead: the move to Reserved is fixed on, and the deal is sent with it", async () => {
  const root = await open("LOST");
  const box = doc.querySelector(".crm-deal-move input");
  assert.ok(box && box.checked && box.disabled, "move fixed on for a lost lead");
  assert.match(doc.querySelector(".crm-deal-dialog").textContent, /lost lead cannot hold a deal/);
  await type("#crm-deal-dev", "Smith Developers");
  await type("#crm-deal-proj", "Sea View Villas");
  await type("#crm-price", "500 000");
  await wait();
  await submit();
  await wait();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].move, true);
  await act(async () => root.unmount());
});

test("a reserved lead offers no move box", async () => {
  const root = await open("RESERVED");
  assert.equal(doc.querySelector(".crm-deal-move"), null);
  await act(async () => root.unmount());
});
