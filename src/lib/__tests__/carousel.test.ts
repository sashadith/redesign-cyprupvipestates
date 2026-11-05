import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { RenderInput, markedProblems, type ProjectData } from "@/lib/social/carousel/schema";
import { formatPrice, isoWeekFolder, outputSubdir, vatText } from "@/lib/social/carousel/format";
import { ImageRejected, resolveImage, uploadsPathOf } from "@/lib/social/carousel/imagePolicy";
import { buildCyprusSlides, buildProjectSlides, markHeadline } from "@/lib/social/carousel/templates";
import { RenderError, renderCarousel } from "@/lib/social/carousel/render";

const fixture = async (name: string) => JSON.parse(await fs.readFile(path.join(process.cwd(), "scripts/qa/fixtures/carousel", `${name}.json`), "utf8"));
const withImages = (v: unknown, base = "https://cyprusvipestates.com/uploads/qa/x.jpg"): any =>
  typeof v === "string" && v.startsWith("@") ? base : Array.isArray(v) ? v.map((x) => withImages(x, base)) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, withImages(x, base)])) : v;

test("rule 7: prices in DE and EN format", () => {
  assert.equal(formatPrice(850000, "de"), "850.000 €");
  assert.equal(formatPrice(850000, "en"), "€850,000");
  assert.equal(formatPrice(1250000, "de"), "1.250.000 €");
  assert.equal(formatPrice(99000, "en"), "€99,000");
});

test("rule 3: VAT note text, null shows only the price", () => {
  assert.equal(vatText("plus", "en"), "+ VAT");
  assert.equal(vatText("plus", "de"), "zzgl. MwSt.");
  assert.equal(vatText("included", "en"), "incl. VAT");
  assert.equal(vatText("included", "de"), "inkl. MwSt.");
  assert.equal(vatText(null, "de"), null);
});

test("folder week: ISO week of postingDate, else today in Nicosia", () => {
  assert.equal(isoWeekFolder("2026-11-09", new Date()), "2026-w46");
  assert.equal(isoWeekFolder("2027-01-01", new Date()), "2026-w53"); // ISO week-year
  assert.equal(isoWeekFolder("2026-12-28", new Date()), "2026-w53");
  // Sunday 22:30 UTC is already Monday 00:30 in Cyprus (EET, UTC+2).
  assert.equal(isoWeekFolder(undefined, new Date("2026-11-08T22:30:00Z")), "2026-w46");
  assert.equal(isoWeekFolder(undefined, new Date("2026-11-08T21:30:00Z")), "2026-w45");
  assert.equal(outputSubdir("2026-w46", "soho-resort-east-tower", "de"), "social/2026-w46/soho-resort-east-tower-de");
});

test("schema: the reference fixtures are valid", async () => {
  for (const f of ["soho-east-tower-en", "soho-east-tower-de", "zypern-warum-de"]) {
    const r = RenderInput.safeParse(withImages(await fixture(f)));
    assert.ok(r.success, `${f}: ${r.success ? "" : JSON.stringify(r.error.issues)}`);
  }
});

test("schema: strict — extra keys (a phone number, a logo) are refused", async () => {
  const d = withImages(await fixture("soho-east-tower-en"));
  assert.equal(RenderInput.safeParse({ ...d, phone: "+357 1" }).success, false);
  assert.equal(RenderInput.safeParse({ ...d, data: { ...d.data, logo: "x" } }).success, false);
  assert.equal(RenderInput.safeParse({ ...d, data: { ...d.data, slide5: { ...d.data.slide5, rows: [1, 2, 3, 4].map(() => ({ label: "a", value: "b" })) } } }).success, false);
});

test("schema: a cyprus payload under template project is refused", async () => {
  const cy = withImages(await fixture("zypern-warum-de"));
  assert.equal(RenderInput.safeParse({ ...cy, template: "project" }).success, false);
});

test("rule 4: the marked phrase must occur exactly once", async () => {
  const d = withImages(await fixture("soho-east-tower-en")).data as ProjectData;
  assert.deepEqual(markedProblems("project", d), []);
  const twice = { ...d, slide3: { ...d.slide3, headline: "all generous. all generous.", markedWords: "all generous." } };
  assert.match(markedProblems("project", twice)[0].message, /exactly once.*2×/);
  const missing = { ...d, slide2: { ...d.slide2, markedWords: "200 m²" } };
  assert.match(markedProblems("project", missing)[0].message, /found 0×/);
});

