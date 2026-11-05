// The two approved carousel designs as parameterised HTML (2026-11-05).
//
// Nothing here is redesigned. The CSS is read at run time straight out of the
// approved files in assets/social-templates/templates/ (never copied, so it
// cannot drift), and the markup below is the approved markup slide for slide
// with the variable text and images swapped in. Every value is HTML-escaped.
// Static content — logos, portrait, phone, the four advantages, frame, footer,
// "Swipe/Weiter", slide numbers, pill, CTA, the second eyebrows — is written
// here and never comes from the input.
//
// data-role marks what the worker measures (scripts/social/carousel-worker.mjs):
// content (the bottom-anchored block), eyebrow, gap (whose margin-top sets the
// eyebrow→heading gap), heading (the element whose font-size the fit shrinks),
// portrait. Attributes do not change the layout.
import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { formatPrice, vatText } from "./format";
import type { CyprusData, Lang, ProjectData } from "./schema";

export function assetsDir(): string {
  return process.env.CAROUSEL_ASSETS_DIR || path.join(process.cwd(), "assets", "social-templates");
}

/** One slide as the worker receives it. */
export type SlideJob = {
  html: string;
  /** Template font-size of the heading the fit may shrink (rule 6); null = static slide. */
  headingPx: number | null;
  /** Rule 1 + Swipe: content is anchored 42 px above "Swipe/Weiter". */
  swipe: boolean;
  /** Rule 2 applies (an eyebrow above the heading / price). */
  eyebrow: boolean;
  /** Which photo-height script of the approved template follows the text. */
  photoFit: "project" | "cyprus" | null;
};

export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const br = (s: string) => esc(s).replace(/\n/g, "<br>");
/** CSS url() inside a style="" attribute. */
const bg = (fileUrl: string) => `url(&quot;${esc(fileUrl)}&quot;)`;

/** Headline with its one marked phrase (validated to occur exactly once). */
export function markHeadline(headline: string, marked: string, cls: "mark-word" | "mark"): string {
  const at = headline.indexOf(marked);
  if (at < 0) throw new Error("marked phrase not in headline");
  return `${br(headline.slice(0, at))}<span class="${cls}">${esc(marked)}</span>${br(headline.slice(at + marked.length))}`;
}

async function styleOf(file: string): Promise<string> {
  const html = await fs.readFile(path.join(assetsDir(), "templates", file), "utf8");
  const m = html.match(/<style>([\s\S]*?)<\/style>/);
  if (!m) throw new Error(`no <style> in ${file}`);
  return m[1];
}

/** The approved file's own inline scripts (the photo-height script), verbatim. They
 *  run while the page is parsed — before the web fonts have loaded, exactly as in
 *  the approved renders, whose photo heights come from that moment. */
async function scriptsOf(file: string): Promise<string> {
  const html = await fs.readFile(path.join(assetsDir(), "templates", file), "utf8");
  return (html.match(/<script>[\s\S]*?<\/script>/g) || []).join("");
}

// Mulish has no "→" (Swipe) and no "✓" (checks), so the browser takes them from a
// fallback font — and the approved renders show which one: in the dark design
// (its stack names "DejaVu Sans") both come from DejaVu Sans; in the light design
// (stack "Mulish, sans-serif") the arrow comes from Liberation Sans, the check
// from DejaVu Sans. Pinned here from local files (assets/social-templates/
// fonts-fallback; Bitstream Vera and SIL OFL licences) so the glyphs never depend
// on what a host has installed. Declared after the template CSS, so for these
// code points these faces are tried before Mulish's own.
const ARROWS = "U+2190-21FF", CHECKS = "U+2713-2714";
const face = (family: string, file: string, weight: number, range?: string) =>
  `@font-face { font-family: ${family}; src: url(../fonts-fallback/${file}); font-weight: ${weight};${range ? ` unicode-range: ${range};` : ""} }`;
