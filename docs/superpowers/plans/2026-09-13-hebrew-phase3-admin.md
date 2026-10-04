# Hebrew Localization — Phase 3: Admin Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Editors can create, edit and AI-generate Hebrew content for every content type in the admin (row-per-language documents, Development descriptions/SEO, Area texts), with RTL-correct editors, while customer-facing send surfaces (IndexNow, CRM presentations) only offer live locales.

**Architecture:** Three layers. (1) Types and constants: `FourLang` becomes `LocaleText = Record<Locale, string>` so TypeScript enumerates every consumer; every hard-coded admin locale list imports `LOCALES` (content editing) or `PUBLIC_LOCALES` (send-to-customer). (2) Data paths: `descriptionHE`, `seo.titleHE/descHE`, `textHE` are written by the admin actions and read by the render/sync paths. (3) AI: a cached Hebrew style-guide/glossary system block (`src/lib/ai/heContext.ts`), five-locale schemas, Hebrew-script validation with one retry; `dir` threaded into Tiptap and plain fields from the row's language.

**Tech Stack:** Next.js 14 App Router (server actions), Prisma 5, Tiptap 2, Anthropic SDK (`@anthropic-ai/sdk`, tool_choice forced), node:test via tsx.

**Spec:** `docs/superpowers/specs/2026-09-13-hebrew-localization-design.md` §5 "Phase 3"; Phase 1 plan `docs/superpowers/plans/2026-09-13-hebrew-phase1-locale-plumbing.md` (base branch `worktree-he-phase1-locale-plumbing`, HEAD 9bbd22b).

## Global Constraints

- Admin UI copy stays English (project convention). Only `LOCALE_LABELS.he.name` ("עברית") appears as a label.
- Content-editing surfaces use `LOCALES` (all five). Customer-facing send surfaces (IndexNow fan-out, CRM presentation locale, presentation API) use `PUBLIC_LOCALES`. Lead `languagePreference` fields use `LOCALES` (a Hebrew lead must be recordable now).
- Slug policy (spec decision A): Hebrew documents keep LATIN slugs; `slugify` is not extended to Hebrew; the slug field shows a hint for `he`.
- Every `he:` placeholder that equals English is marked `TODO(he)`; `node scripts/qa/he-placeholders.mjs` total is recorded in the acceptance doc.
- AI generators: model stays `AI_MODEL`; outputs for `he` must contain Hebrew script (`/[֐-׿]/`) and outputs for other locales must not; one automatic retry with a correction message, then throw.
- `max_tokens`: `projectDescription` 4000, `areaContent` 4000, `seoMeta` 1400.
- Never run Prisma migrations or DB writes locally (`.env.local` = production). No `npm run build` locally (Prisma client/DB skew until the Phase 1 migration is applied); `npx tsc --noEmit -p tsconfig.json` and `npm test` are the local gates.
- Never deploy. Commit on the worktree branch `worktree-he-phase2-3`, explicit paths only, trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Do not send Telegram notifications from tasks (a hook does that).

---

## File map

