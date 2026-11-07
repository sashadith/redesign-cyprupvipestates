import { test } from "node:test";
import assert from "node:assert/strict";
import { sourceForTakenOverDownload, statusForTakenOverDownload } from "../crm/downloadSource";
import { inboxWhere } from "../crm/inboxWhere";
import { boardWhere, sideWhere } from "../crm/boardWhere";
import { EXCLUDE_GUIDE } from "../crm/leadBucket";
import { NAG_EXCLUDED_SOURCES } from "../crm/leadNag";

test("a taken-over download gets the buyer source of where it came from", () => {
  assert.equal(sourceForTakenOverDownload({ guideTitle: "Private Collection Briefing", pageSource: null }), "PRIVATE_COLLECTION");
  assert.equal(sourceForTakenOverDownload({ guideTitle: "Kategorie 6.2", pageSource: "https://cyprusvipestates.com/de/ratgeber/x" }), "BLOG_ENQUIRY");
  assert.equal(sourceForTakenOverDownload({ guideTitle: "Guide", pageSource: "https://cyprusvipestates.com/en/projects/abc" }), "PROJECT_ENQUIRY");
  assert.equal(sourceForTakenOverDownload({ guideTitle: null, pageSource: null }), "CONTACT_FORM");
});

test("a lost or parked download starts over as New; an active one keeps its stage", () => {
  assert.equal(statusForTakenOverDownload("LOST"), "NEW");
  assert.equal(statusForTakenOverDownload("KEEP_CONTACT"), "NEW");
  assert.equal(statusForTakenOverDownload("NEW"), null);
  assert.equal(statusForTakenOverDownload("CONTACTED"), null);
});

test("downloads are out of the inbox, the board, the side lists and the nags", () => {
  const has = (w: unknown) => JSON.stringify(w).includes(JSON.stringify(EXCLUDE_GUIDE));
  assert.ok(has(inboxWhere()), "inbox");
  const user = { id: "u", isActive: true, role: "ADMIN", isOwner: true, canSeeColleagues: true, canEditColleagues: true } as Parameters<typeof boardWhere>[0];
  assert.ok(has(boardWhere(user, "all", new Date())), "board");
  assert.ok(has(sideWhere(user, "all")), "side lists");
  assert.ok((NAG_EXCLUDED_SOURCES as readonly string[]).includes("GUIDE_DOWNLOAD"), "nags and the overdue bar");
});
