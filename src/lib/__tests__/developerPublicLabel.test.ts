// The public brand name vs the admin label.
//
// DeveloperAccount.name is an admin-only string; 15 of the 25 accounts end in a
// parenthetical naming the integration ("AGG (CC)", "Kuutio (drive)"). Copying
// it into Development.developer put "Korantina Homes (SharePoint)" on 34 live
// project pages and into their JSON-LD. These cover the FALLBACK only — the
// real source of truth is the linked page title, which needs a database.
//
// Pure functions only — no DB.
import { test } from "node:test";
import assert from "node:assert/strict";
import { hasUnknownMarker, stripKnownMarker } from "@/lib/developerPublicLabel";

test("every integration marker we have actually seen is stripped", () => {
  // The real account names, measured on production 2026-10-10.
  assert.equal(stripKnownMarker("Korantina Homes (SharePoint)"), "Korantina Homes");
  assert.equal(stripKnownMarker("Kuutio (drive)"), "Kuutio");
  assert.equal(stripKnownMarker("BBF (API)"), "BBF");
  assert.equal(stripKnownMarker("Aristo (XML)"), "Aristo");
  assert.equal(stripKnownMarker("AGG (CC)"), "AGG");
  assert.equal(stripKnownMarker("G&V (drive)"), "G&V");
});

test("a marker is matched case-insensitively and only at the end", () => {
  assert.equal(stripKnownMarker("Korantina Homes (sharepoint)"), "Korantina Homes");
  assert.equal(stripKnownMarker("Something (DRIVE)"), "Something");
  // Not at the end: not a marker, leave the whole name alone.
  assert.equal(stripKnownMarker("(drive) Kuutio"), "(drive) Kuutio");
});

test("an account with no parenthetical is returned untouched", () => {
  for (const n of ["Cybarco", "Marfields", "Motive Point", "Plus Properties", "Misc Projects"]) {
    assert.equal(stripKnownMarker(n), n);
  }
});

test("an UNRECOGNISED parenthetical is left alone, not guessed at", () => {
  // This is the whole point of a vocabulary instead of a generic paren strip: a
  // parenthetical we do not know is as likely to be part of a real brand name
  // as a pipeline tag, and a wrong public name is worse than an ugly one.
  assert.equal(stripKnownMarker("Georgia 12 (A&B)"), "Georgia 12 (A&B)");
  assert.equal(stripKnownMarker("The View (Phase B)"), "The View (Phase B)");
  assert.equal(stripKnownMarker("Acme (Cyprus)"), "Acme (Cyprus)");
  assert.equal(hasUnknownMarker("Acme (Cyprus)"), true);
  assert.equal(hasUnknownMarker("BBF (API)"), false);
  assert.equal(hasUnknownMarker("Cybarco"), false);
});

test("stripping is never the whole answer — 9 of 25 accounts disagree with their page title", () => {
  // Measured on production 2026-10-10. These are the cases that make the page
  // title the source of truth rather than an optimisation: if publicDeveloperLabel
  // ever silently degrades to the strip, these names go out wrong.
  const pageTitle: Record<string, string> = {
    "AGG (CC)": "AGG Luxury Homes",
    "Aristo (XML)": "Aristo Developers",
    "Domenica (XML)": "Domenica Group",
    "G&V (drive)": "G&V Hadjidemosthenous",
    "Kuutio (drive)": "Kuutio Homes",
    "Luma": "Luma Development",
    "Medousa (XML)": "Medousa Developers",
    "Mito (XML)": "Mito Developers",
  };
  for (const [account, title] of Object.entries(pageTitle)) {
    assert.notEqual(stripKnownMarker(account), title, `${account}: strip accidentally equals the page title`);
  }
});

test("the marker vocabulary does not eat a name that merely contains a keyword", () => {
  assert.equal(stripKnownMarker("Drive Developments"), "Drive Developments");
  assert.equal(stripKnownMarker("API Homes"), "API Homes");
});