| File | Responsibility after this phase |
|---|---|
| `src/lib/ai/areaContent.ts` (modify) | exports `LocaleText` (= `Record<Locale, string>`), keeps `FourLang` as a deprecated alias; five-locale schema/prompt |
| `src/lib/ai/localeTextGuards.ts` (create) + `src/lib/__tests__/localeTextGuards.test.ts` (create) | pure validators: `hasHebrew`, `scriptLeaks(out)`, `emptyLocales(out)` |
| `src/lib/ai/heContext.ts` (create) | reads `docs/i18n/he-styleguide.md` + `he-glossary.md`, exports `HE_STYLE_CONTEXT` and `heSystemBlock()` (cache_control ephemeral) |
| `src/lib/ai/projectDescription.ts`, `src/lib/ai/seoMeta.ts`, `src/lib/ai/projectBrief.ts` (modify) | five locales, Hebrew rules, guards, token budgets, non-editable output-locales block |
| `src/app/admin/actions.ts` (modify) | `LOCALES` import; `createFaqTranslation` validation; `saveFaqPage` revalidate loop; new `createSiteDocTranslation` |
| `src/app/admin/TranslationsPanel.tsx`, `settings/page.tsx`, `content/featured/page.tsx`, `content/faq/page.tsx`, `content/faq/[lang]/page.tsx`, `content/{blog,pages,projects}/page.tsx`, `content/new-content-form.tsx` (modify) | derive locales from `@/lib/locale` |
| `src/app/admin/(panel)/developments/[id]/{DescriptionField,SeoMetaFields}.tsx`, `developments/[id]/page.tsx`, `developments/[id]/actions.ts` (modify) | HE tab, `descriptionHE`, `seoTitleHE/seoDescHE`, per-tab `dir`, IndexNow via `PUBLIC_LOCALES` |
| `src/app/admin/(panel)/developments/areas/{AreaEditor.tsx,actions.ts,page.tsx,[slug]/page.tsx}` (modify) | HE tab, `textHE` |
| `src/lib/developmentRender.ts`, `src/app/preview-project/ProjectPageBody.tsx`, `src/lib/seo/staleCopyFigures.ts`, four sync writers (`src/lib/**/driveAvailabilitySync.ts`, `sharepointAvailabilitySync.ts`, `dropboxAvailabilitySync.ts`, `aggSync.ts`) (modify) | read/write `descriptionHE` |
| `src/app/admin/RichTextField.tsx`, `PtEditor.tsx`, `SlugField.tsx`, the `*EditForm.tsx` components, `FaqPageEditor.tsx`, `HomepageEditor.tsx`, `content/forms/[id]/page.tsx`, `content/header/[id]/page.tsx` (modify) | `dir` threading; logical Tailwind classes in editor class strings; LTR overrides |
| `src/app/admin/(panel)/content/{landing,header,forms}/page.tsx`, `settings/page.tsx` (modify) | "+ HE" creation via `createSiteDocTranslation` |
| CRM: `crm/filters.ts`, `crm/create-lead-form.tsx`, `crm/[id]/edit/edit-lead-form.tsx`, `crm/[id]/PropertyMatching.tsx`, `crm/[id]/presentations/[presentationId]/edit/PresentationEditor.tsx`, `crm/[id]/bookingActions.ts`, `src/app/api/admin/presentations/route.ts`, `[id]/route.ts` (modify) | `LOCALES` for lead language, `PUBLIC_LOCALES` for send surfaces, `isLocale` guards |
| `scripts/qa/he-admin-fields-check.mjs` (create) | source assertions that the HE columns are wired in the three write paths and three read paths |
| `docs/i18n/acceptance/phase-3.md` (create) | acceptance + operator notes (AiPromptTemplate row caveat) |

---

### Task 1: `LocaleText` type, Hebrew guards, and every `FourLang` consumer

**Files:**
- Modify: `src/lib/ai/areaContent.ts:9` (type), `:45` (prompt), `:58-63` (schema), `:73-74` (assembly), `:48-49` (max_tokens)
- Create: `src/lib/ai/localeTextGuards.ts`, `src/lib/__tests__/localeTextGuards.test.ts`
- Modify (tsc-driven): `src/lib/ai/projectDescription.ts:28,77-81,96-97,107-108`, `src/app/admin/(panel)/developments/[id]/actions.ts` (imports of `FourLang`), `src/app/admin/(panel)/developments/areas/AreaEditor.tsx:6`, `areas/actions.ts:5`, the four sync writers (`descriptionHE: description.he` in each `create`/`update` literal)

