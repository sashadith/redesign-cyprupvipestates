#!/usr/bin/env node
// Carousel render worker (2026-11-05). Spawned by src/lib/social/carousel/render.ts,
// one process per carousel, never imported by the Next.js server.
//
//   node scripts/social/carousel-worker.mjs <job.json>
//
// job.json: { renderId, dir, slides: [{ file, headingPx, swipe, eyebrow, photoFit, raw?, clipY? }] }
// Writes <dir>/slide-<n>.png and prints ONE JSON line on stdout:
//   { ok: true, slides: [{ headingPx, templatePx, eyebrowGap, contentSwipeGap, geometry }] }
//   { ok: false, error: "layout_rule", slide, rule, detail } | { ok: false, error: "renderer_not_installed" | "internal", detail }
//
// Chromium only ever sees file:// — every other request is aborted — and is
// started with a --cve-carousel-run=<renderId> marker so the parent can sweep
// it by name if this worker is killed. browser.close() runs in finally.
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

if (!process.env.PLAYWRIGHT_BROWSERS_PATH && fs.existsSync("/opt/ms-playwright")) process.env.PLAYWRIGHT_BROWSERS_PATH = "/opt/ms-playwright";

const W = 1080, H = 1350;
const FRAME = 36; // .slide::after inset
const CONTENT_L = 96, CONTENT_R = W - 96;
const SWIPE_GAP = 42; // rule 1 (layout boxes, decision D1)
const EYEBROW_GAP = 44; // rule 2 (ink pixels)
const MIN_TEXT_TOP = 520; // decision D6
const MIN_FACTOR = 0.72; // rule 6
const INK = 38; // a pixel is ink when a channel differs from the flat background by more than this

const job = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const out = (o) => process.stdout.write(JSON.stringify(o) + "\n");
class RuleError extends Error {
  constructor(slide, rule, detail) { super(detail); this.slide = slide; this.rule = rule; this.detail = detail; }
}

