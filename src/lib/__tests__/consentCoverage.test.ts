import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { cookieSettingsLabel, cookieSettingsLabelIsEnglishFallback, hadTrackingConsent, COOKIE_SETTINGS_EVENT } from "@/app/components/CustomCookieConsent/cookieSettings";

/* Why this exists (2026-11-02).
 *
 * middleware.ts rewrites /de/kontakt, /faq, /partners, /case-studies, the
 * guides page and the about / privacy / terms pages onto preview-* route
 * trees that have their OWN <html>/<body>. They do not inherit
 * src/app/[lang]/layout.tsx, and none of them rendered the cookie banner or
 * the tags it gates: a visitor landing on the contact page could not consent,
 * and the pixel, GTM and our own page-view beacon never ran there. Nobody
 * noticed for weeks because every other page looked fine.
 *
 * The fix is one component (SiteConsent) in each of those layouts. This test
 * reads the rewrite targets out of middleware.ts itself, so a new tree that
 * someone wires up next month fails here instead of silently going dark.
 */

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const MIDDLEWARE = read("src/middleware.ts");

/** Every route tree middleware rewrites a public URL onto. */
function rewriteTrees(src: string): string[] {
  const trees = new Set<string>();
  // RegExp.exec loops, not matchAll: tsconfig sets no `target`, so iterating a matchAll result does not compile.
  const collect = (text: string, re: RegExp) => {
    for (let m = re.exec(text); m; m = re.exec(text)) trees.add(m[1]);
  };
  for (const line of src.split("\n")) {
    if (!/url\.pathname\s*=/.test(line)) continue;
    collect(line, /\/((?:preview|home)-[a-z]+(?:-[a-z]+)*)/g);
  }
  // The corporate pages pick their tree in a ternary a few lines above the assignment.
  collect(src, /\?\s*"(preview-[a-z-]+)"/g);
  collect(src, /:\s*"(preview-[a-z-]+)";/g);
  return Array.from(trees).sort();
}

function layoutOf(tree: string): string | null {
  for (const p of [`src/app/${tree}/[lang]/layout.tsx`, `src/app/${tree}/layout.tsx`]) if (existsSync(join(process.cwd(), p))) return p;
  return null;
}

// home-inline is a route handler that serves home-static's own prerendered HTML.
const SERVES_ANOTHER_TREE = new Set(["home-inline"]);

test("middleware rewrite targets are found (the parser is not silently matching nothing)", () => {
  const trees = rewriteTrees(MIDDLEWARE);
  for (const t of ["preview-about", "preview-case-studies", "preview-contacts", "preview-faq", "preview-guides", "preview-legal", "preview-partners", "home-static"]) {
    assert.ok(trees.includes(t), `expected ${t} among ${trees.join(", ")}`);
  }
});

test("every tree a public URL is rewritten onto renders the cookie banner and its tags", () => {
  const missing: string[] = [];
  for (const tree of rewriteTrees(MIDDLEWARE)) {
    if (SERVES_ANOTHER_TREE.has(tree)) continue;
    const layout = layoutOf(tree);
    assert.ok(layout, `no layout found for rewrite target ${tree}`);
    const src = read(layout!);
    const ok = /<SiteConsent\b/.test(src) || (/<CustomCookieConsent\b/.test(src) && /<ConsentScripts\b/.test(src));
    if (!ok) missing.push(layout!);
  }
  assert.deepEqual(missing, [], `layouts without banner + consent-gated tags: ${missing.join(", ")}`);
});

/* The middleware parser above only sees rewrites written the way today's are.
 * This second net does not depend on how a route is wired: every layout that
 * opens its own <html> must render the banner, or be named here as a tree no
 * visitor reaches (all of these are noindex and none is a middleware target). */
const NOT_PUBLIC_ROOT_LAYOUTS = new Set([
  "src/app/admin/layout.tsx",
  "src/app/book/layout.tsx", // tokenised booking links, no tags by design
  "src/app/c/layout.tsx", // tokenised client presentations, no tags by design
  "src/app/crm/layout.tsx",
  "src/app/crm-preview/crm/layout.tsx",
  "src/app/crm-preview/portal/layout.tsx",
  "src/app/partner-portal/layout.tsx",
  "src/app/preview-home/layout.tsx", // staging previews of the redesign
  "src/app/preview-insights/layout.tsx",
  "src/app/preview-landing/[lang]/layout.tsx",
  "src/app/preview-projects/layout.tsx",
  "src/app/sandbox/layout.tsx",
  "src/app/sandbox-v2/layout.tsx",
  "src/app/sandbox-v3/layout.tsx",
  "src/app/sandbox-v4/layout.tsx",
  "src/app/sandbox-v5/layout.tsx",
  "src/app/style/layout.tsx",
]);

