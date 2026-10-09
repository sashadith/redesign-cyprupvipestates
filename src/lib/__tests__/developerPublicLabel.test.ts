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
import { accountNameWarning, reviewAccountName, stripIntegrationMarker } from "@/lib/developerPublicLabel";

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

/* --- the admin-form guard ------------------------------------------------- */

test("a recognised marker needs no warning — that is the intended way to label an account", () => {
  for (const n of ["BBF (API)", "Korantina Homes (SharePoint)", "Kuutio (drive)", "AGG (CC)",
                   "Island Blue (XML)", "Something (Dropbox)"]) {
    assert.equal(accountNameWarning(n, null), null, n);
    assert.equal(accountNameWarning(n, "Some Brand"), null, n);
  }
});

test("a name with no parenthetical at all needs no warning", () => {
  assert.equal(accountNameWarning("Cybarco", null), null);
  assert.equal(accountNameWarning("Quality Home Developers", null), null);
});

test("an UNRECOGNISED marker on an unlinked account warns that clients would see it", () => {
  const w = accountNameWarning("Foo (Bitrix)", null);
  assert.ok(w, "expected a warning");
  assert.match(w, /\(Bitrix\)/);
  assert.match(w, /not a recognised integration marker/);
  // It must say what actually happens, not just that something is off.
  assert.match(w, /no linked public developer page/);
  assert.match(w, /Foo \(Bitrix\)/);
  assert.match(w, /structured data/);
  // And how to get out of it.
  assert.match(w, /SharePoint/);
});

test("the same name on a LINKED account warns about the stale-link case instead", () => {
  const w = accountNameWarning("Foo (Bitrix)", "Korantina Homes");
  assert.ok(w, "expected a warning");
  // Today the page title wins, so the warning must not claim clients see the marker now.
  assert.match(w, /would still show “Korantina Homes” publicly/);
  assert.match(w, /cleared or goes stale/);
  assert.doesNotMatch(w, /no linked public developer page/);
});

test("reviewAccountName reports the token and whether it is known", () => {
  assert.deepEqual(reviewAccountName("Kuutio (drive)"), { marker: "drive", recognised: true });
  assert.deepEqual(reviewAccountName("Foo (Bitrix)"), { marker: "Bitrix", recognised: false });
  assert.deepEqual(reviewAccountName("The View (Phase B)"), { marker: "Phase B", recognised: false });
  assert.deepEqual(reviewAccountName("Cybarco"), { marker: null, recognised: false });
  // Case is irrelevant to recognition, but the token is reported as typed.
  assert.deepEqual(reviewAccountName("BBF (api)"), { marker: "api", recognised: true });
});

test("a real brand that happens to END in parentheses warns rather than being mangled", () => {
  /* The guard's whole reason to be a warning and not a hard block: only the
     operator knows whether this is an internal marker or the actual name. */
  const w = accountNameWarning("Leptos Estates (Cyprus)", null);
  assert.ok(w);
  assert.match(w, /Press Save again to keep this name as it is/);
  // and nothing silently rewrites it either way
  assert.equal(stripIntegrationMarker("Leptos Estates (Cyprus)"), "Leptos Estates (Cyprus)");
});

test("a parenthetical in the MIDDLE of a name is not at risk and is not flagged", () => {
  /* Only a TRAILING parenthetical has the marker shape, and only that shape
     can be mistaken for one — so this must stay quiet, or the guard becomes
     noise on perfectly ordinary company names. */
  assert.equal(accountNameWarning("Leptos (Cyprus) Ltd", null), null);
  assert.equal(accountNameWarning("Foo (Bitrix) Holdings", null), null);
  assert.equal(stripIntegrationMarker("Leptos (Cyprus) Ltd"), "Leptos (Cyprus) Ltd");
});
