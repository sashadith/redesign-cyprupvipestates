// Testbed verification of render_instagram_carousel (2026-11-05). ONLY on /opt/cvp-testbed:
//
//   cd /opt/cvp-testbed/repo && set -a && . /opt/cvp-testbed/.env.testbed && set +a && \
//     SOCIAL_UPLOADS_ROOT=/opt/cvp-testbed/carousel-qa/uploads \
//     node --import tsx scripts/qa/carousel-testbed.mts /opt/cvp-testbed/carousel-qa/out
//
// 1. crm_get_project (getProjectData) for Soho Resort East Tower: gallery / amenities /
//    vatNote, gallery order against the live public page; an unpublished project gets null.
// 2. Stage A: the approved original HTML files, unchanged, in this Chromium → pixel diff
//    against reference-renders/ (proves fonts + browser reproduce the approved output).
// 3. Stage B: the three carousels rendered from data (fixtures = the reference texts,
//    images = the real /uploads files) → element geometry vs. Stage A (tolerance 3 px)
//    and pixel diff vs. the reference, with a heatmap per slide.
// 4. Failure paths: too-long headline, rejected images, the 60 s timeout with a real
//    Chromium; afterwards no Chromium of ours may be left and the lock must be gone.
// Writes report.json and side-by-side sheets into <out>. The source images are COPIED
// (read-only) from /var/www/shared-uploads; nothing is ever written under /var/www.
import { assertNotProdDb } from "../assert-not-prod-db.mjs";
assertNotProdDb();

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import sharp from "sharp";
import { compareGeometry, compareImages } from "./carousel-compare.mjs";
import { getProjectData } from "@/lib/mcp/tools/getProject";
import { RenderInput } from "@/lib/social/carousel/schema";
import { renderCarousel } from "@/lib/social/carousel/render";
import { prisma } from "@/lib/prisma";

const OUT = process.argv[2];
const ROOT = process.env.SOCIAL_UPLOADS_ROOT || "";
if (!OUT || !ROOT) throw new Error("usage: SOCIAL_UPLOADS_ROOT=<dir> carousel-testbed.mts <out dir>");
for (const p of [OUT, ROOT]) if (path.resolve(p).startsWith("/var/www")) throw new Error(`refusing to write under /var/www: ${p}`);
const SHARED = "/var/www/shared-uploads";
const T = path.join(process.cwd(), "assets", "social-templates");
const POSTING = "2026-11-16"; // ISO week 47 — a folder no real post uses yet
// The testbed shares the VPS with production: its own lock, so it never blocks a real render.
process.env.CAROUSEL_LOCK_FILE ??= path.join(path.dirname(path.resolve(OUT)), "cve-carousel.lock");
const LOCK = process.env.CAROUSEL_LOCK_FILE;
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(ROOT, { recursive: true });

const report: Record<string, unknown> = { startedAt: new Date().toISOString(), chromium: null };
const failures: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) failures.push(what); console.log(`${ok ? "✓" : "✗"} ${what}`); };
// The bracket keeps pgrep from matching this very shell, whose command line holds the pattern.
// (A production render running at the same moment would show up here too.)
const ours = () => execFileSync("sh", ["-c", "pgrep -fa 'cve-carousel-ru[n]=' || true"], { encoding: "utf8" }).trim();
const tmpLeft = () => fs.readdirSync(os.tmpdir()).filter((f) => /^cve-carousel-|^playwright[-_]/.test(f));
// tsx can load a module once as ESM and once as CJS, so instanceof is unreliable here; the class name is not.
const isErr = (e: unknown, name: string, code?: string) => (e as any)?.constructor?.name === name && (code === undefined || (e as any).code === code);