function rootLayouts(dir = "src/app"): string[] {
  const found: string[] = [];
  for (const name of readdirSync(join(process.cwd(), dir))) {
    const rel = `${dir}/${name}`;
    if (statSync(join(process.cwd(), rel)).isDirectory()) found.push(...rootLayouts(rel));
    else if (name === "layout.tsx" && /<html\b/.test(read(rel))) found.push(rel);
  }
  return found;
}

test("every root layout renders the banner unless it is a known non-public tree", () => {
  const layouts = rootLayouts();
  assert.ok(layouts.length >= 20, `found only ${layouts.length} root layouts — the walker is broken`);
  const uncovered = layouts.filter((l) => !NOT_PUBLIC_ROOT_LAYOUTS.has(l) && !/<SiteConsent\b|<CustomCookieConsent\b/.test(read(l)));
  assert.deepEqual(uncovered, [], `root layouts without a cookie banner: ${uncovered.join(", ")} — render <SiteConsent> or add the tree to NOT_PUBLIC_ROOT_LAYOUTS with the reason`);
  // A middleware target must never hide behind the exemption list.
  for (const tree of rewriteTrees(MIDDLEWARE)) {
    const l = layoutOf(tree);
    assert.ok(!l || !NOT_PUBLIC_ROOT_LAYOUTS.has(l), `${l} is a rewrite target, it cannot be exempt`);
  }
});

test("SiteConsent itself carries banner, consent-gated tags and the page-view beacon", () => {
  const src = read("src/app/components/SiteConsent/SiteConsent.tsx");
  assert.match(src, /<CustomCookieConsent\b/);
  assert.match(src, /<ConsentScripts\b/);
  assert.match(src, /<AnalyticsTracker\b/);
});

test("the main [lang] layout still renders the banner", () => {
  assert.match(read("src/app/[lang]/layout.tsx"), /<CustomCookieConsent\b/);
});

test("both footers offer the cookie-settings entry", () => {
  for (const f of ["src/app/components/Footer/Footer.tsx", "src/app/preview-home/sections/Footer.tsx"]) {
    const src = read(f);
    assert.match(src, /<CookieSettingsLink\b/, f);
    assert.match(src, /cookieSettingsLabel\(/, f);
  }
});

test("the banner reopens on the footer's event and reloads when consent is withdrawn", () => {
  const src = read("src/app/components/CustomCookieConsent/CustomCookieConsent.tsx");
  assert.match(src, /addEventListener\(COOKIE_SETTINGS_EVENT/);
  assert.match(src, /removeEventListener\(COOKIE_SETTINGS_EVENT/);
  const reject = src.slice(src.indexOf("const rejectAll"), src.indexOf("if (!visible) return null"));
  assert.match(reject, /hadTrackingConsent\(Cookies\.get\(COOKIE_NAME\)\)/);
  assert.match(reject, /window\.location\.reload\(\)/);
  // Read BEFORE the new cookie is written, or it would always see the "no" just stored.
  assert.ok(reject.indexOf("hadTrackingConsent") < reject.indexOf("Cookies.set"), "consent must be read before it is overwritten");
  assert.match(read("src/app/components/CustomCookieConsent/CookieSettingsLink.tsx"), /new Event\(COOKIE_SETTINGS_EVENT\)/);
  assert.equal(COOKIE_SETTINGS_EVENT, "cvp:consent-open");
});

test("cookie-settings label: four client languages, English for Hebrew, none for stray segments", () => {
  assert.equal(cookieSettingsLabel("en"), "Cookie settings");
  assert.equal(cookieSettingsLabel("de"), "Cookie-Einstellungen");
  assert.equal(cookieSettingsLabel("pl"), "Ustawienia cookies");
  assert.equal(cookieSettingsLabel("ru"), "Настройки cookie");
  // Operator decision 2026-11-02: English until a native speaker checks a Hebrew label.
  assert.equal(cookieSettingsLabel("he"), "Cookie settings");
  assert.equal(cookieSettingsLabelIsEnglishFallback("he"), true);
  assert.equal(cookieSettingsLabelIsEnglishFallback("de"), false);
  assert.equal(cookieSettingsLabel("constructor"), null);
  assert.equal(cookieSettingsLabel("xx"), null);
});

test("hadTrackingConsent: only a stored yes counts", () => {
  assert.equal(hadTrackingConsent(JSON.stringify({ necessary: true, analytics: true, marketing: true })), true);
  assert.equal(hadTrackingConsent(JSON.stringify({ necessary: true, analytics: false, marketing: true })), true);
  assert.equal(hadTrackingConsent(JSON.stringify({ necessary: true, analytics: false, marketing: false })), false);
  assert.equal(hadTrackingConsent(undefined), false);
  assert.equal(hadTrackingConsent("not json"), false);
  assert.equal(hadTrackingConsent("null"), false);
});