// In-page helpers, injected once per page. All geometry is in CSS px of the 1080×1350 slide at (0,0).
const PAGE_HELPERS = `
window.__cve = (() => {
  const sec = () => document.querySelector("section.slide");
  const q = (role) => sec().querySelector('[data-role~="' + role + '"]');
  const st = document.createElement("style");
  st.textContent = [
    "html.__iso body *{visibility:hidden!important;text-shadow:none!important;filter:none!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important;box-shadow:none!important}",
    "html.__iso .__on, html.__iso .__on *{visibility:visible!important;color:#000!important}",
    "html.__iso body{background:var(--iso-bg,#fff)!important}",
    // Rule 4 (and the price line, rule 3): markings, price and VAT never wrap. Switched
    // on after the approved photo script has run, exactly as the DE template has it.
    "html.__nowrap .mark-word, html.__nowrap .mark, html.__nowrap .h-num, html.__nowrap .vat{white-space:nowrap}",
    // Text-only mode: every glyph black on white, every box, image and overlay gone.
    "html.__txt body *{background:transparent!important;border-color:transparent!important;outline:none!important;box-shadow:none!important;text-shadow:none!important;filter:none!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important;color:#000!important}",
    "html.__txt body *::before, html.__txt body *::after{display:none!important}",
    "html.__txt img{visibility:hidden!important}",
    "html.__txt body{background:#fff!important}",
  ].join("\\n");
  document.head.appendChild(st);
  // Photo height. The approved template's own script already ran while the page
  // was parsed (h0, the height in the approved renders). When the rules later move
  // the text (eyebrow gap, smaller heading), the photo follows by exactly the
  // amount the same formula changes with the real fonts: h0 + (F_now − F_first).
  let f0 = null, h0 = null;
  const formula = (kind, s) => {
    const t = s.querySelector(".txt");
    if (kind === "project") {
      const L = t.querySelector(".lines");
      return L && s.querySelector(".h-num,.j-glass") ? t.offsetTop + L.offsetTop + 10 : t.offsetTop + 70;
    }
    return t.offsetTop + 6;
  };
  const photoFit = (kind) => {
    const s = sec();
    if (!kind || !s.classList.contains("split")) return;
    const ph = s.querySelector(".ph"), F = formula(kind, s);
    if (f0 === null) { f0 = F; h0 = parseFloat(ph.style.height) || F; }
    ph.style.height = (h0 + (F - f0)) + "px";
  };
  const anchor = (gap) => {
    const c = q("content"), sw = sec().querySelector(".swipe");
    if (!c || !sw) return;
    const bottom = ${H} - (sw.getBoundingClientRect().top - gap);
    c.style.setProperty("bottom", bottom + "px", "important");
  };
  const textRects = (root) => {
    const out = [];
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (!n.nodeValue.trim()) continue;
      const el = n.parentElement;
      if (!el || getComputedStyle(el).visibility === "hidden") continue;
      const r = document.createRange(); r.selectNodeContents(n);
      for (const b of r.getClientRects()) if (b.width > 0 && b.height > 0) out.push({ x: b.left, y: b.top, r: b.right, b: b.bottom, t: n.nodeValue.trim().slice(0, 40) });
    }
    return out;
  };
  const isolate = (els, bg) => {
    document.querySelectorAll(".__on").forEach((e) => e.classList.remove("__on"));
    els.forEach((e) => e.classList.add("__on"));
    document.documentElement.style.setProperty("--iso-bg", bg || "#fff");
    document.documentElement.classList.toggle("__iso", els.length > 0);
  };
  // Rules 3, 4, 5 (frame) and D6 on layout boxes; the portrait overlap is checked on pixels.
  const violations = () => {
    const s = sec(), v = [];
    for (const m of s.querySelectorAll(".mark-word, .mark")) {
      const rs = m.getClientRects(), b = m.getBoundingClientRect();
      if (rs.length > 1) v.push({ rule: 4, detail: "the marking wraps onto two lines" });
      else if (b.right > ${CONTENT_R} + 0.5 || b.left < ${CONTENT_L} - 0.5) v.push({ rule: 4, detail: "the marking runs out of the text area (right edge " + Math.round(b.right) + " px)" });
    }
    const num = s.querySelector(".h-num");
    if (num) {
      const g = s.querySelector(".j-glass").getBoundingClientRect(), vat = s.querySelector(".vat");
      const right = Math.max(num.getBoundingClientRect().right, vat ? vat.getBoundingClientRect().right : 0);
      if (num.getClientRects().length > 1 || right > g.right - 40 + 0.5) v.push({ rule: 3, detail: "the price does not fit on one line inside the price panel" });
    }
    for (const r of textRects(s)) {
      if (r.x < ${FRAME} + 1 || r.r > ${W - FRAME} - 1 || r.y < ${FRAME} + 1 || r.b > ${H - FRAME} - 1) { v.push({ rule: 5, detail: 'text leaves the frame: "' + r.t + '"' }); break; }
    }
    const c = q("content");
    if (c) {
      const top = Math.min(...textRects(c).map((r) => r.y));
      if (top < ${MIN_TEXT_TOP}) v.push({ rule: 1, detail: "the text would start at y=" + Math.round(top) + ", above the limit y=${MIN_TEXT_TOP} (photo too small)" });
    }
    return v;
  };
  const KEYS = "img, .ph, .head, .num, .pill, .chip, .eyebrow, h1, h2, p, .mark-word, .mark, .lines > div, .k, .v, .check, .j-glass, .glass, .h-from, .h-num, .vat, .swipe, .band, .ph-label, .ph-num, .cta, .src2, .goldline, .rule, [style*='height:170px']";
  const geometry = (root) => [...root.querySelectorAll(KEYS)].map((e) => {
    const b = e.getBoundingClientRect(), y0 = root.getBoundingClientRect().top;
    return { k: e.tagName.toLowerCase() + (e.classList.length ? "." + [...e.classList].filter((c) => !c.startsWith("__")).join(".") : ""), x: +b.left.toFixed(1), y: +(b.top - y0).toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1) };
  });
  const textOnly = (on) => document.documentElement.classList.toggle("__txt", on);
  return { sec, q, photoFit, textOnly, anchor, isolate, violations, geometry,
    setPx: (px) => q("heading").style.setProperty("font-size", px + "px", "important"),
    getGap: () => parseFloat(getComputedStyle(q("gap")).marginTop),
    setGap: (m) => q("gap").style.setProperty("margin-top", m + "px", "important"),
    swipeGap: () => { const c = q("content"), sw = sec().querySelector(".swipe"); return c && sw ? sw.getBoundingClientRect().top - c.getBoundingClientRect().bottom : null; } };
})();`;

