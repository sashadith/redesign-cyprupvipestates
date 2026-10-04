#!/usr/bin/env node
/* Guard for the retired-project 301 (src/lib/retiredProjectRedirects.ts, wired
   into src/middleware.ts).

   Why it exists: /projects/golf-residences and /projects/eden-golf were the
   same BBF building, live against each other for two and a half weeks, because
   a Development's identity is its feedKey ("manual:<uuid>" vs "bbf:38") and
   nothing matches on name. The hand-made one was archived on 2026-09-16 and
   404s; this redirect points its remaining search traffic at the survivor.

   The three things that can silently go wrong here, each pinned below:
     - the locale is dropped, sending a German visitor to the English page;
     - a sub-path is flattened onto the survivor, inventing a URL;
     - the map and the middleware drift apart, so the rule exists but never runs.

     node scripts/qa/retired-project-redirect-check.mjs

   Exits non-zero on the first failed assertion. */
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

let build;
try {
  ({ build } = await import("esbuild"));
} catch {
  console.error("esbuild is not installed (it is only a transitive dependency).\n  npm i -D esbuild   — or run this check from a tree where it is present.");
  process.exit(2);
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const written = [];
async function bundle(entry, name) {
  const path = join(ROOT, `.qa-${name}-${process.pid}.mjs`);
  const out = await build({ entryPoints: [join(ROOT, entry)], bundle: true, platform: "node", format: "esm", write: false });
  writeFileSync(path, out.outputFiles[0].text);
  written.push(path);
  return path;
}
const R = await import(await bundle("src/lib/retiredProjectRedirects.ts", "retired-redirects"));
process.on("exit", () => { for (const p of written) rmSync(p, { force: true }); });

let failures = 0;
function check(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { console.log(`  ok   ${name}`); return; }
  failures++;
  console.log(`  FAIL ${name}\n       expected ${e}\n       actual   ${a}`);
}
const t = (p) => R.retiredProjectTarget(p);

/* The redirect itself, in every locale the site serves. All four targets were
   verified to answer HTTP 200 before this shipped. */
check("English redirects", t("/projects/golf-residences"), "/projects/eden-golf");
check("German keeps its locale", t("/de/projects/golf-residences"), "/de/projects/eden-golf");
check("Polish keeps its locale", t("/pl/projects/golf-residences"), "/pl/projects/eden-golf");
check("Russian keeps its locale", t("/ru/projects/golf-residences"), "/ru/projects/eden-golf");
/* Every non-default locale in LOCALES, not a hard-coded three: with a literal
   (de|pl|ru) the Hebrew URL fell through to a 404 while the others 308'd
   (staging, 2026-09-20). */
check("Hebrew keeps its locale", t("/he/projects/golf-residences"), "/he/projects/eden-golf");

/* Everything else must fall through untouched. A redirect rule that fires too
   widely is worse than none: it takes a working page away. */
check("the survivor is not itself redirected", t("/projects/eden-golf"), null);
check("another project is untouched", t("/projects/naftikos-residences"), null);
check("the listing is untouched", t("/projects"), null);
check("a localized listing is untouched", t("/de/projects"), null);
check("an unrelated path is untouched", t("/de/doma-na-kipre"), null);

/* A sub-path under a retired slug must NOT be flattened onto the survivor —
   that would invent a URL the survivor never had. */
check("a sub-path is not flattened", t("/projects/golf-residences/units"), null);
check("a localized sub-path is not flattened", t("/de/projects/golf-residences/units"), null);

/* An unknown locale prefix is not a locale, and inventing a redirect into
   one would be worse than leaving it alone. (/he/ IS a locale since the
   Hebrew localization — see the Hebrew case above.) */
check("an unsupported locale prefix does not match", t("/fr/projects/golf-residences"), null);
check("/en/ is not a prefix this site serves", t("/en/projects/golf-residences"), null);

/* The map and the middleware have to stay wired together. A rule that exists
   but is never called is the quiet way this regresses. */
const mw = readFileSync(join(ROOT, "src/middleware.ts"), "utf8");
check("middleware imports the helper", /import \{ retiredProjectTarget \} from "@\/lib\/retiredProjectRedirects"/.test(mw), true);
check("middleware calls it", /retiredProjectTarget\(request\.nextUrl\.pathname\)/.test(mw), true);
check("and redirects with 301, not 302 or 308", /retiredTarget[\s\S]{0,260}NextResponse\.redirect\(url, 301\)/.test(mw), true);

/* It must run before the i18n rewrite swallows it — in practice, before the
   /properties rule that documents that same hazard. */
// The /properties regex is built once at module top (PROPERTIES_RE, from
// lib/locale's non-default-locale pattern); the RULE is where it is matched.
check("it runs before the /properties rule",
  mw.indexOf("retiredProjectTarget(request.nextUrl.pathname)") < mw.indexOf("pathname.match(PROPERTIES_RE)") && mw.indexOf("pathname.match(PROPERTIES_RE)") > 0, true);

console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
