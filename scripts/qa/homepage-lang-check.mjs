#!/usr/bin/env node
/* Guard for the homepage editor's language switcher.

   The bug this exists for (reported 2026-09-11): picking DE, PL or RU left the
   editor showing English. The documents were correct in the database — all four
   carried their own title and meta title — and the switcher did navigate. The
   fault was one missing React key.

   HomepageEditor seeds its state from the `data` prop inside a useState
   initialiser. That initialiser runs on mount and never again. Switching
   language changes only the ?lang= search param, so Next keeps the route
   segment mounted and React reuses the SAME component instance: the new
   language's document arrives as a prop and is silently dropped.

   Two things therefore have to stay true together, and neither is meaningful
   without the other:
     - the call site passes key={lang}, so a language switch remounts;
     - the editor still seeds from props on mount, which is WHY the key matters.

   If someone later replaces the mount-only seed with an effect that syncs on
   every `data` change, this check will fail — correctly. Read the call-site
   comment, decide deliberately, and update both.

   These are source-text assertions rather than a rendered test: the repository
   has no React test renderer, and a bug whose entire surface is one JSX
   attribute is worth pinning even coarsely. It is the same style the copy
   assertions in feed-digest-check.mjs use.

     node scripts/qa/homepage-lang-check.mjs

   Exits non-zero on the first failed assertion. */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

let failures = 0;
function check(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { console.log(`  ok   ${name}`); return; }
  failures++;
  console.log(`  FAIL ${name}\n       expected ${e}\n       actual   ${a}`);
}

const PAGE = "src/app/admin/(panel)/content/featured/page.tsx";
const EDITOR = "src/app/admin/(panel)/content/featured/HomepageEditor.tsx";
const page = read(PAGE);
const editor = read(EDITOR);

/* The fix itself. `key` must come from the language, not from a constant: a
   constant key remounts nothing and would pass a naive "has a key" test. */
check("the editor is rendered with a key", /<HomepageEditor[^>]*\skey=\{/.test(page), true);
check("that key is the language", /<HomepageEditor[^>]*\skey=\{lang\}/.test(page), true);

/* Why the key is required. If this stops being true the key may be redundant —
   but that is a decision to make on purpose, not to discover later. */
check("the editor still seeds its state on mount only",
  /const \[doc, setDoc\] = useState<any>\(\(\) =>/.test(editor), true);
check("and seeds it from the data prop",
  /useState<any>\(\(\) => JSON\.parse\(JSON\.stringify\(data/.test(editor), true);

/* The switcher has to keep offering every language the document exists in, and
   has to drive the same param the page reads. */
check("the page reads ?lang=", /searchParams\.lang/.test(page), true);
check("the switcher links to ?lang=", /href=\{`\/admin\/content\/featured\?lang=\$\{l\}`\}/.test(page), true);

/* The save action must be bound to the language being edited — remounting the
   editor is pointless if the write lands on the wrong document. */
check("saving is bound to the selected language",
  /action=\{saveHomepage\.bind\(null, lang\)\}/.test(page), true);

/* The explanation has to survive alongside the code. A future reader tidying up
   an "unused" attribute is exactly how this regresses. */
check("the call site explains why the key exists",
  /key=\{lang\}[\s\S]{0,80}load-bearing/.test(page), true);

console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