/** Top/bottom ink rows of a raw RGB(A) screenshot against a flat background colour. */
async function inkSpan(png, bg = [255, 255, 255]) {
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  const ch = info.channels;
  let top = -1, bottom = -1;
  for (let y = 0; y < info.height; y++) {
    let n = 0;
    for (let x = 0; x < info.width && n < 2; x++) {
      const i = (y * info.width + x) * ch;
      if (Math.abs(data[i] - bg[0]) > INK || Math.abs(data[i + 1] - bg[1]) > INK || Math.abs(data[i + 2] - bg[2]) > INK) n++;
    }
    if (n >= 2) { if (top < 0) top = y; bottom = y; }
  }
  return { top, bottom };
}

/** Pixel mask (1 = ink) of a screenshot against a flat background. */
async function inkMask(png, bg) {
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  const ch = info.channels, m = new Uint8Array(info.width * info.height);
  for (let p = 0; p < m.length; p++) {
    const i = p * ch;
    m[p] = Math.abs(data[i] - bg[0]) > INK || Math.abs(data[i + 1] - bg[1]) > INK || Math.abs(data[i + 2] - bg[2]) > INK ? 1 : 0;
  }
  return m;
}

const shot = (page) => page.screenshot({ type: "png", clip: { x: 0, y: 0, width: W, height: H }, animations: "disabled" });

async function isoShot(page, selector, bg) {
  await page.evaluate(([sel, c]) => window.__cve.isolate([...document.querySelectorAll(sel)], c), [selector, bg]);
  const png = await shot(page);
  await page.evaluate(() => window.__cve.isolate([]));
  return png;
}

/** Top/bottom rows of an element's GLYPH ink as rendered on the real slide: the
 *  slide is shot as is and with the element's letters made transparent (nothing
 *  moves, backgrounds stay), and the rows where the two shots differ are the
 *  letters. A marking's bar is therefore not "heading ink" — the approved renders
 *  keep 42–43 px between eyebrow letters and heading letters whether or not the
 *  first heading line carries the bar. */
async function visibleInk(page, selector) {
  const withIt = await sharp(await shot(page)).raw().toBuffer();
  // The previous inline values are kept and put back exactly (.h-num carries an inline text-shadow).
  await page.evaluate((sel) => {
    window.__cveSaved = [];
    document.querySelectorAll(sel).forEach((e) => [e, ...e.querySelectorAll("*")].forEach((x) => {
      window.__cveSaved.push([x, x.style.getPropertyValue("color"), x.style.getPropertyPriority("color"), x.style.getPropertyValue("text-shadow"), x.style.getPropertyPriority("text-shadow")]);
      x.style.setProperty("color", "transparent", "important");
      x.style.setProperty("text-shadow", "none", "important");
    }));
  }, selector);
  const without = await sharp(await shot(page)).raw().toBuffer();
  await page.evaluate(() => {
    for (const [x, c, cp, t, tp] of window.__cveSaved) {
      if (c) x.style.setProperty("color", c, cp); else x.style.removeProperty("color");
      if (t) x.style.setProperty("text-shadow", t, tp); else x.style.removeProperty("text-shadow");
    }
    window.__cveSaved = [];
  });
  const ch = withIt.length / (W * H);
  let top = -1, bottom = -1;
  for (let y = 0; y < H; y++) {
    let n = 0;
    for (let x = 0; x < W && n < 2; x++) {
      const i = (y * W + x) * ch;
      if (Math.abs(withIt[i] - without[i]) > INK || Math.abs(withIt[i + 1] - without[i + 1]) > INK || Math.abs(withIt[i + 2] - without[i + 2]) > INK) n++;
    }
    if (n >= 2) { if (top < 0) top = y; bottom = y; }
  }
  return { top, bottom };
}

