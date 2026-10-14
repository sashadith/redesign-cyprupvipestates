import fs from "fs";
import path from "path";
import type { GuideBlock, GuideContent } from "./types";
import { corporatePath } from "@/lib/corporatePageSlugs";

/* Lead-magnet guide layout, in the site's own brand: deep Maison green and champagne gold, Fraunces for
   display, Mulish for text, Playfair Display where Fraunces has no Cyrillic. The fonts are the site's own
   vendored woff2 files (src/app/fonts/vendored.css), the colours the tokens of preview-home/tokens.css.

   Used ONLY at build time (scripts/guides/render-one.ts prints this HTML to PDF with headless Chrome, one
   process per file). The server never renders; it serves the prebuilt PDFs. */

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const SITE = "https://cyprusvipestates.com";

/** The @font-face rules of the three brand families, with the relative woff2 paths turned into file:// URLs. */
export function brandFontCss(root: string): string {
  const css = fs.readFileSync(path.join(root, "src/app/fonts/vendored.css"), "utf8");
  const blocks = css.match(/@font-face\s*\{[^}]*\}/g) ?? [];
  const wanted = blocks.filter((b) => /font-family:\s*'(Fraunces|Mulish|Playfair Display)'/.test(b));
  if (wanted.length < 9) throw new Error(`expected the brand @font-face rules in vendored.css, found ${wanted.length}`);
  const dir = `file://${path.join(root, "src/app/fonts")}/`;
  return wanted.map((b) => b.replace(/url\(\.\//g, `url(${dir}`)).join("\n");
}

const dataUri = (file: string) => `data:image/png;base64,${fs.readFileSync(file).toString("base64")}`;

function titleHtml(c: GuideContent): string {
  const t = esc(c.title);
  const a = c.titleAccent ? esc(c.titleAccent) : "";
  return a && t.includes(a) ? t.replace(a, `<em>${a}</em>`) : t;
}

function block(b: GuideBlock): string {
  switch (b.type) {
    case "p":
      return `<p>${esc(b.text)}</p>`;
    case "bullets":
      return `<ul class="bul">${b.items.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>`;
    case "steps":
      return `<div class="steps">${b.items
        .map((it, i) => `<div class="step"><span class="step__n">${i + 1}</span><div><p class="step__t">${esc(it.title)}</p><p class="step__x">${esc(it.text)}</p></div></div>`)
        .join("")}</div>`;
    case "table": {
      // Column weight follows the longest cell: wide text columns get room, number columns stay narrow.
      const w = b.head.map((h, ci) => Math.min(40, Math.max(7, ...[h, ...b.rows.map((r) => r[ci])].map((t) => t.length * 0.6))));
      const total = w.reduce((a, x) => a + x, 0);
      const cols = w.map((x) => `<col style="width:${((x / total) * 100).toFixed(1)}%">`).join("");
      return `<div class="tbl"><table><colgroup>${cols}</colgroup><thead><tr>${b.head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${b.rows
        .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
        .join("")}</tbody></table>${b.note ? `<p class="note">${esc(b.note)}</p>` : ""}</div>`;
    }
    case "callout":
      return `<aside class="callout">${b.title ? `<p class="callout__t">${esc(b.title)}</p>` : ""}<p>${esc(b.text)}</p></aside>`;
    case "example":
      return `<div class="ex"><p class="ex__t">${esc(b.title)}</p>${b.rows
        .map(([l, v]) => `<div class="ex__r"><span>${esc(l)}</span><span class="ex__v">${esc(v)}</span></div>`)
        .join("")}${b.total ? `<div class="ex__r ex__total"><span>${esc(b.total[0])}</span><span class="ex__v">${esc(b.total[1])}</span></div>` : ""}${
        b.note ? `<p class="ex__n">${esc(b.note)}</p>` : ""
      }</div>`;
    case "checklist":
      return `<div class="chk">${b.title ? `<p class="chk__t">${esc(b.title)}</p>` : ""}<ul>${b.items.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div>`;
  }
}

/** Keep a short paragraph with the table/example/callout it introduces, and a heading with its first block. */
function sectionHtml(heading: string, blocks: GuideBlock[]): string {
  const parts: { html: string; unsplittable: boolean }[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const next = blocks[i + 1];
    if (b.type === "p" && b.text.length < 520 && next && (next.type === "table" || next.type === "example" || next.type === "callout")) {
      parts.push({ html: `<div class="keep">${block(b)}${block(next)}</div>`, unsplittable: true });
      i++;
    } else {
      const unsplittable = b.type === "table" || b.type === "example" || b.type === "callout" || b.type === "checklist" || (b.type === "p" && b.text.length <= 700);
      parts.push({ html: block(b), unsplittable });
    }
  }
  // The heading travels with the first block when that block cannot split; otherwise it just may not be torn
  // from the line that follows it (a heading used to end one page and finish on the next).
  const head = `<h2>${esc(heading)}</h2><hr class="stripe">`;
  const [first, ...rest] = parts;
  const opening = first.unsplittable ? `<div class="keep">${head}${first.html}</div>` : `<div class="keep-head">${head}</div>${first.html}`;
  return `<section class="sec">${opening}${rest.map((p) => p.html).join("\n")}</section>`;
}

const CSS = `
:root{--sea-deep:#081512;--sea:#102826;--paper:#F5F1E8;--paper-2:#EDE7D9;--raised:#FBF9F3;--ink:#221C15;--ink-soft:#4a4338;
  --ivory:#EFE9DB;--champagne:#C29A5E;--bronze:#8E6B3D;--hair:#d9d3c6}
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-print-color-adjust:exact;print-color-adjust:exact;background:var(--paper)}
body{font-family:'Mulish',system-ui,sans-serif;font-size:9.6pt;line-height:1.55;color:var(--ink);background:var(--paper)}
.disp,h1,h2,.ex__t,.step__n,.fig__v,.next__h{font-family:'Fraunces','Playfair Display',Georgia,serif}
@page{size:A4;margin:20mm 18mm 20mm 18mm;background:#F5F1E8;
  @top-left{content:"CYPRUS VIP ESTATES";font-family:'Mulish',sans-serif;font-size:6.5pt;letter-spacing:.24em;color:#8E6B3D}
  @bottom-left{content:"cyprusvipestates.com";font-family:'Mulish',sans-serif;font-size:7pt;color:#6b6252}
  @bottom-right{content:counter(page) " / " counter(pages);font-family:'Mulish',sans-serif;font-size:7pt;color:#6b6252}}
@page cover{size:A4;margin:0;background:#081512;@top-left{content:none}@bottom-left{content:none}@bottom-right{content:none}}

/* cover */
.cover{page:cover;width:210mm;height:297mm;padding:22mm 20mm 18mm;display:flex;flex-direction:column;justify-content:space-between;color:var(--ivory);break-after:page;
  background:radial-gradient(120% 70% at 85% 8%,rgba(194,154,94,.22) 0%,rgba(194,154,94,0) 55%),linear-gradient(170deg,#081512 0%,#102826 100%)}
.cover__logo{width:64mm;height:auto;display:block}
.cover__edition{font-size:8.5pt;letter-spacing:.2em;text-transform:uppercase;color:var(--champagne);margin-bottom:9mm}
.cover h1{font-weight:300;font-size:34pt;line-height:1.1;letter-spacing:-.01em;color:var(--ivory);max-width:165mm}
.cover h1 em,.cover h1 .it{font-style:italic;font-weight:300;color:var(--champagne)}
.cover .stripe{width:62mm;height:1.4pt;border:0;margin:9mm 0 7mm;background:linear-gradient(90deg,#C29A5E,rgba(194,154,94,0))}
.cover__sub{font-size:12.5pt;line-height:1.5;color:rgba(239,233,219,.74);max-width:140mm}
.cover__figs{display:flex;border-top:1px solid rgba(239,233,219,.22);padding-top:7mm}
.fig{flex:1;padding-right:5mm}
.fig__v{font-size:21pt;font-weight:400;color:var(--champagne);line-height:1.1;margin-bottom:2mm}
.fig__l{font-size:7.8pt;line-height:1.4;color:rgba(239,233,219,.66)}
.cover__foot{font-size:8pt;letter-spacing:.12em;color:rgba(239,233,219,.5);margin-top:9mm}

/* body */
.intro{font-size:10.6pt;line-height:1.62;color:var(--ink);padding-bottom:5mm;margin-bottom:2mm;border-bottom:1px solid var(--hair)}
.sec{margin-top:7mm}
h2{font-weight:400;font-size:17pt;line-height:1.16;letter-spacing:-.005em;color:var(--ink);break-after:avoid;break-inside:avoid}
.stripe{height:1.2pt;border:0;margin:2.2mm 0 3.6mm;width:34mm;background:linear-gradient(90deg,#C29A5E,rgba(194,154,94,0));break-after:avoid}
p{margin-bottom:2.2mm;orphans:3;widows:3}
.bul{margin:0 0 2.4mm;padding:0;list-style:none}
.bul li{position:relative;padding-left:4.2mm;margin-bottom:1.4mm;break-inside:avoid}
.bul li::before{content:"";position:absolute;left:.4mm;top:2.3mm;width:1.6mm;height:1.6mm;background:var(--champagne);transform:rotate(45deg)}
.keep{break-inside:avoid}
.keep-head{break-inside:avoid;break-after:avoid}
.tbl{break-inside:avoid;margin:1mm 0 3mm}
table{width:100%;border-collapse:collapse;font-size:8.3pt;line-height:1.38}
th{background:var(--sea);color:var(--ivory);text-align:left;font-weight:700;font-size:6.8pt;letter-spacing:.07em;text-transform:uppercase;padding:2.1mm 2.4mm}
td{padding:2mm 2.4mm;border-bottom:1px solid var(--hair);background:var(--raised);vertical-align:top}
tbody tr:nth-child(even) td{background:#F1ECDF}
.note{font-size:7.9pt;color:var(--ink-soft);font-style:italic;margin:1.4mm 0 0}
.callout{background:var(--paper-2);border-left:2.4pt solid var(--champagne);padding:3mm 4mm;margin:1mm 0 3.4mm;break-inside:avoid}
.callout p{margin:0;font-size:9pt;line-height:1.5}
.callout .callout__t{font-weight:800;font-size:7pt;letter-spacing:.1em;text-transform:uppercase;color:var(--bronze);margin-bottom:1.2mm}
.ex{border:1px solid var(--hair);background:var(--raised);margin:2.4mm 0 3.6mm;break-inside:avoid}
.ex__t{background:var(--paper-2);font-weight:500;font-size:10.6pt;line-height:1.25;color:var(--ink);padding:2.4mm 3.4mm;margin:0;border-bottom:1px solid var(--hair)}
.ex__r{display:flex;justify-content:space-between;gap:6mm;padding:1.7mm 3.4mm;border-top:1px solid #e6e1d4;font-size:8.8pt}
.ex__r:first-of-type{border-top:0}
.ex__v{white-space:nowrap;text-align:right;font-variant-numeric:tabular-nums}
.ex__total{border-top:1.4pt solid var(--ink);background:var(--paper-2);font-weight:800;padding:2.2mm 3.4mm}
.ex__n{font-size:7.8pt;font-style:italic;color:var(--ink-soft);margin:0;padding:1.8mm 3.4mm;border-top:1px solid var(--hair)}
.steps{margin:1mm 0 3mm}
.step{display:flex;gap:3.4mm;margin-bottom:2.6mm;break-inside:avoid}
.step__n{flex:none;width:6.4mm;height:6.4mm;border:1px solid var(--champagne);border-radius:50%;color:var(--bronze);font-size:9pt;text-align:center;line-height:6.1mm}
.step__t{font-weight:800;font-size:9.4pt;margin:0 0 .6mm}
.step__x{font-size:8.9pt;line-height:1.48;margin:0;color:var(--ink)}
.chk{margin:1mm 0 3mm;break-inside:avoid}
.chk__t{font-weight:800;font-size:9pt;color:var(--bronze);letter-spacing:.04em;margin-bottom:1.6mm}
.chk ul{list-style:none}
.chk li{position:relative;padding-left:6mm;margin-bottom:1.6mm;font-size:9pt;line-height:1.45;break-inside:avoid}
.chk li::before{content:"";position:absolute;left:0;top:.8mm;width:3mm;height:3mm;border:1px solid var(--bronze);background:var(--raised)}
.next{margin-top:8mm;padding:6mm 7mm;color:var(--ivory);break-inside:avoid;
  background:radial-gradient(90% 120% at 100% 0%,rgba(194,154,94,.2),rgba(194,154,94,0) 60%),linear-gradient(160deg,#081512,#102826)}
.next .next__h{font-weight:400;font-size:16pt;line-height:1.2;color:var(--champagne);margin-bottom:2.8mm}
.next p{color:rgba(239,233,219,.88);font-size:9.4pt;line-height:1.55;margin-bottom:4mm}
.btn{display:inline-block;background:var(--champagne);color:var(--sea-deep);text-decoration:none;font-weight:800;font-size:8pt;letter-spacing:.1em;text-transform:uppercase;padding:2.4mm 5mm}
.disc{margin-top:5mm;font-size:7.4pt;line-height:1.45;color:#6b6252}
`;

export function renderGuideHtml(c: GuideContent, id: string, root: string): string {
  const contactUrl = `${SITE}${corporatePath("contacts", c.lang)}?utm_source=guide&utm_medium=pdf&utm_campaign=${id}`;
  const logo = dataUri(path.join(root, "src/lib/guides/assets/logo-full.png"));
  return `<!doctype html><html lang="${c.lang}"><head><meta charset="utf-8"><title>${esc(c.title)}</title>
<meta name="author" content="Cyprus VIP Estates"><meta name="description" content="${esc(c.subtitle)}">
<style>${brandFontCss(root)}${CSS}</style></head><body>
<section class="cover">
  <img class="cover__logo" src="${logo}" alt="Cyprus VIP Estates">
  <div>
    <p class="cover__edition">${esc(c.edition)}</p>
    <h1>${titleHtml(c)}</h1>
    <hr class="stripe">
    <p class="cover__sub">${esc(c.subtitle)}</p>
  </div>
  <div>
    <div class="cover__figs">${c.keyNumbers.map((k) => `<div class="fig"><p class="fig__v">${esc(k.value)}</p><p class="fig__l">${esc(k.label)}</p></div>`).join("")}</div>
    <p class="cover__foot">CYPRUSVIPESTATES.COM</p>
  </div>
</section>
<main>
  <p class="intro">${esc(c.intro)}</p>
  ${c.sections.map((s) => sectionHtml(s.heading, s.blocks)).join("\n")}
  <section class="next"><p class="next__h">${esc(c.nextSteps.heading)}</p><p>${esc(c.nextSteps.text)}</p><a class="btn" href="${esc(contactUrl)}">cyprusvipestates.com</a></section>
  <p class="disc">${esc(c.disclaimer)}</p>
</main></body></html>`;
}
