// Design settings live preview: the postMessage shape the preview frames accept, and the
// owner-guarded email preview core (controller ruling R8: pure core, injected deps).
import { test } from "node:test";
import assert from "node:assert/strict";
import { isPreviewMessage, isPreviewReady } from "../../app/crm-preview/previewMessage";
import { makeDesignActions, OWNER_ONLY, type DesignStore } from "../../app/crm/settings/design/actionsCore";
import { CLASSIC, DEFAULT_GLOBAL, WEBSITE, cssVars } from "../design/theme";

test("a real draft message is accepted", () => {
  assert.equal(isPreviewMessage({ type: "ds-preview", vars: cssVars(CLASSIC, DEFAULT_GLOBAL), dark: false }), true);
  assert.equal(isPreviewMessage({ type: "ds-preview", vars: cssVars(WEBSITE, DEFAULT_GLOBAL), dark: true }), true);
});

test("other shapes are ignored", () => {
  for (const bad of [
    null, undefined, "ds-preview", 42, [],
    { vars: "--ds-page:#FFFFFF", dark: false },
    { type: "other", vars: "--ds-page:#FFFFFF", dark: false },
    { type: "ds-preview", vars: 5, dark: false },
    { type: "ds-preview", dark: false },
    { type: "ds-preview", vars: "--ds-page:#FFFFFF" },
    { type: "ds-preview", vars: "--ds-page:#FFFFFF", dark: "yes" },
  ]) assert.equal(isPreviewMessage(bad), false, JSON.stringify(bad));
});

test("vars that could close the rule or the <style> element are rejected", () => {
  for (const vars of ["--ds-page:#FFF}body{display:none", "--ds-page:#FFF</style><script>x()</script>", "a{b", "x>y"]) {
    assert.equal(isPreviewMessage({ type: "ds-preview", vars, dark: false }), false, vars);
  }
});

const store = new Proxy({}, { get: () => async () => { throw new Error("store must not be called"); } }) as DesignStore;
const OWNER = { id: "u1", name: "Owner", email: "o@x", isOwner: true };
const STAFF = { id: "u2", name: "Staff", email: "s@x", isOwner: false };
function actions(user: typeof OWNER | null) {
  return makeDesignActions({ getUser: async () => user, store, revalidate: () => assert.fail("no revalidate"), baseUrl: () => "https://partner.test" });
}

test("previewEmail is owner only", async () => {
  for (const u of [STAFF, null]) assert.deepEqual(await actions(u).previewEmail(CLASSIC, DEFAULT_GLOBAL), { ok: false, error: OWNER_ONLY });
});

test("previewEmail renders the approved mail in the draft colours with the partner login link", async () => {
  const r = await actions(OWNER).previewEmail(WEBSITE, { ...DEFAULT_GLOBAL, emailBase: 18 });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.match(r.html, /https:\/\/partner\.test\/login/);
  assert.match(r.html, /Anna/);
  assert.match(r.html, new RegExp(WEBSITE.page, "i"));
  assert.match(r.html, /18px/);
});

test("previewEmail normalises junk input to Classic and the default settings", async () => {
  const junk = await actions(OWNER).previewEmail({ page: "red;}</style>", card: 7 } as unknown, { emailBase: 999, headingFont: "<x>" } as unknown);
  const classic = await actions(OWNER).previewEmail(CLASSIC, DEFAULT_GLOBAL);
  assert.equal(junk.ok, true);
  assert.deepEqual(junk, classic);
  if (junk.ok) assert.doesNotMatch(junk.html, /<\/style>"|red;/);
});

test("only the exact ready ping counts as a frame announcing itself", () => {
  assert.equal(isPreviewReady({ type: "ds-preview-ready" }), true);
  for (const bad of [null, "ds-preview-ready", { type: "ds-preview" }, { type: "ds-preview-ready ", x: 1 }, {}]) assert.equal(isPreviewReady(bad), false);
});
