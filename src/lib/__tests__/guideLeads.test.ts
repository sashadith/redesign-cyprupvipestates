import { test } from "node:test";
import assert from "node:assert/strict";
import { formLeadSource, guideFromMessage, messageStartsWithGuide, guideCadenceStep, GUIDE_PARK_DAYS, GUIDE_FIRST_RETRY_DAYS } from "../guides/leadSource";
import { messageWithGuide } from "../guides/request";
import { bucketOf, sourceForBucket, ONLY_GUIDE, EXCLUDE_GUIDE } from "../crm/leadBucket";
import { buildLeadWhere, listBucketOf, LEAD_LIST_SOURCES } from "@/app/admin/(panel)/crm/filters";

test("a guide request is GUIDE_DOWNLOAD whatever page it came from; everything else unchanged", () => {
  assert.equal(formLeadSource("https://cyprusvipestates.com/de/blog/wie-nach-zypern-auswandern", true), "GUIDE_DOWNLOAD");
  assert.equal(formLeadSource("https://cyprusvipestates.com/projects/x", true), "GUIDE_DOWNLOAD");
  assert.equal(formLeadSource("https://cyprusvipestates.com/de/blog/wie-nach-zypern-auswandern", false), "BLOG_ENQUIRY");
  assert.equal(formLeadSource("https://cyprusvipestates.com/projects/x", false), "PROJECT_ENQUIRY");
  assert.equal(formLeadSource("https://cyprusvipestates.com/contact", false), "CONTACT_FORM");
});

test("guide title and language are read back from the stored message, with or without a typed message", () => {
  const guide = { id: "residency" as any, lang: "de" as any, title: "Daueraufenthalt auf Zypern durch Immobilienkauf (Kategorie 6.2): Ablauf, Kosten" };
  assert.deepEqual(guideFromMessage(messageWithGuide("", guide)), { title: guide.title, language: "de" });
  assert.deepEqual(guideFromMessage(messageWithGuide("Hallo, bitte zusenden", guide)), { title: guide.title, language: "de" });
  // A title that itself ends in parentheses keeps them; only the final (XX) is the language.
  assert.deepEqual(guideFromMessage("[Guide] Buying costs (2026 edition) (EN)"), { title: "Buying costs (2026 edition)", language: "en" });
  assert.equal(guideFromMessage("I read your guide and have a question"), null);
  assert.equal(guideFromMessage(null), null);
});

test("the backfill rule is 'message begins with [Guide]'", () => {
  assert.equal(messageStartsWithGuide("[Guide] X (DE)"), true);
  assert.equal(messageStartsWithGuide("  [Guide] X (DE)"), true);
  assert.equal(messageStartsWithGuide("Hello\n[Guide] X (DE)"), false);
  assert.equal(messageStartsWithGuide(null), false);
});

test("guide cadence: 7 days after the first unanswered contact, KEEP_CONTACT + 60 days after the second, then silent", () => {
  assert.deepEqual(guideCadenceStep({ count: 0, status: "CONTACTED", leadReacted: false }), { kind: "schedule", days: GUIDE_FIRST_RETRY_DAYS, count: 1 });
  assert.deepEqual(guideCadenceStep({ count: 1, status: "CONTACTED", leadReacted: false }), { kind: "park", days: GUIDE_PARK_DAYS, count: 2 });
  assert.deepEqual(guideCadenceStep({ count: 2, status: "CONTACTED", leadReacted: false }), { kind: "silent" });
  assert.equal(GUIDE_PARK_DAYS, 60);
});

test("guide cadence never parks a lead that answered or is in a conversation", () => {
  assert.deepEqual(guideCadenceStep({ count: 1, status: "CONTACTED", leadReacted: true }), { kind: "regular" });
  for (const status of ["COMMUNICATING", "VIEWING_SCHEDULED", "OFFER", "KEEP_CONTACT"]) {
    assert.deepEqual(guideCadenceStep({ count: 1, status, leadReacted: false }), { kind: "regular" }, status);
  }
});

test("guide leads have their own bucket, kept out of the buyer list", () => {
  assert.equal(bucketOf("GUIDE_DOWNLOAD"), "guide");
  assert.equal(bucketOf("BLOG_ENQUIRY"), "leads");
  assert.equal(sourceForBucket("guide"), "GUIDE_DOWNLOAD");
  assert.equal(LEAD_LIST_SOURCES.includes("GUIDE_DOWNLOAD"), false);
  assert.equal(listBucketOf({ bucket: "guide" }), "guide");
  assert.deepEqual(buildLeadWhere({}, "guide").AND, [ONLY_GUIDE]);
  assert.ok((buildLeadWhere({}, "leads").AND as unknown[]).includes(EXCLUDE_GUIDE));
});
