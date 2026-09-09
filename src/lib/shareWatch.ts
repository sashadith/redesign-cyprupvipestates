import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { openShare, listTree, isFolder } from "@/lib/sharepoint";

/* A watcher, deliberately not a connector.
 *
 * Marfields (2026-09-09) shares a SharePoint folder that reads like a feed and
 * behaves like an archive: 303 files, 10.89 GB, ZERO changed in the last 30
 * days and two in the last 90 — and those two are duplicates of each other.
 * Only two of its four projects carry a price list at all, one of which
 * ("NCPR Price List July 26.pdf") was last modified in February.
 *
 * A sync adapter's value is proportional to how often its source moves, and
 * this one moves two to four times a year. So this does the one useful thing an
 * adapter would have done — tell the operator WHEN something changed — and
 * none of the expensive ones: it never parses a price list, never mirrors a
 * byte of the 10.89 GB, and never writes a Development. When it fires, a human
 * reconciles the changed file by hand.
 *
 * Add a share here to watch it; nothing else needs touching.
 */
export type WatchedShare = { key: string; label: string; url: string };

export const WATCHED_SHARES: WatchedShare[] = [
  {
    key: "marfields",
    label: "Marfields",
    url: "https://marfields-my.sharepoint.com/:f:/p/j_kopeikina/IgA0ayymvc0yT4Nmjbpgz0yAAeIApQUcQFyendkIJ_BM5S8?e=1oTo0d",
  },
];

/** One file as the snapshot records it. Folders are not recorded: an empty
    folder appearing or vanishing is not news, and a folder's own modifiedTime
    changes whenever anything below it does, which would report every parent of
    every edit. */
export type ShareEntry = { path: string; modified: string; size: number };

export type ShareChanges = {
  added: string[];
  changed: string[];
  removed: string[];
  /** Files seen this run. */
  total: number;
  /** No previous snapshot existed — the baseline was stored and nothing is reported. */
  firstRun: boolean;
};

/**
 * What changed between two snapshots.
 *
 * Keyed by PATH, not by SharePoint item id. A file re-uploaded under the same
 * name gets a new id, which by id would read as one removal plus one addition —
 * two lines for what a human calls "they updated the price list". By path it
 * reads as one change, which is the thing worth being told. The cost is that a
 * rename shows up as a removal and an addition; that is the rarer event and the
 * honest way to describe it anyway.
 *
 * Pure, so the reporting can be tested without a network — see
 * scripts/qa/share-watch-check.mjs.
 */
export function diffSnapshots(previous: ShareEntry[] | null, next: ShareEntry[]): ShareChanges {
  if (previous === null) return { added: [], changed: [], removed: [], total: next.length, firstRun: true };
  const before = new Map(previous.map((e) => [e.path, e]));
  const after = new Map(next.map((e) => [e.path, e]));
  const added: string[] = [];
  const changed: string[] = [];
  for (const [path, e] of Array.from(after)) {
    const old = before.get(path);
    if (!old) { added.push(path); continue; }
    // Size as well as timestamp: SharePoint has been seen to leave
    // modifiedTime untouched on a same-name overwrite, and a changed size is
    // then the only evidence the content moved.
    if (old.modified !== e.modified || old.size !== e.size) changed.push(path);
  }
  const removed = previous.filter((e) => !after.has(e.path)).map((e) => e.path);
  return { added: added.sort(), changed: changed.sort(), removed: removed.sort(), total: next.length, firstRun: false };
}

/** True when there is something worth sending. */
export const hasChanges = (c: ShareChanges) =>
  !c.firstRun && (c.added.length > 0 || c.changed.length > 0 || c.removed.length > 0);

/* Snapshots live under public/uploads, which is a symlink to a directory
   shared across releases (verified on the host, 2026-09-09) — a release-local
   path would lose the baseline on every deploy and report the whole share as
   new. */
const snapshotDir = () => join(process.cwd(), "public", "uploads", ".share-watch");
const snapshotPath = (key: string) => join(snapshotDir(), `${key}.json`);

export async function readSnapshot(key: string): Promise<ShareEntry[] | null> {
  try {
    const raw = await readFile(snapshotPath(key), "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ShareEntry[]) : null;
  } catch {
    return null; // absent or unreadable — treated as a first run, never as "everything vanished"
  }
}

export async function writeSnapshot(key: string, entries: ShareEntry[]): Promise<void> {
  await mkdir(snapshotDir(), { recursive: true });
  await writeFile(snapshotPath(key), JSON.stringify(entries), "utf8");
}

/** Walks the share and returns its files. Read-only; downloads nothing. */
export async function listShareEntries(url: string): Promise<ShareEntry[]> {
  const ctx = await openShare(url);
  const tree = await listTree(ctx, ctx.rootId, { maxDepth: 4 });
  return tree
    .filter((t) => !isFolder(t.file))
    .map((t) => ({ path: t.path, modified: t.file.modifiedTime ?? "", size: t.file.size ?? 0 }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

export type ShareWatchResult = { share: WatchedShare; changes: ShareChanges };

/**
 * Checks one share and stores the new baseline.
 *
 * The baseline is written even when nothing changed, so a run that failed
 * halfway cannot make the next one report a stale diff — and on the very first
 * run it is written INSTEAD of reporting, because 303 "added" lines for a
 * folder nobody has watched before is noise, not news.
 */
export async function checkWatchedShare(share: WatchedShare): Promise<ShareWatchResult> {
  const entries = await listShareEntries(share.url);
  const previous = await readSnapshot(share.key);
  const changes = diffSnapshots(previous, entries);
  await writeSnapshot(share.key, entries);
  return { share, changes };
}
