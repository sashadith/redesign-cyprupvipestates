// The auto-generated SEO text must never be stored as an override.
//
// Found 2026-10-17: 44 of 372 published developments had the HE auto
// description frozen into seo.descHE ("3 יחידות זמינות החל מ-€1,280,000"). The
// admin editor pre-filled every empty field with the auto text and "Save
// overrides" stored it verbatim; Hebrew was the locale nobody typed into, so it
// was the one that got baked. The HE translation queue then skipped those rows
// as "already filled".
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { autoMetaTitle, autoMetaDescription, isAutoSeoText } from "@/lib/developmentSeo";
import type { ProjectVM } from "@/app/preview-project/feeds";

function vm(available: number, priceFrom: number): ProjectVM {
  const units: any[] = [];
  for (let i = 0; i < available; i++) units.push({ status: "available", type: "villa", beds: "4", price: priceFrom });
  return { publicName: "Avakas Residences 3", area: "Paphos", district: "", units, priceFrom, completion: "" } as unknown as ProjectVM;
}

test("the auto text is recognised even after its figures have moved", () => {
  // Rendered into the form with one price, saved after a sync changed it: the
  // drift is the bug, so it must not let the copy through.
  for (const l of ["en", "de", "pl", "ru", "he"]) {
    const atRender = autoMetaDescription(vm(3, 1_280_000), l);
    const atSave = autoMetaDescription(vm(5, 1_150_000), l);
    assert.notEqual(atRender, atSave, l);
    assert.ok(isAutoSeoText(atRender, atSave), `${l}: ${atRender}`);
    assert.ok(isAutoSeoText(autoMetaTitle(vm(3, 1_280_000), l), autoMetaTitle(vm(5, 1_150_000), l)), `${l} title`);
  }
});

test("the stored Avakas Residences 3 string from production is caught", () => {
  const stored = "וילה בפאפוס, קפריסין. 3 יחידות זמינות החל מ-⁦€1,280,000⁩. לצפייה בזמינות ובמחירים.";
  assert.ok(isAutoSeoText(stored, autoMetaDescription(vm(2, 1_310_000), "he")));
});

test("real override copy is kept", () => {
  const auto = autoMetaDescription(vm(3, 1_280_000), "he");
  assert.equal(isAutoSeoText("וילות בפאפוס עם בריכה פרטית, החל מ-{priceFrom}.", auto), false);
  assert.equal(isAutoSeoText("וילה בפאפוס, קפריסין. 3 יחידות זמינות החל מ-€1,280,000. צרו קשר עוד היום.", auto), false);
  assert.equal(isAutoSeoText("", auto), false);
});

test("the admin editor does not pre-fill SEO fields with the auto text", () => {
  // The value the form submits must be the stored override (or empty); the
  // auto text belongs in the placeholder only.
  const page = readFileSync(join(process.cwd(), "src/app/admin/(panel)/developments/[id]/page.tsx"), "utf8");
  assert.doesNotMatch(page, /\|\|\s*auto(Title|Desc)\[/);
  const fields = readFileSync(join(process.cwd(), "src/app/admin/(panel)/developments/[id]/SeoMetaFields.tsx"), "utf8");
  assert.match(fields, /placeholder=\{auto\[titleKey\]\}/);
  assert.match(fields, /placeholder=\{auto\[descKey\]\}/);
});
