/* Behaviour test for the /crm pipeline board's move dialog
   (src/app/crm/components/Board.tsx + MoveDialog.tsx), CRM v2 Phase 2a.

   Mounts the real Board in jsdom with the server actions and next/navigation
   stubbed (recipe: scripts/qa/projects-filter-commit-check.mjs). Pins:
     - a lost reason given in round one is re-sent with the cancel confirmation
       of round two (answers accumulate across dialog rounds);
     - Escape and a native close both clear the dialog, so the next move runs;
     - a failed move puts back only that card, not a whole-board snapshot;
     - a card the user may not edit cannot be moved.

   jsdom 23 has HTMLDialogElement without showModal()/close(); minimal versions
   are installed below (open attribute + close event, as the spec does). */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdtempSync, rmSync, realpathSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { build, stop } from "esbuild";
import { JSDOM } from "jsdom";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
// realpath: see the /var vs /private/var trap in projects-filter-commit-check.mjs.
const tmp = realpathSync(mkdtempSync(join(tmpdir(), "qa-crm-board-")));
const w = (name, src) => { const p = join(tmp, name); writeFileSync(p, src); return p; };

const navStub = w("nav.js", `
export const useRouter = () => ({ refresh() {}, push() {}, replace() {}, prefetch() {}, back() {}, forward() {} });
`);
const actionsStub = w("actions.js", `
export const calls = [];
export const replies = [];
export async function moveLeadAction(id, to, input) {
  calls.push({ id, to, input: JSON.parse(JSON.stringify(input ?? {})) });
  const r = replies.shift();
  if (!r) throw new Error("no reply queued");
  return r;
}
export const searches = [];
export async function searchDevelopmentsAction(q) {
  searches.push(q);
  return q === "" ? [{ id: "d1", label: "Eden Coast · Paphos" }] : [];
}
export async function assignLeadAction() { return { error: "not used" }; }
`);

const entryPath = join(ROOT, `.qa-crm-board-entry-${process.pid}.jsx`);
const bundlePath = join(ROOT, `.qa-crm-board-bundle-${process.pid}.mjs`);
// Removed as soon as the bundle is loaded (an "exit" handler does not run
// reliably under the test runner), and in `finally` if the build fails.
const cleanup = () => { rmSync(tmp, { recursive: true, force: true }); rmSync(entryPath, { force: true }); rmSync(bundlePath, { force: true }); };

writeFileSync(entryPath, `
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { Board } from ${JSON.stringify(join(ROOT, "src/app/crm/components/Board.tsx"))};
import { calls, replies, searches } from ${JSON.stringify(actionsStub)};
export { React, createRoot, act, Board, calls, replies, searches };
`);
try {
  const out = await build({
    entryPoints: [entryPath], bundle: true, platform: "browser", format: "esm", write: false,
    jsx: "automatic", define: { "process.env.NODE_ENV": '"development"' }, logLevel: "silent",
    plugins: [{
      name: "stubs",
      setup(b) {
        b.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: navStub }));
        b.onResolve({ filter: /^\.\.\/actions$/ }, () => ({ path: actionsStub }));
      },
    }],
  });
  writeFileSync(bundlePath, out.outputFiles[0].text);
} finally {
  // The esbuild service is a child process that would keep node alive.
  await stop();
  rmSync(entryPath, { force: true });
}

