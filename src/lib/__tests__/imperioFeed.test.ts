import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getPreviewProject,
  listProjectIds,
  qobrixProjectId,
  qobrixStatus,
  qobrixStage,
  qobrixCompletion,
  canonicalizeByContentLength,
  floorPlanUrls,
  looksLikeFloorPlan,
} from "@/app/preview-project/feeds";
import sharp from "sharp";

/* Imperio Properties (2026-10-10): Qobrix native feed. Project identity is
   <short_description>; images are re-uploaded per unit under fresh UUIDs and
   collapsed by Content-Length; plans are PDFs passed through for the mirror. */

const IMG = (id: string) => `https://imperio.eu1.qobrix.com/api/v2/files/download/media/public/original/${id}`;

function unit(o: Record<string, string>, media: string) {
  const f = (k: string, d = "") => `<${k}>${o[k] ?? d}</${k}>`;
  return `<property>${f("ref")}${f("description", "Unit text.")}${f("unit_number")}${f("property_type", "apartment")}${f("property_subtype", "standard_apartment")}${f("status", "available")}${f("sale_rent", "for_sale")}${f("construction_stage", "construction_phase")}${f("bedrooms", "2")}${f("bathrooms", "2")}${f("coordinates", "34.7048,33.0530")}${f("floor_number", "1")}${f("website_status", "published")}${f("short_description")}${f("internal_area_amount", "80.00")}${f("covered_verandas_amount", "18.00")}${f("uncovered_verandas_amount")}${f("roof_garden_area_amount")}${f("list_selling_price_amount")}${f("common_swimming_pool", "1")}${f("elevator", "1")}${f("air_condition", "1")}${f("storage_space", "1")}${f("heating_medium", "electric_heating")}${f("energy_efficiency_grade", "a")}${f("custom_delivery_quarter")}${f("custom_delivery_year")}${f("construction_year", "2028")}${f("city", "Limassol")}${f("municipality", "Agios Athanasios")}${f("parking", "1")}${f("sea_view")}<media>${media}</media></property>`;
}

const FEED = `<?xml version="1.0" encoding="UTF-8"?><properties><qobrix><version>0.5</version></qobrix>
${unit({ ref: "1", unit_number: "A118", short_description: "Silicon Park", list_selling_price_amount: "285000.00", custom_delivery_quarter: "Q1", custom_delivery_year: "2029", sea_view: "1" },
  `<img category="featured_photo">${IMG("b-render1")}</img><img category="photos">${IMG("b-render2")}</img><document category="floor_plans">${IMG("plan-a118")}</document>`)}
${unit({ ref: "2", unit_number: "A305", short_description: "Silicon Park", list_selling_price_amount: "325000.00", status: "reserved", custom_delivery_quarter: "Q2", custom_delivery_year: "2029" },
  `<img category="featured_photo">${IMG("a-render1-copy")}</img><img category="photos">${IMG("z-render2-copy")}</img><document category="floor_plans">${IMG("plan-a305")}</document>`)}
${unit({ ref: "3", unit_number: "A001", short_description: "Silicon Park", property_subtype: "studio", bedrooms: "", list_selling_price_amount: "199000.00", floor_number: "0", custom_delivery_quarter: "Q1", custom_delivery_year: "2029" }, "")}
${unit({ ref: "4", unit_number: "B101", short_description: "Imperio Portside", list_selling_price_amount: "375000.00", website_status: "unpublished" }, "")}
${unit({ ref: "5", unit_number: "B102", short_description: "Imperio Portside", list_selling_price_amount: "395000.00", property_subtype: "penthouse", roof_garden_area_amount: "54.00" }, "")}
${unit({ ref: "6", unit_number: "R1", short_description: "Imperio Portside", sale_rent: "for_rent", list_selling_price_amount: "1500.00" }, "")}
</properties>`;

// Same render uploaded twice under different ids → same Content-Length.
const LENGTHS: Record<string, string> = {
  "b-render1": "1000", "a-render1-copy": "1000",
  "b-render2": "2000", "z-render2-copy": "2000",
};

const realFetch = globalThis.fetch;
function stubFetch() {
  globalThis.fetch = (async (input: any, init?: any) => {
    const url = String(input);
    if (url.includes("/api/v2/feeds/")) return new Response(FEED, { status: 200, headers: { "content-type": "application/xml" } });
    if (init?.method === "HEAD") {
      const id = url.split("/").pop()!;
      const len = LENGTHS[id];
      return new Response(null, { status: len ? 200 : 404, headers: len ? { "content-length": len } : {} });
    }
    throw new Error(`unexpected fetch ${url}`);
  }) as typeof fetch;
}

test("project ids come from the project name; rentals and unpublished units are left out", async () => {
  stubFetch();
  try {
    assert.deepEqual((await listProjectIds("imperio")).sort(), ["imperio-portside", "silicon-park"]);
    const vm = await getPreviewProject("imperio", "imperio-portside");
    assert.ok(vm);
    assert.deepEqual(vm!.units.map((u) => u.ref), ["B102"]);
    assert.equal(vm!.units[0].type, "Penthouse");
    assert.deepEqual(vm!.units[0].attrs.find((a) => a.name === "Roof garden"), { name: "Roof garden", value: "54 m²" });
  } finally { globalThis.fetch = realFetch; }
});

