import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { isPublicLocale } from "@/lib/locale";
import { deferScripts, inlineStylesheets } from "@/lib/homeInline";

/* The homepage document, with its stylesheets inlined (see src/lib/homeInline.ts for the why).

   src/middleware.ts rewrites "/", "/de", "/pl", "/ru", "/he" to this handler for ordinary document requests;
   client-side navigations (RSC requests) still go to the static page home-static/[lang].

   The HTML is not rendered here: it is read from the file Next wrote for the ISR page
   (.next/server/app/home-static/<lang>.html — prerendered at build, rewritten in place on each revalidation),
   so content, metadata and structured data cannot drift from the page. The result is memoised per file mtime.
   A file nobody requests never revalidates, so once it is older than the page's revalidate window this handler
   pokes the real page route (stale-while-revalidate). If anything is missing or unreadable it falls back to
   fetching the page over loopback, un-inlined — slower, never broken. */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const REVALIDATE_SECONDS = 1800; // keep equal to `revalidate` in home-static/[lang]/page.tsx
type Entry = { mtimeMs: number; html: string; gz?: Buffer; br?: Buffer };
const memo = new Map<string, Entry>();
const lastPoke = new Map<string, number>();
const cssCache = new Map<string, string | null>();

const distDir = () => path.join(process.cwd(), ".next");

function readCss(href: string): string | null {
  if (cssCache.has(href)) return cssCache.get(href) ?? null;
  let css: string | null = null;
  try {
    // href = /_next/static/css/NAME.css ; the file name is content-hashed, so caching it forever is safe.
    css = fs.readFileSync(path.join(distDir(), href.replace(/^\/_next\//, "")), "utf8");
  } catch {
    css = null;
  }
  cssCache.set(href, css);
  return css;
}

function pokePage(lang: string) {
  const now = Date.now();
  if (now - (lastPoke.get(lang) ?? 0) < 60_000) return;
  lastPoke.set(lang, now);
  const port = process.env.PORT || "3000";
  fetch(`http://127.0.0.1:${port}/home-static/${lang}`, { cache: "no-store" }).catch(() => {});
}

const HEADERS = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": `public, s-maxage=${REVALIDATE_SECONDS}, stale-while-revalidate`,
  vary: "Accept-Encoding",
};

/* Next compresses page responses itself but NOT route-handler responses (measured: 608 KB went out raw), and the
   whole point of this route is a small first load — so compress here, once per file version, br > gzip. */
function respond(entry: Entry, acceptEncoding: string): Response {
  if (/\bbr\b/.test(acceptEncoding)) {
    entry.br ??= zlib.brotliCompressSync(Buffer.from(entry.html), { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 } });
    return new Response(new Uint8Array(entry.br), { headers: { ...HEADERS, "content-encoding": "br" } });
  }
  if (/\bgzip\b/.test(acceptEncoding)) {
    entry.gz ??= zlib.gzipSync(Buffer.from(entry.html), { level: 6 });
    return new Response(new Uint8Array(entry.gz), { headers: { ...HEADERS, "content-encoding": "gzip" } });
  }
  return new Response(entry.html, { headers: HEADERS });
}

async function loopbackHtml(lang: string): Promise<string | null> {
  try {
    const r = await fetch(`http://127.0.0.1:${process.env.PORT || "3000"}/home-static/${lang}`, { cache: "no-store" });
    return r.ok ? await r.text() : null;
  } catch {
    return null;
  }
}

export async function GET(req: Request, { params }: { params: { lang: string } }) {
  const { lang } = params;
  if (!isPublicLocale(lang)) return new Response("Not found", { status: 404 });

  const file = path.join(distDir(), "server", "app", "home-static", `${lang}.html`);
  try {
    const st = fs.statSync(file);
    let entry = memo.get(lang);
    if (!entry || entry.mtimeMs !== st.mtimeMs) {
      entry = { mtimeMs: st.mtimeMs, html: deferScripts(inlineStylesheets(fs.readFileSync(file, "utf8"), readCss)) };
      memo.set(lang, entry);
    }
    if (Date.now() - st.mtimeMs > (REVALIDATE_SECONDS - 120) * 1000) pokePage(lang);
    return respond(entry, req.headers.get("accept-encoding") || "");
  } catch {
    const html = await loopbackHtml(lang);
    if (html) return respond({ mtimeMs: 0, html }, req.headers.get("accept-encoding") || "");
    return new Response("Service temporarily unavailable", { status: 503, headers: { "retry-after": "5" } });
  }
}