**Interfaces:**
- Produces: `export type LocaleText = Record<Locale, string>;` `export type FourLang = LocaleText; // deprecated alias` in `areaContent.ts`.
- Produces (`localeTextGuards.ts`):
  ```ts
  import { LOCALES, type Locale } from "@/lib/locale";
  export type LocaleText = Record<Locale, string>;
  export const HEBREW_RE = /[֐-׿]/;
  export const CYRILLIC_RE = /[Ѐ-ӿ]/;
  export function hasHebrew(s: string): boolean { return HEBREW_RE.test(s); }
  /** Locales whose text is empty after trim. */
  export function emptyLocales(out: Partial<LocaleText>): Locale[] { return LOCALES.filter((l) => !(out[l] ?? "").trim()); }
  /** Script leaks: he without Hebrew; any non-he with Hebrew; en/de/pl/he with Cyrillic. Returns human-readable problems (empty = clean). */
  export function scriptLeaks(out: Partial<LocaleText>): string[] {
    const problems: string[] = [];
    for (const l of LOCALES) {
      const t = out[l] ?? "";
      if (!t.trim()) continue;
      if (l === "he" && !HEBREW_RE.test(t)) problems.push("he: no Hebrew script");
      if (l !== "he" && HEBREW_RE.test(t)) problems.push(`${l}: contains Hebrew script`);
      if (l !== "ru" && CYRILLIC_RE.test(t)) problems.push(`${l}: contains Cyrillic`);
    }
    return problems;
  }
  ```
- Consumed by Tasks 3 and 4.

- [ ] **Step 1: Write the failing tests** (`src/lib/__tests__/localeTextGuards.test.ts`)

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { hasHebrew, emptyLocales, scriptLeaks } from "@/lib/ai/localeTextGuards";

const ok = { en: "Sea-view apartments in Limassol.", de: "Wohnungen mit Meerblick in Limassol.", pl: "Apartamenty z widokiem na morze w Limassol.", ru: "Квартиры с видом на море в Лимассоле.", he: "דירות עם נוף לים בלימסול." };

