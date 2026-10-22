import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { tagReachesDomOn, mountComponentOn, FORBIDDEN_HOSTS, PRODUCTION_HOST } from "./helpers/mountOnHost";

/* The last two tags behind the host guard (2026-10-22), after the Meta pixel
   (#139) and Google Ads + LinkedIn (#141):

   GTM is the one that mattered most, because GA4 (G-WLD3B6GN9P) runs
   EXCLUSIVELY through the container — the direct gtag wrapper was removed to
   stop duplicate page_views. So every developer's dev server was writing into
   GA4 as well, for as long as it was writing into the Meta dataset.

   Clarity's cost is different in kind: not a polluted conversion count but
   polluted session RECORDINGS and heatmaps.

   ORDER MATTERS for the GTM case — negatives first, positive last, because of
   next/script's id-keyed LoadCache (written up in ./helpers/mountOnHost.ts).
   Clarity is immune to that: it renders null and creates window.clarity in an
   effect, in a fresh jsdom window each time, so its cases are order-free. */

const GTM_ID = "GTM-MQNF6L9V";
const loadGtm = () => import("@/app/components/GoogleTagManagerScript/GoogleTagManagerScript");
const loadClarity = () => import("@/app/components/MicrosoftClarity/MicrosoftClarity");

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

test("the guard decides whether the GTM container reaches the page", async () => {
  for (const url of FORBIDDEN_HOSTS) {
    assert.equal(await tagReachesDomOn(url, loadGtm, GTM_ID), false, `${url} fed the live GTM container (and GA4)`);
  }
  assert.equal(await tagReachesDomOn(PRODUCTION_HOST, loadGtm, GTM_ID), true, "production stopped reporting to GTM");
});

test("the guard decides whether Clarity starts recording", async () => {
  // Clarity renders nothing; the observable is the queue shim it installs on
  // window, which is what every later window.clarity(...) call relies on.
  for (const url of FORBIDDEN_HOSTS) {
    const win = await mountComponentOn(url, loadClarity, { hasConsent: true });
    assert.equal(typeof win.clarity, "undefined", `${url} started a session recording in the live project`);
  }
  const prod = await mountComponentOn(PRODUCTION_HOST, loadClarity, { hasConsent: true });
  assert.equal(typeof prod.clarity, "function", "production stopped recording sessions");
});

test("Clarity also stays silent on a dev host in its no-consent mode", async () => {
  // The dynamic layout renders Clarity in BOTH consent branches, so the
  // no-consent path needs the same guard — it is the one that runs for a
  // visitor who has not answered the banner, which on a dev machine is always.
  const win = await mountComponentOn("http://localhost:3000/", loadClarity, { hasConsent: false });
  assert.equal(typeof win.clarity, "undefined");
});

test("Clarity guards inside its effects, never with an early return", () => {
  const src = read("src/app/components/MicrosoftClarity/MicrosoftClarity.tsx");
  // This component calls three hooks. An early `return null` after the first
  // would skip both effects on the initial render and then call them once the
  // host resolves — "rendered more hooks than during the previous render".
  assert.equal(
    /if \(!allowed\) return null;/.test(src),
    false,
    "an early return here changes the hook count between renders and will crash React",
  );
  assert.equal((src.match(/if \(!allowed\) return;/g) ?? []).length, 2, "both effects must carry the guard");
  assert.ok(/\}, \[allowed\]\);/.test(src), "the init effect no longer re-runs when the host resolves");
  assert.ok(/\}, \[hasConsent, allowed\]\);/.test(src), "the consent effect no longer re-runs when the host resolves");
});

test("GTM is rendered through the guarded wrapper everywhere", () => {
  // Two render sites, one a SERVER component where a hook cannot go — which is
  // why the wrapper exists at all. A bare <GoogleTagManager> anywhere is an
  // unguarded container.
  for (const p of ["src/app/[lang]/layout.tsx", "src/app/components/ConsentScripts/ConsentScripts.tsx"]) {
    const src = read(p);
    assert.ok(/<GoogleTagManagerScript \/>/.test(src), `${p} no longer renders the guarded wrapper`);
    assert.equal(/<GoogleTagManager\b/.test(src), false, `${p} renders the unguarded container directly`);
    assert.equal(/gtmId=/.test(src), false, `${p} passes a container id outside the wrapper`);
  }
});