const FALLBACK_CSS = {
  project: [
    face(`"DejaVu Sans"`, "DejaVuSans.ttf", 400), face(`"DejaVu Sans"`, "DejaVuSans-Bold.ttf", 700),
    face("Mulish", "DejaVuSans.ttf", 400, `${ARROWS}, ${CHECKS}`), face("Mulish", "DejaVuSans-Bold.ttf", 700, `${ARROWS}, ${CHECKS}`),
  ].join("\n"),
  cyprus: [
    face("Mulish", "DejaVuSans.ttf", 400, CHECKS), face("Mulish", "DejaVuSans-Bold.ttf", 700, CHECKS),
    face("Mulish", "LiberationSans-Regular.ttf", 400, ARROWS), face("Mulish", "LiberationSans-Bold.ttf", 700, ARROWS),
  ].join("\n"),
};

function doc(kind: "project" | "cyprus", lang: Lang, css: string, section: string, scripts = ""): string {
  // <base> = the templates folder, so ../fonts and ../brand resolve exactly as in the approved files.
  const base = pathToFileURL(path.join(assetsDir(), "templates") + path.sep).href;
  return `<!DOCTYPE html><html lang="${lang}"><head><meta charset="utf-8"><base href="${base}"><style>${css}</style><style>${FALLBACK_CSS[kind]}</style></head><body>${section}${scripts}</body></html>`;
}

// ---------------------------------------------------------------- project (dark)

const P = {
  en: {
    pill: "New development", swipe: "Swipe", inside: "Inside the apartments", facilities: "Resort facilities", from: "Prices from",
    s6: `<h2 style="font-size:76px; line-height:1.1">See the apartments<br>and <span class="mark-word">prices.</span></h2>
    <div class="cta" style="margin-top:26px">Link in bio</div>`,
    why: "Why talk to us first",
    checks: [`Not tied to any developer`, `<span>Buyers pay <span class="gold">no fee</span></span>`, `Availability updated daily`, `Advice in EN · DE · RU · PL`],
    phone: "Phone / WhatsApp",
  },
  de: {
    pill: "Neubauprojekt", swipe: "Weiter", inside: "Innenansichten", facilities: "Ausstattung des Resorts", from: "Preise ab",
    s6: `<h2 style="font-size:76px; line-height:1.1">Wohnungen<br>und <span class="mark-word">Preise ansehen.</span></h2>
    <div class="cta" style="margin-top:26px">Link in der Bio</div>`,
    why: "Warum zuerst zu uns",
    checks: [`An keinen Bauträger gebunden`, `<span>Für Käufer <span class="gold">kostenlos</span></span>`, `Verfügbarkeit täglich aktuell`, `Beratung auf DE · EN · RU · PL`],
    phone: "Telefon / WhatsApp",
  },
} as const;

/** Images already resolved to file:// URLs (imagePolicy.resolveImage), keyed by their input URL. */
export type Resolved = (inputUrl: string) => string;

const head = (n: number) => `<div class="head"><img src="../brand/logo-wide.png"><span class="num">0${n} / 06</span></div>`;

