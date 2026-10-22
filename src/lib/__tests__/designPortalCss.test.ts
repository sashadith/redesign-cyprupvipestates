// portal.css reads the --ds-* design variables (Task 4 of the design settings feature).
// At the default values the partner portal must look identical to the pre-variable stylesheet,
// so this test pins the mechanical rules: scaled radii (pills stay literal), translucents built
// from roles, white fields on the Field role, heading sizes scaled, readable dark semantics, and
// the design-tokens names overridden on .pp-app only (never on :root).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { CLASSIC, DEFAULT_GLOBAL, cssVars, contrastRatio } from "../design/theme";

const RAW = readFileSync(path.join(__dirname, "../../app/partner-portal/portal.css"), "utf8");
const CSS = RAW.replace(/\/\*[\s\S]*?\*\//g, "");
const LAYOUT = readFileSync(path.join(__dirname, "../../app/partner-portal/layout.tsx"), "utf8");

type Rule = { selector: string; body: string; media: string | null };

// Innermost declaration blocks with their selector (and enclosing @media, if any).
function rules(css: string): Rule[] {
  const out: Rule[] = [];
  const stack: string[] = [];
  let buf = "";
  for (const ch of css) {
    if (ch === "{") { stack.push(buf.trim()); buf = ""; }
    else if (ch === "}") {
      const sel = stack.pop() ?? "";
      if (buf.trim() && !sel.startsWith("@")) {
        const media = stack.find((s) => s.startsWith("@media")) ?? null;
        out.push({ selector: sel, body: buf.trim(), media });
      }
      buf = "";
    } else buf += ch;
  }
  return out;
}

// Splits declarations on ";" outside parentheses (data: URLs contain none, but keep it robust).
function decls(body: string): { prop: string; value: string }[] {
  const parts: string[] = [];
  let depth = 0, cur = "";
  for (const ch of body) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (ch === ";" && depth === 0) { parts.push(cur); cur = ""; } else cur += ch;
  }
  parts.push(cur);
  return parts.map((d) => d.trim()).filter(Boolean).map((d) => {
    const i = d.indexOf(":");
    return { prop: d.slice(0, i).trim(), value: d.slice(i + 1).trim() };
  });
}

// Removes every calc(...) (balanced parentheses) so only bare values remain.
function stripCalc(v: string): string {
  let out = "";
  for (let i = 0; i < v.length; i++) {
    if (v.startsWith("calc(", i)) {
      let depth = 0, j = i + 4;
      for (; j < v.length; j++) {
        if (v[j] === "(") depth++;
        else if (v[j] === ")") { depth--; if (depth === 0) break; }
      }
      i = j;
      out += "CALC";
    } else out += v[i];
  }
  return out;
}

const ALL = rules(CSS);
const isPrint = (r: Rule) => !!r.media && r.media.includes("print");

function block(selector: string): string {
  const r = ALL.find((x) => x.selector === selector && !x.media);
  assert.ok(r, `rule ${selector} exists`);
  return r.body;
}
function value(body: string, prop: string): string | undefined {
  return decls(body).find((d) => d.prop === prop)?.value;
}

// Light values copied from portal.css before the change (2026-10-22).
const LIGHT_SEMANTIC: Record<string, string> = { "--pp-good": "#3F6B3A", "--pp-warn": "#8A5A12", "--pp-danger": "#A3361F" };
const DARK_CARDS = ["#102826", "#23272A"]; // WEBSITE.card, Anthracite gold card

// Pills stay pills at every radius setting (controller ruling R5): >= 99px and 50% stay literal.
const PILL_SELECTORS = [
  ".pp-app .pp-nav a, .pp-linkbtn", ".pp-lang select", ".pp-chip", ".pp-segment", ".pp-segment-btn", ".pp-state", ".pp-progress",
  ".pp-badge", ".pp-news-kind",
];