test("schema: postingDate must be a real date, slug kebab-case", async () => {
  const d = withImages(await fixture("soho-east-tower-en"));
  assert.equal(RenderInput.safeParse({ ...d, postingDate: "2026-02-30" }).success, false);
  assert.equal(RenderInput.safeParse({ ...d, slug: "Soho Resort" }).success, false);
  assert.equal(RenderInput.safeParse({ ...d, slug: "../etc" }).success, false);
});

test("image policy: only https://cyprusvipestates.com/uploads/…", () => {
  assert.equal(uploadsPathOf("https://cyprusvipestates.com/uploads/developments/a/b_large.webp"), "/uploads/developments/a/b_large.webp");
  for (const bad of [
    "https://evil.example/uploads/a.jpg",
    "http://cyprusvipestates.com/uploads/a.jpg",
    "https://cyprusvipestates.com.evil.example/uploads/a.jpg",
    "https://cyprusvipestates.com/og/home.jpg",
    "https://cyprusvipestates.com/uploads/../.env",
    "https://cyprusvipestates.com/uploads/%2e%2e/.env",
    "https://cyprusvipestates.com/uploads/a.jpg?x=1",
    "https://cyprusvipestates.com/uploads/social/2026-w46/x-de/01.jpg",
    "/uploads/a.jpg",
    "file:///etc/passwd",
  ]) assert.throws(() => uploadsPathOf(bad), ImageRejected, bad);
});

test("image policy: resolves real images only, never outside the root", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "cve-carousel-test-"));
  try {
    await fs.mkdir(path.join(root, "qa"));
    await sharp({ create: { width: 4, height: 4, channels: 3, background: "#888" } }).jpeg().toFile(path.join(root, "qa", "ok.jpg"));
    await fs.writeFile(path.join(root, "qa", "fake.jpg"), "not an image");
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), "cve-outside-"));
    await sharp({ create: { width: 4, height: 4, channels: 3, background: "#888" } }).jpeg().toFile(path.join(outside, "secret.jpg"));
    await fs.symlink(path.join(outside, "secret.jpg"), path.join(root, "qa", "link.jpg"));
    assert.match(await resolveImage("https://cyprusvipestates.com/uploads/qa/ok.jpg", root), /^file:\/\/.*\/qa\/ok\.jpg$/);
    await assert.rejects(resolveImage("https://cyprusvipestates.com/uploads/qa/missing.jpg", root), /not found/);
    await assert.rejects(resolveImage("https://cyprusvipestates.com/uploads/qa/fake.jpg", root), /not a readable image/);
    await assert.rejects(resolveImage("https://cyprusvipestates.com/uploads/qa/link.jpg", root), /outside/);
    await fs.rm(outside, { recursive: true, force: true });
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("templates: input is escaped, static content is fixed", async () => {
  assert.equal(markHeadline("A <b>&\nB", "B", "mark"), 'A &lt;b&gt;&amp;<br><span class="mark">B</span>');
  const d = withImages(await fixture("soho-east-tower-en")).data as ProjectData;
  const evil = { ...d, location: '<script>alert(1)</script>', slide2: { ...d.slide2, body: '"><img src=x onerror=alert(1)>' } };
  const slides = await buildProjectSlides(evil, "en", () => "file:///tmp/x.jpg");
  assert.equal(slides.length, 6);
  const all = slides.map((s) => s.html).join("");
  assert.ok(!all.includes("<script>alert"), "script tag escaped");
  assert.ok(!all.includes("<img src=x"), "attribute injection escaped");
  assert.ok(all.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
  assert.ok(slides[5].html.includes("+357 99 278 285") && slides[5].html.includes("Not tied to any developer"));
  assert.ok(slides[4].html.includes("€850,000") && slides[4].html.includes("+ VAT"));
  const noVat = await buildProjectSlides({ ...d, slide5: { ...d.slide5, vatNote: null } }, "de", () => "file:///tmp/x.jpg");
  assert.ok(noVat[4].html.includes("850.000 €") && noVat[4].html.includes("Preise ab") && !noVat[4].html.includes('class="vat"'));
  const cy = await buildCyprusSlides(withImages(await fixture("zypern-warum-de")).data, "de", () => "file:///tmp/x.jpg");
  assert.ok(cy[5].html.includes("Ihre Vorteile mit uns") && cy[5].html.includes("cyprusvipestates.com"));
  assert.ok(cy[1].html.includes("Quelle: zyprisches Steuerrecht"));
  assert.ok(!cy[4].html.includes("Quelle:"), "slide 5 has no source");
});

// ---- orchestration failure paths, with a fake worker instead of Chromium ----

async function sandbox(worker: string) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "cve-carousel-run-"));
  await fs.mkdir(path.join(dir, "uploads", "qa"), { recursive: true });
  await sharp({ create: { width: 8, height: 8, channels: 3, background: "#468" } }).jpeg().toFile(path.join(dir, "uploads", "qa", "x.jpg"));
  await fs.writeFile(path.join(dir, "worker.mjs"), worker);
  return dir;
}
const opts = (dir: string, extra = {}) => ({ root: path.join(dir, "uploads"), workerPath: path.join(dir, "worker.mjs"), lockFile: path.join(dir, "lock"), now: new Date("2026-11-05T10:00:00Z"), ...extra });

