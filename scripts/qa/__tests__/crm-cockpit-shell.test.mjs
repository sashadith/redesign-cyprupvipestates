/* Behaviour test for the CRM v2 Phase 2b final fixes (2026-10-18):
     - Shell hides the "Old CRM" link for people the old-CRM gate keeps out,
       and keeps it for everyone else; "+ New lead" (/crm/leads/new) is for all;
     - panels inside one ToastProvider share a single toast (no overlap);
     - TeamTable gives focus back to the control that triggered a save;
     - CockpitStage gives focus back to the stage button after a dialog is
       cancelled.

   Same recipe as crm-board-dialog.test.mjs: real components bundled with
   esbuild, mounted in jsdom, server actions and next/* stubbed — but against
   Next's compiled React canary (see the alias below). */
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
const tmp = realpathSync(mkdtempSync(join(tmpdir(), "qa-crm-shell-")));
const w = (name, src) => { const p = join(tmp, name); writeFileSync(p, src); return p; };

const navStub = w("nav.js", `
export const usePathname = () => "/crm/pipeline";
export const useRouter = () => ({ refresh() {}, push() {}, replace() {}, prefetch() {}, back() {}, forward() {} });
`);
// next/link as a plain <a>; loaded with resolveDir ROOT so it finds react.
const linkStub = `
import React from "react";
export default function Link({ href, children, ...rest }) { return React.createElement("a", { href, ...rest }, children); }
`;
const moveStub = w("actions.js", `
export const replies = [];
export async function moveLeadAction() { const r = replies.shift(); if (!r) throw new Error("no reply queued"); return r; }
export async function searchDevelopmentsAction() { return []; }
export async function searchLeadsAction() { return []; }
`);
const teamStub = w("team-actions.js", `
export const teamReplies = [];
export async function updateTeamMemberAction() { const r = teamReplies.shift(); if (!r) throw new Error("no reply queued"); return r; }
`);

const themeStub = w("theme-actions.js", `
export const themeCalls = [];
export async function setMyCrmThemeAction(id) { themeCalls.push(id); return { ok: true }; }
`);

const entryPath = join(ROOT, `.qa-crm-shell-entry-${process.pid}.jsx`);
const bundlePath = join(ROOT, `.qa-crm-shell-bundle-${process.pid}.mjs`);
const cleanup = () => { rmSync(tmp, { recursive: true, force: true }); rmSync(entryPath, { force: true }); rmSync(bundlePath, { force: true }); };
const comp = (f) => JSON.stringify(join(ROOT, "src/app/crm/components", f));

