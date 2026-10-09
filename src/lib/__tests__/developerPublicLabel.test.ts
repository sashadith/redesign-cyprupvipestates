/* `DeveloperAccount.name` is an admin label whose trailing parenthetical names
   the integration method on purpose. Six folder-based adapters plus the admin's
   manual-create action copied it straight into `Development.developer`, which
   is public: on 2026-10-09 production had 34 PUBLISHED project pages printing
   "Developer: Korantina Homes (SharePoint)" and emitting the same string as the
   JSON-LD offers.seller.name.

   Every account name below is a real row from the production DB that day.

   Pure function only — no DB, no React. (publicDeveloperLabel() prefers the
   linked public developer page's title and needs Prisma, so it is not covered
   here; stripIntegrationMarker is its fallback and the part that can silently
   mangle a name.) */
import { test } from "node:test";
import assert from "node:assert/strict";
import { stripIntegrationMarker } from "@/lib/developerPublicLabel";

test("the five integration markers actually in use are stripped", () => {
  // The four accounts that had leaked into public rows.
  assert.equal(stripIntegrationMarker("Korantina Homes (SharePoint)"), "Korantina Homes");
  assert.equal(stripIntegrationMarker("Kuutio (drive)"), "Kuutio");
  assert.equal(stripIntegrationMarker("Olias Homes (drive)"), "Olias Homes");
  assert.equal(stripIntegrationMarker("G&V (drive)"), "G&V");
  // The other markers in the account table, which had not leaked yet but are
  // written by the same code paths.
  assert.equal(stripIntegrationMarker("BBF (API)"), "BBF");
  assert.equal(stripIntegrationMarker("Island Blue (XML)"), "Island Blue");
  assert.equal(stripIntegrationMarker("AGG (CC)"), "AGG");
});

test("a marker is matched case-insensitively, so a retyped account name still works", () => {
  assert.equal(stripIntegrationMarker("Kuutio (Drive)"), "Kuutio");
  assert.equal(stripIntegrationMarker("BBF (api)"), "BBF");
  assert.equal(stripIntegrationMarker("Korantina Homes (sharepoint)"), "Korantina Homes");
});

test("an account with no marker is returned untouched", () => {
  // The ten unmarked accounts, including the two-word and abbreviated ones.
  for (const n of ["Cybarco", "Luma", "Marfields", "Misc Projects", "Motive Point",
                   "Plus Properties", "Prospecta Development", "Quality Home Developers",
                   "Reiwa Development", "SOL Properties"]) {
    assert.equal(stripIntegrationMarker(n), n);
  }
});

test("a parenthetical that is NOT an integration method survives", () => {
  /* This is the whole reason the strip is vocabulary-driven rather than
     "drop any trailing (...)". Production's `developerName` column already
     holds both of these, and a phase or block suffix on an ACCOUNT would be
     just as legitimate a part of the real public name. */
  assert.equal(stripIntegrationMarker("The View (Phase B)"), "The View (Phase B)");
  assert.equal(stripIntegrationMarker("Georgia 12 (A&B)"), "Georgia 12 (A&B)");
  assert.equal(stripIntegrationMarker("Tsada Panorama (Phase D)"), "Tsada Panorama (Phase D)");
});

test("only a TRAILING marker counts, and only the outermost one", () => {
  // A method word in the middle of a name is part of the name.
  assert.equal(stripIntegrationMarker("Drive Properties"), "Drive Properties");
  assert.equal(stripIntegrationMarker("API Homes Ltd"), "API Homes Ltd");
  // Nested/multiple parens are not an integration marker shape — left alone
  // rather than guessed at.
  assert.equal(stripIntegrationMarker("Foo (Bar (XML))"), "Foo (Bar (XML))");
});

test("whitespace is normalised, and a name that is only a marker is kept", () => {
  assert.equal(stripIntegrationMarker("  Kuutio   (drive)  "), "Kuutio");
  assert.equal(stripIntegrationMarker("Kuutio(drive)"), "Kuutio");
  // Stripping would leave an empty public label, which is worse than the marker.
  assert.equal(stripIntegrationMarker("(drive)"), "(drive)");
  assert.equal(stripIntegrationMarker(""), "");
});
