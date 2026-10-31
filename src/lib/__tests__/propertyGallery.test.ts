import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePgXml, groupPgProjects, pgVm, pgStatus, pgImageUrl, pgArea, pickNewestXml } from "@/lib/propertyGallery";

/* Property Gallery (2026-10-12): OpenCart product export. Status and label
   meanings were decoded against the developer's live product pages. */

const attr = (n: string, v: string) => `<attribute><attribute_en>${n}</attribute_en><value_en>${v}</value_en></attribute>`;
function item(o: Record<string, string>, attrs = "", images = "") {
  const f = (k: string, d = "") => `<${k}>${o[k] ?? d}</${k}>`;
  return `<item>${f("product_id")}${f("model", "Limassol - Germasogeia")}${f("project_id")}${f("price", "0.0000")}${f("status", "1")}${f("label_status", "1")}
    ${f("image")}${f("imageplan")}${f("name_en")}${f("description_en", "&lt;p&gt;Text&lt;/p&gt;")}${f("project_description_en")}
    <product_attribute>${attrs}</product_attribute>
    <product_category><category id="82">${o.category ?? "Продажа&gt;Жилая недвижимость&gt;Квартиры / Апартаменты"}</category></product_category>
    <additional_images>${images}</additional_images></item>`;
}

const XML = `<?xml version="1.0"?><itemlist><title>XML Export</title>
${item({ product_id: "1", project_id: "72", name_en: "Alfa Residences: Apartment 101", price: "550000.0000", image: "https://cypruspropertygallery.com/image/catalog/ALPHA/Alpha.jpg", imageplan: "catalog/projects/Alfa Residences/plans/First Floor.jpg" },
  attr("Bedrooms", "2") + attr("Baths", "1.5") + attr("Area", "96.9 m²") + attr("View", "Sea view") + attr("Swimming pool", "Common"),
  "<image>https://cypruspropertygallery.com/image/catalog/projects/Alfa Residences/Interiors 1180x720/Living Room.jpg</image><image>catalog/partner/services-content-img-9.png</image>")}
${item({ product_id: "2", project_id: "72", name_en: "Alfa Residences: Penthouse 301", price: "989000.0000", label_status: "3" }, attr("Bedrooms", "3") + attr("Area", "146.2м²"))}
${item({ product_id: "3", project_id: "72", name_en: "Alfa Residences: Apartment 102", status: "0" }, attr("Bedrooms", "2"))}
${item({ product_id: "4", project_id: "70", name_en: "YOO Limassol - Villa 52", price: "4000000.0000", model: "Limassol - Pyrgos", category: "Продажа&gt;Жилая недвижимость&gt;Дома и Виллы" }, attr("Bedrooms", "5") + attr("Swimming pool", "Private"))}
${item({ product_id: "5", project_id: "90", name_en: "YOO Limassol - Apartments G402", price: "1655000.0000", label_status: "6", model: "Limassol - Pyrgos" }, attr("Bedrooms", "3"))}
${item({ product_id: "10", project_id: "63", name_en: "YOO Limassol - Apartments F202", price: "960000.0000", model: "Limassol - Pyrgos" }, attr("Bedrooms", "1"))}
${item({ product_id: "6", project_id: "70", name_en: "TEST - Apartments G101", price: "1.0000" })}
${item({ product_id: "7", project_id: "88", name_en: "Avenue 15: Office №4", price: "15000.0000", category: "Аренда | Аренда&gt;Аренда Коммерческой недвижимости" })}
${item({ product_id: "8", project_id: "107", name_en: "Seven Residential 104" }, attr("Bedrooms", "1") + attr("Area", "63м²"))}
${item({ product_id: "9", project_id: "86", name_en: "Majestic Villa - №3", price: "6450000.0000", model: "Limassol - Agios Tychonas", category: "Продажа&gt;Жилая недвижимость&gt;Дома и Виллы" })}
</itemlist>`;

test("only online, for-sale, non-test units are read", async () => {
  const rows = await parsePgXml(XML);
  assert.deepEqual(rows.map((r) => r.productId).sort(), ["1", "10", "2", "4", "5", "8", "9"]);
});

test("label_status maps to our statuses; unknown values are never available", () => {
  assert.equal(pgStatus("1"), "available");
  assert.equal(pgStatus("3"), "reserved");
  assert.equal(pgStatus("6"), "sold");
  assert.equal(pgStatus("0"), "reserved");
  assert.equal(pgStatus("5"), "reserved");
});

test("split projects merge, names and labels are clean", async () => {
  const projects = groupPgProjects(await parsePgXml(XML));
  const by = Object.fromEntries(projects.map((p) => [p.key, p]));
  assert.ok(by["yoo-limassol"]);
  assert.equal(by["yoo-limassol"].rows.length, 3); // pids 70 + 90 + 63, TEST dropped
  assert.equal(by["yoo-limassol"].name, "YOO Limassol");
  const seven = pgVm(by["107"]);
  assert.equal(seven.publicName, "Seven Residences");
  assert.equal(seven.units[0].label, "Apartment 104");
  assert.equal(seven.priceFrom, null); // price on request
  assert.equal(pgVm(by["86"]).units[0].label, "Villa 3");
});