async function eyebrowGap(page) {
  const eb = await visibleInk(page, 'section.slide [data-role~="eyebrow"]');
  const hd = await visibleInk(page, 'section.slide [data-role~="heading"]');
  return hd.top - eb.bottom - 1;
}

async function portraitOverlap(page) {
  const hasPortrait = await page.evaluate(() => !!document.querySelector('[data-role~="portrait"]'));
  if (!hasPortrait) return 0;
  const MAG = [255, 0, 255];
  const portrait = await inkMask(await isoShot(page, '[data-role~="portrait"]', "#ff00ff"), MAG);
  await page.evaluate(() => window.__cve.textOnly(true));
  const text = await inkMask(await shot(page), [255, 255, 255]);
  await page.evaluate(() => window.__cve.textOnly(false));
  let n = 0;
  for (let p = 0; p < text.length; p++) if (text[p] && portrait[p]) n++;
  return n;
}

async function loadPage(context, file, raw = false) {
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  await page.route("**/*", (r) => (r.request().url().startsWith("file:") ? r.continue() : r.abort()));
  await page.goto(pathToFileURL(file).href, { waitUntil: "load" });
  // Every declared face must load from the local files — no silent fallback font.
  const fonts = await page.evaluate(async () => {
    try { await Promise.all([...document.fonts].map((f) => f.load())); } catch (e) { return { ok: false, detail: String(e) }; }
    await document.fonts.ready;
    const bad = [...document.fonts].filter((f) => f.status !== "loaded").map((f) => f.family + " " + f.weight + " " + f.style);
    return { ok: bad.length === 0 && document.fonts.size > 0, detail: bad.join(", ") || "no fonts declared" };
  });
  if (!fonts.ok) throw new Error(`fonts did not load: ${fonts.detail}`);
  // Background images: decode every url() so the screenshot never catches a half-loaded photo.
  await page.evaluate(async () => {
    const urls = new Set();
    for (const el of document.querySelectorAll("*")) {
      const m = getComputedStyle(el).backgroundImage.match(/url\("([^"]+)"\)/g) || [];
      m.forEach((u) => urls.add(u.slice(5, -2)));
    }
    await Promise.all([...urls].map((u) => new Promise((res, rej) => { const i = new Image(); i.onload = () => i.decode().then(res, res); i.onerror = () => rej(new Error("image failed: " + u.slice(-60))); i.src = u; })));
    await Promise.all([...document.images].map((i) => (i.complete ? Promise.resolve() : new Promise((r) => (i.onload = i.onerror = r)))));
  });
  await page.addScriptTag({ content: PAGE_HELPERS });
  if (!raw) await page.evaluate(() => document.documentElement.classList.add("__nowrap"));
  return page;
}

