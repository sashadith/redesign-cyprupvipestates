#!/usr/bin/env node
/* Runs the Verification list from
   docs/superpowers/specs/2026-08-30-leptos-feed-adapter-design.md against the
   LIVE Leptos feed. Separate from leptos-grouping-check.mjs on purpose: that
   one is synthetic and must never fail because a vendor edited a listing.

     node scripts/qa/leptos-live-check.mjs

   Exits non-zero on any failed assertion. */
import { writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseStringPromise } from "xml2js";

let build;
try { ({ build } = await import("esbuild")); }
catch { console.error("esbuild is not installed (it is only a transitive dependency).\n  npm i -D esbuild"); process.exit(2); }

const bundlePath = join(tmpdir(), `leptos-live-check-${process.pid}.mjs`);
const out = await build({
  entryPoints: ["src/app/preview-project/feeds.ts"],
  bundle: true, platform: "node", format: "esm", write: false,
  // feeds.ts pulls in xml2js, a real CJS dependency requiring Node built-ins;
  // esbuild's ESM output has no ambient require to satisfy them.
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
});
writeFileSync(bundlePath, out.outputFiles[0].text);
process.on("exit", () => rmSync(bundlePath, { force: true }));
const F = await import(bundlePath);

let failures = 0;
const check = (name, ok, detail = "") => {
  if (ok) { console.log(`  ok   ${name}`); return; }
  failures++; console.log(`  FAIL ${name}${detail ? `\n       ${detail}` : ""}`);
};

const groups = await F.leptosGroups();
const units = groups.reduce((n, g) => n + g.rows.length, 0);
console.log(`\n${groups.length} projects, ${units} units\n`);

check("45 projects", groups.length === 45, `got ${groups.length}`);
check("377 units", units === 377, `got ${units}`);
check("Cavalli Tower is separate", groups.some((g) => g.key === "LBM-CT" && g.name === "Cavalli Tower"));
check("Poseidon Tower is separate", groups.some((g) => g.key === "LBM" && g.name === "Poseidon Tower"));
check("Kamares Village is one project",
  groups.filter((g) => /^Kamares/i.test(g.name)).length === 1,
  groups.filter((g) => /^Kamares/i.test(g.name)).map((g) => g.name).join(", "));
check("no Greek property survived",
  groups.every((g) => g.rows.every((r) => r.country === "Cyprus")));
check("no land parcel survived",
  groups.every((g) => g.rows.every((r) => r.type !== "Plots & Land Parcels")));
check("every project has a non-empty name", groups.every((g) => g.name && g.name.length >= 3),
  groups.filter((g) => !g.name || g.name.length < 3).map((g) => g.key).join(", "));

// Geography: the independent signal that the code key is right. A group whose
// members are kilometres apart is two projects sharing one code, whatever the
// ref says.
const R = 6371000, rad = (d) => (d * Math.PI) / 180;
const dist = (a, b) => {
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};
let worst = 0, worstKey = "";
for (const g of groups) {
  const pts = g.rows.filter((r) => r.lat != null && r.lng != null);
  for (let i = 0; i < pts.length; i++)
    for (let j = i + 1; j < pts.length; j++) {
      const m = dist(pts[i], pts[j]);
      if (m > worst) { worst = m; worstKey = g.key; }
    }
}
check(`units within 200 m of each other (worst ${Math.round(worst)} m in ${worstKey || "n/a"})`, worst <= 200);

// Prices: a zero-priced unit must never become the headline, because
// resolveDevelopmentPrice() treats priceFrom/priceTo as authoritative.
const zeroPriced = groups
  .map((g) => ({ key: g.key, priceFrom: F.leptosVm(g).priceFrom }))
  .filter((p) => p.priceFrom != null && p.priceFrom <= 0);
check("no project advertises a zero price", zeroPriced.length === 0,
  zeroPriced.map((p) => `${p.key}=${p.priceFrom}`).join(", "));

// Images: leptosFullSize rewrites WordPress's "-scaled" downsize back to the
// original with NO runtime fallback, so every original it asks for has to
// exist. This is the check that earns that decision.
//
// The sample is taken from the RAW feed, not from LeptosRow.images: leptosRow
// has already applied the rewrite by then, and a rewritten URL is
// indistinguishable from one that was never "-scaled" at all. So the feed is
// re-parsed here — same URL, same parser options — and the rewrite is applied
// to exactly the URLs the adapter would have rewritten: raw image and
// floor-plan URLs carrying "-scaled", on IN-SCOPE properties only.
const raw = await parseStringPromise(
  await fetch(F.LEPTOS_URL, { cache: "no-store" }).then((r) => r.text()),
  { explicitArray: false, trim: true, explicitRoot: true },
);
const props = [].concat(raw?.root?.property ?? []);
console.log(`\n${props.length} <property> nodes in the raw feed (440 on 2026-08-30)`);

const one = (v) => (v == null ? "" : typeof v === "object" ? String(v._ ?? v["#text"] ?? v.cdata ?? "") : String(v));
const upgraded = new Set();
for (const p of props) {
  if (!F.leptosInScope({ country: one(p?.country), type: one(p?.type) })) continue;
  for (const im of [].concat(p?.images?.image ?? [], p?.floor_plans?.image ?? [])) {
    const u = one(im?.url);
    if (u.includes("-scaled")) {
      // Only count it if the rewrite actually changed the URL — "-scaled" in a
      // directory name is left alone on purpose and proves nothing here. The
      // http->https part of leptosFullSize is not the upgrade under test, so it
      // is applied to both sides of the comparison.
      const full = F.leptosFullSize(u);
      if (full !== u.replace(/^http:\/\//i, "https://")) upgraded.add(full);
    }
  }
}
const all = Array.from(upgraded);
// Stride-sample rather than slice: the first 60 URLs all belong to the first
// project or two, and one project's uploads directory being intact says
// nothing about the other 44.
const TARGET = 60;
const stride = Math.max(1, Math.floor(all.length / TARGET));
const sample = all.filter((_, i) => i % stride === 0).slice(0, TARGET);

let missing = 0;
for (const u of sample) {
  const res = await fetch(u, { method: "HEAD" }).catch(() => null);
  if (!res || !res.ok) { missing++; console.log(`       missing: ${u}`); }
}
console.log(`\n${all.length} in-scope image/plan URLs were upgraded past "-scaled"; ${sample.length} sampled, ${missing} missing`);
check(`${sample.length} sampled full-size originals all resolve`, missing === 0, `${missing} missing`);

console.log(`\n${failures ? `${failures} failed` : "all live checks passed"}`);
process.exit(failures ? 1 : 0);