test("(b) every radius 1-98px is scaled by --ds-radius-scale, pills (>= 99px, 50%) stay literal", () => {
  let scaled = 0;
  for (const r of ALL) {
    for (const d of decls(r.body)) {
      if (d.prop !== "border-radius") continue;
      const re = /(\d+(?:\.\d+)?)px/g;
      const bare = stripCalc(d.value);
      for (let m = re.exec(bare); m; m = re.exec(bare)) {
        const px = Number(m[1]);
        assert.ok(px === 0 || px >= 99, `${r.selector} { border-radius: ${d.value} }`);
      }
      const calcRe = /calc\((\d+(?:\.\d+)?)px \* var\(--ds-radius-scale\)\)/g;
      for (let m = calcRe.exec(d.value); m; m = calcRe.exec(d.value)) {
        scaled++;
        assert.ok(Number(m[1]) < 99, `pill radius must stay literal: ${r.selector} { border-radius: ${d.value} }`);
      }
    }
  }
  assert.ok(scaled >= 12, `found ${scaled} scaled radii`);
  for (const sel of PILL_SELECTORS) assert.equal(value(block(sel), "border-radius"), "999px", sel);
  assert.equal(value(block(".pp-stagebar-dot"), "border-radius"), "50%");
  assert.equal(value(block(".pp-app"), "--r-ui"), "calc(16px * var(--ds-radius-scale))");
});

