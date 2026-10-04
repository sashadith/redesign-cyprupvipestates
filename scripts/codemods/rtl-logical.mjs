#!/usr/bin/env node
// RTL codemod: converts the regex-safe physical CSS properties (margin/padding
// -left|-right, border-left|-right[-width|-style|-color], text-align:
// left|right, float: left|right) to their logical-property equivalents, so
// the site mirrors correctly under [dir="rtl"] without per-selector overrides.
//
// Deliberately narrow and property-anchored — every rule requires the exact
// property name immediately before the colon/side, so it can NEVER touch:
//   - margin:/padding: shorthands ("margin: 0 auto")
//   - *-radius corners ("border-top-left-radius")
//   - bare left:/right: physical offsets ("left: 0")
//   - background-position, translateX(...)
// See scripts/codemods/__tests__/rtl-logical.test.mjs for the fixtures this
// is built against, and the plan's Global Constraints
// (docs/superpowers/plans/2026-09-13-hebrew-phase2-rtl.md) for why those
// exclusions matter (LTR locales must render pixel-identical).

import { readFileSync, writeFileSync } from "node:fs";

const SIDE = { left: "start", right: "end" };
const INLINE_SIDE = { left: "inline-start", right: "inline-end" };

/** Each rule: a global regex + a function building the replacement from the
 *  captured groups. Order doesn't matter — the patterns are disjoint. */
const RULES = [
  {
    // margin-left: / margin-right: / padding-left: / padding-right:
    // (never the "margin:"/"padding:" shorthand — the property name must be
    // followed by -left or -right before the colon)
    re: /(^|[;{\s])(margin|padding)-(left|right)(\s*:)/g,
    build: (pre, prop, side, colon) => `${pre}${prop}-inline-${SIDE[side]}${colon}`,
  },
  {
    // border-left: / border-right: and their -width/-style/-color suffixes.
    // Never border-top-left-radius etc. — "border-" must be directly followed
    // by "left"/"right", not by "top-left"/"bottom-right".
    re: /(^|[;{\s])border-(left|right)(-width|-style|-color)?(\s*:)/g,
    build: (pre, side, suffix, colon) => `${pre}border-inline-${SIDE[side]}${suffix || ""}${colon}`,
  },
  {
    // text-align: left|right -> start|end
    re: /(text-align\s*:\s*)(left|right)/g,
    build: (prefix, side) => `${prefix}${SIDE[side]}`,
  },
  {
    // float: left|right -> inline-start|inline-end
    re: /(float\s*:\s*)(left|right)/g,
    build: (prefix, side) => `${prefix}${INLINE_SIDE[side]}`,
  },
];

/** Pure transform: applies every rule once over the whole source. */
export function transformCss(src) {
  let out = src;
  for (const rule of RULES) {
    out = out.replace(rule.re, (_match, ...groups) => rule.build(...groups));
  }
  return out;
}

/** Count how many replacements transformCss would make, without mutating. */
export function countReplacements(src) {
  let n = 0;
  for (const rule of RULES) {
    const matches = src.match(rule.re);
    if (matches) n += matches.length;
  }
  return n;
}

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry");
  const files = args.filter((a) => a !== "--dry");

  if (files.length === 0) {
    console.error("Usage: node scripts/codemods/rtl-logical.mjs [--dry] <files…>");
    process.exit(1);
  }

  let totalFiles = 0;
  let totalReplacements = 0;

  for (const file of files) {
    let src;
    try {
      src = readFileSync(file, "utf8");
    } catch (e) {
      console.error(`${file}: cannot read (${e.message})`);
      continue;
    }
    const count = countReplacements(src);
    if (count === 0) continue;
    totalFiles++;
    totalReplacements += count;
    console.log(`${file}: ${count} replacement${count === 1 ? "" : "s"}`);
    if (!dry) {
      const out = transformCss(src);
      writeFileSync(file, out, "utf8");
    }
  }

  console.log(`${dry ? "[dry run] " : ""}${totalReplacements} replacement(s) across ${totalFiles} file(s)`);
}

// Only run the CLI when this file is executed directly (not when imported by
// the test suite).
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
