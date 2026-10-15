import { test } from "node:test";
import assert from "node:assert/strict";
import { AWAITED_FOLDERS, AWAITED_JOB_PREFIX, awaitedFolderFor, checkAwaited, awaitedMessage } from "@/lib/korantinaAwaited";
import { awaitedFolderItems } from "@/lib/actionCenter/rules/developers";

/* Hill Residences 2 is maintained by hand until Korantina adds its folder
   (2026-10-15). The current share root, for the negative cases, is the real
   list of their project folders. */
const CURRENT_ROOT = [
  "Hill Residences & Hill Panorama by Cap St. Georges", "Golden View", "Royal Bay Resort", "Soho Resort",
  "City Landmark", "Lara Residences 3", "Seascape", "Gardens View Villas", "Resale Ready Properties", "Unbranded brochures",
];
const HR2 = AWAITED_FOLDERS.find((a) => a.label === "Hill Residences 2")!;

test("the expected spellings of a new Hill Residences 2 folder are recognised", () => {
  for (const f of ["Hill Residences 2", "Hill Residences 2 by Cap St. Georges", "HILL RESIDENCES 2", " Hill  Residences  2 ", "Hill Residences II", "Hill Residences Phase 2", "Hill Residences2"]) {
    assert.equal(awaitedFolderFor(f)?.developmentId, HR2.developmentId, f);
  }
});

test("today's folders never match — above all the existing Hill Residences & Hill Panorama one", () => {
  for (const f of CURRENT_ROOT) assert.equal(awaitedFolderFor(f), null, f);
  for (const f of ["Hill Residences 20", "Hill Residences 3", "Hill Panorama 2", "Hill Residences"]) assert.equal(awaitedFolderFor(f), null, f);
});

test("the price list dropped into an EXISTING folder, or a subfolder named for it, is caught by path", () => {
  for (const p of [
    "/Hill Residences & Hill Panorama by Cap St. Georges/Availability/AL_HR2.pdf",
    "/Hill Residences & Hill Panorama by Cap St. Georges/Availability/AL-HR 2.pdf",
    "/Cap St Georges Resort/Hill Residences 2/Availability/Price list.pdf",
  ]) assert.equal(awaitedFolderFor(p)?.developmentId, HR2.developmentId, p);
  for (const p of [
    "/Hill Residences & Hill Panorama by Cap St. Georges/Availability/AL_HR.pdf",
    "/Hill Residences & Hill Panorama by Cap St. Georges/Availability/AL_HR20.pdf",
    "/Golden View Villas/Availability/AL_GV2.pdf",
  ]) assert.equal(awaitedFolderFor(p), null, p);
});

test("checkAwaited reports the folder once it is there, null before", () => {
  assert.equal(checkAwaited(CURRENT_ROOT).find((c) => c.awaited === HR2)!.folderName, null);
  const c = checkAwaited([...CURRENT_ROOT, "Hill Residences 2 by Cap St. Georges"]).find((x) => x.awaited === HR2)!;
  assert.equal(c.folderName, "Hill Residences 2 by Cap St. Georges");
  assert.match(awaitedMessage(c), /Korantina added "Hill Residences 2 by Cap St\. Georges"/);
});

const job = `${AWAITED_JOB_PREFIX}${HR2.developmentId}`;
const row = (ok: boolean, minutesAgo: number, message = "m") => ({ job, ok, ranAt: new Date(Date.now() - minutesAgo * 60_000), message });

test("Action Center: an item only while the NEWEST row says the folder is there", () => {
  assert.deepEqual(awaitedFolderItems([row(true, 1)]), []);
  const items = awaitedFolderItems([row(false, 1, "Korantina created the folder")]);
  assert.equal(items.length, 1);
  assert.equal(items[0].id, job);
  assert.equal(items[0].category, "DEVELOPERS");
  assert.equal(items[0].deepLink, `/admin/developments/${HR2.developmentId}`);
  assert.match(items[0].title, /Hill Residences 2/);
  assert.deepEqual(awaitedFolderItems([row(true, 1), row(false, 60)]), [], "newest row wins");
});

test("Action Center: rows for a project no longer awaited are ignored", () => {
  assert.deepEqual(awaitedFolderItems([{ job: `${AWAITED_JOB_PREFIX}00000000-gone`, ok: false, ranAt: new Date(), message: "x" }]), []);
});