test("(c) no translucent ink, bronze or semantic literal remains", () => {
  assert.doesNotMatch(CSS, /rgba\(\s*34\s*,\s*28\s*,\s*21\b/);
  assert.doesNotMatch(CSS, /rgba\(\s*122\s*,\s*90\s*,\s*48\b/);
  assert.doesNotMatch(CSS, /rgba\(\s*142\s*,\s*107\s*,\s*61\b/);
  assert.doesNotMatch(CSS, /rgba\(\s*163\s*,\s*54\s*,\s*31\b/);
  assert.doesNotMatch(CSS, /rgba\(\s*63\s*,\s*107\s*,\s*58\b/);
  assert.doesNotMatch(CSS, /rgba\(\s*138\s*,\s*90\s*,\s*18\b/);
  const app = block(".pp-app");
  assert.equal(value(app, "--hairline"), "color-mix(in srgb, var(--ds-text) 14%, transparent)");
  assert.equal(value(app, "--hairline-strong"), "color-mix(in srgb, var(--ds-text) 24%, transparent)");
  assert.equal(value(app, "--text-faint"), "color-mix(in srgb, var(--ds-text) 48%, transparent)");
  assert.equal(value(app, "--pp-field-line"), "color-mix(in srgb, var(--ds-text) 50%, transparent)");
  assert.equal(value(app, "--accent-soft"), "color-mix(in srgb, var(--ds-accent) 10%, transparent)");
  assert.equal(value(app, "--glass-solid"), "color-mix(in srgb, var(--ds-page) 92%, transparent)");
  assert.equal(value(app, "--glass-border"), "color-mix(in srgb, var(--ds-text) 10%, transparent)");
  assert.equal(
    value(app, "--pp-shadow"),
    "0 1px 2px color-mix(in srgb, var(--ds-text) 4%, transparent), 0 28px 56px -34px color-mix(in srgb, var(--ds-text) 22%, transparent)",
  );
  assert.match(CSS, /text-decoration-color: color-mix\(in srgb, var\(--ds-accent-text\) 35%, transparent\)/);
});

test("(e) dark semantic colours reach 4.5:1 on dark cards; dark sets switch native controls and the root scrollbar", () => {
  const dark = block(".pp-app.ds-dark");
  for (const k of Object.keys(LIGHT_SEMANTIC)) {
    const v = value(dark, k);
    assert.ok(v, `dark ${k}`);
    assert.match(v, /^#[0-9A-F]{6}$/, k);
    for (const card of DARK_CARDS) {
      const ratio = contrastRatio(v, card);
      assert.ok(ratio >= 4.5, `${k} ${v} on ${card}: ${ratio.toFixed(2)}`);
    }
  }
  assert.equal(value(dark, "color-scheme"), "dark");
  assert.equal(value(block(".pp-html.ds-dark"), "color-scheme"), "dark");
  assert.match(LAYOUT, /isDarkSet\(/);
});

test("(f) light semantic values are unchanged", () => {
  const app = block(".pp-app");
  for (const [k, v] of Object.entries(LIGHT_SEMANTIC)) assert.equal(value(app, k), v, k);
});

test("fields: no white background literal remains outside print; the select chevron keeps its bronze stroke", () => {
  for (const r of ALL) {
    if (isPrint(r)) continue;
    for (const d of decls(r.body)) {
      if (d.prop !== "background" && d.prop !== "background-color") continue;
      assert.doesNotMatch(d.value, /#fff\b|#ffffff\b|\bwhite\b/i, `${r.selector} { ${d.prop}: ${d.value} }`);
    }
  }
  for (const sel of [".pp-field input, .pp-field select, .pp-copy input", ".pp-field textarea", ".pp-search", ".pp-projects", ".pp-tab"]) {
    assert.equal(value(block(sel), "background"), "var(--ds-field)", sel);
  }
  assert.match(value(block(".pp-field select"), "background") ?? "", /^var\(--ds-field\) url\(.*%237A5A30/);
});

test(".pp-html: page colour, base font size from --ds-portal-base; no :root rule in portal.css", () => {
  const html = block(".pp-html");
  assert.equal(value(html, "background"), "var(--ds-page)");
  assert.equal(value(html, "font-size"), "var(--ds-portal-base)");
  assert.doesNotMatch(CSS, /:root/);
});

test("roles: .pp-app overrides the design-tokens names, fallbacks carry today's values at zero specificity", () => {
  const app = block(".pp-app");
  const expect: Record<string, string> = {
    "--bg": "var(--ds-page)", "--surface": "var(--ds-surface)", "--surface-raised": "var(--ds-card)",
    "--paper": "var(--ds-page)", "--paper-2": "var(--ds-surface)",
    "--text": "var(--ds-text)",
    "--bronze": "var(--ds-accent)", "--accent": "var(--ds-accent)", "--accent-ink": "var(--ds-on-accent)", "--champagne": "var(--ds-gold)",
    "--pp-bronze-ink": "var(--ds-accent-text)", "--pp-bronze-deep": "var(--ds-accent-hover)", "--pp-card": "var(--ds-card)",
    "--gold-contour": "linear-gradient(90deg, transparent, var(--ds-gold), transparent)",
    // R6: today's computed chains, with the role font where the first family sits.
    "--pp-display": "var(--ds-font-heading), Georgia, 'Times New Roman', serif, var(--font-display-cyr), Georgia, serif",
    "--pp-body": "var(--ds-font-body), system-ui, sans-serif, system-ui, sans-serif",
  };
  for (const [k, v] of Object.entries(expect)) assert.equal(value(app, k), v, k);
  // --text-soft: today rgba(34,28,21,0.74) over every surface; kept translucent so defaults compute identically.
  assert.equal(value(app, "--text-soft"), "color-mix(in srgb, var(--ds-text) 74%, transparent)");
  const fb = block(":where(.pp-html)");
  for (const d of cssVars(CLASSIC, DEFAULT_GLOBAL).split(";")) {
    const [k, v] = d.split(/:(.*)/);
    assert.equal(value(fb, k), v, `fallback ${k}`);
  }
});

test("headings: every size on a heading or a --pp-display rule is multiplied by --ds-heading-scale", () => {
  const headingSel = /(^|[\s>,])h[1-3]\b|\.pp-h[23]\b|\.pp-rt-sub\b/;
  let n = 0;
  for (const r of ALL) {
    const heading = r.selector.split(",").some((s) => headingSel.test(s.trim())) || /var\(--pp-display\)/.test(r.body);
    for (const d of decls(r.body)) {
      if (d.prop !== "font-size" && d.prop !== "font") continue;
      if (d.prop === "font" && !/rem|px|em|clamp|calc/.test(d.value)) continue;
      if (d.prop === "font-size" && /^var\(--text-/.test(d.value)) continue;
      if (heading) {
        n++;
        assert.match(d.value, /var\(--ds-heading-scale\)/, `${r.selector} { ${d.prop}: ${d.value} }`);
        assert.doesNotMatch(stripCalc(d.value), /\d(rem|px|em)\b|clamp\(/, `${r.selector} { ${d.prop}: ${d.value} }`);
      } else {
        assert.doesNotMatch(d.value, /--ds-heading-scale/, `body text ${r.selector} { ${d.prop}: ${d.value} }`);
      }
    }
  }
  assert.ok(n >= 20, `found ${n} heading sizes`);
  assert.equal(value(block(".pp-app h1, .pp-app h2, .pp-app h3"), "font-size"), "calc(1em * var(--ds-heading-scale))");
});

test("layout: viewer design injected via DsStyle with the default-set fallback", () => {
  assert.match(LAYOUT, /designForPartner\(me\?\.partner\.id \?\? null\)/);
  assert.match(LAYOUT, /<DsStyle scope="portal"/);
  assert.match(LAYOUT, /\[portal design\]/);
  assert.match(LAYOUT, /generateViewport/);
  assert.match(LAYOUT, /data-theme="light"/);
  assert.match(LAYOUT, /\bcache\(/);
});
