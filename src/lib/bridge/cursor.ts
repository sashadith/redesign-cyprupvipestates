// The opaque pagination cursor for the Xellex bridge (/api/bridge/projects).
//
// Lives in its own module rather than inside the route for one reason: it is a
// pure codec with no request, no DB and no filesystem, so `npm test` can hold
// it to its contract. That contract is not cosmetic — see the generatedAt note
// below — and it was first verified by slicing the source out of the route into
// a scratchpad file, which nobody would ever have run again.
// Tests: src/lib/__tests__/bridgeCursor.test.ts

/**
 * The cursor carries the RUN's generatedAt, not only the last id of the page.
 *
 * Opaque by contract — base64 of a tiny JSON object — so a consumer cannot
 * read the id out of it and start paging by hand. Deliberately not signed:
 * every field in it is the caller's own sync position, the WHERE clause and
 * the field allowlist are server-side, and a caller who forges one can only
 * corrupt its own window. It is validated rather than trusted all the same,
 * so a mangled or hand-written cursor is a clean 400 instead of a 500 or,
 * worse, a silently wrong window.
 *
 * Buffer.from(…, "base64url") does not throw on garbage, it discards the
 * invalid bytes — so JSON.parse and the field checks below are the real gate,
 * not the decode.
 */
export const CURSOR_VERSION = 1;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type DecodedCursor = { id: string; generatedAt: Date; since: Date | null };

export function encodeCursor(generatedAt: Date, since: Date | null, lastId: string): string {
  // Validate on the way OUT as well as in. decodeCursor rejects anything that
  // is not a UUID; all 437 Development ids are UUIDs today, but a single
  // hand-created id from an import script would make the page AFTER that row a
  // hard 400 and kill the rest of that run's pagination. Failing here instead
  // turns a silent dead end into one error naming the row.
  if (!UUID_RE.test(lastId)) throw new Error(`bridge cursor: id is not a UUID: ${lastId}`);
  const payload = {
    v: CURSOR_VERSION,
    g: generatedAt.toISOString(),
    s: since ? since.toISOString() : null,
    i: lastId,
  };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeCursor(raw: string): DecodedCursor | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const c = parsed as Record<string, unknown>;
  if (c.v !== CURSOR_VERSION) return null;
  if (typeof c.i !== "string" || !UUID_RE.test(c.i)) return null;
  if (typeof c.g !== "string") return null;
  const generatedAt = new Date(c.g);
  if (Number.isNaN(generatedAt.getTime())) return null;
  let since: Date | null = null;
  if (c.s !== null) {
    if (typeof c.s !== "string") return null;
    since = new Date(c.s);
    if (Number.isNaN(since.getTime())) return null;
  }
  return { id: c.i, generatedAt, since };
}
