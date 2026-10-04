import { test } from "node:test";
import assert from "node:assert/strict";
import { autoMetaTitle, autoMetaDescription, fit, TITLE_MAX } from "@/lib/developmentSeo";
import type { ProjectVM } from "@/app/preview-project/feeds";

const segmenter = new Intl.Segmenter("he", { granularity: "grapheme" });
const graphemes = (s: string) => Array.from(segmenter.segment(s)).length;

type VmOpts = {
  name: string;
  area?: string;
  district?: string;
  type?: string;
  beds?: string;
  available?: number;
  sold?: number;
  priceFrom?: number | null;
  completion?: string;
};

function vm(o: VmOpts): ProjectVM {
  const units: any[] = [];
  for (let i = 0; i < (o.available ?? 0); i++) units.push({ status: "available", type: o.type ?? "villa", beds: o.beds ?? "3", price: o.priceFrom ?? null });
  for (let i = 0; i < (o.sold ?? 0); i++) units.push({ status: "sold", type: o.type ?? "villa", beds: o.beds ?? "3", price: o.priceFrom ?? null });
  return {
    publicName: o.name,
    area: o.area ?? "",
    district: o.district ?? "",
    units,
    priceFrom: o.priceFrom ?? null,
    completion: o.completion ?? "",
  } as unknown as ProjectVM;
}

test("fit() never ends on a bare separator", () => {
  // The exact regression Pass B measured: a 35-char project name leaves no room
  // for the type/place clause, and the old three-clause form kept the "|".
  const long = "⁨Limassol Del Mar Residences Tower B⁩";
  const out = fit([long, "|", "דירות בלימסול"], TITLE_MAX);
  assert.ok(!/[|–—]\s*$/.test(out), `title ends on a bare separator: ${JSON.stringify(out)}`);
  assert.ok(graphemes(out) <= TITLE_MAX);
});

test("autoMetaTitle (he) leads with the keyword and never leaves a dangling pipe", () => {
  const t = autoMetaTitle(vm({ name: "Limassol Del Mar Residences Tower B", area: "Neapolis", district: "Limassol", type: "apartment", available: 4 }), "he");
  assert.ok(!/\|\s*$/.test(t), `dangling pipe: ${JSON.stringify(t)}`);
  assert.ok(t.startsWith("דירה"), t);
  assert.ok(t.includes("בלימסול"), t);
  assert.ok(graphemes(t) <= TITLE_MAX, `${graphemes(t)} graphemes: ${t}`);
});

test("autoMetaTitle (he) binds ב to a Hebrew place with no hyphen", () => {
  const t = autoMetaTitle(vm({ name: "Cap St Georges", area: "Peyia", district: "Paphos", type: "villa", beds: "3", available: 6 }), "he");
  assert.ok(t.includes("בפאפוס"), t);
  assert.ok(!t.includes("ב-פאפוס"), t);
  assert.ok(!t.includes("Paphos"), `place must be transliterated: ${t}`);
  assert.ok(t.includes("עם 3 חדרי שינה"), t);
});

test("autoMetaTitle (he) keeps the hyphen only when the place stays Latin", () => {
  const t = autoMetaTitle(vm({ name: "Some Project", area: "Nowhere Village", type: "villa", available: 2 }), "he");
  assert.ok(t.includes("ב-⁨Nowhere Village⁩"), t);
});

test("autoMetaTitle LTR output is unchanged by the clause restructure", () => {
  const v = vm({ name: "Cap St Georges", area: "Peyia", district: "Paphos", type: "villa", beds: "3", available: 6 });
  assert.equal(autoMetaTitle(v, "en"), "Cap St Georges – 3-bed Villa in Peyia, Paphos");
  assert.equal(autoMetaTitle(v, "de"), "Cap St Georges – 3-Zimmer-Villa in Peyia, Paphos");
  assert.equal(autoMetaTitle(v, "pl"), "Cap St Georges – Willa w Peyia, Paphos");
  assert.equal(autoMetaTitle(v, "ru"), "Cap St Georges – Вилла в Peyia, Paphos");
});

test("autoMetaDescription (he) counts one unit grammatically", () => {
  const one = autoMetaDescription(vm({ name: "X", area: "Germasogeia", district: "Limassol", type: "apartment", available: 1, priceFrom: 420000, completion: "Q2 2027" }), "he");
  assert.ok(one.includes("יחידה אחת זמינה"), one);
  assert.ok(!one.includes("1 יחידות"), one);
  assert.ok(one.includes("מסירה ברבעון 2 2027"), one);
  assert.ok(graphemes(one) <= 155, `${graphemes(one)}: ${one}`);

  const many = autoMetaDescription(vm({ name: "X", area: "Peyia", district: "Paphos", type: "villa", available: 12, priceFrom: 850000, completion: "Q3 2029" }), "he");
  assert.ok(many.includes("12 יחידות זמינות"), many);
});

test("autoMetaDescription (he) fills the sold-out snippet to the §6 corridor", () => {
  const d = autoMetaDescription(vm({ name: "X", area: "Kato Paphos", district: "Paphos", type: "apartment", sold: 8 }), "he");
  assert.ok(d.startsWith("נמכר במלואו."), d);
  assert.ok(d.includes("בפאפוס"), d);
  assert.ok(d.includes("באזור יש נכסים חדשים"), d);
  assert.ok(graphemes(d) >= 90 && graphemes(d) <= 155, `${graphemes(d)}: ${d}`);
});

test("autoMetaDescription LTR output is unchanged", () => {
  const v = vm({ name: "X", area: "Peyia", district: "Paphos", type: "villa", available: 12, priceFrom: 850000, completion: "Q3 2029" });
  assert.equal(
    autoMetaDescription(v, "en"),
    "Villa in Peyia, Paphos, Cyprus. 12 units available from €850,000. Completion: Q3 2029. View availability & prices.",
  );
  assert.equal(
    autoMetaDescription(vm({ name: "X", area: "Peyia", district: "Paphos", type: "villa", sold: 4 }), "en"),
    "Sold out — Villa in Peyia, Paphos, Cyprus. See similar projects.",
  );
});