writeFileSync(entryPath, `
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { Shell } from ${comp("Shell.tsx")};
import { ToastProvider, useToast } from ${comp("Toast.tsx")};
import { TeamTable } from ${comp("TeamTable.tsx")};
import { CockpitStage } from ${comp("CockpitStage.tsx")};
import { replies } from ${JSON.stringify(moveStub)};
import { teamReplies } from ${JSON.stringify(teamStub)};
import { themeCalls } from ${JSON.stringify(themeStub)};
export { React, createRoot, act, Shell, ToastProvider, useToast, TeamTable, CockpitStage, replies, teamReplies, themeCalls };
`);
try {
  const out = await build({
    entryPoints: [entryPath], bundle: true, platform: "browser", format: "esm", write: false,
    jsx: "automatic", define: { "process.env.NODE_ENV": '"development"' }, logLevel: "silent",
    // The React build the app router really runs (Next's compiled canary): it
    // keeps useTransition pending across an async action, React 18.3.1 does not.
    alias: { react: "next/dist/compiled/react", "react-dom": "next/dist/compiled/react-dom" },
    plugins: [{
      name: "stubs",
      setup(b) {
        b.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: navStub }));
        b.onResolve({ filter: /^next\/link$/ }, () => ({ path: "next-link", namespace: "stub" }));
        b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({ contents: linkStub, loader: "js", resolveDir: ROOT }));
        b.onResolve({ filter: /^\.\.\/actions$/ }, () => ({ path: moveStub }));
        b.onResolve({ filter: /^\.\.\/themeActions$/ }, () => ({ path: themeStub }));
        b.onResolve({ filter: /^\.\.\/team\/actions$/ }, () => ({ path: teamStub }));
      },
    }],
  });
  writeFileSync(bundlePath, out.outputFiles[0].text);
} finally {
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
  setTimeout(() => this.dispatchEvent(new win.Event("close")), 0);
};
for (const k of ["window", "document", "HTMLElement", "Node", "Event", "KeyboardEvent", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame"]) {
  Object.defineProperty(globalThis, k, { value: k === "window" ? win : win[k], configurable: true, writable: true });
}
Object.defineProperty(globalThis, "navigator", { value: win.navigator, configurable: true });
globalThis.CSS = { escape: (s) => String(s) };
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// See crm-board-dialog.test.mjs: a MessageChannel that does not keep node alive.
globalThis.MessageChannel = class {
  constructor() {
    this.port1 = { onmessage: null, close() {} };
    this.port2 = { postMessage: (data) => setImmediate(() => this.port1.onmessage?.({ data })), close() {} };
  }
};

let mod;
try { mod = await import(bundlePath); } finally { cleanup(); }
const { React, createRoot, act, Shell, ToastProvider, useToast, TeamTable, CockpitStage, replies, teamReplies, themeCalls } = mod;
after(() => win.close());

const doc = win.document;
const h = React.createElement;
const flush = () => act(async () => { await new Promise((r) => win.requestAnimationFrame(() => setTimeout(r, 0))); });
const click = (el) => act(async () => { el.focus(); el.dispatchEvent(new win.MouseEvent("click", { bubbles: true })); });
async function mount(el) {
  doc.body.innerHTML = "<div id='root'></div>";
  const root = createRoot(doc.getElementById("root"));
  await act(async () => root.render(el));
  return root;
}
const links = () => [...doc.querySelectorAll("a")].map((a) => a.getAttribute("href"));

test("the shell hides the old-CRM links for people the gate keeps out", async () => {
  const user = { name: "Sophie Keller", canAssign: false, inboxCount: 0, oldCrm: false };
  const root = await mount(h(Shell, { user }, h("p", null, "page")));
  assert.ok(!links().includes("/admin/crm"), "no Old CRM link");
  assert.ok(!links().includes("/admin/crm/new"), "no link into the old CRM's new-lead form");
  assert.ok(links().includes("/crm/leads/new"), "+ New lead stays, pointing at the new CRM");
  assert.ok(links().includes("/crm/pipeline"));
  await act(async () => root.unmount());
});

test("the shell keeps the old-CRM links for everyone else", async () => {
  const user = { name: "Sophie Keller", canAssign: true, inboxCount: 2, oldCrm: true };
  const root = await mount(h(Shell, { user }, h("p", null, "page")));
  assert.ok(links().includes("/admin/crm"), "Old CRM link");
  assert.ok(links().includes("/crm/leads/new"), "+ New lead link (new CRM)");
  assert.ok(!links().includes("/admin/crm/new"), "no link into the old CRM's new-lead form");
  await act(async () => root.unmount());
});

// Phone dock (Phase 2c final fixes): only the quick actions; Today, Team and
// Commissions stay in the top nav and in ⌘K.
const dockLinks = () => [...doc.querySelectorAll(".crm-dock a")].map((a) => a.getAttribute("href"));
test("the dock holds New lead, Pipeline and (for managers) Inbox only", async () => {
  let root = await mount(h(Shell, { user: { name: "Sophie Keller", canAssign: true, inboxCount: 2, oldCrm: true } }, h("p", null, "page")));
  assert.deepEqual(dockLinks(), ["/crm/leads/new", "/crm/pipeline", "/crm/inbox"]);
  for (const href of ["/crm/today", "/crm/team", "/crm/commissions"]) assert.ok(links().includes(href), `${href} stays in the top nav`);
  await act(async () => root.unmount());
  root = await mount(h(Shell, { user: { name: "Sophie Keller", canAssign: false, inboxCount: 0, oldCrm: false } }, h("p", null, "page")));
  assert.deepEqual(dockLinks(), ["/crm/leads/new", "/crm/pipeline"]);
  await act(async () => root.unmount());
});

test("panels inside one ToastProvider share a single toast", async () => {
  const shows = [];
  const Panel = ({ name }) => { const t = useToast(); shows.push(t.show); return h("section", null, name, t.node); };
  const root = await mount(h(ToastProvider, null, h(Panel, { name: "a" }), h(Panel, { name: "b" })));
  assert.equal(doc.querySelectorAll('[role="status"]').length, 1, "one live region for the page");
  await act(async () => shows[0]("Stage saved"));
  await act(async () => shows[1]("Logged", "error"));
  const toasts = doc.querySelectorAll(".crm-toast");
  assert.equal(toasts.length, 1);
  assert.equal(toasts[0].textContent, "Logged", "the newer message replaces the older one");
  assert.match(toasts[0].className, /error/);
  await act(async () => root.unmount());
});

test("outside a provider a panel keeps a toast of its own", async () => {
  const Panel = () => { const t = useToast(); return h("section", null, t.node); };
  const root = await mount(h("div", null, h(Panel), h(Panel)));
  assert.equal(doc.querySelectorAll('[role="status"]').length, 2);
  await act(async () => root.unmount());
});

const teamRow = { id: "u1", name: "Sophie Keller", email: "s@x.test", seesEverything: false, canSeeColleagues: false, canEditColleagues: false, languages: ["en"], specialties: [], acceptsLeads: true, activeLeads: 3 };
const stored = { canSeeColleagues: true, canEditColleagues: false, languages: ["en"], specialties: [], acceptsLeads: true };

test("a team switch gets focus back after its save, and is shown disabled meanwhile", async () => {
  let resolve;
  teamReplies.length = 0;
  teamReplies.push(new Promise((r) => { resolve = r; }));
  const root = await mount(h(TeamTable, { rows: [teamRow] }));
  const sw = [...doc.querySelectorAll('[role="switch"]')].find((b) => b.textContent.includes("See colleagues"));
  await click(sw);
  assert.ok(doc.querySelector("fieldset").disabled, "row disabled while saving");
  // Browsers move focus to <body> when the focused control becomes disabled
  // ("focus fixup"); jsdom does not, and will not blur a disabled control, so
  // focus and blur a throwaway button instead.
  const fixup = doc.createElement("button");
  doc.body.appendChild(fixup); fixup.focus(); fixup.blur(); fixup.remove();
  assert.equal(doc.activeElement, doc.body);
  await act(async () => { resolve({ ok: true, stored }); });
  await flush();
  assert.equal(doc.querySelector("fieldset").disabled, false);
  assert.equal(doc.activeElement, sw, "focus is back on the switch");
  assert.equal(sw.getAttribute("aria-checked"), "true");
  await act(async () => root.unmount());
});

test("a finished save does not steal focus the user moved elsewhere", async () => {
  let resolve;
  teamReplies.length = 0;
  teamReplies.push(new Promise((r) => { resolve = r; }));
  const outside = doc.createElement("button");
  const root = await mount(h(TeamTable, { rows: [teamRow] }));
  doc.body.appendChild(outside);
  const sw = doc.querySelector('[role="switch"]');
  await click(sw);
  outside.focus();
  await act(async () => { resolve({ ok: true, stored }); });
  await flush();
  assert.equal(doc.activeElement, outside);
  await act(async () => root.unmount());
});

test("the stage button gets focus back after the move dialog is cancelled", async () => {
  replies.length = 0;
  replies.push({ error: "Choose why the lead was lost.", need: "lostReason" });
  const root = await mount(h(CockpitStage, { leadId: "l1", leadName: "Anna Weber", status: "CONTACTED", canEdit: true }));
  const lost = [...doc.querySelectorAll("button")].find((b) => b.textContent === "Lost");
  await click(lost);
  await flush();
  const dialog = doc.querySelector("dialog.crm-dialog");
  assert.ok(dialog?.hasAttribute("open"), "lost-reason dialog open");
  await act(async () => { dialog.dispatchEvent(new win.Event("cancel", { cancelable: true })); });
  await flush();
  assert.equal(doc.querySelector("dialog.crm-dialog"), null);
  assert.equal(lost.disabled, false);
  assert.equal(doc.activeElement, lost, "focus is back on the Lost button");
  await act(async () => root.unmount());
});

test("the name button opens the colour-set menu: picker, owner link, Escape closes", async () => {
  const options = [
    { id: "a", name: "Classic", isDefault: true, swatch: { page: "#fff", card: "#fff", accent: "#000", text: "#000" } },
    { id: "b", name: "Live website", isDefault: false, swatch: { page: "#081512", card: "#102826", accent: "#C29A5E", text: "#EFE9DB" } },
  ];
  const root = await mount(h(Shell, { user: { name: "Sophie Keller", canAssign: true, inboxCount: 0, oldCrm: false, isOwner: true }, themes: { options, choiceId: null } }, h("p", null, "page")));
  assert.equal(doc.querySelector(".crm-me-menu"), null);
  await act(async () => doc.querySelector(".crm-me-btn").click());
  const radios = [...doc.querySelectorAll(".crm-me-menu [role=radio]")];
  assert.deepEqual(radios.map((r) => r.textContent), ["Default (Classic)", "Live website"]);
  assert.equal(radios[0].getAttribute("aria-checked"), "true");
  assert.ok(links().filter((x) => x === "/crm/settings/design").length >= 2, "owner link in menu");
  await act(async () => radios[1].click());
  assert.deepEqual(themeCalls, ["b"]);
  await act(async () => doc.dispatchEvent(new win.KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
  assert.equal(doc.querySelector(".crm-me-menu"), null);
  await act(async () => root.unmount());
});
