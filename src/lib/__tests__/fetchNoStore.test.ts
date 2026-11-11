// Every server-side fetch of LIVE external data must pass `cache: "no-store"`.
//
// Why this is a test and not a convention (2026-11-11): Next.js replaces the
// global fetch, and a GET *or HEAD* that names no cache mode is written to
// .next/cache/fetch-cache with revalidate `false` — normalised to one year.
// Three details make it bite rather than warn:
//
//   1. `export const dynamic = "force-dynamic"` does NOT stop it. In a route
//      handler that flag only sets `forceDynamic`; what would disable the fetch
//      cache is `staticGenerationStore.revalidate === 0`, which Next sets when
//      the route module exports a non-static method (POST/PUT/PATCH/DELETE).
//      Every cron route here exports GET alone, so they are precisely the
//      routes at risk. (node_modules/next/dist/server/future/route-modules/
//      app-route/module.js, and server/lib/patch-fetch.js for the rest.)
//   2. Only a 200 is stored — so a cache can only ever make a check look
//      healthier or a listing look fuller than it is, never noisier.
//   3. deploy-prod.sh copies .next/cache forward between releases, so a frozen
//      answer survives every deploy and never expires on its own.
//
// That is how the OpenWA gateway's session read stayed "qr_ready" from 14:45
// UTC while the health watchdog paged about a gateway reconnected since 18:43,
// and how a Drive 401 was replayed for days in 2026-08 (see googleDrive.ts).
//
// Two layers below: per-module tests that inject a fake fetch and read the init
// each call actually sends, and a source sweep over every server-side file so a
// NEW direct fetch() cannot be added without deciding this. The sweep only sees
// literal `fetch(` calls — a client reached through an injected or aliased
// function (openwa/client.ts's `doFetch`) is invisible to it and needs its own
// module test, which is the other half of this file.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fetchAggProjects, downloadAggPricelist } from "@/lib/agg";
import { listFolder as spListFolder, downloadFile as spDownloadFile, type ShareContext } from "@/lib/sharepoint";
import { listSharedFolder, downloadSharedFile, getDropboxAccessToken } from "@/lib/dropbox";

type Call = { url: string; init: RequestInit | undefined };

/** Installs a fake global fetch, runs `fn`, restores, and returns what was sent. */
async function record(reply: (url: string, n: number) => Response, fn: () => Promise<unknown>): Promise<Call[]> {
  const calls: Call[] = [];
  const real = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return reply(String(url), calls.length - 1);
  }) as unknown as typeof fetch;
  try {
    await fn();
  } finally {
    globalThis.fetch = real;
  }
  return calls;
}

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

/** Asserts every recorded GET/HEAD opted out of Next's fetch cache. */
function allNoStore(calls: Call[], where: string): void {
  assert.ok(calls.length > 0, `${where}: no request was made, so nothing was asserted`);
  for (const c of calls) {
    const method = (c.init?.method ?? "GET").toUpperCase();
    if (method !== "GET" && method !== "HEAD") continue;
    assert.equal(c.init?.cache, "no-store", `${where}: ${method} ${c.url} would be cached for a year`);
  }
}

// ── agg.ts: agcyprus.com's WordPress REST API + the ShareOneDrive price list ──

test("agg: every WordPress REST read is no-store", async () => {
  // Empty taxonomies and an empty project list are enough — the point is the
  // init of each request, not what comes back.
  const calls = await record(() => json([]), () => fetchAggProjects("https://www.agcyprus.com"));
  assert.ok(calls.length >= 4, `expected the 3 taxonomy reads plus the project list, got ${calls.length}`);
  allNoStore(calls, "fetchAggProjects");
});

test("agg: the price-list PDF download is no-store", async () => {
  const pdf = () =>
    new Response(Buffer.from("%PDF-1.4 fake"), {
      status: 200,
      headers: { "content-type": "application/pdf", "content-disposition": 'attachment; filename="Projects Pricelist 031126 AF.pdf"' },
    });
  const ref = { account_id: "acct", drive_id: "drive", listtoken: "tok", base: "https://www.agcyprus.com/wp-admin/admin-ajax.php" };
  const calls = await record(pdf, () => downloadAggPricelist(ref, { id: "file-1", name: "Projects Pricelist 031126 AF.pdf" }));
  allNoStore(calls, "downloadAggPricelist");
});

// ── sharepoint.ts / dropbox.ts: the shared fetchWithRetry chokepoint ─────────

const SP_CTX: ShareContext = {
  origin: "https://contoso.sharepoint.com",
  cookie: "FedAuth=abc",
  driveId: "drive-1",
  rootId: "item-1",
  rootPath: "/sites/x/Shared Documents/Dev",
};

test("sharepoint: folder listings and downloads are no-store", async () => {
  const list = await record(() => json({ value: [] }), () => spListFolder(SP_CTX, "item-1"));
  allNoStore(list, "sharepoint listFolder");

  const dl = await record(() => new Response(Buffer.from("x"), { status: 200 }), () => spDownloadFile(SP_CTX, "item-2"));
  allNoStore(dl, "sharepoint downloadFile");
});

test("dropbox: listing, download and the token refresh are no-store", async () => {
  // Dropbox's calls are POSTs, which Next never caches; asserted anyway so a
  // switch to a GET endpoint cannot silently become cacheable.
  const list = await record(() => json({ entries: [], has_more: false }), () => listSharedFolder("https://www.dropbox.com/scl/fo/x", "", "tok"));
  for (const c of list) assert.equal(c.init?.cache, "no-store", `dropbox listSharedFolder: ${c.url}`);

  const dl = await record(() => new Response(Buffer.from("x"), { status: 200 }), () => downloadSharedFile("https://www.dropbox.com/scl/fo/x", "/a.pdf", "tok"));
  for (const c of dl) assert.equal(c.init?.cache, "no-store", `dropbox downloadSharedFile: ${c.url}`);

  const tok = await record(() => json({ access_token: "t" }), () => getDropboxAccessToken());
  for (const c of tok) assert.equal(c.init?.cache, "no-store", `dropbox token refresh: ${c.url}`);
});

