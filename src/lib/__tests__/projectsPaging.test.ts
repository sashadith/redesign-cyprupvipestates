import { test } from "node:test";
import assert from "node:assert/strict";
import { outOfRangePageTarget as t } from "../projectsPaging";

test("in range: no redirect", () => {
  assert.equal(t("/projects", { page: "8", propertyType: "Villa" }, 8, 8), null);
  assert.equal(t("/projects", {}, 1, 1), null);
  assert.equal(t("/projects", {}, 1, 0), null); // empty result set, first page: nothing to redirect to
});

test("past the end: last real page, every other filter kept in place", () => {
  assert.equal(t("/projects", { propertyType: "Villa", page: "9" }, 9, 8), "/projects?propertyType=Villa&page=8");
  assert.equal(t("/projects", { page: "9", propertyType: "Villa" }, 9, 8), "/projects?page=8&propertyType=Villa");
  assert.equal(t("/ru/projects", { city: "Limassol", priceFrom: "", page: "12" }, 12, 8), "/ru/projects?city=Limassol&priceFrom=&page=8");
  assert.equal(t("/projects", { page: "24", sort: "priceAsc" }, 24, 23), "/projects?page=23&sort=priceAsc");
});

test("single real page or no results: the page parameter is dropped", () => {
  assert.equal(t("/projects", { page: "3" }, 3, 1), "/projects");
  assert.equal(t("/projects", { city: "Paphos", page: "2" }, 2, 1), "/projects?city=Paphos");
  assert.equal(t("/de/projects", { page: "5" }, 5, 0), "/de/projects");
});

test("repeated parameters survive", () => {
  assert.equal(t("/projects", { city: ["A", "B"], page: "9" }, 9, 2), "/projects?city=A&city=B&page=2");
});