test("clean five-locale output passes", () => {
  assert.ok(hasHebrew(ok.he));
  assert.deepEqual(emptyLocales(ok), []);
  assert.deepEqual(scriptLeaks(ok), []);
});
test("he without Hebrew script is a leak; Hebrew inside en is a leak; Cyrillic inside de is a leak", () => {
  assert.deepEqual(scriptLeaks({ ...ok, he: "Sea-view apartments in Limassol." }), ["he: no Hebrew script"]);
  assert.deepEqual(scriptLeaks({ ...ok, en: "דירות in Limassol" }), ["en: contains Hebrew script"]);
  assert.deepEqual(scriptLeaks({ ...ok, de: "Wohnungen в Лимассоле" }), ["de: contains Cyrillic"]);
});
test("emptyLocales lists blanks in canonical order", () => {
  assert.deepEqual(emptyLocales({ ...ok, de: "  ", he: "" }), ["de", "he"]);
});
```

- [ ] **Step 2: Run** `npm test 2>&1 | grep -A3 localeTextGuards` → FAIL (module not found).

- [ ] **Step 3: Implement `localeTextGuards.ts`** exactly as in Interfaces. Then in `areaContent.ts` replace line 9 with:

```ts
import { LOCALES, type Locale } from "@/lib/locale";
export type LocaleText = Record<Locale, string>;
/** @deprecated use LocaleText — kept so older importers compile; remove in Phase 4 cleanup. */
export type FourLang = LocaleText;
```

Prompt tail (~line 45): replace `keys exactly "en","de","pl","ru"` and "four languages" with `` keys exactly ${LOCALES.map((l) => `"${l}"`).join(",")} `` and "five languages (the Hebrew text must be written natively in Hebrew script, RTL, following the Hebrew style guide in the system prompt)". Schema (~58-63): build `properties` from `LOCALES` (`Object.fromEntries(LOCALES.map((l) => [l, { type: "string", description: `${l} (native)` }]))`) and `required: [...LOCALES]`. Assembly (~73): `const out = Object.fromEntries(LOCALES.map((l) => [l, String(p[l] ?? "")])) as LocaleText;`. `max_tokens: 4000`.

- [ ] **Step 4: Let tsc enumerate consumers**

Run `npx tsc --noEmit -p tsconfig.json 2>&1 | head -40`. Fix each:
- `projectDescription.ts`: `:96-97` schema/required from `LOCALES` (same pattern); `:107` `out` from `LOCALES`; `:81` `hasDigits` over all locales; `:77` leak check → replace with `scriptLeaks(out)` from `localeTextGuards` (keep the existing digit check). `max_tokens: 4000`. Prompt line ~72 "in four languages" → "in five languages".
- Sync writers: add `descriptionHE: description.he` next to `descriptionRU` in every `create`/`update` literal (`driveAvailabilitySync.ts:~345`, `sharepointAvailabilitySync.ts:~735`, `dropboxAvailabilitySync.ts:~572`, `aggSync.ts:~305`).
- Anything else tsc lists that only needs the wider type.

- [ ] **Step 5: Verify** — `npm test` → all pass (98 expected: 95 + 3); `npx tsc --noEmit` → nothing; `grep -rn "FourLang" src | wc -l` (report; alias may remain).

- [ ] **Step 6: Commit** `feat(ai): LocaleText with he; Hebrew-script guards; sync writers carry descriptionHE`

---

### Task 2: Admin constants sweep (content editing = `LOCALES`, send surfaces = `PUBLIC_LOCALES`)

**Files:** every site in the inventory table (§1 of the Phase 3 inventory): `src/app/admin/actions.ts:45,1317,1678-1682,1689-1701`, `TranslationsPanel.tsx:9`, `settings/page.tsx:8`, `content/featured/page.tsx:9`, `content/faq/page.tsx:7-8`, `content/faq/[lang]/page.tsx:8`, `content/{blog,pages,projects}/page.tsx`, `content/new-content-form.tsx:36`, `developments/[id]/page.tsx:111`, `developments/[id]/actions.ts:473,637`, `crm/filters.ts:12`, `crm/create-lead-form.tsx:37`, `crm/[id]/edit/edit-lead-form.tsx:44`, `crm/[id]/PropertyMatching.tsx:22-23`, `crm/[id]/presentations/[presentationId]/edit/PresentationEditor.tsx:10-11`, `crm/[id]/bookingActions.ts:36-37`, `src/app/api/admin/presentations/route.ts:48`, `[id]/route.ts:51`.

**Rules per site:**
- `LOCALES`: actions.ts (`createContent`, `createProject`, `saveHomepage`, `createTranslation`, `updateFooterSettings`), TranslationsPanel, settings footer tabs, featured tabs, faq LANGS + `LANG_NAMES` → `LOCALE_LABELS[l].name`, faq/[lang] guard → `isLocale`, list filters, new-content-form select (`LOCALE_LABELS[l].name` as option text), `developments/[id]/page.tsx` `seoLangs`, CRM lead forms + `LEAD_LOCALES`, `bookingActions.toLocale` → `isLocale(pref) ? pref : "en"`.
- `PUBLIC_LOCALES`: IndexNow fan-out (`developments/[id]/actions.ts:473,637`), `PropertyMatching.tsx` locale select + `Locale` type, `PresentationEditor.tsx`, `api/admin/presentations/route.ts:48` and `[id]/route.ts:51` (`isPublicLocale(body.locale) ? body.locale : "en"`).
- `saveFaqPage` revalidation: `for (const l of LOCALES) revalPublic(l, ["faq"]);` (helper at actions.ts:~104).
- `createFaqTranslation`: add `if (!isLocale(lang)) throw new Error("Invalid language");`.
- Comment at actions.ts:~1763 ("4-language groups") → "translated groups".
- `scripts/qa/homepage-lang-check.mjs` header prose "all four" → "every locale" (assertions untouched).

- [ ] Step 1: Apply all edits. Step 2: `grep -rn '"en", "de", "pl", "ru"\|"en","de","pl","ru"' src/app/admin src/app/api/admin` → nothing. Step 3: `npx tsc --noEmit` clean; `npm test` green; `node scripts/qa/homepage-lang-check.mjs` passes. Step 4: Commit `refactor(admin): derive every admin locale list from lib/locale (LOCALES vs PUBLIC_LOCALES)`.

---

### Task 3: Development + Area editors write and read the HE columns

**Files:**
- Modify: `developments/[id]/DescriptionField.tsx:7-13,48,52-56,70,75,86`, `SeoMetaFields.tsx:8-11,55-57,61-65,77,81,88`, `developments/[id]/page.tsx:306-309`, `developments/[id]/actions.ts:422-424,436-439`
- Modify: `developments/areas/AreaEditor.tsx:9-14,33,55,69,92-98`, `areas/actions.ts:26-42`, `areas/[slug]/page.tsx:51`, `areas/page.tsx:65,75`
- Modify (read paths): `src/lib/developmentRender.ts:85`, `src/app/preview-project/ProjectPageBody.tsx:90`, `src/lib/seo/staleCopyFigures.ts:47,159`
- Create: `scripts/qa/he-admin-fields-check.mjs`

**Interfaces:** `DescriptionField` `LANGS` gains `["he", "עברית", "descriptionHE"]`; `SeoMetaFields` `Fields` keys gain `titleHE`/`descHE` → hidden inputs `seoTitleHE`/`seoDescHE`; server action reads `descriptionHE`, `seoTitleHE`, `seoDescHE`, `textHE`.

- [ ] **Step 1: Write the QA script first** (it is the test for this task):

```js
#!/usr/bin/env node
// Source assertions: the Hebrew columns must be wired in every write and read path.
// A missed key here fails silently at runtime (null column), not at compile time.
import { readFileSync } from "node:fs";
const checks = [
  ["src/app/admin/(panel)/developments/[id]/actions.ts", ["descriptionHE", "seoTitleHE", "seoDescHE"]],
  ["src/app/admin/(panel)/developments/areas/actions.ts", ["textHE"]],
  ["src/app/admin/(panel)/developments/[id]/page.tsx", ["descriptionHE"]],
  ["src/app/admin/(panel)/developments/areas/[slug]/page.tsx", ["textHE"]],
  ["src/lib/developmentRender.ts", ["descriptionHE"]],
  ["src/app/preview-project/ProjectPageBody.tsx", ["textHE"]],
  ["src/lib/seo/staleCopyFigures.ts", ["descriptionHE"]],
];
let fail = 0;
for (const [file, needles] of checks) {
  const src = readFileSync(file, "utf8");
  for (const n of needles) if (!src.includes(n)) { console.error(`MISSING ${n} in ${file}`); fail = 1; }
}
console.log(fail ? "he-admin-fields-check: FAIL" : "he-admin-fields-check: OK");
process.exit(fail);
```

Run it → FAIL (all missing).

- [ ] **Step 2: Editors** — add the HE tuple to `LANGS` in `DescriptionField.tsx` and `AreaEditor.tsx` (`["he", "עברית"]`), `"HE"` to the `Fields` template union in `SeoMetaFields.tsx`; counters `{filled}/{LANGS.length}`; copy "all 4 languages" → `` `all ${LANGS.length} languages` ``; per-tab direction on the shared field: `dir={tab === "he" ? "rtl" : "ltr"}` on `DescriptionField.tsx:70` textarea, `SeoMetaFields.tsx:77` input + `:81` textarea, `AreaEditor.tsx:92` textarea.
- [ ] **Step 3: Server actions** — `developments/[id]/actions.ts`: `seoEntries` gains `titleHE: clean(formData, "seoTitleHE"), descHE: clean(formData, "seoDescHE")`; override write gains `descriptionHE: clean(formData, "descriptionHE")`. `areas/actions.ts` `saveArea` gains `textHE: texts.he?.trim() || null`.
- [ ] **Step 4: Initial values** — `developments/[id]/page.tsx:306-309` add `he: ov?.descriptionHE ?? ""`; `areas/[slug]/page.tsx:51` add `he: existing?.textHE ?? ""`; `areas/page.tsx:65` include `d.textHE`, `:75` denominator `LOCALES.length`.
- [ ] **Step 5: Read paths** — `developmentRender.ts:85` map gains `he: ov?.descriptionHE`; `ProjectPageBody.tsx:90` gains `he: "textHE"`; `staleCopyFigures.ts:47` `DESC_FIELDS` and `:159` select gain `descriptionHE`.
- [ ] **Step 6: Verify** — `node scripts/qa/he-admin-fields-check.mjs` → OK; `npx tsc --noEmit` clean; `npm test` green.
- [ ] **Step 7: Commit** `feat(admin): Hebrew tab + descriptionHE/seo HE/textHE across editors, actions and render paths`

---

### Task 4: AI generators — Hebrew context block, five-locale prompts, guards, token budgets

**Files:**
- Create: `src/lib/ai/heContext.ts`
- Modify: `src/lib/ai/projectDescription.ts` (system block, prompt rules ~61-74, retry using `scriptLeaks`), `src/lib/ai/areaContent.ts` (system block, retry), `src/lib/ai/seoMeta.ts:24,35,47-51,82,98,244-252,270`, `src/lib/ai/projectBrief.ts:31`

**Interfaces:**
```ts
// src/lib/ai/heContext.ts — server-only. Loads the Hebrew style guide + glossary once and
// exposes them as a cacheable system block. These two files are ~7k tokens and byte-stable
// across calls, which is exactly the case the earlier "prompt caching evaluated: skipped"
// comments in the generators ruled out for their <1k-token blocks — this block earns cache_control.
import { readFileSync } from "node:fs";
import path from "node:path";
const read = (f: string) => readFileSync(path.join(process.cwd(), "docs", "i18n", f), "utf8");
export const HE_STYLE_CONTEXT = `# Hebrew (he) writing rules — binding\n\n${read("he-styleguide.md")}\n\n${read("he-glossary.md")}`;
export type HeContextKind = "description" | "area" | "seo";
/** Trimmed context per generator kind: descriptions/areas need §1–§3 + glossary; seo needs §5–§6 + glossary §4. Falls back to the full text if headings change. */
export function heContext(kind: HeContextKind): string { /* slice by the markdown "## " headings named in the styleguide; if a heading is not found, return HE_STYLE_CONTEXT */ }
export function heSystemBlock(kind: HeContextKind) { return { type: "text" as const, text: heContext(kind), cache_control: { type: "ephemeral" as const } }; }
```
Implement `heContext` by splitting on `\n## ` and picking sections whose heading starts with the numbers listed (styleguide §1,2,3,4,5,7,8 for description/area; §4,5,6,7 for seo; glossary sections 1,2,3,5 for description/area; 2,4,5 for seo). Unit-test the slicing with a fixture string (create `src/lib/__tests__/heContext.test.ts` that tests an exported pure `sliceSections(md, wantedPrefixes)` helper — the file reads are not tested).

