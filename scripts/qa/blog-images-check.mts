// Testbed check for the blog tools' image fields (2026-11-09). Calls the REAL
// MCP tool handlers (blog_get_article, blog_list_articles,
// render_instagram_carousel) against the disposable testbed DB, then renders
// a "cyprus" carousel from exactly the URLs the blog tools returned.
//
//   cd /opt/cvp-testbed/repo && set -a && source /opt/cvp-testbed/.env.testbed && set +a
//   SOCIAL_UPLOADS_ROOT=<temp dir holding images/<the 4 files>> npx tsx scripts/qa/blog-images-check.mts
//
// The carousel output lands under SOCIAL_UPLOADS_ROOT/social/, never in the
// live uploads. The guard below refuses to run against the production DB.
// @ts-expect-error — plain .mjs module without a declaration file
import { assertNotProdDb } from "../assert-not-prod-db.mjs";
assertNotProdDb();
import { promises as fs } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { registerBlogGetArticle } from "@/lib/mcp/tools/blogGetArticle";
import { registerBlogListArticles } from "@/lib/mcp/tools/blogListArticles";
import { registerRenderInstagramCarousel } from "@/lib/mcp/tools/renderInstagramCarousel";

if (!process.env.SOCIAL_UPLOADS_ROOT) { console.error("set SOCIAL_UPLOADS_ROOT to a temp dir (the live uploads must not be written)"); process.exit(1); }

const handlers = new Map<string, (input: any, ctx: any) => Promise<any>>();
const server = { registerTool: (name: string, _def: unknown, h: any) => handlers.set(name, h) } as any;
registerBlogGetArticle(server);
registerBlogListArticles(server);
registerRenderInstagramCarousel(server);
const admin = await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } });
const ctx = { http: { authInfo: { extra: { userId: admin?.id ?? "qa", userName: "qa", tokenId: "qa-blog-images" } } } };
const call = async (name: string, input: any) => {
  const r = await handlers.get(name)!(input, ctx);
  const data = JSON.parse(r.content[0].text);
  if (r.isError) throw new Error(`${name}: ${JSON.stringify(data)}`);
  return data;
};

let failures = 0;
const check = (ok: boolean, msg: string) => { console.log(`${ok ? "✓" : "✗"} ${msg}`); if (!ok) failures++; };
const ABS = /^https:\/\/cyprusvipestates\.com\/uploads\/images\/[^?#]+$/;

const cases = [
  { slug: "tax-residency-in-cyprus", body: 0 },
  { slug: "how-to-get-permanent-residence-in-cyprus", body: 2 },
];
const list = await call("blog_list_articles", { locale: "en", limit: 200, page: 1 });
const all: string[] = [];
for (const c of cases) {
  const a = await call("blog_get_article", { slug: c.slug, locale: "en" });
  console.log(`  ${c.slug}: cover ${a.coverImageUrl}; body ${JSON.stringify(a.bodyImageUrls)}`);
  check(typeof a.coverImageUrl === "string" && ABS.test(a.coverImageUrl), `${c.slug}: coverImageUrl is an absolute /uploads/images/ URL`);
  check(Array.isArray(a.bodyImageUrls) && a.bodyImageUrls.length === c.body && a.bodyImageUrls.every((u: string) => ABS.test(u)), `${c.slug}: ${c.body} body image(s), absolute`);
  const inBody = [...a.body.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map((m) => m[1]);
  check(JSON.stringify([...new Set(inBody)]) === JSON.stringify(a.bodyImageUrls), `${c.slug}: bodyImageUrls match the body's images in order`);
  const entry = list.articles.find((e: any) => e.locales.en !== "missing" && e.locales.en.slug === c.slug);
  check(!!entry && entry.locales.en.coverImageUrl === a.coverImageUrl && JSON.stringify(entry.locales.en.bodyImageUrls) === JSON.stringify(a.bodyImageUrls), `${c.slug}: blog_list_articles carries the same images`);
  for (const u of [a.coverImageUrl, ...a.bodyImageUrls]) {
    const status = (await fetch(u, { method: "HEAD" }).catch(() => ({ status: -1 }))).status;
    check(status === 200, `live HEAD ${u} → ${status}`);
    all.push(u);
  }
}
const missingShape = list.articles.filter((e: any) => Object.values(e.locales).some((v: any) => v !== "missing" && (!("coverImageUrl" in v) || !Array.isArray(v.bodyImageUrls))));
check(missingShape.length === 0, `every listed locale has coverImageUrl + bodyImageUrls (${list.articles.length} articles on the page)`);
const withCover = list.articles.filter((e: any) => e.locales.en !== "missing" && e.locales.en.coverImageUrl).length;
console.log(`  EN covers on this page: ${withCover}/${list.articles.length}`);

// Carousel from exactly these URLs (the reference cyprus fixture, images swapped in).
const fixture = JSON.parse(await fs.readFile(path.join(process.cwd(), "scripts/qa/fixtures/carousel/zypern-warum-de.json"), "utf8"));
let i = 0;
const swap = (v: any): any => typeof v === "string" && v.startsWith("@") ? all[i++ % all.length] : Array.isArray(v) ? v.map(swap) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, swap(x)])) : v;
const input = { ...swap(fixture), slug: "qa-blog-images" };
const out = await call("render_instagram_carousel", input);
check(Array.isArray(out.slides) && out.slides.length === 6, `render_instagram_carousel accepted the blog URLs: ${out.slides?.length} slides, preview ${out.preview ?? out.previewUrl}`);
const folder = path.join(process.env.SOCIAL_UPLOADS_ROOT, out.folder.replace(/^\/uploads\//, ""));
const files = await fs.readdir(folder);
check(files.filter((f) => f.endsWith(".jpg")).length >= 6, `slides written to the temp root (${folder}): ${files.join(", ")}`);

await prisma.$disconnect();
console.log(failures ? `\n${failures} check(s) FAILED` : "\nall checks passed");
process.exit(failures ? 1 : 0);
