#!/usr/bin/env node
/* Guard: the admin's Claude buttons never spin forever.

   Reported 2026-09-26: "seitdem wir hebrew haben, wird die projektbeschreibung
   durch claude API nicht mehr erstellt, das icon dreht sich 'writing...' und es
   passiert nichts." The five-language description ran past nginx's 60 s /admin
   proxy timeout (504 in cvp-error.log). A server action that gets no answer
   REJECTS rather than returning { ok: false }, and the handlers awaited it with
   no catch/finally — so `setBusy(null)` never ran and "Writing…" stayed up with
   no message. (nginx /admin now allows 300 s; this pins the client side.)

   Mounts the real components in jsdom with the server actions stubbed to
   reject, clicks, and asserts the button comes back and an error is shown —
   plus the success path, so the fix did not break the normal flow.

     node scripts/qa/admin-claude-busy-check.mjs

   Recipe and traps: see scripts/qa/projects-filter-commit-check.mjs. */
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
const tmp = realpathSync(mkdtempSync(join(tmpdir(), "qa-busy-")));
process.on("exit", () => rmSync(tmp, { recursive: true, force: true }));
const w = (name, src) => { const p = join(tmp, name); writeFileSync(p, src); return p; };

/* Every server action the three components import, driven by state.mode:
   "reject" = what the browser sees when the proxy cuts the request off. */
const actionsStub = w("actions.js", `
export const state = { mode: "reject", calls: 0 };
const run = async (okValue) => {
  state.calls++;
  await new Promise((r) => setTimeout(r, 5));
  if (state.mode === "reject") throw new Error("An unexpected response was received from the server.");
  return okValue;
};
const five = { en: "EN text", de: "DE Text", pl: "PL tekst", ru: "RU текст", he: "HE טקסט" };
export const generateDescription = () => run({ ok: true, texts: five });
export const checkDescriptionUniqueness = () => run({ uniqueness: 90, sim: 0.1, mostSimilar: "x" });
export const generateSeoMetaAction = () => run({ ok: true, result: { titleEN: "Generated title" } });
export const saveSeoPromptAction = () => run(undefined);
export const generateArea = () => run({ ok: true, texts: five });
export const saveArea = () => run(undefined);
`);
const navStub = w("nav.js", `export const useRouter = () => ({ refresh() {}, push() {}, replace() {}, prefetch() {} });`);

const entryPath = join(ROOT, `.qa-busy-entry-${process.pid}.jsx`);
const bundlePath = join(ROOT, `.qa-busy-bundle-${process.pid}.mjs`);
process.on("exit", () => { rmSync(entryPath, { force: true }); rmSync(bundlePath, { force: true }); });
const dev = (p) => JSON.stringify(join(ROOT, "src/app/admin/(panel)/developments", p));
writeFileSync(entryPath, `
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import DescriptionField from ${dev("[id]/DescriptionField.tsx")};
import SeoMetaFields from ${dev("[id]/SeoMetaFields.tsx")};
import AreaEditor from ${dev("areas/AreaEditor.tsx")};
import { state } from ${JSON.stringify(actionsStub)};
export { React, createRoot, act, DescriptionField, SeoMetaFields, AreaEditor, state };
`);

const out = await build({
  entryPoints: [entryPath], bundle: true, platform: "browser", format: "esm", write: false,
  jsx: "automatic", loader: { ".js": "jsx" },
  define: { "process.env.NODE_ENV": '"development"' },
  plugins: [{
    name: "stubs",
    setup(b) {
      b.onResolve({ filter: /^\.\/actions$/ }, () => ({ path: actionsStub }));
      b.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: navStub }));
    },
  }],
});
writeFileSync(bundlePath, out.outputFiles[0].text);

const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "https://example.test/admin", pretendToBeVisual: true });
const win = dom.window;
win.matchMedia = () => ({ matches: false, media: "", addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent() { return false; } });
for (const k of ["window", "document", "HTMLElement", "HTMLInputElement", "Event", "KeyboardEvent", "FocusEvent", "MouseEvent", "Node", "getComputedStyle", "matchMedia", "requestAnimationFrame", "cancelAnimationFrame"]) {
  Object.defineProperty(globalThis, k, { value: k === "window" ? win : win[k], configurable: true, writable: true });
}
Object.defineProperty(globalThis, "navigator", { value: win.navigator, configurable: true });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const { React, createRoot, act, DescriptionField, SeoMetaFields, AreaEditor, state } = await import(bundlePath);