- [ ] **Step 1: Test + implement `heContext.ts`** (`sliceSections` pure helper with a 3-section fixture; assert selected sections and fallback when none match).
- [ ] **Step 2: Wire the system block** — in each generator's `client.messages.create({...})` add `system: [{ type: "text", text: PROJECT_BRIEF }, heSystemBlock(kind)]` (import `PROJECT_BRIEF` where not yet imported; `seoMeta.ts` already has `system: [{…PROJECT_BRIEF}]` → append the block).
- [ ] **Step 3: Prompt text** — `projectDescription.ts:~69` add the HE rendering of the off-plan term from the glossary (`על הנייר`); `~72` "five languages"; add rule: "Hebrew: Western digits, `€` before the number, no `—` dash, masculine-plural or nominal register (see system rules)". `areaContent.ts` prompt: geography names per glossary (Hebrew transliterations are in the system block; instruct "use the Hebrew place names exactly as given in the glossary"). `seoMeta.ts:24` opener names five languages; `:47-51` add Hebrew formatting example `he "החל מ-€320,000"`; `:35` note Hebrew runs shorter (risk is under-filling the 45–55/130–145 bands); `:82` closing line lists `en/de/pl/ru/he`; `:98` `LANG_KEYS` gains `titleHE`, `descHE`; `:244-246` `max_tokens: 1400`. `projectBrief.ts:31` HARD RULE 3 lists `en/de/pl/ru/he`.
- [ ] **Step 4: Non-editable output-locales block for the DB-stored seo prompt** — in `getSeoPromptTemplate()` (seoMeta.ts:~84-87) return `stored ?? DEFAULT_SEO_PROMPT` PLUS an appended constant `OUTPUT_LOCALES_BLOCK = \`\n\nOUTPUT LOCALES (fixed by the system, not editable): ${LOCALES.join(", ")}. Return one title and one description per locale.\`` so a production `AiPromptTemplate` row saved with four languages still yields Hebrew. Document in the acceptance doc that the stored row may still *say* four languages and should be refreshed via the admin "Save prompt".
- [ ] **Step 5: Guards + retry** — after parsing `out` in each generator: `const leaks = scriptLeaks(out); if (leaks.length) return attempt(\`Fix these problems and return all locales again: ${leaks.join("; ")}\`)` using each file's existing `attempt(correction)` retry pattern (one retry, then throw with the problems in the message). Keep the existing digit and empty checks.
- [ ] **Step 6: Verify** — `npm test` green (98 + heContext tests); `npx tsc --noEmit` clean; `node -e 'import("./src/lib/ai/heContext.ts")'` is NOT runnable without tsx — instead `node --import tsx -e 'import("./src/lib/ai/heContext.ts").then(m=>{const d=m.default??m;console.log(d.heContext("seo").length, d.heContext("description").length)})'` prints two non-zero lengths, seo shorter than description.
- [ ] **Step 7: Commit** `feat(ai): Hebrew style/glossary system block, five-locale prompts, script guards, token budgets`

