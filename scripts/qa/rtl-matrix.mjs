#!/usr/bin/env node
// RTL visual-QA matrix for the Hebrew localization Phase 2 (RTL layout) —
// see docs/superpowers/plans/2026-09-13-hebrew-phase2-rtl.md and
// docs/i18n/rtl-qa-checklist.md. This script does NOT open a browser or
// take screenshots — this project's sessions run browser tools only on
// explicit instruction (see the plan's Global Constraints), so this prints
// the EN<->HE URL pairs, one per viewport, for the operator (or an
// explicitly authorised session) to open and screenshot by hand after
// deploying this branch to staging with NEXT_PUBLIC_LIVE_LOCALES including
// "he" and applying the Phase 1 migration (see docs/i18n/acceptance/phase-1.md
// and phase-2.md for the exact steps).
//
// Locale routing (src/middleware.ts, next-intl localePrefix: "as-needed"):
// "en" is the default locale and carries NO path prefix; every other locale
// (de/pl/ru/he) is prefixed. So EN "/projects" pairs with HE "/he/projects".
//
// Usage:
//   node scripts/qa/rtl-matrix.mjs [host] [--project <slug>] [--case <slug>] [--landing <slug>] [--json]
//
// [host]      Origin to prefix every path with, e.g. https://design.cyprusvipestates.com
//             Omit it to print bare paths (useful for --json piping / tests).
// --project   Slug of a published Development for the project-detail pair.
//             Default: cypress-park (confirmed published, see
//             scripts/qa/url-inventory-production.txt: /projects/cypress-park).
// --case      Slug of a published case study.
//             Default: how-a-uk-investor-diversified-wealth-through-property-in-limassol
//             (the first case-study slug found in scripts/qa/url-inventory-production.txt).
// --landing   Slug of a published landing (Singlepage) page.
//             Default: 2-bedroom-apartments-in-paphos (confirmed published,
//             same source file).
// --json      Print a JSON array of {type, viewport, width, height, en, he}
//             instead of the pipe-delimited text table.
//
// Text output format: one line per viewport per page type —
//   type | viewport | EN url | HE url

const DEFAULTS = {
  project: "cypress-park",
  case: "how-a-uk-investor-diversified-wealth-through-property-in-limassol",
  landing: "2-bedroom-apartments-in-paphos",
};

const VIEWPORTS = [
  { label: "desktop 1440x900", width: 1440, height: 900 },
  { label: "mobile 390x844", width: 390, height: 844 },
];

function parseArgs(argv) {
  const opts = { host: "", json: false, ...DEFAULTS };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--json") {
      opts.json = true;
    } else if (arg === "--project" || arg === "--case" || arg === "--landing") {
      const key = arg.slice(2);
      const value = argv[++i];
      if (!value) {
        throw new Error(`${arg} requires a value`);
      }
      opts[key] = value;
    } else if (arg.startsWith("--")) {
      throw new Error(`Unknown flag: ${arg}`);
    } else if (!opts.host) {
      opts.host = arg.replace(/\/+$/, "");
    } else {
      throw new Error(`Unexpected extra argument: ${arg}`);
    }
  }
  return opts;
}

function buildPages(opts) {
  return [
    { type: "home", en: "/", he: "/he" },
    { type: "projects", en: "/projects", he: "/he/projects" },
    {
      type: "project",
      en: `/projects/${opts.project}`,
      he: `/he/projects/${opts.project}`,
    },
    { type: "developers", en: "/developers", he: "/he/developers" },
    { type: "blog", en: "/blog", he: "/he/blog" },
    { type: "about", en: "/about-us", he: "/he/about-us" },
    { type: "contacts", en: "/contacts", he: "/he/contacts" },
    { type: "faq", en: "/faq", he: "/he/faq" },
    { type: "privacy", en: "/privacy-policy", he: "/he/privacy-policy" },
    {
      type: "case-study",
      en: `/case-studies/${opts.case}`,
      he: `/he/case-studies/${opts.case}`,
    },
    {
      type: "landing",
      en: `/${opts.landing}`,
      he: `/he/${opts.landing}`,
    },
    { type: "404", en: "/no-such-page", he: "/he/no-such-page" },
  ];
}

function buildRows(opts) {
  const pages = buildPages(opts);
  const rows = [];
  for (const page of pages) {
    for (const viewport of VIEWPORTS) {
      rows.push({
        type: page.type,
        viewport: viewport.label,
        width: viewport.width,
        height: viewport.height,
        en: opts.host + page.en,
        he: opts.host + page.he,
      });
    }
  }
  return rows;
}

function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err.message);
    console.error(
      "Usage: node scripts/qa/rtl-matrix.mjs [host] [--project <slug>] [--case <slug>] [--landing <slug>] [--json]",
    );
    process.exitCode = 1;
    return;
  }

  const rows = buildRows(opts);

  if (opts.json) {
    console.log(JSON.stringify(rows, null, 2));
    return;
  }

  for (const row of rows) {
    console.log(`${row.type} | ${row.viewport} | ${row.en} | ${row.he}`);
  }
}

main();