export async function buildProjectSlides(d: ProjectData, lang: Lang, img: Resolved): Promise<SlideJob[]> {
  // Each language uses its own approved file: the photo-height script runs while the
  // page is parsed, so the EN render must see the EN style exactly (the DE file adds
  // `white-space:nowrap`, which changes how lines break in that moment). Rule 4's
  // nowrap for both languages is applied by the worker after the page has loaded.
  const file = lang === "de" ? "project-dark-de.html" : "project-dark-en.html";
  const css = await styleOf(file);
  const js = await scriptsOf(file);
  const t = P[lang];
  const swipe = `<div class="swipe">${t.swipe} &nbsp;→</div>`;
  const tile = (image: string, caption: string) =>
    `<div style="flex:1"><div style="height:170px; background:${bg(img(image))} center/cover; border:1px solid rgba(201,166,107,0.4)"></div><p class="small" style="margin-top:12px; color:var(--cream)">${esc(caption)}</p></div>`;
  const ph = (image: string, pos: string) => `<div class="ph" style="background-image:${bg(img(image))}; background-position:${pos}"></div>`;

  const s1 = `<section class="slide photo" style="background-image:${bg(img(d.heroImage))}">
  ${head(1)}
  <div class="bottom" data-role="content"><span class="pill">${t.pill}</span>
    <h1 style="margin-top:34px" data-role="heading">${esc(d.name[0])}<br><em class="gold">${esc(d.name[1])}</em></h1>
    <p class="body" style="margin-top:22px">${esc(d.location)}</p></div>
  ${swipe}</section>`;

  const s2 = `<section class="slide split">
  ${ph(d.slide2.image, "center")}
  ${head(2)}
  <div class="txt" data-role="content"><div class="eyebrow" data-role="eyebrow">${esc(d.slide2.eyebrow)}</div>
  <h2 style="margin-top:26px" data-role="heading gap">${markHeadline(d.slide2.headline, d.slide2.markedWords, "mark-word")}</h2>
  <p class="body muted" style="margin-top:24px; font-size:34px">${esc(d.slide2.body)}</p>
  <div class="eyebrow" style="margin-top:40px">${t.inside}</div>
  <div style="display:flex; gap:22px; margin-top:22px">${d.slide2.tiles.map((x) => tile(x.image, x.caption)).join("")}</div></div>
  ${swipe}
</section>`;

  const s3 = `<section class="slide split">
  ${ph(d.slide3.image, "center")}
  ${head(3)}
  <div class="txt" data-role="content"><div class="eyebrow" data-role="eyebrow">${esc(d.slide3.eyebrow)}</div>
  <h2 style="margin-top:26px" data-role="heading gap">${markHeadline(d.slide3.headline, d.slide3.markedWords, "mark-word")}</h2>
  <div class="lines">${d.slide3.layouts.map((r) => `<div><span class="k gold">${esc(r.layout)}</span><span class="v">${esc(r.size)}</span></div>`).join("\n  ")}</div></div>
  ${swipe}
</section>`;

  const s4 = `<section class="slide split">
  ${ph(d.slide4.image, "center 60%")}
  ${head(4)}
  <div class="txt" data-role="content"><div class="eyebrow" data-role="eyebrow">${esc(d.slide4.eyebrow)}</div>
  <h2 style="margin-top:26px" data-role="heading gap">${markHeadline(d.slide4.headline, d.slide4.markedWords, "mark-word")}</h2>
  <div class="eyebrow" style="margin-top:56px">${t.facilities}</div>
  <div style="display:flex; gap:22px; margin-top:22px">${d.slide4.facilities.map((x) => tile(x.facilityImage, x.caption)).join("")}</div></div>
  ${swipe}
</section>`;

  const vat = vatText(d.slide5.vatNote, lang);
  const priceSize = lang === "de" ? 118 : 130;
  const vatStyle = lang === "de" ? "font-weight:700; font-size:26px; letter-spacing:0.06em; color:#F4DB9E" : "font-weight:700; font-size:30px; letter-spacing:0.12em; color:#F4DB9E";
  const rows = d.slide5.rows.length
    ? `\n  <div class="lines">${d.slide5.rows.map((r) => `<div><span class="k">${esc(r.label)}</span><span class="v">${esc(r.value)}</span></div>`).join("\n  ")}</div>`
    : "";
  const s5 = `<section class="slide split">
  ${ph(d.slide5.image, "center")}
  ${head(5)}
  <div class="txt" data-role="content"><div class="j-glass">
    <div class="h-from" data-role="eyebrow">${t.from}</div>
    <div class="price-row" data-role="gap" style="display:flex; align-items:baseline; gap:20px; margin-top:18px">
      <div class="h-num" data-role="heading" style="font-size:${priceSize}px; text-shadow:none; margin:0">${esc(formatPrice(d.slide5.priceFrom, lang))}<span class="bl" style="display:inline-block; width:0; height:0"></span></div>${
        vat ? `\n      <span class="vat" style="${vatStyle}">${esc(vat)}</span>` : ""
      }
    </div>
  </div>${rows}</div>
  ${swipe}
</section>`;

  const s6 = `<section class="slide">
  ${head(6)}<div class="rule"></div>
  <div style="position:relative; z-index:3; margin-top:76px">
    ${t.s6}
  </div>
  <div style="position:absolute; right:20px; bottom:200px; width:440px; height:700px; z-index:2">
    <div style="position:absolute; inset:60px 0 0; background:radial-gradient(50% 50% at 50% 58%, rgba(201,166,107,0.32), rgba(201,166,107,0) 70%)"></div>
    <img src="../brand/sascha.png" data-role="portrait" style="position:absolute; bottom:0; left:50%; transform:translateX(-50%); height:660px; filter:drop-shadow(0 24px 40px rgba(0,0,0,0.45))"><div class="goldline"></div>
  </div>
  <div class="glass" style="position:absolute; left:96px; width:610px; top:560px; z-index:3">
    <div class="eyebrow" style="margin-bottom:14px">${t.why}</div>
    ${t.checks.map((c) => `<div class="check"><i>✓</i>${c}</div>`).join("\n    ")}
  </div>
  <div class="band" style="height:200px; flex-direction:row; justify-content:space-between; padding:0 96px; z-index:4">
    <img src="../brand/logo-wide.png" style="height:40px">
    <div style="text-align:right"><div class="ph-label">${t.phone}</div><div class="ph-num gold">+357 99 278 285</div></div>
  </div>
</section>`;

  const split = (html: string, headingPx: number): SlideJob => ({ html: doc("project", lang, css, html, js), headingPx, swipe: true, eyebrow: true, photoFit: "project" });
  return [
    { html: doc("project", lang, css, s1), headingPx: 100, swipe: true, eyebrow: false, photoFit: null },
    split(s2, 68),
    split(s3, 68),
    split(s4, 68),
    split(s5, priceSize),
    { html: doc("project", lang, css, s6), headingPx: null, swipe: false, eyebrow: false, photoFit: null },
  ];
}