---

### Task 5: RTL-correct editors (`dir` threading) and LTR overrides

**Files:**
- Modify: `src/app/admin/RichTextField.tsx:11-12,20`, `src/app/admin/PtEditor.tsx:35-40`, `src/app/admin/SlugField.tsx:41` (+ helpText), `src/app/admin/RichFieldEditor.tsx`, `BlockEditor.tsx`, `block-editors/BlockFieldEditor.tsx`
- Modify: every `*EditForm.tsx` under `src/app/admin/(panel)/content/**` (Blog, Page, CaseStudy, Project, Developer, LandingPage, Author, Category, HeaderNav), `FaqPageEditor.tsx`, `HomepageEditor.tsx:100,109,111`, `content/forms/[id]/page.tsx`, the server pages that render them (pass `dir={localeDir(row.language)}`)

**Interfaces:** every editor form component accepts `dir?: "ltr" | "rtl"` (default `"ltr"`), sets it on its `<form>` and passes it to `BlockEditor`/`RichTextField`/`PtEditor`; `RichTextField`/`PtEditor` accept `dir` and put it in `editorProps.attributes.dir`; `SlugField` hard-codes `dir="ltr"` + `inputMode="url"` and shows `Latin letters, digits and dashes only (Hebrew pages keep an English slug)` when `language === "he"` (new optional `language` prop).