test("Silicon Park: statuses, studio, ground floor, areas, delivery and price range", async () => {
  stubFetch();
  try {
    const vm = (await getPreviewProject("imperio", "silicon-park"))!;
    assert.equal(vm.publicName, "Silicon Park");
    assert.equal(vm.district, "Limassol");
    assert.equal(vm.area, "Agios Athanasios");
    assert.equal(vm.stage, "Under Construction");
    assert.equal(vm.completion, "Q2 2029"); // the later of the two phases
    assert.equal(vm.energy, "A");
    const by = Object.fromEntries(vm.units.map((u) => [u.ref, u]));
    assert.equal(by.A305.status, "reserved");
    assert.equal(by.A001.type, "Studio");
    assert.equal(by.A001.beds, "0");
    assert.equal(by.A001.floor, "Ground");
    assert.equal(by.A118.areaBuilt, "80 m²"); // interior only
    assert.equal(by.A118.areaVeranda, "18 m²");
    assert.deepEqual(by.A118.features, ["Sea view"]);
    assert.deepEqual(by.A118.plans, [IMG("plan-a118")]); // PDF passed through for the mirror
    // priceFrom/To from AVAILABLE units only: the reserved 325,000 does not count
    assert.equal(vm.priceFrom, 199000);
    assert.equal(vm.priceTo, 285000);
    assert.deepEqual(vm.amenities, ["Communal swimming pool", "Elevator", "A/C split units", "Storage room"]);
  } finally { globalThis.fetch = realFetch; }
});

test("re-uploaded renders collapse to one canonical url in gallery and unit photos", async () => {
  stubFetch();
  try {
    const vm = (await getPreviewProject("imperio", "silicon-park"))!;
    assert.deepEqual(vm.gallery, [IMG("a-render1-copy"), IMG("b-render2")]); // smallest url of each group, featured first
    const by = Object.fromEntries(vm.units.map((u) => [u.ref, u]));
    assert.deepEqual(by.A118.photos, [IMG("a-render1-copy"), IMG("b-render2")]);
    assert.deepEqual(by.A305.photos, [IMG("a-render1-copy"), IMG("b-render2")]);
  } finally { globalThis.fetch = realFetch; }
});

test("canonicalization never merges a file whose size could not be read", async () => {
  const m = await canonicalizeByContentLength(["u2", "u1", "x", "y"], async (u) => (u === "u1" || u === "u2" ? "len:5" : ""));
  assert.equal(m.get("u2"), "u1");
  assert.equal(m.get("x"), "x");
  assert.equal(m.get("y"), "y");
});

test("status, stage, completion and id helpers", () => {
  assert.equal(qobrixStatus("available"), "available");
  assert.equal(qobrixStatus("Sold"), "sold");
  assert.equal(qobrixStatus("under_offer"), "reserved");
  assert.equal(qobrixStatus("something_new"), "reserved"); // never "available" by default
  assert.equal(qobrixStage("offplans"), "Off Plan");
  assert.equal(qobrixStage("construction_phase"), "Under Construction");
  assert.equal(qobrixCompletion([{ quarter: "", year: "", built: "2028" }]), "2028");
  assert.equal(qobrixCompletion([{ quarter: "", year: "", built: "" }]), "");
  assert.equal(qobrixProjectId("Imperio Skyline"), "imperio-skyline");
});

test("floor-plan thresholds: line drawing on white yes, render or interior no", () => {
  assert.equal(looksLikeFloorPlan({ lightFraction: 0.9, meanSaturation: 0.006 }), true);
  assert.equal(looksLikeFloorPlan({ lightFraction: 0.36, meanSaturation: 0.157 }), false); // brightest real photo measured
  assert.equal(looksLikeFloorPlan({ lightFraction: 0.95, meanSaturation: 0.3 }), false); // bright but colourful
});

test("floorPlanUrls keeps only what the classifier calls a plan", async () => {
  const set = await floorPlanUrls(["a", "b", "a", "c"], async (u) => u !== "b");
  assert.deepEqual(Array.from(set).sort(), ["a", "c"]);
});

test("plan drawings delivered as photos go to plans, out of the gallery and unit photos", async () => {
  const white = await sharp({ create: { width: 120, height: 80, channels: 3, background: { r: 250, g: 250, b: 250 } } })
    .composite([{ input: await sharp({ create: { width: 120, height: 4, channels: 3, background: { r: 120, g: 120, b: 120 } } }).png().toBuffer(), top: 38, left: 0 }])
    .png().toBuffer();
  const blue = await sharp({ create: { width: 120, height: 80, channels: 3, background: { r: 40, g: 110, b: 200 } } }).png().toBuffer();
  const feed = `<?xml version="1.0"?><properties><qobrix><version>0.5</version></qobrix>${unit({ ref: "9", unit_number: "P1", short_description: "Plan Test", list_selling_price_amount: "300000.00" },
    `<img category="featured_photo">${IMG("pt-photo")}</img><img category="photos">${IMG("pt-plan")}</img>`)}</properties>`;
  globalThis.fetch = (async (input: any, init?: any) => {
    const url = String(input);
    if (url.includes("/api/v2/feeds/")) return new Response(feed, { status: 200 });
    if (init?.method === "HEAD") return new Response(null, { status: 200, headers: { "content-length": url.endsWith("pt-plan") ? "11" : "22" } });
    if (url.includes("/public/small/pt-plan")) return new Response(new Uint8Array(white), { status: 200 });
    if (url.includes("/public/small/pt-photo")) return new Response(new Uint8Array(blue), { status: 200 });
    throw new Error(`unexpected fetch ${url}`);
  }) as typeof fetch;
  try {
    const { __resetFeedCacheForTests } = await import("@/app/preview-project/feeds");
    __resetFeedCacheForTests();
    const vm = (await getPreviewProject("imperio", "plan-test"))!;
    assert.deepEqual(vm.gallery, [IMG("pt-photo")]);
    assert.deepEqual(vm.plans, [IMG("pt-plan")]);
    assert.deepEqual(vm.units[0].photos, [IMG("pt-photo")]);
  } finally { globalThis.fetch = realFetch; }
});
