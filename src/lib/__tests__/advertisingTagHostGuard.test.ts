import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { tagReachesDomOn, FORBIDDEN_HOSTS, PRODUCTION_HOST } from "./helpers/mountOnHost";

/* Google Ads and LinkedIn, the same hole as the Meta pixel (2026-10-22): the
   vendor ids are compiled into the bundle and nothing asked which site the
   browser was on, so a dev server fed the live Google Ads remarketing audience
   and the live LinkedIn Insight Tag. LinkedIn had more than page views to lose
   — LinkedInConversionTracker fires a conversion on every project page
   (27871513) and every blog page (27871521), and the forms fire 27871505 on
   submit; all of that was reported from laptops too.

   ORDER MATTERS — negatives first, positive last, per component. The reason is
   next/script's id-keyed LoadCache, written up in ./helpers/mountOnHost.ts.
   The two components use different script ids, so their caches are
   independent; within each, do not reorder. */

const GOOGLE_ADS_ID = "AW-16992138077";
const LINKEDIN_PARTNER_ID = "10107329";

const loadGoogleAds = () => import("@/app/components/GoogleAdsScript/GoogleAdsScript");
const loadLinkedIn = () => import("@/app/components/LinkedInPixel/LinkedInPixel");

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

test("the guard decides whether the Google Ads tag reaches the page", async () => {
  for (const url of FORBIDDEN_HOSTS) {
    assert.equal(
      await tagReachesDomOn(url, loadGoogleAds, GOOGLE_ADS_ID),
      false,
      `${url} fed the live Google Ads account`,
    );
  }
  assert.equal(
    await tagReachesDomOn(PRODUCTION_HOST, loadGoogleAds, GOOGLE_ADS_ID),
    true,
    "production stopped reporting to Google Ads",
  );
});

test("the guard decides whether the LinkedIn Insight Tag reaches the page", async () => {
  for (const url of FORBIDDEN_HOSTS) {
    assert.equal(
      await tagReachesDomOn(url, loadLinkedIn, LINKEDIN_PARTNER_ID),
      false,
      `${url} fed the live LinkedIn pixel`,
    );
  }
  assert.equal(
    await tagReachesDomOn(PRODUCTION_HOST, loadLinkedIn, LINKEDIN_PARTNER_ID),
    true,
    "production stopped reporting to LinkedIn",
  );
});

test("both components ask the shared guard, and only after mount", () => {
  for (const p of [
    "src/app/components/GoogleAdsScript/GoogleAdsScript.tsx",
    "src/app/components/LinkedInPixel/LinkedInPixel.tsx",
  ]) {
    const src = read(p);
    assert.ok(/from "@\/lib\/useTrackingAllowed"/.test(src), `${p}: the shared host guard is no longer imported`);
    assert.ok(/if \(!allowed\) return null;/.test(src), `${p}: no longer refuses on a non-production host`);
    // Matched precisely: LinkedInPixel's doc comment legitimately mentions
    // `typeof window.lintrk`, which a bare /typeof window/ test flagged.
    assert.equal(
      /typeof\s+window\s*===?\s*"undefined"/.test(src),
      false,
      `${p}: the host is being probed during render again`,
    );
  }
});

test("suppressing the tags cannot break a caller", () => {
  // The guard only works if every consumer tolerates the vendor global being
  // absent. lintrk has many callers; gtag has none outside its own component.
  const callers = [
    "src/app/components/LinkedInConversionTracker/LinkedInConversionTracker.tsx",
    "src/app/components/FormStandard/FormStandard.tsx",
    "src/app/components/FormFull/FormFull.tsx",
    "src/app/components/FormStatic/FormStatic.tsx",
    "src/app/components/FormMinimalBlockComponent/FormMinimalBlockComponent.tsx",
    "src/app/components/WhatAppButtonProject/WhatAppButtonProject.tsx",
  ];
  for (const p of callers) {
    const src = read(p);
    assert.ok(
      /typeof \(window as any\)\.lintrk === "function"/.test(src),
      `${p} calls lintrk without checking it exists — it will throw once the tag is suppressed`,
    );
  }
});