test("sharepoint/dropbox: fetchWithRetry defaults the cache mode, it does not trust callers", () => {
  for (const file of ["src/lib/sharepoint.ts", "src/lib/dropbox.ts"]) {
    const src = readFileSync(join(process.cwd(), file), "utf8");
    assert.match(
      src,
      /fetch\(url, \{ \.\.\.init, cache: init\.cache \?\? "no-store" \}\)/,
      `${file}: fetchWithRetry must default cache to "no-store" so a new caller cannot omit it`,
    );
  }
});

// ── the sweep ────────────────────────────────────────────────────────────────

/* Comments and template literals blanked, quoted strings kept (the options
   object is read from the source, so "no-store" and "POST" must survive).
   Walks the characters rather than running regexes over the whole file, because
   "https://…" inside a string must not read as the start of a comment. */
function stripNoise(src: string): string {
  let out = "";
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === "\\") { out += src.slice(i, i + 2); i += 2; continue; }
    if (c === "/" && src[i + 1] === "/") { while (i < src.length && src[i] !== "\n") i++; continue; }
    if (c === "/" && src[i + 1] === "*") { const end = src.indexOf("*/", i + 2); i = end === -1 ? src.length : end + 2; out += " "; continue; }
    if (c === "`") {
      i++;
      let depth = 0;
      while (i < src.length) {
        if (src[i] === "\\") { i += 2; continue; }
        if (src[i] === "{" && src[i - 1] === "$") depth++;
        else if (src[i] === "}" && depth > 0) depth--;
        else if (src[i] === "`" && depth === 0) { i++; break; }
        i++;
      }
      out += '""';
      continue;
    }
    if (c === '"' || c === "'") {
      out += c;
      i++;
      while (i < src.length) {
        if (src[i] === "\\") { out += src.slice(i, i + 2); i += 2; continue; }
        out += src[i];
        const closed = src[i] === c;
        i++;
        if (closed) break;
      }
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/** The argument text of the call whose "(" is at `open`, parens balanced. */
function callArgs(src: string, open: number): string {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "(") depth++;
    else if (src[i] === ")") {
      depth--;
      if (depth === 0) return src.slice(open + 1, i);
    }
  }
  return src.slice(open + 1);
}

function serverSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "__tests__" || entry === "node_modules") continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) { out.push(...serverSourceFiles(p)); continue; }
    if (!/\.tsx?$/.test(entry)) continue;
    const src = readFileSync(p, "utf8");
    // The browser's fetch is not patched, so a client component is out of scope.
    if (/^\s*["']use client["']/m.test(src.slice(0, 200))) continue;
    out.push(p);
  }
  return out;
}

/* Calls the sweep cannot judge from one options object. Each needs a reason;
   an entry that stops matching is simply never used, so a fixed call does not
   fail the suite on the day it is fixed. */
const SWEEP_EXCEPTIONS: { file: string; args: string; why: string }[] = [
  {
    file: "src/lib/social/typefully.ts",
    args: "url, init",
    why: "the default fetchImpl forwards the init built in fetchPage, which sets cache: \"no-store\" (asserted below)",
  },
];

const WRITE_METHOD = /method:\s*["'](POST|PUT|PATCH|DELETE)["']/i;

test("sweep: every direct server-side fetch() of a GET/HEAD names a cache mode", () => {
  const roots = [join(process.cwd(), "src/lib"), join(process.cwd(), "src/app")];
  const offenders: string[] = [];
  let checked = 0;

  for (const root of roots) {
    for (const path of serverSourceFiles(root)) {
      const rel = relative(process.cwd(), path);
      const src = stripNoise(readFileSync(path, "utf8"));
      // Bare `fetch(` only: `client.fetch(`, `doFetch(` and `fetchImpl(` are
      // indirections the per-module tests cover.
      const re = /(?<![\w.$])fetch\s*\(/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(src))) {
        const args = callArgs(src, m.index + m[0].length - 1);
        if (WRITE_METHOD.test(args)) continue;
        checked++;
        if (/\bcache:/.test(args)) continue;
        if (SWEEP_EXCEPTIONS.some((e) => e.file === rel && args.trim() === e.args)) continue;
        const line = src.slice(0, m.index).split("\n").length;
        offenders.push(`${rel}:${line} — fetch(${args.trim().replace(/\s+/g, " ").slice(0, 90)})`);
      }
    }
  }

  assert.ok(checked > 5, `the sweep found only ${checked} cacheable fetch calls — it has stopped seeing the source`);
  assert.deepEqual(
    offenders,
    [],
    `these server-side GET/HEAD fetches would be cached for a year; add cache: "no-store" (or, if a stale answer is genuinely harmless, an entry in SWEEP_EXCEPTIONS saying why):\n  ${offenders.join("\n  ")}`,
  );
});

test("sweep: the typefully exception holds — fetchPage still sets no-store", () => {
  const src = readFileSync(join(process.cwd(), "src/lib/social/typefully.ts"), "utf8");
  const page = src.slice(src.indexOf("async function fetchPage"), src.indexOf("async function fetchStatus"));
  assert.match(page, /cache:\s*"no-store"/, "typefully's only request no longer opts out of the fetch cache");
});
