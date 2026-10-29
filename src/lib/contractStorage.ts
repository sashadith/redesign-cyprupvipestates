// Developer contract PDFs on disk (2026-10-29). Deliberately NOT under public/:
// public/uploads is served by nginx to anyone with the URL, a contract must
// only reach a signed-in manager through /api/admin/developer-contracts/[id].
// The default sits beside /var/www/shared-uploads so it survives every release
// swap the same way; CONTRACTS_DIR overrides it. A local dev server writes to
// the PRODUCTION database (.env.local tunnels to it) but cannot write here, so
// an upload from a laptop fails before any row exists that would point at a
// file the server does not have.
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const DIR = () => process.env.CONTRACTS_DIR || "/var/www/shared-contracts";
const KEY = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/;

function fileOf(key: string): string {
  // Keys come from the DB, never from a request — checked anyway, so a bad row
  // can never turn into a path outside the directory.
  if (!KEY.test(key)) throw new Error("Invalid contract file key");
  return path.join(DIR(), key);
}

export async function saveContractFile(buf: Buffer): Promise<string> {
  const key = `${randomUUID()}.pdf`;
  await mkdir(DIR(), { recursive: true, mode: 0o700 });
  await writeFile(fileOf(key), buf, { mode: 0o600, flag: "wx" });
  return key;
}

export const readContractFile = (key: string) => readFile(fileOf(key));

/** Moves the file to trash/ instead of deleting it — a removed contract can still be recovered by hand. */
export async function trashContractFile(key: string): Promise<void> {
  const trash = path.join(DIR(), "trash");
  await mkdir(trash, { recursive: true, mode: 0o700 });
  await rename(fileOf(key), path.join(trash, key)).catch((e) => {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  });
}