let failures = 0;
/* The bug itself surfaces as an unhandled rejection: the handler awaited the
   action with no catch, so the rejection escapes the click. Count it as a
   failure instead of letting it crash the run before anything is reported. */
process.on("unhandledRejection", (e) => {
  failures++;
  console.log(`  FAIL a click let a rejected server action escape unhandled: ${e?.message ?? e}`);
});
function check(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { console.log(`  ok   ${name}`); return; }
  failures++;
  console.log(`  FAIL ${name}\n       expected ${e}\n       actual   ${a}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let root = null;
async function mount(el) {
  const host = win.document.getElementById("root");
  if (root) await act(async () => root.unmount());
  await act(async () => { root = createRoot(host); root.render(el); });
  return host;
}
const button = (host, re) => Array.from(host.querySelectorAll("button")).find((b) => re.test(b.textContent));
async function click(btn) {
  await act(async () => { btn.dispatchEvent(new win.MouseEvent("click", { bubbles: true })); await sleep(30); });
}

const five = { en: "", de: "", pl: "", ru: "", he: "" };
const cases = [
  {
    name: "DescriptionField: Rewrite with Claude",
    el: () => React.createElement(DescriptionField, { developmentId: "d1", initial: five, aiReady: true }),
    idle: /Rewrite with Claude/, busy: /Writing/,
    success: (host) => host.querySelector("textarea").value === "EN text",
  },
  {
    name: "DescriptionField: uniqueness check",
    el: () => React.createElement(DescriptionField, { developmentId: "d1", initial: { ...five, en: "Some text" }, aiReady: true }),
    idle: /Check uniqueness|uniqueness/i, busy: /Checking/i,
    success: (host) => /90/.test(host.textContent),
  },
  {
    name: "SeoMetaFields: Generate with Claude",
    el: () => React.createElement(SeoMetaFields, {
      developmentId: "d1", titleMax: 60, descMax: 160, aiReady: true, initialPrompt: "",
      initial: { titleEN: "", titleDE: "", titlePL: "", titleRU: "", titleHE: "", descEN: "", descDE: "", descPL: "", descRU: "", descHE: "" },
    }),
    idle: /Generate with Claude/, busy: /Writing/,
    success: (host) => Array.from(host.querySelectorAll("input")).some((i) => i.value === "Generated title"),
  },
  {
    name: "AreaEditor: Generate all languages",
    el: () => React.createElement(AreaEditor, { slug: "a", name: "A", district: "Paphos", initial: five, initialStatus: "draft", aiReady: true }),
    idle: /Generate all/, busy: /Generating/,
    success: (host) => host.querySelector("textarea").value === "EN text",
  },
  {
    name: "AreaEditor: Save draft",
    el: () => React.createElement(AreaEditor, { slug: "a", name: "A", district: "Paphos", initial: { ...five, en: "x" }, initialStatus: "draft", aiReady: true }),
    idle: /Save draft/, busy: /Saving/,
    success: () => true,
  },
];

for (const c of cases) {
  for (const mode of ["reject", "ok"]) {
    state.mode = mode; state.calls = 0;
    const host = await mount(c.el());
    const btn = button(host, c.idle);
    if (!btn) { failures++; console.log(`  FAIL ${c.name}: button not found`); break; }
    await click(btn);
    await act(async () => { await sleep(30); });
    check(`${c.name} [${mode}]: the action was called`, state.calls, 1);
    const after = button(host, c.idle);
    check(`${c.name} [${mode}]: the button is back, not stuck busy`, [!!after, !!button(host, c.busy)], [true, false]);
    check(`${c.name} [${mode}]: the button is enabled again`, after ? !after.disabled : false, true);
    if (mode === "reject") check(`${c.name} [reject]: an error is shown`, /failed or timed out/i.test(host.textContent), true);
    else check(`${c.name} [ok]: the normal result still lands`, c.success(host), true);
  }
}

console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