const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "https://crm.test/crm/pipeline", pretendToBeVisual: true });
const win = dom.window;
const D = win.HTMLDialogElement.prototype;
D.showModal = function () { this.setAttribute("open", ""); };
D.close = function () {
  if (!this.hasAttribute("open")) return;
  this.removeAttribute("open");
  // Queued, as in browsers: the event arrives after the current task.
  setTimeout(() => this.dispatchEvent(new win.Event("close")), 0);
};
for (const k of ["window", "document", "HTMLElement", "Node", "Event", "KeyboardEvent", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame"]) {
  Object.defineProperty(globalThis, k, { value: k === "window" ? win : win[k], configurable: true, writable: true });
}
Object.defineProperty(globalThis, "navigator", { value: win.navigator, configurable: true });
globalThis.CSS = { escape: (s) => String(s) };
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// Bundled for the browser, React's act() queues work through MessageChannel and
// never closes the ports, which keeps node alive after the last test. Same
// contract (port1.onmessage / port2.postMessage), backed by setImmediate.
globalThis.MessageChannel = class {
  constructor() {
    this.port1 = { onmessage: null, close() {} };
    this.port2 = { postMessage: (data) => setImmediate(() => this.port1.onmessage?.({ data })), close() {} };
  }
};

let mod;
try { mod = await import(bundlePath); } finally { cleanup(); }
const { React, createRoot, act, Board, calls, replies, searches } = mod;
// pretendToBeVisual keeps a frame timer running; close the window or node never exits.
after(() => win.close());

const card = (id, status, over = {}) => ({
  id, name: `Lead ${id}`, lang: null, project: null, sourceLabel: "Website", isPartner: false,
  ownerInitials: "SK", ownerName: "Sophie Keller", ageLabel: "2h", stale: false,
  dealValue: null, dealCommission: null, status, canEdit: true, ...over,
});
const STATUSES = ["NEW", "CONTACTED", "COMMUNICATING", "VIEWING_SCHEDULED", "OFFER", "RESERVED", "CLOSED"];
const columns = (cards) => STATUSES.map((s) => ({ status: s, label: s, total: 0, cards: cards.filter((c) => c.status === s) }));

const doc = win.document;
// Waits a frame too: Board refocuses a moved card in requestAnimationFrame, and
// that focus must land before the next interaction (as it does for a person).
const flush = () => act(async () => { await new Promise((r) => win.requestAnimationFrame(() => setTimeout(r, 0))); });
const click = (el) => act(async () => { el.dispatchEvent(new win.MouseEvent("click", { bubbles: true })); });
const dialog = () => doc.querySelector("dialog.crm-dialog");
const columnOf = (id) => doc.querySelector(`.crm-card[data-id="${id}"]`)?.closest("section")?.getAttribute("aria-label") ?? null;

async function mount(cards, strict = false) {
  calls.length = 0; replies.length = 0;
  doc.body.innerHTML = "<div id='root'></div>";
  const root = createRoot(doc.getElementById("root"));
  await act(async () => { const el = React.createElement(Board, { columns: columns(cards) }); root.render(strict ? React.createElement(React.StrictMode, null, el) : el); });
  return root;
}
async function menuMove(id, label) {
  const wrap = doc.querySelector(`.crm-card[data-id="${id}"]`).closest(".crm-cardwrap");
  await click(wrap.querySelector(".crm-move"));
  const item = [...wrap.querySelectorAll(".crm-menu button")].find((b) => b.textContent === label);
  assert.ok(item, `menu item ${label} in ${wrap.innerHTML}`);
  await click(item);
  await flush();
}
async function submitDialog() {
  await act(async () => { dialog().querySelector("form").dispatchEvent(new win.Event("submit", { bubbles: true, cancelable: true })); });
  await flush();
}

test("a lost reason from round one is re-sent with the cancel confirmation", async () => {
  const root = await mount([card("a", "RESERVED")]);
  replies.push(
    { error: "Choose why the lead was lost.", need: "lostReason" },
    { error: "This move cancels the open deal(s).", need: "confirmCancel", cancelCount: 1 },
    { ok: true },
  );
  await menuMove("a", "Lost");
  assert.ok(dialog()?.hasAttribute("open"), "lost-reason dialog open");
  assert.ok(dialog().querySelector("#crm-reason"));
  await submitDialog();
  assert.ok(dialog()?.hasAttribute("open"), "confirm dialog open");
  assert.match(dialog().textContent, /cancels 1 open deal/);
  await submitDialog();
  assert.equal(calls.length, 3);
  assert.deepEqual(calls[0].input, {});
  assert.deepEqual(calls[1].input, { lostReason: "BUDGET" });
  assert.deepEqual(calls[2].input, { lostReason: "BUDGET", confirmCancel: true });
  assert.equal(dialog(), null);
  await act(async () => root.unmount());
});

test("Escape clears the dialog and its answers; the next move runs", async () => {
  const root = await mount([card("a", "RESERVED")]);
  replies.push({ error: "Choose why the lead was lost.", need: "lostReason" });
  await menuMove("a", "Lost");
  assert.ok(dialog());
  await act(async () => { dialog().dispatchEvent(new win.Event("cancel", { cancelable: true })); });
  assert.equal(dialog(), null);
  replies.push({ ok: true });
  await menuMove("a", "Offer");
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1], { id: "a", to: "OFFER", input: {} });
  await act(async () => root.unmount());
});

test("a natively closed dialog never leaves dialog state behind", async () => {
  const root = await mount([card("a", "RESERVED")]);
  replies.push({ error: "Choose why the lead was lost.", need: "lostReason" });
  await menuMove("a", "Lost");
  await act(async () => { dialog().close(); await new Promise((r) => setTimeout(r, 5)); });
  assert.equal(dialog(), null);
  replies.push({ ok: true });
  await menuMove("a", "Offer");
  assert.equal(calls.length, 2, "the board is not blocked by a stale dialog");
  await act(async () => root.unmount());
});

