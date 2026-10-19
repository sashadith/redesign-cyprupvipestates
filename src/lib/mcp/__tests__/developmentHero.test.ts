import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveGalleryOrder, resolveHeroImage, heroImageUrl, isMirroredImage, absoluteUrls } from "@/lib/developmentHero";
import { publicUrlFor } from "@/lib/crm/inventorySearch";

const feed = ["/uploads/developments/inex-1/aaa_medium.webp", "/uploads/developments/inex-1/bbb_medium.webp"];

test("hero precedence: admin mainImage, then admin gallery, then feed gallery — duplicates collapsed", () => {
  assert.deepEqual(resolveGalleryOrder({ gallery: feed }), feed);
  assert.deepEqual(resolveGalleryOrder({ gallery: feed, override: { gallery: ["/uploads/developments/inex-1/ccc_medium.webp"] } }), ["/uploads/developments/inex-1/ccc_medium.webp"]);
  assert.deepEqual(
    resolveGalleryOrder({ gallery: feed, override: { mainImage: feed[1] } }),
    [feed[1], feed[0]],
  );
  assert.equal(resolveHeroImage({ gallery: feed, override: { mainImage: "/uploads/developments/inex-1/hero_medium.webp", gallery: [] } }), "/uploads/developments/inex-1/hero_medium.webp");
  assert.equal(resolveHeroImage({ gallery: null }), null);
  assert.equal(resolveHeroImage({ gallery: [""] }), null);
});

test("heroImageUrl: published only, largest hosted tier, absolute", () => {
  assert.equal(heroImageUrl({ publishStatus: "published", gallery: feed }), "https://cyprusvipestates.com/uploads/developments/inex-1/aaa_large.webp");
  assert.equal(heroImageUrl({ publishStatus: "ready", gallery: feed }), null);
  assert.equal(heroImageUrl({ publishStatus: "draft", gallery: feed, override: { mainImage: feed[0] } }), null);
  assert.equal(heroImageUrl({ publishStatus: "published", gallery: [] }), null);
});

test("a vendor URL (not mirrored) is returned as the page shows it, upgraded to its own large tier", () => {
  const vendor = "https://qubehub.fra1.digitaloceanspaces.com/bbf/images/projects/MEDIUM_abc.jpg";
  assert.equal(heroImageUrl({ publishStatus: "published", gallery: [vendor] }), "https://qubehub.fra1.digitaloceanspaces.com/bbf/images/projects/LARGE_abc.jpg");
  assert.equal(isMirroredImage(vendor), false);
  assert.equal(isMirroredImage(feed[0]), true);
  assert.equal(isMirroredImage("https://cyprusvipestates.com/uploads/developments/x/y_large.webp"), true);
});

test("absoluteUrls prefixes every locale path of publicUrlFor with the site origin", () => {
  const rel = publicUrlFor("cap-st-georges-resort", "published");
  const absUrls = absoluteUrls(rel);
  assert.equal(absUrls?.en, "https://cyprusvipestates.com/projects/cap-st-georges-resort");
  assert.equal(absUrls?.de, "https://cyprusvipestates.com/de/projects/cap-st-georges-resort");
  assert.deepEqual(Object.keys(absUrls ?? {}), Object.keys(rel ?? {}));
  assert.equal(absoluteUrls(publicUrlFor("x", "ready")), null);
});