test("the Alfa view model: prices from available units only, areas, images, plans", async () => {
  const vm = pgVm(groupPgProjects(await parsePgXml(XML)).find((p) => p.key === "72")!);
  assert.equal(vm.publicName, "Alfa Residences");
  assert.equal(vm.area, "Germasogeia");
  assert.equal(vm.district, "Limassol");
  assert.equal(vm.priceFrom, 550000); // the reserved penthouse does not count
  assert.equal(vm.priceTo, 550000);
  const u = vm.units.find((x) => x.ref === "1")!;
  assert.equal(u.label, "Apartment 101");
  assert.equal(u.areaBuilt, "96.9 m²");
  assert.equal(u.baths, "1.5");
  assert.deepEqual(u.features, ["Sea view"]);
  assert.deepEqual(u.plans, ["https://cypruspropertygallery.com/image/catalog/projects/Alfa%20Residences/plans/First%20Floor.jpg"]);
  assert.equal(u.photos.length, 2); // partner icon dropped
  assert.equal(vm.units.find((x) => x.ref === "2")!.type, "Penthouse");
  assert.deepEqual(vm.amenities, ["Communal swimming pool"]);
});

test("image urls: relative paths resolve, spaces encode, junk is dropped", () => {
  assert.equal(pgImageUrl("catalog/projects/A B/x.jpg"), "https://cypruspropertygallery.com/image/catalog/projects/A%20B/x.jpg");
  assert.equal(pgImageUrl("catalog/partner/services-content-img-9.png"), null);
  assert.equal(pgImageUrl("catalog/projects/Dream/DTL Colour Logo.png"), null);
  assert.equal(pgImageUrl("https://cypruspropertygallery.com/image/catalog/YOO EVENT PHOTOS/1.jpg"), null);
  assert.equal(pgImageUrl(""), null);
});

test("area names follow ours, including the Cyrillic М in 'Мakarios avenue'", () => {
  assert.equal(pgArea("Limassol - Agios Tichonas"), "Agios Tychonas");
  assert.equal(pgArea("Limassol - Мakarios avenue"), "City centre");
  assert.equal(pgArea("Platres - Cyprus"), "Platres");
  assert.equal(pgArea("Limassol - Pissouri"), "Pissouri");
});

test("the newest export wins by modified time", () => {
  const f = pickNewestXml([
    { name: "PG XML File Aug 2026.xml", modifiedTime: "2026-08-27T06:05:39Z" },
    { name: "PG XML File Sep 2026.xml", modifiedTime: "2026-09-26T08:00:00Z" },
    { name: "notes.pdf", modifiedTime: "2026-10-01T00:00:00Z" },
  ]);
  assert.equal(f?.name, "PG XML File Sep 2026.xml");
});

test("plan drawings are told from photos by file name, tone and the checked-by-eye list", async () => {
  const { pgIsPlanImage } = await import("@/lib/propertyGallery");
  const base = "https://cypruspropertygallery.com/image/catalog/projects/";
  const photo = { lightFraction: 0.1, meanSaturation: 0.25 };
  const drawing = { lightFraction: 0.9, meanSaturation: 0.01 };
  const colouredPlan = { lightFraction: 0.35, meanSaturation: 0.18 };
  assert.equal(pgIsPlanImage(base + "Homer%20Residences/1-st%20floor/AP105.png", colouredPlan), true);
  assert.equal(pgIsPlanImage(base + "Greenwood/Greenwood%20A/A1F.jpg", colouredPlan), true);
  assert.equal(pgIsPlanImage(base + "Pissouri/MASTER%20PLAN%20Villa%20No%2027.png", colouredPlan), true);
  // a folder called "3-rd floor" does not make a render a plan
  assert.equal(pgIsPlanImage(base + "Homer%20Residences/3-rd%20floor/cgi03.jpg", photo), false);
  // a "masterplan" file that is a dark, colourful aerial photo stays a photo
  assert.equal(pgIsPlanImage(base + "YOO/masterplan-1024x768.jpg", { lightFraction: 0.01, meanSaturation: 0.26 }), false);
  // no name hint: a light colourless drawing is a plan, a photo is not, unreadable is a photo
  assert.equal(pgIsPlanImage(base + "YOO/G202-1024x768.jpg", drawing), true);
  assert.equal(pgIsPlanImage(base + "Alfa/Living%20Room.jpg", photo), false);
  assert.equal(pgIsPlanImage(base + "Alfa/Living%20Room.jpg", null), false);
  // the checked-by-eye list wins even over a dark tone
  assert.equal(pgIsPlanImage(base + "Pissouri%20Forest%20Park/Picture1.png", { lightFraction: 0, meanSaturation: 0.2 }), true);
});

test("plan images leave the gallery and unit photos and become project plans", async () => {
  const rows = await parsePgXml(XML);
  const alfa = groupPgProjects(rows).find((p) => p.key === "72")!;
  const living = alfa.rows[0].photos[1];
  const vm = pgVm(alfa, new Set([living]));
  assert.ok(!vm.gallery.includes(living));
  assert.deepEqual(vm.plans, [living]);
  assert.ok(!vm.units.find((u) => u.ref === "1")!.photos.includes(living));
});
