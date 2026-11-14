// What lands on a DOMO project page, and what must not (2026-11-13).
//
// Every fixture path below was taken from the real Agents Library share, not
// invented: the three ways DOMO names floor plans, the sales brochure that sits
// in all 16 folders, and the five interior renders Messina and Padua share byte
// for byte. No SharePoint and no Prisma — these are pure rules.
import { test } from "node:test";
import assert from "node:assert/strict";
import { classify, splitFolder, orderPhotos, claimPhoto, type DomoFile } from "@/lib/domo/media";

const f = (path: string, mimeType = "image/png", size = 1000): DomoFile => ({
  path,
  name: path.split("/").pop() ?? "",
  mimeType,
  size,
});

test("photos are the renders, and only the renders", () => {
  assert.equal(classify(f("/Renders/Exteriors/Siena Residence by DOMO_1.png")), "photo");
  assert.equal(classify(f("/Renders/Interiors/02. VERANDA.png")), "photo");
  assert.equal(classify(f("/Renders/Common Areas/Vireo Residence_6.png")), "photo");
  assert.equal(classify(f("/Renders/Albion.jpeg", "image/jpeg")), "photo");
  // An image that is not under Renders is not a project photo.
  assert.equal(classify(f("/Marketing/banner.png")), "skip");
});

test("the three ways DOMO names a floor plan are all plans", () => {
  // A file at the root…
  assert.equal(classify(f("/Hampton Floor plans.pdf", "application/pdf")), "plan");
  assert.equal(classify(f("/Mantua - Floor Plan.pdf", "application/pdf")), "plan");
  // …a per-storey set in a Layouts folder…
  assert.equal(classify(f("/Domo Properties - EVORA - Layouts/EVORA_01_1ST FLOOR.pdf", "application/pdf")), "plan");
  // …and a dated folder.
  assert.equal(classify(f("/Siena floor plans 2026/Siena Floor Plans_Jul 2026.pdf", "application/pdf")), "plan");
});

test("the sales brochure is never a plan and never a photo", () => {
  // It is in all 16 folders, its price pages are two months older than the
  // master list, and rasterising it would put a priced brochure in the gallery.
  const b = f("/Unbranded_Siena Residence_brochure with prices_Sep 10 2026.pdf", "application/pdf", 3_500_000);
  assert.equal(classify(b), "brochure");
  assert.equal(classify(f("/Unbranded_MILFORD Heights_brochure with prices_September 10 2026.pdf", "application/pdf")), "brochure");
  assert.equal(classify(f("/Domo Properties - Siena Overview.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")), "overview");
});

test("the card image is an exterior, not a bathroom", () => {
  // The listing grid shows photos[0] and nothing else, so this ordering IS the
  // thumbnail choice.
  const ordered = orderPhotos([
    f("/Renders/Interiors/05. EN SUITE BATHROOM.jpg", "image/jpeg"),
    f("/Renders/Common Areas/pool.png"),
    f("/Renders/Exteriors/Siena_1.png"),
    f("/Renders/Interiors/01. LIVING AREA.png"),
  ]);
  assert.deepEqual(ordered.map((x) => x.path), [
    "/Renders/Exteriors/Siena_1.png",
    "/Renders/Common Areas/pool.png",
    "/Renders/Interiors/01. LIVING AREA.png",
    "/Renders/Interiors/05. EN SUITE BATHROOM.jpg",
  ]);
  // The developer's own numbering decides the order inside a group.
  assert.deepEqual(
    orderPhotos([f("/Renders/Interiors/03. MASTER BEDROOM.jpg"), f("/Renders/Interiors/01. LIVING AREA.png")]).map((x) => x.name),
    ["01. LIVING AREA.png", "03. MASTER BEDROOM.jpg"],
  );
});

test("splitFolder sorts one real folder the way the share has it", () => {
  const siena = [
    f("/Renders/Exteriors/Siena Residence by DOMO_1.png"),
    f("/Renders/Interiors/01. LIVING AREA_Siena.png"),
    f("/Renders/Interiors/05. EN SUITE BATHROOM_Siena.jpg", "image/jpeg"),
    f("/Siena floor plans 2026/Siena Floor Plans_Jul 2026.pdf", "application/pdf"),
    f("/Domo Properties - Siena Overview.docx", "application/msword"),
    f("/Unbranded_Siena Residence_brochure with prices_Sep 10 2026.pdf", "application/pdf"),
  ];
  const got = splitFolder(siena);
  assert.equal(got.photos.length, 3);
  assert.equal(got.photos[0].path, "/Renders/Exteriors/Siena Residence by DOMO_1.png");
  assert.equal(got.plans.length, 1);
  assert.equal(got.brochures.length, 1);
  assert.equal(got.overviews.length, 1);
});

