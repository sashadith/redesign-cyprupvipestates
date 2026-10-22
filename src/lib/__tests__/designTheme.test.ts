import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CLASSIC, WEBSITE, STARTER_SETS, DEFAULT_GLOBAL, ROLE_KEYS, CLASSIC_EMAIL_THEME,
  cssVars, contrastWarnings, contrastRatio, isDarkSet, normalizeSetValues, normalizeGlobal,
  validateSetValues, validateGlobal, deriveAccentVariants, emailTheme,
} from "../design/theme";

function lum(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

test("cssVars emits defaults", () => {
  const css = cssVars(CLASSIC, DEFAULT_GLOBAL);
  for (const s of ["--ds-page:#F5F1E8", "--ds-crm-scale:1", "--ds-radius-scale:1", "--ds-font-heading:'Fraunces'", "--ds-portal-base:16px", "--ds-accent-text:#7A5A30", "--ds-on-accent:#FFFFFF", "--ds-heading-scale:1", "--ds-font-body:'Mulish'"]) {
    assert.ok(css.includes(s), s);
  }
  assert.ok(!css.includes(" "), "no spaces besides inside quoted fonts");
});

test("cssVars numbers have no trailing zeros", () => {
  const css = cssVars(CLASSIC, { ...DEFAULT_GLOBAL, crmBase: 15, radius: 8, headingScale: 1.1 });
  assert.ok(css.includes("--ds-crm-scale:1.0714"));
  assert.ok(css.includes("--ds-radius-scale:0.5"));
  assert.ok(css.includes("--ds-heading-scale:1.1"));
});

test("contrastWarnings empty for built-in and starter sets", () => {
  assert.deepEqual(contrastWarnings(CLASSIC), []);
  assert.deepEqual(contrastWarnings(WEBSITE), []);
  assert.equal(STARTER_SETS.length, 3);
  for (const s of STARTER_SETS) assert.deepEqual(contrastWarnings(s.values), [], s.name);
});

test("contrastWarnings reports a failing pair", () => {
  const w = contrastWarnings({ ...CLASSIC, text: "#F5F1E8" });
  assert.ok(w.some((x) => x.fg === "text" && x.bg === "page" && x.ratio < 4.5));
});

test("contrastRatio", () => {
  assert.equal(contrastRatio("#FFFFFF", "#000000"), 21);
  assert.equal(Math.round(contrastRatio("#8E6B3D", "#F5F1E8") * 100) / 100, 4.31);
});

test("isDarkSet", () => {
  assert.equal(isDarkSet(WEBSITE), true);
  assert.equal(isDarkSet(CLASSIC), false);
});

test("normalizeSetValues", () => {
  const n = normalizeSetValues({ page: "nope", text: "#000000" });
  assert.equal(n.page, CLASSIC.page);
  assert.equal(n.text, "#000000");
  assert.deepEqual(normalizeSetValues(null), CLASSIC);
  assert.equal(normalizeSetValues({ accent: "#abcdef" }).accent, "#ABCDEF");
  assert.deepEqual(normalizeSetValues("garbage"), CLASSIC);
  assert.deepEqual(normalizeSetValues([1, 2]), CLASSIC);
});

test("validateSetValues", () => {
  const ok = validateSetValues({ ...CLASSIC, page: "#abcdef" });
  assert.ok(ok.ok && ok.values.page === "#ABCDEF");
  for (const bad of ["#FFF", "red"]) {
    const r = validateSetValues({ ...CLASSIC, page: bad });
    assert.ok(!r.ok && r.errors.page);
  }
  const { field, ...rest } = CLASSIC;
  void field;
  const m = validateSetValues(rest);
  assert.ok(!m.ok && m.errors.field);
  const all = validateSetValues(null);
  assert.ok(!all.ok && ROLE_KEYS.every((k) => all.errors[k]));
});

test("validateGlobal", () => {
  assert.ok(validateGlobal(DEFAULT_GLOBAL).ok);
  const cases: [string, unknown][] = [["crmBase", 11], ["radius", 25], ["headingFont", "Comic Sans"], ["headingScale", 1.31]];
  for (const [k, v] of cases) {
    const r = validateGlobal({ ...DEFAULT_GLOBAL, [k]: v });
    assert.ok(!r.ok && r.errors[k], k);
  }
  assert.ok(!validateGlobal(null).ok);
});

test("normalizeGlobal", () => {
  assert.equal(normalizeGlobal({ crmBase: 99 }).crmBase, 14);
  assert.deepEqual(normalizeGlobal(undefined), DEFAULT_GLOBAL);
  assert.equal(normalizeGlobal({ crmBase: 16, bodyFont: "Onest" }).bodyFont, "Onest");
});

test("deriveAccentVariants on light page", () => {
  const d = deriveAccentVariants("#B08850", CLASSIC.page, CLASSIC.card);
  assert.ok(contrastRatio(d.accentText, CLASSIC.page) >= 4.5);
  assert.ok(contrastRatio(d.accentText, CLASSIC.card) >= 4.5);
  assert.ok(lum(d.accentHover) < lum(d.accentText));
});

test("deriveAccentVariants on dark page", () => {
  const d = deriveAccentVariants("#7A5A30", WEBSITE.page, WEBSITE.card);
  assert.ok(contrastRatio(d.accentText, WEBSITE.page) >= 4.5);
  assert.ok(contrastRatio(d.accentText, WEBSITE.card) >= 4.5);
  assert.ok(lum(d.accentText) > lum("#7A5A30"));
  assert.ok(lum(d.accentHover) > lum(d.accentText));
});

test("deriveAccentVariants keeps a passing accent", () => {
  const d = deriveAccentVariants("#221C15", CLASSIC.page, CLASSIC.card);
  assert.equal(d.accentText, "#221C15");
});

test("emailTheme", () => {
  const t = emailTheme(CLASSIC, DEFAULT_GLOBAL);
  assert.deepEqual(t, CLASSIC_EMAIL_THEME);
  assert.equal(t.base, 15);
  assert.equal(t.radius, 16);
  assert.equal(t.muted, "#59534C");
  assert.equal(t.headingFamily, "Georgia,'Times New Roman',serif");
});
