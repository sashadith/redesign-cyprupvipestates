import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { changedSince, removedSince } from "@/lib/bridge/query";
import { buildProject, type BridgeProject } from "@/lib/bridge/payload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 350 published projects today; seven pages. Sized by the 120,972 fs.stat
 *  calls a full export costs — 40,324 image references times three variants,
 *  re-measured on production 2026-10-09 from what the payload actually
 *  delivers — not by response bytes, which are one ordinary 3 MB gzipped
 *  response. If the catalogue doubles, lower this rather than letting the
 *  latency rise. */
const PAGE_SIZE = 50;

/**
 * Constant-time comparison of the presented key against the configured one.
 * Same shape as the public blog API's (src/lib/publicApi/auth.ts): the length
 * test comes first because timingSafeEqual throws on unequal-length buffers,
 * and the mismatch branch still burns one comparison over the same number of
 * bytes so the timing cannot separate "wrong length" from "wrong key".
 *
 * An UNSET XELLEX_API_KEY refuses every request. The inverse reading — no key
 * configured means no key required — is how a box that was deployed without
 * the env var ends up serving 25 developers' entire catalogues to whoever
 * guesses the path. This endpoint's wrong answers are the most expensive ones
 * in the feature, so the default is closed.
 */
function authorized(req: NextRequest): boolean {
  const expected = process.env.XELLEX_API_KEY;
  if (!expected) return false;
  const presented = Buffer.from(req.headers.get("x-api-key") ?? "", "utf8");
  const configured = Buffer.from(expected, "utf8");
  if (presented.length !== configured.length) {
    crypto.timingSafeEqual(configured, configured);
    return false;
  }
  return crypto.timingSafeEqual(presented, configured);
}

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
const CURSOR_VERSION = 1;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type DecodedCursor = { id: string; generatedAt: Date; since: Date | null };

function encodeCursor(generatedAt: Date, since: Date | null, lastId: string): string {
  const payload = {
    v: CURSOR_VERSION,
    g: generatedAt.toISOString(),
    s: since ? since.toISOString() : null,
    i: lastId,
  };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeCursor(raw: string): DecodedCursor | null {
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

/**
 * The read-only bridge to Xellex, the operator's second public portal.
 * Spec: docs/superpowers/specs/2026-10-09-xellex-bridge-design.md
 *
 * Auth is a HEADER, deliberately unlike the cron routes' `?key=` — those run
 * from a local crontab, while this key lives in a third system and would
 * otherwise be written into every access log, proxy log and Referer along the
 * way.
 */
export async function GET(req: NextRequest) {
  const started = Date.now();
  if (!authorized(req)) {
    // The fact, never the value: a near-miss key in a log line is a leaked
    // key, and that holds for a truncated or hashed one too. Deliberately not
    // a CronRunLog row either — this path is reachable by anyone on the
    // internet, and giving unauthenticated traffic a write into the table the
    // Action Center reads would be a self-inflicted flood. Every
    // authenticated outcome below is logged.
    console.warn("[xellex-bridge] unauthorized request refused");
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const params = req.nextUrl.searchParams;
  const sinceRaw = params.get("updatedSince");
  const cursorRaw = params.get("cursor");

  let since: Date | null = null;
  if (sinceRaw) {
    const d = new Date(sinceRaw);
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: "updatedSince is not a valid ISO 8601 timestamp" }, { status: 400 });
    }
    since = d;
  }

  // ONE generatedAt per RUN, not per page, carried inside the cursor and
  // echoed on every page.
  //
  // A project that newly starts qualifying partway through a paginated run,
  // with an id below the cursor already passed, is skipped by that run —
  // paging is ordered by id and that id is already behind us. It is recovered
  // only if the consumer's next updatedSince is the FIRST page's stamp.
  // Restamping per page (this route's first draft) therefore hands a consumer
  // that keeps the LAST page's stamp a window beginning after the skipped row
  // went behind the cursor, and that row is then lost permanently, silently,
  // with no error anywhere. Echoing the run's stamp on every page makes "keep
  // the last one you were sent" correct, which is the only thing a client is
  // actually going to do.
  //
  // Taken BEFORE the queries on the first page, for the same reason: a change
  // landing while this request runs must fall inside the consumer's NEXT
  // window, not vanish between the two.
  let cursorId: string | null = null;
  let generatedAt = new Date();
  if (cursorRaw) {
    const decoded = decodeCursor(cursorRaw);
    if (!decoded) {
      return NextResponse.json({ error: "cursor is not one this endpoint issued" }, { status: 400 });
    }
    // The cursor remembers which run it belongs to. Continuing one run's
    // cursor under a different updatedSince would quietly mix two windows,
    // which is the same lost-row failure the run stamp exists to prevent —
    // so it is an error the consumer can see rather than a wrong answer.
    if ((decoded.since?.getTime() ?? null) !== (since?.getTime() ?? null)) {
      return NextResponse.json(
        { error: "cursor belongs to a run with a different updatedSince; restart the run without a cursor" },
        { status: 400 },
      );
    }
    cursorId = decoded.id;
    generatedAt = decoded.generatedAt;
  }

  try {
    const rows = await changedSince(since, cursorId, PAGE_SIZE + 1);
    const page = rows.slice(0, PAGE_SIZE);
    const complete = rows.length <= PAGE_SIZE;
    const projects: BridgeProject[] = [];
    for (const row of page) projects.push(await buildProject(row));

    // Removals belong to the whole sync, not to a page: sent once, on the last
    // page, so a consumer that stops paginating early never acts on a partial
    // removal list. Meaningless without `since` — on a full export everything
    // absent is removed by definition.
    const removed = complete && since ? await removedSince(since) : [];
    const lastId = page.length ? page[page.length - 1].id : null;

    const body = {
      generatedAt: generatedAt.toISOString(),
      complete,
      cursor: complete || !lastId ? null : encodeCursor(generatedAt, since, lastId),
      projects,
      removed,
    };

    await prisma.cronRunLog.create({
      data: {
        job: "xellex-bridge",
        ok: true,
        // run= is the whole point of logging a page at all: it is the one
        // field that stitches the seven rows of one sync back together.
        message: `${since ? "incremental" : "full"}: ${projects.length} projects, ${removed.length} removed, complete=${complete}, run=${generatedAt.toISOString()}`,
        durationMs: Date.now() - started,
      },
    });

    return NextResponse.json(body);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await prisma.cronRunLog
      .create({ data: { job: "xellex-bridge", ok: false, message: message.slice(0, 500), durationMs: Date.now() - started } })
      .catch(() => {});
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
