import test from "node:test";
import assert from "node:assert/strict";
import { resolveShortcuts, type RawDriveFile } from "../googleDrive";

/* A Drive shortcut ("Verknüpfung") is its own file type: it carries the target's
   id and mime type in shortcutDetails and nothing else. Until 2026-10-05
   listFolder fetched neither, so a shortcut was a file of an unknown type — not a
   folder the scanner would descend into, not a price list it would read. It fell
   through silently.

   This matters for the Misc Projects account: several small developers keep their
   own Drive folders, and the only way to gather them under one root the sync can
   read — without copying anything, and without a second folder column on the
   account — is a shortcut per developer inside a folder of ours. */

const FOLDER = "application/vnd.google-apps.folder";
const SHORTCUT = "application/vnd.google-apps.shortcut";
const SHEET = "application/vnd.google-apps.spreadsheet";

const file = (over: Partial<RawDriveFile>): RawDriveFile => ({
  id: "x", name: "x", mimeType: FOLDER, modifiedTime: "2026-01-01T00:00:00Z", ...over,
});

/** Target lookups, recorded so the tests can assert how many were made. */
function targets(map: Record<string, { mimeType: string; modifiedTime: string }>) {
  const asked: string[] = [];
  return {
    asked,
    get: async (id: string) => { asked.push(id); return map[id] ?? null; },
  };
}

test("passes ordinary files and folders through untouched", async () => {
  const t = targets({});
  const out = await resolveShortcuts(
    [file({ id: "f1", name: "Arie X", mimeType: FOLDER }), file({ id: "s1", name: "Prices.xlsx", mimeType: SHEET })],
    t.get,
  );
  assert.deepEqual(out.map((f) => [f.id, f.mimeType]), [["f1", FOLDER], ["s1", SHEET]]);
  assert.equal(t.asked.length, 0, "no target lookup for non-shortcuts");
});

test("a shortcut to a folder becomes that folder, under the name WE gave the shortcut", async () => {
  const t = targets({});
  const out = await resolveShortcuts(
    [file({ id: "sc", name: "Arie X — Hillside", mimeType: SHORTCUT, shortcutDetails: { targetId: "real", targetMimeType: FOLDER } })],
    t.get,
  );
  assert.equal(out.length, 1);
  // The id has to be the TARGET's: everything downstream lists children by it.
  assert.equal(out[0].id, "real");
  assert.equal(out[0].mimeType, FOLDER);
  // The name stays ours. The project name is derived from the folder name, and the
  // shortcut is the one piece of that we control without touching the developer's
  // own folder.
  assert.equal(out[0].name, "Arie X — Hillside");
  assert.equal(t.asked.length, 0, "a folder's own modifiedTime is never read, so no extra call");
});

test("a shortcut to a FILE takes the target's modifiedTime", async () => {
  // Not cosmetic: sourceSignature() keys the skip-this-sync decision on the price
  // list's modifiedTime. The shortcut's own timestamp never moves when the
  // developer edits the sheet behind it, so reading it would freeze the sync.
  const t = targets({ real: { mimeType: SHEET, modifiedTime: "2026-10-05T09:00:00Z" } });
  const out = await resolveShortcuts(
    [file({ id: "sc", name: "Price list", mimeType: SHORTCUT, modifiedTime: "2020-01-01T00:00:00Z", shortcutDetails: { targetId: "real", targetMimeType: SHEET } })],
    t.get,
  );
  assert.equal(out[0].modifiedTime, "2026-10-05T09:00:00Z");
  assert.deepEqual(t.asked, ["real"]);
});

test("a shortcut whose target cannot be read is dropped, not crashed on", async () => {
  // The developer revoked the share, or moved the folder to the bin. The entry
  // disappearing is what the admin's folder preview reports as a missing project —
  // far better than a half-read import.
  const t = targets({});
  const out = await resolveShortcuts(
    [file({ id: "sc", name: "Gone", mimeType: SHORTCUT, shortcutDetails: { targetId: "dead", targetMimeType: SHEET } })],
    t.get,
  );
  assert.deepEqual(out, []);
});

test("a shortcut with no target id is dropped", async () => {
  const t = targets({});
  const out = await resolveShortcuts([file({ id: "sc", name: "Broken", mimeType: SHORTCUT })], t.get);
  assert.deepEqual(out, []);
});

test("resolution is one level: a shortcut pointing at a shortcut is dropped", async () => {
  // Drive does not create these, but a hand-made copy can produce one, and
  // following it would mean an unbounded chase.
  const t = targets({});
  const out = await resolveShortcuts(
    [file({ id: "sc", name: "Chain", mimeType: SHORTCUT, shortcutDetails: { targetId: "sc2", targetMimeType: SHORTCUT } })],
    t.get,
  );
  assert.deepEqual(out, []);
});
