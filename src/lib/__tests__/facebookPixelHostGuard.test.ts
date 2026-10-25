import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { tagReachesDomOn, FORBIDDEN_HOSTS, PRODUCTION_HOST } from "./helpers/mountOnHost";

/* The Meta half of the host guard. See src/lib/trackingHost.ts for the
   incident: the pixel id is compiled into the bundle, so a dev server reported
   straight into the live dataset — 310 events from `localhost` in one hour on
   26 September, 30 of them InitiateCheckout against 69 in the whole 28-day
   window. trackingHost.test.ts covers the host decision as a function; this
   file mounts the real component and asks whether the tag reaches the DOM.
   advertisingTagHostGuard.test.ts does the same for Google Ads and LinkedIn.

   ORDER MATTERS — negatives first, positive last. The reason is next/script's
   id-keyed LoadCache, written up in ./helpers/mountOnHost.ts. Do not reorder,
   and do not add a mount above this test. */

const PIXEL_ID = "1238429281352397";
const load = () => import("@/app/components/FacebookPixel/FacebookPixel");

test("the guard decides whether the Meta pixel reaches the page", async () => {
  for (const url of FORBIDDEN_HOSTS) {
    assert.equal(await tagReachesDomOn(url, load, PIXEL_ID), false, `${url} wrote into the production dataset`);
  }
  assert.equal(await tagReachesDomOn(PRODUCTION_HOST, load, PIXEL_ID), true, "production stopped reporting");
});

test("the component asks the shared guard, and only after mount", () => {
  const src = readFileSync(join(process.cwd(), "src/app/components/FacebookPixel/FacebookPixel.tsx"), "utf8");
  assert.ok(/from "@\/lib\/useTrackingAllowed"/.test(src), "the shared host guard is no longer imported");
  assert.ok(/if \(!allowed\) return null;/.test(src), "the component no longer refuses on a non-production host");
  // A `typeof window === "undefined"` shortcut during render would make server
  // and client disagree on the first pass instead of both rendering nothing.
  // Matched precisely: a doc comment may legitimately mention `typeof window`.
  assert.equal(/typeof\s+window\s*===?\s*"undefined"/.test(src), false, "the host is being probed during render again");
});