// ---------------------------------------------------------------- cyprus (light)

const C = {
  de: {
    swipe: "Weiter", source: "Quelle:",
    s6: `<div style="position:absolute; left:96px; top:300px; z-index:3"><h2 style="font-size:80px; line-height:1.1">Mehr dazu im <span class="mark">Journal</span><br>auf unserer Website.</h2>
    <div class="eyebrow" style="margin-top:26px; font-size:28px">cyprusvipestates.com</div></div>`,
    why: "Ihre Vorteile mit uns",
    checks: [`An keinen Bauträger gebunden`, `<span>Für Käufer <span style="color:var(--bronze)">kostenlos</span></span>`, `Verfügbarkeit täglich aktuell`, `Beratung auf DE · EN · RU · PL`],
    phone: "Telefon / WhatsApp",
  },
  // No approved EN design exists; static wording from the approved project-EN
  // template (operator decision D5, 2026-11-05).
  en: {
    swipe: "Swipe", source: "Source:",
    s6: `<div style="position:absolute; left:96px; top:300px; z-index:3"><h2 style="font-size:80px; line-height:1.1">More in our <span class="mark">Journal</span><br>on our website.</h2>
    <div class="eyebrow" style="margin-top:26px; font-size:28px">cyprusvipestates.com</div></div>`,
    why: "Why talk to us first",
    checks: [`Not tied to any developer`, `<span>Buyers pay <span style="color:var(--bronze)">no fee</span></span>`, `Availability updated daily`, `Advice in EN · DE · RU · PL`],
    phone: "Phone / WhatsApp",
  },
} as const;