test("a failed move puts back only that card, not moves that finished meanwhile", async () => {
  const root = await mount([card("a", "NEW"), card("b", "NEW")]);
  let failB;
  replies.push(new Promise((r) => { failB = r; }));
  await menuMove("b", "Contacted");
  assert.equal(columnOf("b"), "CONTACTED", "optimistic move");
  replies.push({ ok: true });
  await menuMove("a", "Offer");
  assert.equal(columnOf("a"), "OFFER");
  await act(async () => { failB({ error: "Nope." }); });
  await flush();
  assert.equal(columnOf("b"), "NEW", "failed card is back");
  assert.equal(columnOf("a"), "OFFER", "the move that succeeded while b was in flight stays");
  await act(async () => root.unmount());
});

test("a card the user may not edit cannot be moved", async () => {
  const root = await mount([card("a", "NEW", { canEdit: false }), card("b", "NEW")]);
  const a = doc.querySelector('.crm-card[data-id="a"]');
  assert.equal(a.getAttribute("draggable"), "false");
  assert.equal(a.closest(".crm-cardwrap").querySelector(".crm-move"), null);
  await act(async () => { a.dispatchEvent(new win.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })); });
  await flush();
  assert.equal(calls.length, 0);
  assert.ok(doc.querySelector('.crm-card[data-id="b"]').closest(".crm-cardwrap").querySelector(".crm-move"));
  await act(async () => root.unmount());
});

test("an unassigned card shows a muted owner placeholder", async () => {
  const root = await mount([card("a", "NEW", { ownerInitials: null, ownerName: null })]);
  const av = doc.querySelector('.crm-card[data-id="a"] .av');
  assert.equal(av.className, "av none");
  assert.equal(av.getAttribute("title"), "Unassigned");
  assert.equal(av.textContent, "—");
  await act(async () => root.unmount());
});

test("the move menu carries no ARIA menu roles", async () => {
  const root = await mount([card("a", "NEW")]);
  const wrap = doc.querySelector(".crm-cardwrap");
  const btn = wrap.querySelector(".crm-move");
  assert.equal(btn.getAttribute("aria-haspopup"), null);
  await click(btn);
  assert.equal(btn.getAttribute("aria-expanded"), "true");
  assert.equal(wrap.querySelector('[role="menu"], [role="menuitem"]'), null);
  await act(async () => root.unmount());
});

test("the card links to the new cockpit", async () => {
  const root = await mount([card("a", "NEW")]);
  assert.match(doc.querySelector('.crm-card[data-id="a"]').getAttribute("href"), /^\/crm\/leads\/a$/);
  await act(async () => root.unmount());
});

test("the deal dialog keeps showing the chosen project", async () => {
  const root = await mount([card("a", "OFFER")]);
  replies.push({ error: "Add the deal.", need: "deal" });
  await menuMove("a", "Reserved");
  assert.ok(dialog()?.hasAttribute("open"));
  const wait = () => act(async () => { await new Promise((r) => setTimeout(r, 300)); });
  await wait();
  const opt = [...dialog().querySelectorAll('[role="option"]')].find((b) => b.textContent === "Eden Coast · Paphos");
  assert.ok(opt, "option listed");
  await click(opt);
  searches.length = 0;
  await wait();
  const rows = [...dialog().querySelectorAll('[role="option"]')];
  assert.equal(rows.length, 1);
  assert.equal(rows[0].className, "on");
  assert.match(rows[0].textContent, /Eden Coast · Paphos/);
  assert.deepEqual(searches, [], "no search for the chosen label");
  // Price makes the form submittable: the selection survived.
  const price = dialog().querySelector("#crm-price");
  await act(async () => {
    const set = Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, "value").set;
    set.call(price, "412000");
    price.dispatchEvent(new win.Event("input", { bubbles: true }));
  });
  const save = [...dialog().querySelectorAll("button")].find((b) => b.textContent === "Save deal and move");
  assert.equal(save.disabled, false);
  await act(async () => root.unmount());
});

test("under StrictMode the dialog stays open, and Escape / native close still clear it", async () => {
  const root = await mount([card("a", "RESERVED")], true);
  replies.push({ error: "Choose why the lead was lost.", need: "lostReason" });
  await menuMove("a", "Lost");
  await flush();
  await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
  assert.ok(dialog()?.hasAttribute("open"), "dialog survives the simulated unmount");
  await act(async () => { dialog().dispatchEvent(new win.Event("cancel", { cancelable: true })); });
  await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
  assert.equal(dialog(), null, "Escape clears it");
  replies.push({ error: "Choose why the lead was lost.", need: "lostReason" });
  await menuMove("a", "Lost");
  await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
  assert.ok(dialog()?.hasAttribute("open"));
  await act(async () => { dialog().close(); });
  await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
  assert.equal(dialog(), null, "native close clears it");
  await act(async () => root.unmount());
});
