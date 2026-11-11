// The admin rail's two machine channels: MCP (/admin/mcp) and OpenWA
// (wa.cyprusvipestates.com), added 2026-11-11.
//
// This file's subject is the failure mode the nav has already produced three
// times — an entry that is declared but cannot be clicked. Publishing Queue and
// Xellex Bridge were both in buildModules() and absent from the list the
// operator actually sees (see adminDevelopmentsNav.test.ts), and /admin/mcp
// shipped on 2026-09-07 reachable only through one sentence on /admin/account.
//
// Two NEW ways to be declared-but-broken arrive with an external module:
//   - an absolute URL inside a next/link <Link>, which routes it as an in-app
//     path instead of opening the other application;
//   - a module key with no icon, which draws an empty square in a 104 px rail
//     where the icon is most of the button.
// Both are pinned below. No React, no DB — this reads the three sources.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(process.cwd(), "src/app/admin/(panel)", p), "utf8");

const layout = () => read("layout.tsx");
const sidebar = () => read("Sidebar.tsx");
const navIcons = () => read("NavIcons.tsx");

/** The `key:` of every module buildModules() declares. */
function moduleKeys(src: string): string[] {
  const start = src.indexOf("function buildModules");
  assert.notEqual(start, -1, "buildModules() was renamed or removed");
  const end = src.indexOf("export default async function PanelLayout", start);
  assert.ok(end > start, "could not find the end of buildModules()");
  return Array.from(src.slice(start, end).matchAll(/key: "([a-z0-9]+)"/g)).map((m) => m[1]);
}

test("the rail declares the MCP and OpenWA entries", () => {
  const src = layout();
  const keys = moduleKeys(src);
  assert.ok(keys.includes("mcp"), "the MCP module is gone from buildModules()");
  assert.ok(keys.includes("openwa"), "the OpenWA module is gone from buildModules()");
  // Both sit in the ADMIN-only branch, below Users: the OpenWA dashboard takes
  // the gateway's master key and /admin/mcp hands out CRM access.
  const usersAt = src.indexOf('key: "users"');
  assert.ok(usersAt !== -1 && src.indexOf('key: "mcp"') > usersAt, "MCP must come after Users");
  assert.ok(src.indexOf('key: "openwa"') > usersAt, "OpenWA must come after Users");

  assert.ok(src.includes('{ href: "/admin/mcp"'), "the MCP entry must point at the Connected apps page");
  assert.ok(
    src.includes('href: "https://wa.cyprusvipestates.com"'),
    "the OpenWA entry must point at the gateway dashboard",
  );
});

test("a module whose href leaves this app is marked external", () => {
  const src = layout();
  // Without `external`, ModuleLink renders a next/link <Link>, which treats an
  // absolute URL as a route and never opens the other application.
  // Array.from, not a for-of over the iterator: this tsconfig sets no `target`,
  // so iterating a RegExp match iterator directly is a TS2802 error here.
  for (const match of Array.from(src.matchAll(/\{ key: "([a-z0-9]+)"[^\n]*\}/g))) {
    const decl = match[0];
    if (/href: "https?:\/\//.test(decl)) {
      assert.match(decl, /external: true/, `an off-site module must set external: true — ${decl.slice(0, 80)}`);
    }
  }
  assert.match(src, /key: "openwa", label: "OpenWA", external: true/);
});

test("external modules open in a new tab and never claim the active state", () => {
  const src = sidebar();
  assert.ok(src.includes("function ModuleLink"), "ModuleLink was renamed or removed");
  const start = src.indexOf("function ModuleLink");
  const body = src.slice(start, src.indexOf("\n}", src.indexOf("return (\n    <Link", start)));
  assert.match(body, /target="_blank"/, "an external module must open in its own tab");
  assert.match(body, /rel="noopener noreferrer"/, "a new tab needs noopener");

  // resolveActive() compares an href against the pathname. An absolute URL can
  // never match, but the admin must also not look "active" because a tab to
  // another application is open — so it is skipped outright.
  const ra = src.slice(src.indexOf("function resolveActive"), src.indexOf("// First page of a module"));
  assert.match(ra, /if \(m\.external\) continue;/, "resolveActive must skip external modules");
});

test("both places that render a module go through ModuleLink", () => {
  // Everything below ModuleLink's own definition — its in-app branch is the one
  // legitimate <Link href={landing(m)}> in the file.
  const src = sidebar().slice(sidebar().indexOf("export default function Sidebar"));
  // The rail and the mobile drawer each draw the module list. A raw
  // <Link href={landing(m)}> in either one silently loses the external case.
  const raw = Array.from(src.matchAll(/<Link[^>]*href=\{landing\(m\)\}/g));
  assert.deepEqual(raw.map((m) => m[0]), [], "render modules through ModuleLink, not a bare <Link>");
  const uses = Array.from(src.matchAll(/<ModuleLink\b/g));
  assert.equal(uses.length, 2, `expected the rail and the drawer to use ModuleLink, found ${uses.length}`);
});

test("every module in the rail has an icon", () => {
  // The rail is 104 px wide with 11 px labels: NavIcon's default branch renders
  // an empty square, which in that space reads as a broken button.
  const icons = navIcons();
  const drawn = new Set(Array.from(icons.matchAll(/case "([a-z0-9]+)":/g)).map((m) => m[1]));
  const missing = moduleKeys(layout()).filter((k) => !drawn.has(k));
  assert.deepEqual(missing, [], `module keys with no NavIcon case: ${missing.join(", ")}`);
});