async function renderSlide(context, s, n) {
  const page = await loadPage(context, s.file, !!s.raw);
  try {
    if (s.raw) {
      // An approved original, as delivered: no fit, its own scripts already ran.
      await page.setViewportSize({ width: W, height: H });
      await page.evaluate((y) => window.scrollTo(0, y), s.clipY || 0);
      const geometry = await page.evaluate((y) => window.__cve.geometry(document.querySelectorAll("section.slide")[Math.round(y / 1350)]), s.clipY || 0);
      const png = await page.screenshot({ type: "png", clip: { x: 0, y: s.clipY || 0, width: W, height: H }, fullPage: true, animations: "disabled" });
      fs.writeFileSync(`${job.dir}/slide-${n}.png`, png);
      return { geometry };
    }
    const settle = () => page.evaluate(([fit, gap]) => { window.__cve.anchor(gap); window.__cve.photoFit(fit); }, [s.photoFit, SWIPE_GAP]);
    const templatePx = s.headingPx;
    const minPx = templatePx ? Math.ceil(templatePx * MIN_FACTOR) : null;
    let px = templatePx, gap = null, templateGap = null, v = [];
    for (;;) {
      if (px) await page.evaluate((p) => window.__cve.setPx(p), px);
      if (s.swipe) await settle();
      if (s.eyebrow) {
        // Rule 2: move the heading until exactly 44 px of background separate the two inks.
        let margin = await page.evaluate(() => window.__cve.getGap()), step = null;
        for (let i = 0; i < 8; i++) {
          gap = await eyebrowGap(page);
          if (templateGap === null) templateGap = gap;
          if (gap === EYEBROW_GAP) break;
          const want = EYEBROW_GAP - gap;
          step = step !== null && Math.sign(step) !== Math.sign(want) ? want / 2 : want;
          margin += step;
          await page.evaluate((m) => window.__cve.setGap(m), margin);
          if (s.swipe) await settle();
        }
      }
      v = await page.evaluate(() => window.__cve.violations());
      const overlap = await portraitOverlap(page);
      if (overlap > 0) v.push({ rule: 5, detail: `text overlaps the portrait (${overlap} px)` });
      if (!v.length || !px) break;
      if (px - 2 < minPx) break;
      px -= 2;
    }
    if (v.length) {
      const why = px ? ` — heading already at the minimum ${px} px (72 % of ${templatePx} px)` : "";
      throw new RuleError(n, v[0].rule, v[0].detail + why);
    }
    if (s.eyebrow && gap !== EYEBROW_GAP) throw new RuleError(n, 2, `eyebrow → heading gap is ${gap} px, must be ${EYEBROW_GAP} px`);
    const contentSwipeGap = s.swipe ? await page.evaluate(() => window.__cve.swipeGap()) : null;
    if (s.swipe && Math.abs(contentSwipeGap - SWIPE_GAP) > 0.5) throw new RuleError(n, 1, `content ends ${contentSwipeGap} px above Swipe, must be ${SWIPE_GAP} px`);
    const geometry = await page.evaluate(() => window.__cve.geometry(window.__cve.sec()));
    fs.writeFileSync(`${job.dir}/slide-${n}.png`, await shot(page));
    return { headingPx: px, templatePx, eyebrowGap: s.eyebrow ? gap : null, templateEyebrowGap: templateGap, contentSwipeGap, geometry };
  } finally {
    await page.close().catch(() => {});
  }
}

let browser = null;
try {
  const { chromium } = await import("playwright-core");
  try {
    browser = await chromium.launch({ headless: true, args: [`--cve-carousel-run=${job.renderId}`] });
  } catch (e) {
    const msg = String(e && e.message || e);
    if (/Executable doesn't exist|browserType\.launch: .*not found/i.test(msg)) { out({ ok: false, error: "renderer_not_installed", detail: msg.split("\n")[0] }); process.exitCode = 1; }
    else throw e;
  }
  if (browser) {
    if (process.env.CAROUSEL_TEST_HANG === "1" && process.env.NODE_ENV !== "production") await new Promise(() => {});
    const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    const slides = [];
    for (let i = 0; i < job.slides.length; i++) slides.push(await renderSlide(context, job.slides[i], i + 1));
    out({ ok: true, slides });
  }
} catch (e) {
  if (e instanceof RuleError) out({ ok: false, error: "layout_rule", slide: e.slide, rule: e.rule, detail: e.detail });
  else out({ ok: false, error: "internal", detail: String(e && e.stack || e).split("\n").slice(0, 3).join(" | ") });
  process.exitCode = 1;
} finally {
  if (browser) await browser.close().catch(() => {});
}