// Photo crops of the approved slides 2–5 (part of the design, not of the input).
const CY_POS = ["center", "center 40%", "60% center", "center"];

export async function buildCyprusSlides(d: CyprusData, lang: Lang, img: Resolved): Promise<SlideJob[]> {
  const css = await styleOf("cyprus-light-de.html");
  const js = await scriptsOf("cyprus-light-de.html");
  // Slide 6 is the separately approved final version, with its own style additions.
  const css6 = await styleOf("cyprus-light-de-slide6-final.html");
  const t = C[lang];
  const swipe = `<div class="swipe">${t.swipe} &nbsp;→</div>`;

  const at = d.cover.title.indexOf(d.cover.accentWord);
  const title = `${br(d.cover.title.slice(0, at))}<span style="color:#E8CF98">${esc(d.cover.accentWord)}</span>${br(d.cover.title.slice(at + d.cover.accentWord.length))}`;
  const s1 = `<section class="slide cover on-photo" style="background-image:${bg(img(d.cover.image))}">
  <div class="head" style="top:84px; align-items:flex-start"><img src="../brand/logo-full.png" style="height:160px"><span class="num" style="margin-top:12px">01 / 06</span></div>
  <div class="bottom" data-role="content"><span class="chip">${esc(d.cover.chip)}</span>
    <h1 style="margin-top:34px; color:#fff" data-role="heading">${title}</h1>
    <p style="font-size:36px; margin-top:22px; color:#EFE9DB">${esc(d.cover.subtitle)}</p></div>
  ${swipe}
</section>`;

  const split = d.slides.map(
    (s, i) => `<section class="slide split on-photo">
  <div class="ph" style="background-image:${bg(img(s.image))}; background-position:${CY_POS[i]}"></div>
  <div class="head"><img src="../brand/logo-wide.png"><span class="num">0${i + 2} / 06</span></div>
  <div class="txt" data-role="content"><div class="eyebrow" data-role="eyebrow">${esc(s.eyebrow)}</div>
    <h2 style="margin-top:26px" data-role="heading gap">${markHeadline(s.headline, s.markedWords, "mark")}</h2>
    <div class="checks">${s.checks.map((c) => `<div class="check"><i>✓</i><span>${esc(c)}</span></div>`).join("")}</div>${s.source ? `<p class="src2">${t.source} ${esc(s.source)}</p>` : ""}</div>
  ${swipe}
</section>`,
  );

  const s6 = `<section class="slide"><div class="hdr6"><img src="../brand/logo-full.png"><span class="num">06 / 06</span></div>
  ${t.s6}
  <div style="position:absolute; left:96px; width:540px; top:640px; z-index:3">
    <div class="eyebrow" style="margin-bottom:12px">${t.why}</div>${t.checks.map((c) => `<div class="check chk"><i>✓</i>${c}</div>`).join("\n    ")}</div>
  <div style="position:absolute; right:0px; bottom:91px; width:540px; height:810px; z-index:4"><img src="../brand/sascha.png" data-role="portrait" style="position:absolute; bottom:0; left:50%; transform:translateX(-50%); height:810px"><div class="goldline" style="left:30px; right:76px"></div></div>
  <div class="phone6"><div class="ph-label">${t.phone}</div><div class="ph-num">+357 99 278 285</div></div>
</section>`;

  return [
    { html: doc("cyprus", lang, css, s1), headingPx: 100, swipe: true, eyebrow: false, photoFit: null },
    ...split.map((html): SlideJob => ({ html: doc("cyprus", lang, css, html, js), headingPx: 68, swipe: true, eyebrow: true, photoFit: "cyprus" })),
    { html: doc("cyprus", lang, css6, s6), headingPx: null, swipe: false, eyebrow: false, photoFit: null },
  ];
}