- [ ] **Step 1:** `RichTextField` + `PtEditor`: add `dir` prop → `editorProps: { attributes: { class: EDITOR_CLASS, dir } }`; convert the class strings' physical utilities (`pl-5`→`ps-5`, `border-l-2`→`border-s-2`, `pl-3`→`ps-3`).
- [ ] **Step 2:** `BlockEditor`, `BlockFieldEditor`, `RichFieldEditor`: accept and forward `dir`.
- [ ] **Step 3:** Each `*EditForm`: `dir` prop → `<form dir={dir}>`; forward to editors; explicit `dir="ltr"` on: slug inputs (`SlugField`), URL/link inputs (`social_*_link`, `policy_*_link`, nav link fields, heroVideo URL), `datetime-local` and numeric inputs, `SeoPromptEditor` textarea, `PromptTuner` boxes.
- [ ] **Step 4:** Server pages pass `dir={localeDir(row.language)}` (blog/[id], pages/[id], case-studies/[id], projects/[id], developers/[id], authors/[id], categories/[id], landing/[id], header/[id], forms/[id], faq/[lang] (from `params.lang`), featured (from `lang`)). `HomepageEditor.tsx:100` uses the `lang` it currently voids: `const dir = localeDir(lang)` on its string/text field renderers (`:109,111`).
- [ ] **Step 5:** Verify — `npx tsc --noEmit` clean; `npm test` green; `grep -rn 'attributes: { class' src/app/admin` shows `dir` in both editors; `grep -rn "pl-5\|border-l-2" src/app/admin/RichTextField.tsx src/app/admin/PtEditor.tsx` → nothing. Runtime: `npm run dev -p 3005` (reads prod DB; acceptable) → open `/admin/content/blog` list in a browser is NOT possible here; instead `curl -s -o /dev/null -w "%{http_code}" http://localhost:3005/admin` must not be 500 (login redirect 302/200 is fine). Kill the server.
- [ ] **Step 6:** Commit `feat(admin): RTL-aware editors — dir threading, logical editor classes, LTR slug/URL/date fields`