// ---------------------------------------------------------------- 1. crm_get_project
const soho = (await getProjectData({ slug: "soho-resort-east-tower" })) as any;
const gallery: string[] = soho.gallery ?? [];
check(soho.publishStatus === "published", "Soho Resort East Tower is published in the testbed copy");
check(gallery.length > 0 && gallery.length <= 40, `gallery has 1–40 entries (${gallery.length})`);
check(gallery.every((u) => u.startsWith("https://cyprusvipestates.com/uploads/")), "every gallery URL is one of our /uploads URLs");
check(Array.isArray(soho.amenities) && soho.amenities.length > 0, `amenities present (${soho.amenities?.length})`);
check(soho.vatNote === null, "vatNote is null until an admin sets it");
const hash = (u: string) => (u.match(/\/([0-9a-f]{16})_(?:small|medium|large)\./) || [])[1];
const live = execFileSync("curl", ["-sL", "https://cyprusvipestates.com/projects/soho-resort-east-tower"], { encoding: "utf8", maxBuffer: 20 << 20 });
const liveOrder = [...new Set([...live.matchAll(/\/uploads\/developments\/[^"'\s?,]+/g)].map((m) => hash(m[0])).filter(Boolean))];
const ourOrder = gallery.map(hash);
// First appearance on the live page (hero + gallery come before unit photos and plans).
check(JSON.stringify(liveOrder.filter((h) => ourOrder.includes(h))) === JSON.stringify(ourOrder), `gallery order = live page order (${ourOrder.length} images)`);
const draft = await prisma.development.findFirst({ where: { publishStatus: { not: "published" } }, select: { id: true } });
if (draft) {
  const d = (await getProjectData({ developmentId: draft.id })) as any;
  check(d.gallery === null && d.amenities === null && d.vatNote === null, "an unpublished project gets gallery/amenities/vatNote = null");
}
report.getProject = { gallery, amenities: soho.amenities, vatNote: soho.vatNote, units: soho.units?.total, rowKeys: Object.keys(soho.units?.rows?.[0] ?? {}) };
check(!("amenities" in (soho.units?.rows?.[0] ?? {})), "unit rows do not carry the unit features");

// Copy the gallery files into the testbed uploads root (copies, never links).
for (const u of gallery) {
  const rel = new URL(u).pathname.replace(/^\/uploads\//, "");
  const dst = path.join(ROOT, rel);
  if (!fs.existsSync(dst)) { fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(path.join(SHARED, rel), dst); }
}
fs.mkdirSync(path.join(ROOT, "qa-carousel", "blog"), { recursive: true });
for (const f of ["harbour.jpg", "dinner.jpg", "lounge.jpg", "blog/b2.jpg", "blog/b4.jpg"]) fs.copyFileSync(path.join(T, "sample-images", f), path.join(ROOT, "qa-carousel", f));

// The fixtures name images by the zip's sample file; map each to the gallery file with the
// same hash, the hero (sample "soho.jpg") to the gallery image that looks most like it.
const thumb = async (file: string) => (await sharp(file).resize(32, 40, { fit: "fill" }).greyscale().raw().toBuffer());
const sohoThumb = await thumb(path.join(T, "sample-images", "soho.jpg"));
let heroUrl = "", best = Infinity;
for (const u of gallery) {
  const t = await thumb(path.join(ROOT, new URL(u).pathname.replace(/^\/uploads\//, "")));
  let d = 0; for (let i = 0; i < t.length; i++) d += Math.abs(t[i] - sohoThumb[i]);
  if (d < best) { best = d; heroUrl = u; }
}
report.heroMatch = { heroUrl, meanDiff: +(best / sohoThumb.length).toFixed(1) };
const mapImg = (name: string) => {
  if (name === "soho") return heroUrl;
  const g = gallery.find((u) => u.includes(`/${name}_`));
  if (g) return g;
  return `https://cyprusvipestates.com/uploads/qa-carousel/${name.replace(/^blog-/, "blog/")}.jpg`;
};
const resolveFixture = (v: any): any => (typeof v === "string" && v.startsWith("@") ? mapImg(v.slice(1)) : Array.isArray(v) ? v.map(resolveFixture) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, resolveFixture(x)])) : v);
const fixture = (n: string) => resolveFixture(JSON.parse(fs.readFileSync(path.join("scripts/qa/fixtures/carousel", `${n}.json`), "utf8")));

// ---------------------------------------------------------------- 2. Stage A — the approved originals
const SETS = [
  { fixture: "soho-east-tower-en", ref: "soho-east-tower", original: "project-dark-en.html" },
  { fixture: "soho-east-tower-de", ref: "soho-east-tower-de", original: "project-dark-de.html" },
  { fixture: "zypern-warum-de", ref: "zypern-warum-de", original: "cyprus-light-de.html" },
];
const stageA: Record<string, unknown[]> = {};
for (const s of SETS) {
  const dir = path.join(OUT, "stageA", s.ref);
  fs.mkdirSync(dir, { recursive: true });
  const slides = [0, 1, 2, 3, 4, 5].map((i) => ({ file: path.join(T, "templates", s.original), raw: true, clipY: i * 1350 }));
  if (s.ref === "zypern-warum-de") slides[5] = { file: path.join(T, "templates", "cyprus-light-de-slide6-final.html"), raw: true, clipY: 0 };
  fs.writeFileSync(path.join(dir, "job.json"), JSON.stringify({ renderId: `qa-a-${s.ref}`, dir, slides }));
  const res = JSON.parse(execFileSync(process.execPath, ["scripts/social/carousel-worker.mjs", path.join(dir, "job.json")], { encoding: "utf8" }).trim().split("\n").pop()!);
  if (!res.ok) throw new Error(`stage A ${s.ref}: ${JSON.stringify(res)}`);
  stageA[s.ref] = res.slides.map((x: any) => x.geometry);
  const px = [];
  for (let i = 1; i <= 6; i++) px.push({ slide: i, ...(await compareImages(path.join(T, "reference-renders", `${s.ref}-0${i}.jpg`), path.join(dir, `slide-${i}.png`), path.join(dir, `heat-${i}.jpg`))) });
  (report.stageA ??= {} as any)[s.ref] = px.map((p) => ({ slide: p.slide, meanDiff: p.meanDiff, hotBlocks: p.hotBlocks, regions: p.regions.slice(0, 6) }));
  console.log(`stage A ${s.ref}: mean ${px.map((p) => p.meanDiff).join(" / ")}`);
}

// ---------------------------------------------------------------- 3. Stage B — rendered from data
const sheets: string[] = [];
for (const s of SETS) {
  const input = RenderInput.parse(fixture(s.fixture)) as any;
  const t0 = Date.now();
  const r = await renderCarousel(input, { withGeometry: true });
  const secs = (Date.now() - t0) / 1000;
  const folder = path.join(ROOT, r.folder.replace(/^\/uploads\//, ""));
  const slides = [];
  for (let i = 1; i <= 6; i++) {
    const heat = path.join(OUT, `${s.fixture}-heat-${i}.jpg`);
    const px = await compareImages(path.join(T, "reference-renders", `${s.ref}-0${i}.jpg`), path.join(folder, `0${i}.jpg`), heat);
    const geo = compareGeometry(stageA[s.ref][i - 1] as any, (r.geometry as any)[i - 1], 3);
    // Accepted by the operator (2026-11-05): rule 2 is exactly 44 px on every slide, while the
    // approved templates keep 39–43 px. Moving the eyebrow block up by exactly that difference
    // (eyebrow / "Prices from", its glass panel, and the photo that follows the text) is intended.
    const rule2Shift = r.report[i - 1].eyebrowGap !== null ? r.report[i - 1].eyebrowGap! - (r.report[i - 1].templateEyebrowGap ?? 44) : 0;
    const RULE2_MOVES = ["div.eyebrow", "div.h-from", "div.j-glass", "div.ph"];
    const accepted = geo.length > 0 && rule2Shift > 0 && geo.every((g: any) => g.delta && RULE2_MOVES.includes(g.k) && g.delta.x === 0 && Math.abs(g.delta.w) <= 0.5 && (g.k === "div.ph" ? Math.abs(g.delta.h) <= rule2Shift + 1 : -g.delta.y <= rule2Shift + 1));
    slides.push({ slide: i, ...r.report[i - 1], meanDiff: px.meanDiff, hotBlocks: px.hotBlocks, regions: px.regions.slice(0, 6), geometryOver3px: geo, acceptedRule2: accepted ? rule2Shift : null });
    // ref | render | heatmap, half size
    const tiles = await Promise.all([path.join(T, "reference-renders", `${s.ref}-0${i}.jpg`), path.join(folder, `0${i}.jpg`), heat].map((f) => sharp(f).resize(540, 675).toBuffer()));
    const sheet = path.join(OUT, `${s.fixture}-0${i}-compare.jpg`);
    await sharp({ create: { width: 1640, height: 675, channels: 3, background: "#ffffff" } }).composite(tiles.map((input, k) => ({ input, left: k * 550, top: 0 }))).jpeg({ quality: 82 }).toFile(sheet);
    sheets.push(sheet);
  }
  (report.stageB ??= {} as any)[s.fixture] = { seconds: secs, urls: r.slides, preview: r.preview, folder: r.folder, slides };
  for (const x of slides) {
    const detail = x.geometryOver3px.map((g: any) => `${g.k} ${JSON.stringify(g.delta ?? g.detail)}`).join("; ");
    if (x.acceptedRule2 !== null) console.log(`✓ ${s.fixture} slide ${x.slide}: ACCEPTED rule-2 shift of ${x.acceptedRule2} px (template ${x.templateEyebrowGap} px → 44 px) — ${detail}`);
    else check(x.geometryOver3px.length === 0, `${s.fixture} slide ${x.slide}: every element within 3 px of the approved layout${detail ? " — " + detail : ""}`);
  }
  check(ours() === "", `${s.fixture}: no Chromium left after the render`);
  console.log(`stage B ${s.fixture}: ${secs.toFixed(1)} s, mean ${slides.map((x) => x.meanDiff).join(" / ")}`);
}

{
  // Decision D5: "cyprus" in EN has no approved reference — the rules must hold and the
  // static EN copy must appear. (The slide texts stay the German fixture's.)
  const input = RenderInput.parse({ ...fixture("zypern-warum-de"), lang: "en", slug: "qa-cyprus-en" }) as any;
  const r = await renderCarousel(input);
  report.cyprusEn = { urls: r.slides, report: r.report };
  check(r.report.every((x) => !x.eyebrowGap || x.eyebrowGap === 44), "cyprus EN: all rules held");
  const folder = path.join(ROOT, r.folder.replace(/^\/uploads\//, ""));
  for (const n of ["01", "06"]) {
    const sheet = path.join(OUT, `qa-cyprus-en-${n}.jpg`);
    await sharp(path.join(folder, `${n}.jpg`)).resize(540, 675).jpeg({ quality: 85 }).toFile(sheet);
    sheets.push(sheet);
  }
}

// ---------------------------------------------------------------- 4. failure paths
const failure: Record<string, unknown> = {};
const LONG_HEADLINE = "Even the smallest one-bedroom apartment starts at 117 m², with a terrace facing the sea and a kitchen that opens onto the living room.";
{
  // Rule 6 at work: a 140-character headline (the schema maximum) still fits slide 2 by shrinking.
  const input = RenderInput.parse(fixture("soho-east-tower-en")) as any;
  input.slug = "qa-shrink";
  input.data.slide2.headline = LONG_HEADLINE;
  const r = await renderCarousel(input);
  failure.shrink = r.report[1];
  check(r.report[1].reduced && r.report[1].headingPx! >= Math.ceil(68 * 0.72), `140-character headline fits slide 2 at ${r.report[1].headingPx} px (template 68 px)`);
  const folder = path.join(ROOT, r.folder.replace(/^\/uploads\//, ""));
  const sheet = path.join(OUT, "qa-shrink-02.jpg");
  await sharp(path.join(folder, "02.jpg")).resize(540, 675).jpeg({ quality: 85 }).toFile(sheet);
  sheets.push(sheet);
}
for (const [label, mutate] of [
  ["too-long headline + long body (slide 2)", (d: any) => { d.slide2.headline = LONG_HEADLINE; d.slide2.body = "That's the size of a family flat in most European cities — and every apartment comes with covered parking, storage and a share of the resort gardens."; }],
  ["unbreakable marked compound (slide 2)", (d: any) => { d.slide2.headline = "Every apartment comes with a Meerblick-Penthouse-Dachterrassenlandschaft."; d.slide2.markedWords = "Meerblick-Penthouse-Dachterrassenlandschaft"; }],
] as const) {
  // Must fail naming the slide and the rule; the set rendered in stage B stays exactly as it was.
  const input = RenderInput.parse(fixture("soho-east-tower-en")) as any;
  mutate(input.data);
  const folder = path.join(ROOT, "social", "2026-w47", "soho-resort-east-tower-en");
  const snapshot = () => fs.readdirSync(folder).map((f) => [f, fs.statSync(path.join(folder, f)).mtimeMs, fs.statSync(path.join(folder, f)).size]);
  const before = snapshot();
  try {
    await renderCarousel(input);
    check(false, `${label} is refused`);
  } catch (e) {
    (failure.refused ??= [] as any[]).push({ label, code: (e as any).code, message: (e as Error).message });
    check(isErr(e, "RenderError", "layout_rule") && /^Slide 2, rule \d/.test((e as Error).message), `${label} → "${(e as Error).message}"`);
  }
  check(JSON.stringify(before) === JSON.stringify(snapshot()), `${label}: the earlier set is untouched`);
  check(fs.readdirSync(path.dirname(folder)).every((f) => !/\.(tmp|old)-/.test(f)), `${label}: no temp/old folders left behind`);
  check(ours() === "", `${label}: no Chromium left`);
  check(!fs.existsSync(LOCK), `${label}: lock released`);
}
{
  const tooLong = fixture("soho-east-tower-en");
  tooLong.data.slide2.headline = LONG_HEADLINE + " And a second sentence that takes it past the limit.";
  const p = RenderInput.safeParse(tooLong);
  check(!p.success, `a headline over 140 characters is refused by the schema${p.success ? "" : ": " + p.error.issues[0].message}`);
}
for (const [label, url] of [["external", "https://images.example.com/a.jpg"], ["traversal", "https://cyprusvipestates.com/uploads/../../etc/passwd"], ["own output", "https://cyprusvipestates.com/uploads/social/2026-w47/soho-resort-east-tower-en/01.jpg"]]) {
  const input = RenderInput.parse(fixture("zypern-warum-de")) as any;
  input.data.cover.image = url;
  try { await renderCarousel(input); check(false, `${label} image is refused`); }
  catch (e) { check(isErr(e, "ImageRejected"), `${label} image refused: ${(e as Error).message}`); }
}
{
  // The 60 s hard limit with a real Chromium hanging (test hook, NODE_ENV != production).
  process.env.CAROUSEL_TEST_HANG = "1";
  const input = RenderInput.parse(fixture("zypern-warum-de")) as any;
  input.slug = "qa-timeout";
  const t0 = Date.now();
  try { await renderCarousel(input); check(false, "a hanging render is stopped"); }
  catch (e) {
    const secs = (Date.now() - t0) / 1000;
    failure.timeout = { code: (e as any).code, message: (e as Error).message, seconds: secs };
    check(isErr(e, "RenderError", "render_timeout") && secs < 63, `hanging render stopped after ${secs.toFixed(1)} s: "${(e as Error).message}"`);
  }
  delete process.env.CAROUSEL_TEST_HANG;
  await new Promise((r) => setTimeout(r, 500));
  const left = ours();
  failure.timeoutLeftovers = left;
  check(left === "", "no Chromium left after the timeout");
  check(tmpLeft().length === 0, `no temp files left after the timeout${tmpLeft().length ? ": " + tmpLeft().join(", ") : ""}`);
  check(!fs.existsSync(path.join(ROOT, "social", "2026-w47", "qa-timeout-de")), "nothing saved for the timed-out render");
}
report.failure = failure;
report.failures = failures;
report.sheets = sheets;
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 1));
await prisma.$disconnect();
console.log(failures.length ? `\n${failures.length} check(s) failed` : "\nall checks passed");
process.exitCode = failures.length ? 1 : 0;