test("a render shared by two projects is mirrored for the first one only", () => {
  // Messina and Padua carry the same five interiors, identical by MD5. Both
  // galleries showing them would be the same five photos on two pages.
  const seen = new Map<string, string>();
  const hash = "6ab8ef8695d29cf8b6a501ab5407352c";
  const first = claimPhoto(seen, hash, "messina");
  const second = claimPhoto(seen, hash, "padua");
  assert.equal(first.take, true);
  assert.equal(second.take, false);
  assert.equal(second.ownedBy, "messina");
  // Re-running the sync must not take the photo away from its owner.
  assert.equal(claimPhoto(seen, hash, "messina").take, true);
  // A different file is unaffected.
  assert.equal(claimPhoto(seen, "other-hash", "padua").take, true);
});

/* The registry itself. It is data, not code, which is exactly why it needs a
   test: every figure in it was read off the share or the price list once, by
   hand, and nothing else in the pipeline would notice if one of them were a
   typo. The sync compares its own counts against these on every run. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const registry = () =>
  JSON.parse(readFileSync(join(process.cwd(), "scripts/data/domo/2026-11-13.json"), "utf8"));

test("the DOMO registry covers both sources and contradicts neither", () => {
  const d = registry();
  const p = d.projects as any[];
  assert.equal(p.length, 18, "18 projects are on sale: 15 residential and 3 commercial");
  assert.equal(new Set(p.map((x) => x.slug)).size, 18, "slugs must be unique — the feedKey is built from them");

  // 16 of the 18 have a folder; The Glover and Roman House are price-list only.
  assert.equal(p.filter((x) => x.folder).length, 16);
  assert.deepEqual(p.filter((x) => !x.folder).map((x) => x.slug).sort(), ["roman-house", "the-glover"]);

  // Commercial is part of this catalogue, not an exception to it: the site has
  // 205 commercial units live and the public type filter carries Office, Shop,
  // Commercial and Hotel.
  assert.equal(p.filter((x) => x.category === "Commercial real estate").length, 3);

  for (const x of p) {
    assert.equal(x.district, "Limassol", `${x.slug}: DOMO builds only in Limassol`);
    assert.ok(["Residential", "Commercial real estate"].includes(x.category), `${x.slug}: unexpected category ${x.category}`);
    assert.ok(["Under Construction", "Off Plan"].includes(x.stage), `${x.slug}: unexpected stage ${x.stage}`);
    // No completion quarter may be written until phase 2 reads them from the
    // PDF's coordinates — 13 of 24 price-list pages yield two "Delivery:" lines
    // and reading order cannot say which belongs to the table.
    assert.ok(!("completion" in x) || x.completion == null, `${x.slug}: completion must stay empty until it is read from coordinates`);
    assert.ok((x.media.photosInFolder ?? x.media.photos) >= x.media.photos, `${x.slug}: shows more photos than its folder holds`);
  }
});

test("exactly one project claims the renders Messina and Padua share", () => {
  const p = registry().projects as any[];
  const claimers = p.filter((x) => x.claimsSharedRenders).map((x) => x.slug);
  assert.deepEqual(claimers, ["messina"], "the owner of a shared render set is a decision, not an accident of ordering");
  const padua = p.find((x) => x.slug === "padua");
  // 13 in the folder, 8 shown: the five Messina claims.
  assert.equal(padua.media.photosInFolder - padua.media.photos, 5);
});

test("the five renamed projects keep their old studio names on record", () => {
  // Files in the share still say Alveo, Seya, Vireo, Orien and Caeli. The names
  // are recorded so the sync can explain a file it reads, and nothing may build
  // a project's identity from them.
  const bySlug = Object.fromEntries((registry().projects as any[]).map((x) => [x.slug, x]));
  assert.equal(bySlug["messina"].codeName, "Alveo");
  assert.equal(bySlug["milford-heights"].codeName, "Seya");
  assert.equal(bySlug["navarre"].codeName, "Vireo");
  assert.equal(bySlug["padua"].codeName, "Orien");
  assert.equal(bySlug["mantua"].codeName, "Caeli");
});