---

### Task 6: "+ HE" creation for SiteDocuments (header, footer, forms, landing) and the FAQ path

**Files:**
- Modify: `src/app/admin/actions.ts` (new `createSiteDocTranslation(type, lang)` generalizing `createFaqTranslation`), `content/landing/page.tsx`, `content/header/page.tsx`, `content/forms/page.tsx`, `settings/page.tsx` (footer), `content/faq/page.tsx` (use the generalized action)

**Interfaces:**
```ts
export async function createSiteDocTranslation(type: string, lang: string) {
  await requireAdmin();
  if (!isLocale(lang)) throw new Error("Invalid language");
  const en = await prisma.siteDocument.findUnique({ where: { type_language: { type, language: "en" } } });
  if (!en) throw new Error(`No English ${type} document to copy`);
  await prisma.siteDocument.upsert({ where: { type_language: { type, language: lang as any } }, update: {}, create: { type, language: lang as any, data: en.data as any } });
  revalidatePath("/admin/content/" + type); // adjust per list page
}
```
`createFaqTranslation` becomes `createSiteDocTranslation("faqPage", lang)` (keep the old export as a thin wrapper for its caller).

- [ ] Step 1: implement the action; Step 2: on each list page, for every `LOCALES` entry without a row, render `<form action={createSiteDocTranslation.bind(null, TYPE, l)}><button>+ {l.toUpperCase()} from English</button></form>` next to the existing rows (same pill style as `TranslationsPanel`); Step 3: `npx tsc --noEmit`, `npm test`; Step 4: Commit `feat(admin): create HE (any locale) SiteDocument copies from English for header/footer/forms/landing/faq`.

---

### Task 7: Acceptance doc + placeholder count + final greps

**Files:** create `docs/i18n/acceptance/phase-3.md`; run `node scripts/qa/he-placeholders.mjs` and record the total; `grep -rn "FourLang" src` (list remaining alias users; fine).

Acceptance content: what an editor can now do (step list: create HE translation of a Singlepage via TranslationsPanel → edit in RTL editor → Latin slug → save DRAFT → preview under `/he/<slug>` on staging with the env var); Development: HE tab, "Rewrite with Claude" yields Hebrew text (verify Hebrew script), Meta HE; Areas HE; CRM shows HE only in lead-language fields until launch; operator caveat: production `AiPromptTemplate` row for `seoMeta` should be re-saved from the admin prompt editor so its text names five languages (the fixed OUTPUT LOCALES block guarantees Hebrew output regardless); staging verification steps (deploy-staging from this branch — Phase 1 migration must already be applied).

- [ ] Commit `docs(i18n): Phase 3 acceptance`.

---

## Self-review

- Spec coverage (Phase 3 list): TranslationsPanel/createTranslation ✔ T2; Development tabs + save ✔ T3; KI generators five locales + glossary injection ✔ T4; list filters/new-content/settings/featured/FAQ/CRM ✔ T2; RTL editor ✔ T5; admin stays English ✔; acceptance ✔ T7. Additions beyond the spec, justified by the inventory: read paths + sync writers (T1/T3; otherwise HE text is invisible), SiteDocument creation (T6; no affordance existed), guards/tests (T1/T4).
- Placeholders: none in this plan; `heContext` slicing rules are explicit; `createSiteDocTranslation` body is given.
- Type consistency: `LocaleText`, `scriptLeaks`, `emptyLocales`, `hasHebrew`, `heSystemBlock`, `heContext`, `createSiteDocTranslation`, `dir` prop names consistent across tasks.
