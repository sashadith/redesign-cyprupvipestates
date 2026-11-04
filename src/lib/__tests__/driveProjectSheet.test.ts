import test from "node:test";
import assert from "node:assert/strict";
import { findPriceFile, type DriveFile } from "../googleDrive";

/* A project folder's price list must be NAMED like one (requireNamed): a project
   folder routinely holds payment schedules and reservation forms. Olias' Aura
   (2026-10-31) keeps its list as plain "Aura.xlsx" — named after the project
   itself, which is just as unambiguous — and so was never read. */

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const f = (name: string, modifiedTime = "2026-10-06T00:00:00Z", mimeType = XLSX): DriveFile => ({ id: name, name, mimeType, modifiedTime });
const strict = { requireNamed: true, spreadsheetsOnly: true };

test("a spreadsheet named exactly like the project is its price list", () => {
  assert.equal(findPriceFile([f("Aura.xlsx")], { ...strict, projectName: "Aura" })?.name, "Aura.xlsx");
  assert.equal(findPriceFile([f("skyline villas.xlsx")], { ...strict, projectName: "Skyline Villas" })?.name, "skyline villas.xlsx");
});

test("without the project name the strict rule is unchanged", () => {
  assert.equal(findPriceFile([f("Aura.xlsx")], strict), null);
});

test("other spreadsheets in the folder still don't count", () => {
  assert.equal(findPriceFile([f("Payment Schedule.xlsx"), f("Aura reservation form.xlsx")], { ...strict, projectName: "Aura" }), null);
});

test("a price-list name still wins, newest first, alongside a project-named sheet", () => {
  const got = findPriceFile([f("Aura.xlsx", "2026-10-06T00:00:00Z"), f("Sales Catalogue - Aura.xlsx", "2026-10-20T00:00:00Z")], { ...strict, projectName: "Aura" });
  assert.equal(got?.name, "Sales Catalogue - Aura.xlsx");
});
