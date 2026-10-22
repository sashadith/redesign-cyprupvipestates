// crm.css reads the --ds-* design variables (Task 3 of the design settings feature).
// At the default values the CRM must look identical to the pre-variable stylesheet,
// so this test pins the mechanical rules: scaled font sizes and radii, translucents
// built from roles, only semantic/stage hex values left, and readable dark variants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { CLASSIC, DEFAULT_GLOBAL, cssVars, contrastRatio } from "../design/theme";

const RAW = readFileSync(path.join(__dirname, "../../app/crm/crm.css"), "utf8");
const CSS = RAW.replace(/\/\*[\s\S]*?\*\//g, "");

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

function decls(body: string): { prop: string; value: string }[] {
  return body.split(";").map((d) => d.trim()).filter(Boolean).map((d) => {
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
const SELECTORS_WITH_DISPLAY = new Set<string>();
for (const r of ALL) {
  if (/font(-family)?:[^;]*var\(--display\)/.test(r.body)) r.selector.split(",").forEach((s) => SELECTORS_WITH_DISPLAY.add(s.trim()));
}
function usesDisplay(r: Rule): boolean {
  return r.selector.split(",").some((s) => SELECTORS_WITH_DISPLAY.has(s.trim()));
}

// Light values copied from crm.css before the change (2026-10-22).
const LIGHT_SEMANTIC: Record<string, string> = { "--good": "#3F6B3A", "--warn": "#8A5A12", "--danger": "#A3361F" };
const LIGHT_STAGES: Record<string, string> = {
  NEW: "#8C877E", CONTACTED: "#5C7C99", COMMUNICATING: "#4F8682", VIEWING_SCHEDULED: "#7F6A99", OFFER: "#B88A3E",
  RESERVED: "#B0663F", CLOSED: "#3F6B3A", KEEP_CONTACT: "#7D776C", LOST: "#A3361F",
};
// Semantic tints that were literals before and have no role equivalent; now named semantic variables.
const LIGHT_EXTRA: Record<string, string> = {
  "--danger-deep": "#8A2D19", // danger button hover
  "--danger-bg": "#F8ECE7", // error toast surface
  "--cold": "#A79F92", // cold lead temperature dot
};
const SEMANTIC_PROPS = new Set(["--good", "--warn", "--danger", "--danger-deep", "--danger-bg", "--cold", "--sc"]);

const DARK_CARDS = ["#102826", "#23272A"]; // WEBSITE.card, Anthracite gold card

function block(selector: string): string {
  const r = ALL.find((x) => x.selector === selector && !x.media);
  assert.ok(r, `rule ${selector} exists`);
  return r.body;
}
function value(body: string, prop: string): string | undefined {
  return decls(body).find((d) => d.prop === prop)?.value;
}

test("(a) every font size is scaled by --ds-crm-scale, display fonts also by --ds-heading-scale", () => {
  let n = 0;
  for (const r of ALL) {
    for (const d of decls(r.body)) {
      if (d.prop !== "font-size" && d.prop !== "font") continue;
      if (!/\d(px)?/.test(d.value) || (d.prop === "font" && !/px|calc/.test(d.value))) continue;
      n++;
      assert.doesNotMatch(stripCalc(d.value), /\d+(\.\d+)?px/, `${r.selector} { ${d.prop}: ${d.value} }`);
      assert.match(d.value, /var\(--ds-crm-scale\)/, `${r.selector} { ${d.prop}: ${d.value} }`);
      const heading = usesDisplay(r) && !/var\(--(body|mono)\)/.test(r.body);
      if (heading) assert.match(d.value, /var\(--ds-heading-scale\)/, `heading ${r.selector} { ${d.prop}: ${d.value} }`);
      else assert.doesNotMatch(d.value, /--ds-heading-scale/, `body ${r.selector} { ${d.prop}: ${d.value} }`);
    }
  }
  assert.ok(n > 100, `found ${n} font sizes`);
  assert.equal(value(block(".crm-app"), "font-size"), "calc(14px * var(--ds-crm-scale))");
});

test("(b) every radius 1-998px is scaled by --ds-radius-scale", () => {
  for (const r of ALL) {
    for (const d of decls(r.body)) {
      if (d.prop !== "border-radius") continue;
      const re = /(\d+(?:\.\d+)?)px/g;
      const bare = stripCalc(d.value);
      for (let m = re.exec(bare); m; m = re.exec(bare)) {
        const px = Number(m[1]);
        assert.ok(px === 0 || px >= 999, `${r.selector} { border-radius: ${d.value} }`);
      }
    }
  }
  assert.equal(value(block(".crm-app"), "--r"), "calc(16px * var(--ds-radius-scale))");
});

test("(c) no translucent ink or bronze literal remains", () => {
  assert.doesNotMatch(CSS, /rgba\(\s*34\s*,\s*28\s*,\s*21\b/);
  assert.doesNotMatch(CSS, /rgba\(\s*142\s*,\s*107\s*,\s*61\b/);
  assert.doesNotMatch(CSS, /rgba\(\s*245\s*,\s*241\s*,\s*232\b/);
  assert.doesNotMatch(CSS, /rgba\(\s*251\s*,\s*249\s*,\s*243\b/);
  assert.match(CSS, /background: color-mix\(in srgb, var\(--ds-page\) 92%, transparent\)/);
  assert.equal(value(block(".crm-app"), "--line"), "color-mix(in srgb, var(--ds-text) 12%, transparent)");
  assert.equal(value(block(".crm-app"), "--field-line"), "color-mix(in srgb, var(--ds-text) 50%, transparent)");
  assert.equal(value(block(".crm-app"), "--hover"), "color-mix(in srgb, var(--ds-accent) 9%, transparent)");
});

test("(d) the only hex literals left are semantic and stage colours", () => {
  const allowed = new Set([...Object.values(LIGHT_SEMANTIC), ...Object.values(LIGHT_STAGES), ...Object.values(LIGHT_EXTRA)]);
  for (const r of ALL) {
    if (r.selector === ":where(.crm-html)") continue; // the Classic fallbacks, pinned by the roles test
    for (const d of decls(r.body)) {
      const hexes = d.value.match(/#[0-9a-fA-F]{3,8}\b/g);
      if (!hexes) continue;
      assert.ok(SEMANTIC_PROPS.has(d.prop) || d.prop === "--partnerfg", `hex outside a semantic variable: ${r.selector} { ${d.prop}: ${d.value} }`);
      if (!r.selector.includes(".ds-dark")) for (const h of hexes) assert.ok(allowed.has(h.toUpperCase()), `unexpected light hex ${h} in ${r.selector}`);
    }
  }
});

test("(e) dark semantic and stage colours reach 4.5:1 on dark cards", () => {
  const dark = ALL.filter((r) => r.selector.includes(".ds-dark"));
  const checked = new Set<string>();
  for (const r of dark) {
    for (const d of decls(r.body)) {
      if (!SEMANTIC_PROPS.has(d.prop) || d.prop === "--danger-deep" || d.prop === "--danger-bg" || d.prop === "--cold") continue;
      assert.match(d.value, /^#[0-9A-F]{6}$/, `${r.selector} ${d.prop}`);
      for (const card of DARK_CARDS) {
        const ratio = contrastRatio(d.value, card);
        assert.ok(ratio >= 4.5, `${r.selector} ${d.prop} ${d.value} on ${card}: ${ratio.toFixed(2)}`);
      }
      const stage = r.selector.match(/\.s-([A-Z_]+)/)?.[1];
      checked.add(stage ?? d.prop);
    }
  }
  for (const k of [...Object.keys(LIGHT_SEMANTIC), ...Object.keys(LIGHT_STAGES)]) assert.ok(checked.has(k), `dark variant for ${k}`);
  const app = block(".crm-app.ds-dark");
  assert.ok(value(app, "--partnerfg"), "dark --partnerfg");
});

test("(f) light semantic and stage values are unchanged", () => {
  const app = block(".crm-app");
  for (const [k, v] of Object.entries({ ...LIGHT_SEMANTIC, ...LIGHT_EXTRA })) assert.equal(value(app, k), v, k);
  assert.equal(value(app, "--partnerfg"), "var(--ds-accent-hover)");
  for (const [stage, v] of Object.entries(LIGHT_STAGES)) {
    const r = ALL.find((x) => x.selector === `.crm-app .s-${stage}`);
    assert.ok(r, stage);
    assert.equal(value(r.body, "--sc"), v, stage);
  }
});

test("roles: .crm-app variables point at --ds-*, fallbacks carry today's values at zero specificity", () => {
  const app = block(".crm-app");
  const expect: Record<string, string> = {
    "--bg": "var(--ds-page)", "--panel": "var(--ds-card)", "--colbg": "var(--ds-surface)", "--ink": "var(--ds-text)", "--muted": "var(--ds-muted)",
    "--accent": "var(--ds-accent)", "--accent-ink": "var(--ds-accent-text)", "--accent-deep": "var(--ds-accent-hover)", "--onaccent": "var(--ds-on-accent)",
    "--champagne": "var(--ds-gold)", "--field-bg": "var(--ds-field)",
    "--gold-contour": "linear-gradient(90deg, transparent, var(--ds-gold), transparent)",
    "--body": "var(--ds-font-body), system-ui, sans-serif",
  };
  for (const [k, v] of Object.entries(expect)) assert.equal(value(app, k), v, k);
  assert.match(value(app, "--display") ?? "", /^var\(--ds-font-heading\), .*var\(--font-display-cyr\)/);
  assert.equal(value(block(".crm-html"), "background"), "var(--ds-page)");
  const fb = block(":where(.crm-html)");
  for (const d of cssVars(CLASSIC, DEFAULT_GLOBAL).split(";")) {
    const [k, v] = d.split(/:(.*)/);
    assert.equal(value(fb, k), v, `fallback ${k}`);
  }
});

test("DsStyle renders the vars unescaped inside :root and drops markup characters", async () => {
  const React = await import("react");
  (globalThis as unknown as { React: unknown }).React = React;
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { DsStyle } = await import("../design/DsStyle");
  const vars = cssVars(CLASSIC, DEFAULT_GLOBAL);
  const html = renderToStaticMarkup(React.createElement(DsStyle, { scope: "crm", vars }));
  assert.equal(html, `<style data-ds="crm">:root{${vars}}</style>`);
  const evil = renderToStaticMarkup(React.createElement(DsStyle, { scope: "portal", vars: "--ds-page:#000}</style><script>x</script>{" }));
  assert.doesNotMatch(evil, /<\/style><script|<script/);
  assert.equal((evil.match(/[{}]/g) ?? []).length, 2);
});
