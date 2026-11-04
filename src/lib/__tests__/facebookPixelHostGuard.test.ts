import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { tagReachesDomOn, FORBIDDEN_HOSTS, PRODUCTION_HOST } from "./helpers/mountOnHost";
import { isAutomatedVisitor, metaPixelEnabled } from "@/lib/metaPixelGate";

/* The Meta half of the host guard. See src/lib/trackingHost.ts for the
   incident: the pixel id is compiled into the bundle, so a dev server reported
   straight into the live dataset — 310 events from `localhost` in one hour on
   26 September, 30 of them InitiateCheckout against 69 in the whole 28-day
   window. trackingHost.test.ts covers the host decision as a function; this
   file mounts the real component and asks whether the tag reaches the DOM.
   advertisingTagHostGuard.test.ts does the same for Google Ads and LinkedIn.

   Since 2026-11-01 the pixel also needs NEXT_PUBLIC_META_PIXEL_ENABLED=1 and a
   visitor that is not an automated browser (metaPixelGate.ts) — those
   refusals are mounted here too, on the PRODUCTION host, so each one is the
   only thing standing between the tag and the page.

   ORDER MATTERS — negatives first, positive last. The reason is next/script's
   id-keyed LoadCache, written up in ./helpers/mountOnHost.ts. Do not reorder,
   and do not add a mount above this test. */

const PIXEL_ID = "1238429281352397";
const load = () => import("@/app/components/FacebookPixel/FacebookPixel");
const setNav = (key: string, value: unknown) => (win: any) =>
  Object.defineProperty(win.navigator, key, { value, configurable: true });

test("the guards decide whether the Meta pixel reaches the page", async () => {
  process.env.NEXT_PUBLIC_META_PIXEL_ENABLED = "1";
  for (const url of FORBIDDEN_HOSTS) {
    assert.equal(await tagReachesDomOn(url, load, PIXEL_ID), false, `${url} wrote into the production dataset`);
  }
  assert.equal(
    await tagReachesDomOn(PRODUCTION_HOST, load, PIXEL_ID, setNav("webdriver", true)),
    false,
    "an automated browser (navigator.webdriver) loaded the pixel",
  );
  assert.equal(
    await tagReachesDomOn(PRODUCTION_HOST, load, PIXEL_ID, setNav("userAgent", "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)")),
    false,
    "a crawler user agent loaded the pixel",
  );
  assert.equal(
    await tagReachesDomOn(PRODUCTION_HOST, load, PIXEL_ID, setNav("userAgent", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/131.0.0.0 Safari/537.36")),
    false,
    "headless Chrome loaded the pixel",
  );
  delete process.env.NEXT_PUBLIC_META_PIXEL_ENABLED;
  assert.equal(await tagReachesDomOn(PRODUCTION_HOST, load, PIXEL_ID), false, "the pixel loaded with the switch off");
  process.env.NEXT_PUBLIC_META_PIXEL_ENABLED = "1";
  assert.equal(await tagReachesDomOn(PRODUCTION_HOST, load, PIXEL_ID), true, "production stopped reporting");
});

test("the switch is exactly \"1\"", () => {
  assert.equal(metaPixelEnabled("1"), true);
  for (const v of ["", "0", "true", "yes", " 1"]) assert.equal(metaPixelEnabled(v), false, JSON.stringify(v));
  delete process.env.NEXT_PUBLIC_META_PIXEL_ENABLED;
  assert.equal(metaPixelEnabled(), false, "unset");
});

test("the bot check reads webdriver and the user agent", () => {
  const chrome = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
  assert.equal(isAutomatedVisitor({ userAgent: chrome }), false, "an ordinary Chrome");
  assert.equal(isAutomatedVisitor({ userAgent: chrome, webdriver: false }), false);
  assert.equal(isAutomatedVisitor({ userAgent: chrome, webdriver: true }), true, "Playwright/Puppeteer keep a real UA");
  assert.equal(isAutomatedVisitor({ userAgent: "facebookexternalhit/1.1" }), true);
  assert.equal(isAutomatedVisitor(undefined), true, "no navigator at all is not a visitor");
});

test("the component asks the shared guard, and only after mount", () => {
  const src = readFileSync(join(process.cwd(), "src/app/components/FacebookPixel/FacebookPixel.tsx"), "utf8");
  assert.ok(/from "@\/lib\/useMetaPixelAllowed"/.test(src), "the pixel guard is no longer imported");
  assert.ok(/if \(!allowed\) return null;/.test(src), "the component no longer refuses when the guard says no");
  const hook = readFileSync(join(process.cwd(), "src/lib/useMetaPixelAllowed.ts"), "utf8");
  assert.ok(/isTrackingHost\(window\.location\.hostname\)/.test(hook), "the host guard dropped out of the pixel guard");
  // A `typeof window === "undefined"` shortcut during render would make server
  // and client disagree on the first pass instead of both rendering nothing.
  // Matched precisely: a doc comment may legitimately mention `typeof window`.
  assert.equal(/typeof\s+window\s*===?\s*"undefined"/.test(src), false, "the host is being probed during render again");
});
