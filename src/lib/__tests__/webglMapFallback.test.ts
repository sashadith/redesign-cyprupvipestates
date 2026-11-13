import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { probeWebGL } from "../webgl";

/* Without WebGL the MapLibre constructor throws. It used to do so inside
   MapContainer's layout effect, which unmounted the whole page — /pl/projects
   and /de/projects rendered "Application error: a client-side exception has
   occurred" with no listing, footer or cookie banner (2026-11-02, headless
   Chrome without GL; real visitors with hardware acceleration off, VMs,
   remote desktops, locked-down or privacy browsers hit the same).

   The probe is the up-front check; the source assertions below pin the two
   guards inside MapContainer that must survive a refactor, because the probe
   alone is not enough (it can succeed where MapLibre's own context fails). */

const fakeDoc = (getContext: (kind: string) => unknown) => ({
  createElement: () => ({ getContext }),
});

test("probe: no document → false", () => {
  assert.equal(probeWebGL(null), false);
  assert.equal(probeWebGL(undefined), false);
});

test("probe: both contexts null → false (the crash case)", () => {
  assert.equal(probeWebGL(fakeDoc(() => null)), false);
});

test("probe: getContext throws → false, never rethrows", () => {
  assert.equal(probeWebGL(fakeDoc(() => { throw new Error("blocked by policy"); })), false);
});

test("probe: webgl1 only → true", () => {
  const asked: string[] = [];
  const ok = probeWebGL(fakeDoc((k) => { asked.push(k); return k === "webgl" ? {} : null; }));
  assert.equal(ok, true);
  assert.deepEqual(asked, ["webgl2", "webgl"]);
});

test("probe: releases its own context so it cannot evict a real map's", () => {
  let lost = 0;
  const gl = { getExtension: (n: string) => (n === "WEBGL_lose_context" ? { loseContext: () => { lost++; } } : null) };
  assert.equal(probeWebGL(fakeDoc((k) => (k === "webgl2" ? gl : null))), true);
  assert.equal(lost, 1);
});

test("probe: a context without the lose extension still counts", () => {
  const gl = { getExtension: () => null };
  assert.equal(probeWebGL(fakeDoc(() => gl)), true);
});

const src = (rel: string) => readFileSync(join(__dirname, "..", "..", rel), "utf8");

test("MapContainer: constructor is guarded, an error boundary wraps the map", () => {
  const s = src("app/components/map/MapLibre.tsx");
  assert.match(s, /if \(!canUseWebGL\(\)\)\s*\{\s*setFailed\(true\)/, "probe before new maplibregl.Map");
  assert.match(s, /try\s*\{\s*m = new maplibregl\.Map\(/, "constructor inside try");
  assert.match(s, /getDerivedStateFromError/, "error boundary present");
  assert.match(s, /<MapErrorBoundary fallback=\{box\}>\s*<MapContainerInner/, "exported MapContainer wraps the inner map");
});

test("callers drop map entry points when WebGL is missing", () => {
  const explorer = src("app/preview-projects/ProjectsExplorer.tsx");
  assert.match(explorer, /gridSlots\(cards, isMobile \|\| !mapOk\)/, "grid tile dropped");
  assert.match(explorer, /\{mapOk && <button type="button" className="px__mapbtn"/, "filter-bar map button hidden");
  assert.match(explorer, /\{mapOk && <button type="button" className="px__mapfab"/, "floating map button hidden");
  assert.match(src("app/preview-project/PropertyMapBlock.tsx"), /if \(!mapOk\) return null/);
  assert.match(src("app/c/[token]/PresentationBody.tsx"), /\{mapOk && markers\.length > 0 &&/);
});
