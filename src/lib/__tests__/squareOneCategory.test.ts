import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { squareOneCategory } from "@/app/preview-project/feeds";

/* Apex (2026-10-05) is an office building in the Square One feed and was filed
   as "Residential" because the adapter hard-coded the category. */

test("an all-office project is commercial", () => {
  assert.equal(squareOneCategory(["Office", "Office", "Office", "Office"]), "Commercial real estate");
});

test("apartments and penthouses stay residential", () => {
  assert.equal(squareOneCategory(["Apartment", "Penthouse"]), "Residential");
});

test("one apartment in a mixed building keeps it residential", () => {
  assert.equal(squareOneCategory(["Office", "Shop", "Apartment"]), "Residential");
});

test("no unit types at all is not evidence of commercial use", () => {
  assert.equal(squareOneCategory([]), "Residential");
  assert.equal(squareOneCategory([""]), "Residential");
});

test("the Square One adapter actually uses it", () => {
  const src = readFileSync("src/app/preview-project/feeds.ts", "utf8");
  const adapter = src.slice(src.indexOf("async function squareOne("), src.indexOf("async function squareOne(") + 6000);
  assert.match(adapter, /category: squareOneCategory\(units\.map\(\(u\) => u\.type\)\)/);
});
