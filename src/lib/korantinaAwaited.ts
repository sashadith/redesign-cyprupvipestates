// Korantina projects we maintain BY HAND until Korantina adds a folder for them
// to their SharePoint share (2026-10-15). Pure — imported by the sync
// (src/lib/sharepointAvailabilitySync.ts, src/app/api/cron/korantina-sync) and
// by the Action Center (rules/developers.ts) without pulling the PDF stack in.
//
// While an entry is here:
//  - every korantina-sync run (also the nights the weekly interval skips) lists
//    the share root and logs `korantina-awaited:<developmentId>` — ok while the
//    folder is missing, NOT ok (an Action Center item) once it exists;
//  - the sync never turns that folder into a draft of its own, so the manual
//    project is not duplicated by a second, auto-created one.
// Switching to the sync is a deliberate step: move the manual development onto
// the folder's feedKey (or archive it), then remove the entry here. Removing it
// also clears the Action Center item.

export type AwaitedFolder = {
  /** Project name as the operator knows it, used in the Action Center text. */
  label: string;
  /** The manual Development (dev "manual") that stands in until then. */
  developmentId: string;
  /** Tested against every folder name on a path, whitespace-normalised. */
  match: RegExp;
  /** Tested against a file name — catches the price list dropped into an EXISTING
   *  folder, where it would otherwise be read under that folder's feedKey (table
   *  ordinals restart per file, so AL_HR2.pdf page 1 would collide with AL_HR.pdf's
   *  "-t0" and overwrite Hill Residences' units). */
  fileMatch?: RegExp;
};

export const AWAITED_FOLDERS: AwaitedFolder[] = [
  // Price list 14 Oct 2026 + masterplan (Plot 268, Pegia) came by WhatsApp;
  // operator: "solange das projekt noch nicht in der korantina drive verfügbar
  // ist, werden wir es manuell verwalten". Must NOT match the existing
  // "Hill Residences & Hill Panorama by Cap St. Georges" folder.
  { label: "Hill Residences 2", developmentId: "220534ce-bd33-403d-9f54-66a5d4f8476f", match: /^hill\s+residences\s*(?:phase\s*)?(?:2|ii)(?![0-9a-z])/i, fileMatch: /^al[\s_-]*hr[\s_-]*2(?![0-9])/i },
];

export const AWAITED_JOB_PREFIX = "korantina-awaited:";

const norm = (s: string) => (s || "").replace(/\s+/g, " ").trim();

/** A share-root folder name, or a whole path ("/Folder/Sub/Availability/AL_HR2.pdf"):
 *  matches when any folder segment matches `match` or the last segment `fileMatch`. */
export function awaitedFolderFor(nameOrPath: string, list: AwaitedFolder[] = AWAITED_FOLDERS): AwaitedFolder | null {
  const segs = (nameOrPath || "").split("/").map(norm).filter(Boolean);
  const last = segs[segs.length - 1] ?? "";
  return list.find((a) => segs.some((s) => a.match.test(s)) || (!!a.fileMatch && a.fileMatch.test(last))) ?? null;
}

export type AwaitedCheck = { awaited: AwaitedFolder; folderName: string | null };

/** For every awaited project: the root folder or path that now stands for it, or
 *  null. Candidates = share-root folder names (checked nightly) plus any deeper
 *  paths the full sync held back (it walks the folders on its weekly run). */
export function checkAwaited(candidates: string[], list: AwaitedFolder[] = AWAITED_FOLDERS): AwaitedCheck[] {
  return list.map((awaited) => ({ awaited, folderName: candidates.find((f) => awaitedFolderFor(f, [awaited])) ?? null }));
}

export const awaitedMessage = (c: AwaitedCheck): string =>
  c.folderName
    ? `Korantina added "${norm(c.folderName)}" to their SharePoint share. "${c.awaited.label}" is still maintained by hand: switch it to the sync (move the manual project onto the folder's feedKey or archive it), then remove its entry in src/lib/korantinaAwaited.ts. Until then the sync leaves the folder alone.`
    : `No folder for "${c.awaited.label}" on Korantina's share yet — still maintained by hand.`;