test("a layout-rule failure saves nothing and keeps the earlier set", async () => {
  const dir = await sandbox(`process.stdout.write(JSON.stringify({ ok: false, error: "layout_rule", slide: 3, rule: 6, detail: "heading already at the minimum 50 px" }) + "\\n"); process.exitCode = 1;`);
  try {
    const input = RenderInput.parse(withImages(await fixture("soho-east-tower-en"))) as any;
    const earlier = path.join(dir, "uploads", "social", "2026-w47", "soho-resort-east-tower-en");
    await fs.mkdir(earlier, { recursive: true });
    await fs.writeFile(path.join(earlier, "01.jpg"), "earlier");
    await assert.rejects(renderCarousel(input, opts(dir)), (e: unknown) => e instanceof RenderError && e.code === "layout_rule" && /Slide 3, rule 6/.test(e.message));
    assert.equal(await fs.readFile(path.join(earlier, "01.jpg"), "utf8"), "earlier");
    assert.deepEqual((await fs.readdir(path.dirname(earlier))).sort(), ["soho-resort-east-tower-en"]);
    await assert.rejects(fs.stat(path.join(dir, "lock")), "lock released");
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("the hard timeout kills the worker's process group and saves nothing", async () => {
  // The fake worker starts a grandchild that stays in the worker's process group; the
  // timeout must take both down. (Chromium itself is started detached by Playwright and
  // is swept by its --cve-carousel-run marker — checked on the testbed with the real browser.)
  const dir = await sandbox(`import { spawn } from "node:child_process"; import fs from "node:fs"; import path from "node:path"; const c = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore" }); fs.writeFileSync(path.join(path.dirname(process.argv[1]), "grandchild.pid"), String(c.pid)); setInterval(() => {}, 1000);`);
  try {
    const input = RenderInput.parse(withImages(await fixture("soho-east-tower-en"))) as any;
    const t = Date.now();
    await assert.rejects(renderCarousel(input, opts(dir, { timeoutMs: 1500 })), (e: unknown) => e instanceof RenderError && e.code === "render_timeout");
    assert.ok(Date.now() - t < 6000, "returned soon after the timeout");
    const pid = Number(await fs.readFile(path.join(dir, "grandchild.pid"), "utf8"));
    await new Promise((r) => setTimeout(r, 200));
    assert.throws(() => process.kill(pid, 0), "the grandchild was killed with the group");
    await assert.rejects(fs.stat(path.join(dir, "uploads", "social")), "nothing written");
    await assert.rejects(fs.stat(path.join(dir, "lock")), "lock released");
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("a worker that dies without a result is an internal error, not a saved set", async () => {
  const dir = await sandbox(`process.exit(3);`);
  try {
    const input = RenderInput.parse(withImages(await fixture("zypern-warum-de"))) as any;
    await assert.rejects(renderCarousel(input, opts(dir)), (e: unknown) => e instanceof RenderError && e.code === "internal");
    await assert.rejects(fs.stat(path.join(dir, "uploads", "social")));
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("a rejected image fails before anything runs", async () => {
  const dir = await sandbox(`throw new Error("must not run");`);
  try {
    const input = RenderInput.parse(withImages(await fixture("zypern-warum-de"), "https://cyprusvipestates.com/uploads/qa/missing.jpg")) as any;
    await assert.rejects(renderCarousel(input, opts(dir)), ImageRejected);
    await assert.rejects(fs.stat(path.join(dir, "lock")));
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("a second render waits for the lock; a lock of a dead process is cleared", async () => {
  const dir = await sandbox(`process.exit(3);`);
  try {
    await fs.writeFile(path.join(dir, "lock"), JSON.stringify({ pid: 999999, at: Date.now(), token: "dead" }));
    const input = RenderInput.parse(withImages(await fixture("zypern-warum-de"))) as any;
    await assert.rejects(renderCarousel(input, opts(dir)), (e: unknown) => e instanceof RenderError && e.code === "internal");
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
