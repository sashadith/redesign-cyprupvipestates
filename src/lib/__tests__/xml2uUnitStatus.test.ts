// Domenica moved unit status from a Features "Status:" line to
// <Price><status>. Until the adapter read the new field, every Domenica unit
// came out "available", so fully reserved projects (Oculus, la-bella,
// Eniko Mare) stayed on the market. The XML below is copied from the live
// feed on 2026-11-11 and parsed with the adapter's own xml2js options.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseStringPromise } from "xml2js";
import { xml2uUnitStatus, parseXml2uStatusValue } from "../xml2uUnitStatus";
import { computeAvailability } from "../developmentAvailability";

const parse = (xml: string) => parseStringPromise(xml, { explicitArray: false, trim: true, explicitRoot: true });

const NEW_FORMAT_FEATURES =
  "<Features><Feature1>Internal Covered: 93 m2</Feature1><Feature2>Covered Verandas: 16 m2</Feature2>" +
  "<Feature3>Total Covered Area: 109 m2</Feature3><Feature4></Feature4></Features>";

const domenicaUnit = (status: string) =>
  `<Property><Price><prefix></prefix><price>0</price><currency>EUR</currency><RentalBond />` +
  `<availableDate></availableDate><status>${status}</status><reference>A104Oculus</reference></Price>` +
  `<Description>${NEW_FORMAT_FEATURES}</Description></Property>`;

async function statusOf(propertyXml: string) {
  const p = (await parse(propertyXml)).Property;
  return xml2uUnitStatus(p?.Price?.status, p?.Description?.Features);
}

test("Domenica Price.status Reserved is reserved, not available", async () => {
  assert.equal(await statusOf(domenicaUnit("Reserved")), "reserved");
});

test("Domenica Price.status For Sale is available", async () => {
  assert.equal(await statusOf(domenicaUnit("For Sale")), "available");
});

test("Price.status Sold is sold", async () => {
  assert.equal(await statusOf(domenicaUnit("Sold")), "sold");
});

test("empty Price.status falls back to the old Features line", async () => {
  const xml =
    `<Property><Price><status></status><reference>B1Cirvis</reference></Price><Description><Features>` +
    `<Feature1>Bedrooms: 2</Feature1><Feature2>Status: Sold</Feature2></Features></Description></Property>`;
  assert.equal(await statusOf(xml), "sold");
});

test("old Features 'Status: Available For Sale' is still available", async () => {
  const xml =
    `<Property><Price><status></status></Price><Description><Features>` +
    `<Feature1>Status: Available For Sale</Feature1></Features></Description></Property>`;
  assert.equal(await statusOf(xml), "available");
});

test("Price.status wins over a stale Features line", async () => {
  const xml =
    `<Property><Price><status>Reserved</status></Price><Description><Features>` +
    `<Feature1>Status: Available For Sale</Feature1></Features></Description></Property>`;
  assert.equal(await statusOf(xml), "reserved");
});

test("Pafilia: empty status, marketing features -> available (unchanged)", async () => {
  const xml =
    `<Property><Price><status></status><reference>PA-232-6521</reference></Price><Description><Features>` +
    `<Feature1>Private swimming pool</Feature1></Features></Description></Property>`;
  assert.equal(await statusOf(xml), "available");
});

test("unrecognised Price.status never hides a unit", () => {
  assert.equal(parseXml2uStatusValue("Coming soon"), null);
  assert.equal(xml2uUnitStatus("Coming soon", undefined), "available");
});

test("missing Price and Features -> available", () => {
  assert.equal(xml2uUnitStatus(undefined, undefined), "available");
});

test("a project whose units are all Reserved counts as sold out", async () => {
  const units = await Promise.all(["Reserved", "Reserved", "Reserved", "Reserved"].map(async (s) => ({ status: await statusOf(domenicaUnit(s)) })));
  assert.deepEqual(computeAvailability(units), { total: 4, available: 0, soldOut: true });
});

test("one unit back For Sale lifts sold out", async () => {
  const units = await Promise.all(["Reserved", "For Sale", "Sold"].map(async (s) => ({ status: await statusOf(domenicaUnit(s)) })));
  assert.deepEqual(computeAvailability(units), { total: 3, available: 1, soldOut: false });
});
