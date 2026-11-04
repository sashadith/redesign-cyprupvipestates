# Design Settings and Colour Sets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an owner-only design page at `/crm/settings/design` with these parts:
- named colour sets, each saved on its own;
- global fonts, font sizes and corner rounding;
- a per-person colour-set choice for CRM staff and portal partners;
- partner emails themed with the recipient's set.

**Architecture:**
- **Pure module** `src/lib/design/theme.ts`. It holds:
  - the 12 colour roles and the built-in and starter sets;
  - validation, WCAG contrast checks and accent derivation;
  - the `--ds-*` CSS variable output and the email theme.
- **Store module** `src/lib/design/store.ts`. It reads and writes the new tables and resolves "which set does this viewer see".
- **Layouts.** The CRM and portal layouts inject `<style>` with the viewer's `--ds-*` variables. `crm.css` and `portal.css` are re-pointed at those variables, and the defaults reproduce today's look exactly.
- **Emails.** `renderPartnerEmail` takes a theme argument. Senders resolve the partner's set.
- **Previews.** These are real pages under a new top-level `/crm-preview/*` segment, each with its own root layout. They are embedded as iframes and fed draft values by `postMessage`.

**Tech Stack:** Next.js 14.2 App Router, Prisma 5.22 (additive migration), node:test via tsx.

**Spec:** `docs/superpowers/specs/2026-10-22-design-settings-design.md`

## Global Constraints

- **Local DB is production.** The local `.env.local` DATABASE_URL is the LIVE production DB. Never run migrate, db push, `next build` or `next dev` against it, or anything else that connects to a DB. The controller verifies the migration on PGlite (`scratchpad/pgcheck`; `prisma migrate diff` must be empty). Never send email or Telegram.
- **Do not touch:** `src/app/admin`, the public website (`src/app/[lang]`, `src/app/design-tokens.css`), customer emails (`src/lib/crm/sendCrmEmail.ts`, `src/app/api/*`), the credit-note PDF, or anything Hebrew.
- **Copy and language:**
  - The design page, the CRM switcher and all audit text are in English.
  - The portal switcher is in en/de/pl/ru (DE "Sie", PL "Państwo", RU "Вы") through the portal dictionary.
- **Defaults must be pixel-identical to today.** With no rows saved and no choice stored, every computed colour, size and radius equals today's value. Partner email HTML is byte-identical.
- **No in-memory cache.** Layouts read per request (both are already `force-dynamic`).
- **Checks:**
  - `npm test` green, `npx tsc --noEmit` 0 errors.
  - `npm run lint`: no new errors. One error already exists in `src/lib/__tests__/engagementCtaClick.test.ts`; leave it alone.
- **Git:** commit with explicit paths, never `git add -A`. Do not push and do not deploy.
- **Regex in `.ts`:** no `u` flag and no `\p{L}` (tsconfig has no `target`).
- **Server actions:** every `"use server"` export checks its own auth. Owner actions use `getCrmUser()` + `isOwner`. Staff actions use `getCrmUser()`. Partner actions use `getPartner()` and require partner status ACTIVE.

## Review Focus

1. **Malformed set JSON in the DB** (manual edit, older shape, missing role). The layout must still render: missing or invalid roles fall back to Classic's value. It must never throw. Test: `normalizeSetValues` in Task 1.
2. **Deleted or unoffered set still stored on a person.** Resolution falls back to the default set, and the switcher does not list it. Test: `resolveViewerSet` in Task 2.
3. **Forged set id from a client.** A staff user posts a partners-only set id, or a partner posts a staff-only id. The server rejects it and nothing changes. Test: `canChooseSet` in Task 2, plus the action tests in Task 8.
4. **The last default set.** Deleting the default set or a built-in set is refused, and so is un-offering the default set from either side. Test: `validateSetMutation` in Task 2.
5. **Dark set in the CRM.** Stage and semantic colours on a dark Card must stay readable (4.5:1). Field text must stay readable on the Field colour. Test: the contrast table test in Task 3.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/design/theme.ts` (new) | pure: roles, sets, global settings, validation, contrast, derivation, CSS vars, email theme |
| `src/lib/design/store.ts` (new) | DB reads/writes, viewer resolution, history, audit |
| `src/lib/design/DsStyle.tsx` (new) | server component that renders `<style>` with the `--ds-*` vars for a scope |
| `prisma/schema.prisma`, `prisma/migrations/20261022120000_design_settings/migration.sql` (new) | tables + columns + seed |
| `src/app/crm/crm.css`, `src/app/crm/layout.tsx` | CRM re-pointed at `--ds-*` |
| `src/app/partner-portal/portal.css`, `src/app/partner-portal/layout.tsx` | portal re-pointed at `--ds-*` |
| `src/lib/partner/mail.ts`, `notify.ts`, `digest.ts`, `notifySend.ts`, `digestSend.ts`, `accounts.ts`, `src/app/crm/partners/actions.ts`, `src/app/partner-portal/bankActions.ts` | themed partner emails |
| `src/app/crm/settings/design/*` (new) | owner page + actions |
| `src/app/crm-preview/*` (new), `src/middleware.ts` | preview pages |
| `src/app/crm/components/Shell.tsx`, `src/app/crm/components/ThemePicker.tsx` (new), `src/app/crm/themeActions.ts` (new) | staff switcher, Design nav entry |
| `src/app/partner-portal/components/ThemeSwitcher.tsx` (new), `src/app/partner-portal/themeAction.ts` (new), `PortalShell.tsx`, `profile/page.tsx`, `src/lib/partner/i18n*` | partner switcher |
| `src/lib/__tests__/design*.test.ts` (new) | tests |

---

### Task 1: Pure theme module

**Files:**
- Create: `src/lib/design/theme.ts`
- Test: `src/lib/__tests__/designTheme.test.ts`

**Interfaces — Produces:**
```ts
export const ROLE_KEYS = ["page","surface","card","text","muted","accent","accentText","accentHover","gold","border","onAccent","field"] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];
export type SetValues = Record<RoleKey, string>;            // "#RRGGBB" uppercase
export type GlobalSettings = {
  headingFont: HeadingFont; bodyFont: BodyFont;
  crmBase: number; portalBase: number; emailBase: number;  // px
  headingScale: number; radius: number;                    // factor, px
  derivedAccent: boolean;                                  // per-set derivation toggle default
};
export const HEADING_FONTS = ["Fraunces","Playfair Display","Cormorant Garamond","Bodoni Moda","EB Garamond","Spectral"] as const;
export const BODY_FONTS = ["Mulish","Manrope","Onest","Commissioner","Tenor Sans"] as const;
export const CLASSIC: SetValues; export const WEBSITE: SetValues;
export const STARTER_SETS: { name: string; values: SetValues }[];   // Stone grey, Navy, Anthracite gold
export const DEFAULT_GLOBAL: GlobalSettings;
export const RANGES: { crmBase:[12,18]; portalBase:[14,20]; emailBase:[13,18]; headingScale:[0.8,1.3]; radius:[0,24] };
export function normalizeSetValues(raw: unknown): SetValues;            // invalid/missing role → CLASSIC's value; never throws
export function normalizeGlobal(raw: unknown): GlobalSettings;          // invalid/out-of-range field → DEFAULT_GLOBAL's value
export function validateSetValues(raw: unknown): { ok: true; values: SetValues } | { ok: false; errors: Partial<Record<RoleKey,string>> };
export function validateGlobal(raw: unknown): { ok: true; value: GlobalSettings } | { ok: false; errors: Record<string,string> };
export function contrastRatio(a: string, b: string): number;            // WCAG 2.1, 2 decimals not rounded internally
export type ContrastWarning = { pair: string; fg: RoleKey; bg: RoleKey; ratio: number };
export function contrastWarnings(v: SetValues): ContrastWarning[];      // threshold 4.5
export function isDarkSet(v: SetValues): boolean;                       // relative luminance of card < 0.4
export function deriveAccentVariants(accent: string, page: string, card: string): { accentText: string; accentHover: string };
export function cssVars(v: SetValues, g: GlobalSettings): string;       // "--ds-page:#F5F1E8;..." declarations, no selector
export type EmailTheme = { page: string; card: string; text: string; muted: string; accent: string; onAccent: string; gold: string; border: string; base: number; radius: number; headingFamily: string };
export function emailTheme(v: SetValues, g: GlobalSettings): EmailTheme;
export const CLASSIC_EMAIL_THEME: EmailTheme;                           // emailTheme(CLASSIC, DEFAULT_GLOBAL)
```

These values are copied verbatim from the spec. CLASSIC is:
`page #F5F1E8, surface #EDE7D9, card #FBF9F3, text #221C15, muted #59534C, accent #8E6B3D, accentText #7A5A30, accentHover #6E512B, gold #C29A5E, border #E4DCCB, onAccent #FFFFFF, field #FFFFFF`

WEBSITE is:
`page #081512, surface #0C1E1B, card #102826, text #EFE9DB, muted #AEAEA3, accent #C29A5E, accentText #C29A5E, accentHover #D8B268, gold #C29A5E, border #2D3732, onAccent #081512, field #0B1A17`

STARTER_SETS (Claude's proposal). The implementer may nudge a value only when the contrast test fails, and must note it in the report.
- **Stone grey:** `#F2F3F4 #E6E8EA #FAFBFB #1E2124 #4F555B #2F5D62 #2A5357 #23464A #A9B4B8 #D9DDE0 #FFFFFF #FFFFFF`
- **Navy:** `#F4F6F9 #E8ECF2 #FBFCFD #18202B #4D5664 #1F3A5F #1F3A5F #172C48 #B89B5E #DCE1E8 #FFFFFF #FFFFFF`
- **Anthracite gold:** `#16181A #1D2023 #23272A #ECE7DD #A9A49A #C29A5E #C9A46A #D8B47A #C29A5E #363A3E #16181A #1B1E21`

Each list is in ROLE_KEYS order.

DEFAULT_GLOBAL is: `{ headingFont:"Fraunces", bodyFont:"Mulish", crmBase:14, portalBase:16, emailBase:15, headingScale:1, radius:16, derivedAccent:true }`.

`cssVars` emits these variables:
- one variable per role: `--ds-page`, `--ds-surface`, `--ds-card`, `--ds-text`, `--ds-muted`, `--ds-accent`, `--ds-accent-text`, `--ds-accent-hover`, `--ds-gold`, `--ds-border`, `--ds-on-accent`, `--ds-field`;
- `--ds-font-heading: '<font>'` and `--ds-font-body: '<font>'`;
- `--ds-crm-scale: <crmBase/14>` and `--ds-portal-base: <portalBase>px`;
- `--ds-heading-scale: <n>` and `--ds-radius-scale: <radius/16>`.

Numbers have no trailing zeros, so the defaults give `--ds-crm-scale:1` and `--ds-radius-scale:1`.

`emailTheme` maps:
- the colour roles 1:1;
- `base` = emailBase and `radius` = radius;
- `headingFamily` = `Georgia,'Times New Roman',serif` for every offered heading font (all are serif).

Contrast pairs checked by `contrastWarnings`:

| Pair | Foreground | Background |
|---|---|---|
| text/page | text | page |
| text/card | text | card |
| muted/card | muted | card |
| accentText/page | accentText | page |
| accentText/card | accentText | card |
| onAccent/accent | onAccent | accent |
| text/field | text | field |

`deriveAccentVariants`:
- Step the accent's HSL lightness in 3-point steps, darker when the page is light (luminance ≥ 0.4) and lighter otherwise, until `contrastRatio` ≥ 4.5 against both page and card. That colour is `accentText`.
- `accentHover` is one more step in the same direction.
- If the accent already passes, `accentText` = accent.
- Cap at 30 steps, then return the last value.

- [ ] **Step 1: Write the failing tests** in `designTheme.test.ts`:
  - `cssVars(CLASSIC, DEFAULT_GLOBAL)` contains `--ds-page:#F5F1E8`, `--ds-crm-scale:1`, `--ds-radius-scale:1`, `--ds-font-heading:'Fraunces'` and `--ds-portal-base:16px`.
  - `contrastWarnings` returns `[]` for CLASSIC, WEBSITE and each STARTER_SETS entry.
  - `contrastRatio("#FFFFFF","#000000") === 21` and `contrastRatio("#8E6B3D","#F5F1E8")` rounds to 4.31.
  - `isDarkSet(WEBSITE) === true` and `isDarkSet(CLASSIC) === false`.
  - `normalizeSetValues({ page: "nope", text: "#000000" })` gives `page === CLASSIC.page` and `text === "#000000"`. `normalizeSetValues(null)` deep-equals CLASSIC. Lowercase `#abcdef` normalises to `#ABCDEF`.
  - `validateSetValues` rejects `#FFF`, `red` and a missing role, with a per-role error.
  - `validateGlobal` rejects `crmBase: 11`, `radius: 25`, `headingFont: "Comic Sans"` and `headingScale: 1.31`.
  - `normalizeGlobal({ crmBase: 99 }).crmBase === 14`.
  - `deriveAccentVariants("#B08850", CLASSIC.page, CLASSIC.card)`: `accentText` reaches ≥ 4.5 on both, and `accentHover` is darker (lower luminance) than `accentText`.
  - `deriveAccentVariants("#7A5A30", WEBSITE.page, WEBSITE.card)` returns lighter variants that reach ≥ 4.5.
  - `emailTheme(CLASSIC, DEFAULT_GLOBAL)` deep-equals `CLASSIC_EMAIL_THEME`, with `base 15`, `radius 16` and `muted "#59534C"`.
- [ ] **Step 2:** Run `npx tsx --test src/lib/__tests__/designTheme.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3:** Implement `src/lib/design/theme.ts` per the interfaces. It is pure, with no imports from Prisma or Next.
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5:** Commit: `git add src/lib/design/theme.ts src/lib/__tests__/designTheme.test.ts && git commit -m "Design settings: pure theme module (roles, sets, contrast, CSS vars)"`

---

### Task 2: Schema, migration and store

**Files:**
- Modify: `prisma/schema.prisma` (models + `User.designThemeId`, `Partner.designThemeId`)
- Create: `prisma/migrations/20261022120000_design_settings/migration.sql`
- Create: `src/lib/design/store.ts`
- Test: `src/lib/__tests__/designStore.test.ts`

**Schema:**
```prisma
model DesignTheme {
  id                String   @id @default(uuid())
  key               String?  @unique          // "classic" | "website" for built-ins, null otherwise
  name              String
  values            Json
  offeredToStaff    Boolean  @default(true)
  offeredToPartners Boolean  @default(true)
  isDefault         Boolean  @default(false)  // exactly one true: partial unique index in SQL
  sort              Int      @default(0)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  updatedById       String?
  versions          DesignThemeVersion[]
  users             User[]
  partners          Partner[]
  @@map("design_themes")
}
model DesignThemeVersion {
  id String @id @default(uuid())
  themeId String
  theme DesignTheme @relation(fields: [themeId], references: [id], onDelete: Cascade)
  values Json
  name String
  createdAt DateTime @default(now())
  createdById String?
  @@index([themeId, createdAt])
  @@map("design_theme_versions")
}
model DesignSettingsVersion {
  id String @id @default(uuid())
  values Json
  note String?
  createdAt DateTime @default(now())
  createdById String?
  @@index([createdAt])
  @@map("design_settings_versions")
}
```

Both `User` and `Partner` get these two lines:
```prisma
designThemeId String?
designTheme DesignTheme? @relation(fields: [designThemeId], references: [id], onDelete: SetNull)
```

**Migration rules:**
- Additive only, in the house style of `20261020100000_partner_tiers_rating` (header comment).
- Add a partial unique index: `CREATE UNIQUE INDEX "design_themes_one_default" ON "design_themes"("isDefault") WHERE "isDefault";`
- Foreign keys `ON DELETE SET NULL ON UPDATE CASCADE`.
- Seed INSERT of 5 rows with fixed literal ids (`'ds-classic'`, `'ds-website'`, `'ds-stone'`, `'ds-navy'`, `'ds-anthracite'`):

  | Row | key | isDefault | sort | offered |
  |---|---|---|---|---|
  | Classic | `classic` | true | 1 | both sides |
  | Live website | `website` | false | 2 | both sides |
  | Stone grey | null | false | 3 | both sides |
  | Navy | null | false | 4 | both sides |
  | Anthracite gold | null | false | 5 | both sides |

- `values` is the JSON of the matching Task 1 constant.

**Interfaces — Consumes:** Task 1 (`SetValues`, `normalizeSetValues`, `normalizeGlobal`, `validateSetValues`, `validateGlobal`, `CLASSIC`, `DEFAULT_GLOBAL`).

**Interfaces — Produces** (`store.ts`):

Pure functions, exported and unit-tested:
```ts
export type Side = "staff" | "partner";
export type ThemeRow = { id: string; key: string | null; name: string; values: SetValues; offeredToStaff: boolean; offeredToPartners: boolean; isDefault: boolean; sort: number };
export function offeredOn(row: ThemeRow, side: Side): boolean;
export function resolveViewerSet(choiceId: string | null, rows: ThemeRow[], side: Side): ThemeRow; // choice if exists+offered, else default, else synthetic Classic row
export function canChooseSet(id: string, rows: ThemeRow[], side: Side): boolean;
export type SetMutation = { kind: "delete"; id: string } | { kind: "update"; id: string; offeredToStaff: boolean; offeredToPartners: boolean } | { kind: "makeDefault"; id: string };
export function validateSetMutation(m: SetMutation, rows: ThemeRow[]): string | null; // error text or null
```

DB functions take `db = prisma`:
```ts
export async function listThemes(db?): Promise<ThemeRow[]>;            // ordered by sort, name; values normalised
export async function loadGlobal(db?): Promise<GlobalSettings>;        // newest design_settings_versions row, else DEFAULT_GLOBAL
export async function designForStaff(userId: string, db?): Promise<{ set: ThemeRow; global: GlobalSettings; offered: ThemeRow[] }>;
export async function designForPartner(partnerId: string | null, db?): Promise<{ set: ThemeRow; global: GlobalSettings; offered: ThemeRow[] }>;
export async function emailThemeForPartner(partnerId: string | null, db?): Promise<EmailTheme>; // never throws: on error logs "[design email theme]" and returns CLASSIC_EMAIL_THEME
export async function saveTheme(actor, input: { id?: string; name: string; values: SetValues; offeredToStaff: boolean; offeredToPartners: boolean }, db?): Promise<string>; // create/update + version row + audit design_theme_save (before/after)
export async function deleteTheme(actor, id: string, db?): Promise<void>;     // refuses per validateSetMutation; SetNull clears choices; audit design_theme_delete
export async function makeDefaultTheme(actor, id: string, db?): Promise<void>; // one transaction: clear old, set new; audit design_theme_default
export async function restoreThemeVersion(actor, versionId: string, db?): Promise<void>; // inserts new version + updates theme; audit design_theme_save note "restore"
export async function restoreBuiltIn(actor, id: string, db?): Promise<void>;  // key classic→CLASSIC, website→WEBSITE; others refused
export async function saveGlobal(actor, value: GlobalSettings, note: string | null, db?): Promise<void>; // insert version + audit design_settings_save
export async function themeHistory(id: string, db?): Promise<{ id: string; name: string; values: SetValues; createdAt: Date; createdById: string | null }[]>; // last 20
export async function globalHistory(db?): Promise<{ id: string; values: GlobalSettings; note: string | null; createdAt: Date }[]>; // last 20
export async function setStaffChoice(userId: string, themeId: string | null, db?): Promise<boolean>;    // false if !canChooseSet
export async function setPartnerChoice(partnerId: string, themeId: string | null, db?): Promise<boolean>;
```

- `actor` is `{ id, name, email }` as in `writeAudit` (`src/lib/crm/audit.ts`).
- `targetType` is `"design_theme"` or `"design_settings"`.

Validation rules:
- `validateSetMutation`:
  - refuses deleting a built-in (`key` not null): "Built-in sets cannot be deleted";
  - refuses deleting the default: "Make another set the default first";
  - refuses un-offering the default from either side: "The default set must be offered to staff and partners";
  - refuses an unknown id: "Unknown set".
- `makeDefault` requires the target to be offered on both sides.

- [ ] **Step 1: Write the failing tests** (pure functions only):
  - `resolveViewerSet` returns the choice when it exists and is offered.
  - It returns the default when the choice is null, deleted, or not offered on that side.
  - It returns a synthetic row with `values` deep-equal to CLASSIC and `id "ds-classic"` when `rows` is empty.
  - `canChooseSet` is false for a partners-only set on staff, and vice versa.
  - Every refusal case of `validateSetMutation` returns its exact text above.
  - Migration-sync test: read `migration.sql`, extract the 5 `values` JSON literals and deep-equal them to `CLASSIC`, `WEBSITE` and `STARTER_SETS` in order. This guards drift between the seed and the constants.
- [ ] **Step 2:** Run `npx tsx --test src/lib/__tests__/designStore.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Write the schema and migration. Run `npx prisma generate` (no DB connection) and implement `store.ts`.
- [ ] **Step 4:** Run the test (PASS) and `npx tsc --noEmit` (0).
- [ ] **Step 5:** Commit the schema, migration, store and test with explicit paths: "Design settings: tables, seed of 5 colour sets, store".
- [ ] **Controller:** run the PGlite check. `prisma migrate diff` must be empty, and the seed rows must be present.

---

### Task 3: CRM re-pointed at the design variables

**Files:**
- Create: `src/lib/design/DsStyle.tsx`
- Modify: `src/app/crm/crm.css`, `src/app/crm/layout.tsx`
- Test: `src/lib/__tests__/designCrmCss.test.ts`

**Interfaces:**
- Consumes: `designForStaff`, `cssVars`, `isDarkSet` (Tasks 1–2).
- Produces: `DsStyle({ scope, vars }: { scope: "crm" | "portal"; vars: string })`, a server component rendering `<style>{`:root{${vars}}`}</style>`. `vars` comes only from `cssVars` (validated hex, whitelisted fonts, numbers), so no user text reaches CSS.

**Layout (`src/app/crm/layout.tsx`):**
- Call `designForStaff(user.id)` inside try/catch. On error, use CLASSIC + DEFAULT_GLOBAL and log `[crm design]`.
- Render `<DsStyle>` in `<head>`.
- Add `ds-dark` to the body className when `isDarkSet(set.values)`.
- Make `viewport` a `generateViewport()` that returns `themeColor` = the viewer's page colour. Also check that `.crm-html` background reads `var(--ds-page)`.

**Re-pointing rules for `crm.css`:**
1. **Variables on `.crm-app`:**
   - `--bg: var(--ds-page)`, `--panel: var(--ds-card)`, `--colbg: var(--ds-surface)`, `--ink: var(--ds-text)`, `--muted: var(--ds-muted)`;
   - `--accent: var(--ds-accent)`, `--accent-ink: var(--ds-accent-text)`, `--accent-deep: var(--ds-accent-hover)`, `--onaccent: var(--ds-on-accent)`;
   - `--champagne: var(--ds-gold)`, `--field-bg: var(--ds-field)`;
   - `--gold-contour` built from `var(--ds-gold)`;
   - `--r: calc(16px * var(--ds-radius-scale))`.

   Also define fallbacks on `.crm-html` for every `--ds-*` with today's values, so the CSS works without the injected style.
2. **Translucents:** every `rgba(34, 28, 21, a)` becomes `color-mix(in srgb, var(--ds-text) a*100%, transparent)`, and every `rgba(142, 107, 61, a)` becomes the same with `var(--ds-accent)`. The top bar `rgba(245, 241, 232, 0.92)` uses `var(--ds-page)` at 92%. Shadows follow the same rule.
3. **Remaining hex literals** map to a role variable when they equal a CLASSIC value; otherwise they stay (white on accent is `--onaccent`). The only allowed leftover hex values are the semantic and stage colours (`--good`, `--warn`, `--danger`, `.s-*`).
4. **Font sizes:** every `NNpx` inside `font-size:` or a `font:` shorthand becomes `calc(NNpx * var(--ds-crm-scale))`. If the rule's font family is `var(--display)`, it becomes `calc(NNpx * var(--ds-crm-scale) * var(--ds-heading-scale))`. The base `font-size: 14px` on `.crm-app` follows the same rule.
5. **Radii:** every `border-radius: Npx` with 1 ≤ N < 999 becomes `calc(Npx * var(--ds-radius-scale))`. Pill radii (≥ 999px or `50%`) stay.
6. **Fonts:** `--display: var(--ds-font-heading), var(--font-display-cyr), Georgia, serif` and `--body: var(--ds-font-body), system-ui, sans-serif`. The Playfair Cyrillic fallback stays.
7. **Dark variants:** under `.crm-app.ds-dark`, redefine `--good`, `--warn`, `--danger`, `--partnerfg` and each `.s-*` `--sc`. The values are the implementer's, but each must reach ≥ 4.5:1 on WEBSITE.card `#102826` and on the Anthracite card `#23272A`. Also `--field-line: color-mix(in srgb, var(--ds-text) 50%, transparent)` (no change needed if rule 2 already produces it).

- [ ] **Step 1: Write the failing test** `designCrmCss.test.ts`. It reads `crm.css` as text and asserts:
  - (a) no `font-size:` or `font:` declaration contains a bare `\d+px` outside `calc(`;
  - (b) no `border-radius: \d+px` remains with 1–998px outside `calc(`;
  - (c) no `rgba(34, 28, 21` or `rgba(142, 107, 61` remains;
  - (d) the hex literals left are exactly the allowed semantic/stage set (list them in the test);
  - (e) every `--sc`, `--good`, `--warn` and `--danger` value under `.ds-dark` has `contrastRatio ≥ 4.5` against `#102826` and `#23272A`;
  - (f) the light semantic/stage values still equal today's values (`--good #3F6B3A`, `--warn #8A5A12`, `--danger #A3361F`, `.s-NEW #8C877E` … copied from the current file).
- [ ] **Step 2:** Run the test. Expected: FAIL.
- [ ] **Step 3:** Rewrite `crm.css` per the rules (a script is fine for rules 2, 4 and 5; check the diff by hand) and wire up the layout and `DsStyle`.
- [ ] **Step 4:** Run the test, `npx tsc --noEmit` and `npm test`. Expected: PASS.
- [ ] **Step 5: Identity check (controller, on the demo).** Start the demo (`crm-v2-demo`, PGlite on 55440). For `/crm/pipeline`, compute the styles of `.crm-top`, `.crm-app`, a board column, a card, a primary button and an `h1`/`h2`, before (on the `origin/main` worktree) and after. Every colour, font-size and border-radius must be identical.
- [ ] **Step 6:** Commit: "Design settings: CRM reads the --ds-* variables (identical at defaults)".

---

### Task 4: Portal re-pointed at the design variables

**Files:**
- Modify: `src/app/partner-portal/portal.css`, `src/app/partner-portal/layout.tsx`
- Test: `src/lib/__tests__/designPortalCss.test.ts`

**Interfaces:** Consumes `designForPartner`, `cssVars`, `isDarkSet` and `DsStyle`.

**Layout (`src/app/partner-portal/layout.tsx`):**
- Call `designForPartner(me?.partner.id ?? null)` with the same try/catch fallback (`[portal design]`). Logged-out pages get the default set.
- Render `<DsStyle>`, add `ds-dark` on body, and use `generateViewport` themeColor.
- Keep `data-theme="light"` on `<html>`.

**Re-pointing rules for `portal.css`:**
1. On `.pp-app`, override the design-tokens names locally, inside `.pp-app` only and never on `:root`:
   - `--bg: var(--ds-page)`, `--surface: var(--ds-surface)`, `--surface-raised: var(--ds-card)`, `--paper: var(--ds-page)`, `--paper-2: var(--ds-surface)`;
   - `--text: var(--ds-text)`, `--text-soft: var(--ds-muted)`;
   - `--bronze: var(--ds-accent)`, `--accent: var(--ds-accent)`, `--accent-ink: var(--ds-on-accent)`, `--champagne: var(--ds-gold)`;
   - `--hairline` / `--hairline-strong` as `color-mix` of `--ds-text` at 14% / 24%;
   - `--pp-bronze-ink: var(--ds-accent-text)`, `--pp-bronze-deep: var(--ds-accent-hover)`, `--pp-card: var(--ds-card)`;
   - `--r-ui: calc(16px * var(--ds-radius-scale))`.

   `.pp-html` background becomes `var(--ds-page)`, with fallbacks for every `--ds-*` on `.pp-html` as in Task 3.
   - **Exception:** `--text-faint` is not on the list. Keep today's `rgba(34,28,21,0.48)` value for it, written as color-mix of `--ds-text` at 48%.
2. **White fields:** every `background: #fff` on fields (`.pp-field input/select/textarea`, `.pp-search`, the dropdown at line ~237) becomes `var(--ds-field)`. The select chevron's stroke `%237A5A30` stays (decorative).
3. **Translucents** `rgba(34,28,21,a)` / `rgba(122,90,48,a)` / `rgba(142,107,61,a)` become `color-mix` of `--ds-text` / `--ds-accent-text` / `--ds-accent`.
4. **Font sizes:** the portal uses rem and the token scale. Set `html.pp-html { font-size: var(--ds-portal-base) }`; the default 16px is identical. Headings (`.pp-app h1, h2, h3`, `.pp-card > h1`, `.pp-h3` and any rule using `var(--pp-display)`) multiply their size by `var(--ds-heading-scale)`.
5. **Radii:** same rule as Task 3, rule 5.
6. **Fonts:** `--pp-display: var(--ds-font-heading), var(--font-display-cyr), Georgia, serif` and `--pp-body: var(--ds-font-body), system-ui, sans-serif`.
7. **Dark variants:** `--pp-good`, `--pp-warn` and `--pp-danger` under `.pp-app.ds-dark`, with the same ≥ 4.5 rule as Task 3.

- [ ] **Step 1: Write the failing test.** It mirrors Task 3 assertions (b), (c), (e) and (f) for `portal.css`, and also asserts:
  - no `background: #fff` remains on field selectors;
  - `.pp-html` sets `font-size: var(--ds-portal-base)`;
  - no `:root` selector is added.
- [ ] **Step 2:** Run the test. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the tests and tsc. Expected: PASS.
- [ ] **Step 5: Identity check (controller, demo, partner host).** Compare computed styles before and after on `/home` and `/profile`, logged in as the demo partner: page, card, h1, link, button, input. They must be identical.
- [ ] **Step 6:** Commit: "Design settings: portal reads the --ds-* variables (identical at defaults)".

---

### Task 5: Themed partner emails

**Files:**
- Modify: `src/lib/partner/mail.ts`, `src/lib/partner/notify.ts`, `src/lib/partner/digest.ts`, `src/lib/partner/notifySend.ts`, `src/lib/partner/digestSend.ts`, `src/lib/partner/accounts.ts`, `src/app/crm/partners/actions.ts`, `src/app/partner-portal/bankActions.ts`
- Test: `src/lib/__tests__/partnerMail.test.ts` (extend), `src/lib/__tests__/designEmail.test.ts` (new)

**Interfaces:**
- Consumes: `EmailTheme`, `CLASSIC_EMAIL_THEME`, `emailThemeForPartner`.
- Produces:
  - `renderPartnerEmail(p: EmailParts, theme: EmailTheme = CLASSIC_EMAIL_THEME): BuiltEmail`.
  - Every `build*Email` in `mail.ts`, `notify.ts` and `digest.ts` gains a final optional parameter `theme: EmailTheme = CLASSIC_EMAIL_THEME` and passes it through.

**Mapping inside `renderPartnerEmail`:**

| Today's value | Becomes |
|---|---|
| body bg `#F5F1E8` | `theme.page` |
| quote bg | `theme.page` |
| card `#FBF9F3` | `theme.card` |
| text `#221C15` | `theme.text` |
| `font-size:15px` | `${theme.base}px` |
| link-line `font-size:13px` | `${round(theme.base*13/15)}px` |
| link-line colour `#6B5E4E` | `theme.muted` |
| card border `#E4DCCB` | `theme.border` |
| button bg `#8E6B3D` | `theme.accent` |
| button text `#ffffff` | `theme.onAccent` |
| card and button `border-radius:16px` | `${theme.radius}px` |
| quote rule + divider `#C29A5E` | `theme.gold` |
| quote `border-radius:4px` | `${round(4*theme.radius/16)}px` |

- **Byte-identity at the default:** with `CLASSIC_EMAIL_THEME`, the HTML is byte-identical to today's, except the link line. Its colour changes `#6B5E4E` → `#59534C`, because the spec merges it into Muted text. The test pins that single difference explicitly.
- **Hex case:** the button text colour must render as `#ffffff` lowercase at the default to stay byte-identical. Emit `onAccent.toLowerCase()`, and lowercase all inline hex the same way only where today's string is lowercase.
- **Heading family:** emails have no headings today, so `headingFamily` is unused by the layout for now. Keep it in the type for the preview.

**Senders:**
- `notifySend.ts`: select `designThemeId` on the partner, call `emailThemeForPartner(partner.id)` once per partner, and pass the theme to each builder.
- `digestSend.ts`: same.
- `accounts.ts`: verify and reset mails resolve via the partner linked to the account, or `null` if there is none yet, which gives the default.
- `crm/partners/actions.ts` (approved mail) and `bankActions.ts`: same.

- [ ] **Step 1: Write the failing tests:**
  - Before changing anything, capture today's `buildApprovedEmail("en","Anna","https://x/login").html` into a fixture string in the test.
  - After the change, the same call without a theme equals the fixture with `#6B5E4E` replaced by `#59534C` (the only difference).
  - With the WEBSITE theme (via `emailTheme(WEBSITE, DEFAULT_GLOBAL)`), the HTML contains `background:#081512`, `background:#102826`, `color:#EFE9DB` and button `color:#081512`, and does not contain `#F5F1E8`.
  - `emailBase: 18` gives `font-size:18px` and the link line `font-size:16px`.
  - `radius: 0` gives `border-radius:0px` on card and button.
  - Every builder in `notify.ts`/`digest.ts`, called with the WEBSITE theme, contains `#102826`. This proves the pass-through.
- [ ] **Step 2:** Run `npx tsx --test src/lib/__tests__/partnerMail.test.ts src/lib/__tests__/designEmail.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement the builders and the sender wiring.
- [ ] **Step 4:** Run `npm test` and tsc. Expected: PASS.
- [ ] **Step 5:** Commit: "Design settings: partner emails use the recipient's colour set".

---

### Task 6: Owner design page

**Files:**
- Create: `src/app/crm/settings/design/page.tsx`, `src/app/crm/settings/design/actions.ts`, `src/app/crm/settings/design/DesignEditor.tsx` (client), `src/app/crm/settings/design/designForm.ts` (pure form parsing)
- Modify: `src/app/crm/components/Shell.tsx` and the CommandPalette entry, adding a "Design" link visible only when `user.isOwner`. Pass `isOwner` from the layout.
- Modify: `src/app/crm/crm.css`, adding the page's styles at the end with `--ds-*`-based variables only.
- Test: `src/lib/__tests__/designForm.test.ts`, `src/lib/__tests__/designActions.test.ts`

**Interfaces:**
- Consumes: all store functions (Task 2), `validateSetValues`, `validateGlobal`, `contrastWarnings`, `deriveAccentVariants` and `cssVars` (Task 1).
- Produces:
  - Server actions, each guarded with `getCrmUser()` and `isOwner`. A non-owner gets `{ ok:false, error:"Owner only" }` and nothing is written.
    - `saveThemeAction(input: { id?: string; name: string; values: Record<string,string>; offeredToStaff: boolean; offeredToPartners: boolean; confirmLowContrast: boolean }): Promise<{ ok: true; id: string } | { ok: false; error: string; warnings?: ContrastWarning[]; fieldErrors?: Partial<Record<RoleKey,string>> }>`
    - `deleteThemeAction(id)`, `makeDefaultThemeAction(id)`, `restoreThemeVersionAction(versionId)`, `restoreBuiltInAction(id)`, `duplicateThemeAction(id) → { ok, id }` (name "<name> copy")
    - `saveGlobalAction(input: Record<string, unknown>)` and `resetGlobalAction()`
  - Each action calls `revalidatePath("/crm", "layout")` after a write.
  - `designForm.ts` exports `parseThemeInput(raw: unknown): { ok: true; value: {...} } | { ok: false; error: string; fieldErrors? }`. It handles the name (trimmed, 1–40 chars, unique among sets, case-insensitive; the error text is "A set with this name already exists"), the values and the two booleans. It also exports `needsContrastConfirm(values, confirm): ContrastWarning[] | null`, which returns the warnings when there are any and `confirm` is false.

**Page layout** (English; `notFound()` for non-owners):
- **Left column: set list.** Each set shows a swatch strip of page, card, accent and text, its name, "Default" and "Built-in" badges, "Staff" / "Partners" offered toggles, and actions: Edit, Duplicate, Make default, Delete (hidden for built-ins and the default). Plus a "New set" button, which duplicates Classic.
- **Editor for the selected set:**
  - a name field;
  - 12 colour controls, each a native `<input type="color">` plus a hex text field, with label and hint per the spec table (e.g. "Page background — CRM, portal and email background");
  - an "Adjust accent variants manually" toggle. When it is off, changing Accent recomputes Accent text and Accent hover with `deriveAccentVariants`;
  - contrast warnings next to the affected control, showing the ratio;
  - Save. When warnings exist, Save turns into "Save anyway", which sends `confirmLowContrast: true`;
  - "Restore original" (built-ins only) and a history list (last 20, each with Restore).
- **Global section:**
  - heading font and body font selects, each option rendered in its own font;
  - sliders with number fields for CRM base, Portal base, Email base, Heading scale and Corner rounding, with the spec ranges and steps (1px, 0.05, 1px);
  - Save, Reset to default, and history (last 20).
- **Preview area:** three iframes, filled by Task 7. In this task, render placeholders with the final ids `ds-prev-crm`, `ds-prev-portal` and `ds-prev-email`.
- **Unsaved changes:** a `beforeunload` guard while the draft differs from the saved set.

- [ ] **Step 1: Write the failing tests:**
  - `parseThemeInput` rejects an empty name, a 41-char name, a duplicate name (case-insensitive), an invalid hex (with a per-field error) and a missing role.
  - `needsContrastConfirm(CLASSIC, false) === null`.
  - A set with text `#F5F1E8` on page `#F5F1E8` returns warnings when `confirm` is false and `null` when it is true.
  - In `designActions.test.ts`, use the existing mocking pattern of `crmCommissionActions.test.ts` (read it first). A non-owner gets "Owner only" and the store is not called. Deleting the default returns the store's refusal text.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement the actions, the page, the editor and the nav entry.
- [ ] **Step 4:** Run `npm test` and tsc. Expected: PASS.
- [ ] **Step 5: Demo smoke (controller).** As the owner:
  - create a set, save it with low contrast ("Save anyway"), make it the default and delete a custom set;
  - check that the history shows the entries and that `admin_audit_logs` has the rows;
  - as a non-owner user, check that `/crm/settings/design` returns 404 and the nav entry is hidden.
- [ ] **Step 6:** Commit: "Design settings: owner page for colour sets and global type/shape".

---

### Task 7: Live preview

**Files:**
- Create: `src/app/crm-preview/crm/layout.tsx`, `src/app/crm-preview/crm/page.tsx`, `src/app/crm-preview/portal/layout.tsx`, `src/app/crm-preview/portal/page.tsx`, `src/app/crm-preview/PreviewBridge.tsx` (client)
- Modify: `src/middleware.ts` (matcher exclusion `crm-preview(?![\w-])` plus a comment line in the house style), `src/app/crm/settings/design/actions.ts` (`previewEmailAction`), `DesignEditor.tsx`
- Test: `src/lib/__tests__/crmMiddlewareCrm.test.ts` (extend), `src/lib/__tests__/designPreview.test.ts`

**Interfaces:**
- Consumes: `cssVars`, `emailTheme`, `renderPartnerEmail`, the `crm.css` / `portal.css` imports, and the font wiring of the real layouts.
- Produces:
  - **The two layouts.** Each is a root layout with its own `<html>`/`<body>`, importing exactly the same CSS and fonts as the real CRM or portal layout.
    - Guard: `getCrmUser()` + `isOwner`, else `notFound()`. Both set robots noindex.
    - The body classes match the real layouts (`crm-app` / `pp-app`; the portal also sets `data-theme="light"` on `<html>`).
  - **The pages** render static sample markup that uses the real class names, with no DB data:
    - CRM: top bar, one board column with two cards, a primary and a secondary button, a stage badge, an input;
    - portal: header, card with eyebrow, h1, paragraph, link, input, primary button, a status pill.
  - **PreviewBridge** listens for `message` events with `event.origin === window.location.origin` and data `{ type: "ds-preview", vars: string, dark: boolean }`. It sets a `<style id="ds-draft">` `:root{vars}` and toggles `ds-dark` on body. Other origins and shapes are ignored.
  - **`previewEmailAction(values, global)`** (owner guard). It validates with `normalizeSetValues` / `normalizeGlobal` and returns the HTML of `buildApprovedEmail("en", "Anna", "<partnerBaseUrl()>/login", emailTheme(values, global))`.
  - **The editor:**
    - posts `{ type:"ds-preview", vars: cssVars(draft, draftGlobal), dark: isDarkSet(draft) }` to both iframes on every change, debounced to 100ms, and on iframe `load`;
    - calls `previewEmailAction` debounced to 400ms and puts the result into the email iframe's `srcdoc`, with `sandbox=""` on that iframe.

- [ ] **Step 1: Write the failing tests:**
  - Middleware matcher test: `/crm-preview/crm` is excluded from i18n, and `/crm-previewx` and `/crm-preview-foo` are not. Follow the existing crm cases in `crmMiddlewareCrm.test.ts`.
  - In `designPreview.test.ts`, export a pure `isPreviewMessage(data: unknown): data is { type:"ds-preview"; vars:string; dark:boolean }` from `PreviewBridge.tsx` (or a sibling `.ts`). It is false for missing `type`, for non-string `vars`, and for `vars` containing `}` or `<`. That last case rejects injection, because a real `cssVars` output never contains them.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test` and tsc. Expected: PASS.
- [ ] **Step 5: Demo smoke (controller):**
  - Changing Page background in the editor recolours all three previews before saving.
  - Picking "Live website" shows dark previews.
  - `/crm-preview/crm` as a non-owner returns 404.
  - Read-only check on the VPS: grep nginx for `X-Frame-Options`. If it is `DENY`, flag it to the operator; same-origin iframes need `SAMEORIGIN`. Do not edit nginx.
- [ ] **Step 6:** Commit: "Design settings: live preview of CRM, portal and partner email".

---

### Task 8: Personal set switchers

**Files:**
- Create: `src/app/crm/themeActions.ts`, `src/app/crm/components/ThemePicker.tsx`, `src/app/partner-portal/themeAction.ts`, `src/app/partner-portal/components/ThemeSwitcher.tsx`
- Modify: `src/app/crm/components/Shell.tsx` (`crm-me` becomes a button that opens a small menu with the ThemePicker), `src/app/crm/layout.tsx` (pass `offered` + current id), `src/app/partner-portal/components/PortalShell.tsx` (compact switcher next to LanguageSwitcher), `src/app/partner-portal/layout.tsx`, `src/app/partner-portal/profile/page.tsx` (a "Colour set" section with the full picker), the portal dictionary files (`src/lib/partner/i18n*`, key `theme`: `label`, `title`, `hint`, `saved` in en/de/pl/ru), and `crm.css` / `portal.css` (picker styles, `--ds-*` only)
- Test: `src/lib/__tests__/designSwitch.test.ts`

**Interfaces:**
- Consumes: `setStaffChoice`, `setPartnerChoice`, `designForStaff`, `designForPartner`, `canChooseSet`.
- Produces:
  - `setMyCrmThemeAction(themeId: string | null): Promise<{ ok: boolean }>` checks `getCrmUser()`, then calls `setStaffChoice(user.id, themeId)` and `revalidatePath("/crm", "layout")`.
  - `setMyPortalThemeAction(themeId: string | null): Promise<{ ok: boolean }>` checks `getPartner()` with status ACTIVE (logged out or inactive → `{ ok:false }`), then calls `setPartnerChoice(me.partner.id, themeId)`.
  - `null` means "use default".

**Pickers:**
- Both pickers list "Default (<name>)" first, then the offered sets in `sort` order, each with a 4-colour swatch.
- Picking calls the action inside `useTransition`, then `router.refresh()`. This is the same pattern as `LanguageSwitcher.tsx`.
- The CRM menu also shows "Design settings →" for the owner.

**Portal copy** (Claude's wording; the native-speaker review covers it):

| Locale | label | title | hint |
|---|---|---|---|
| en | "Colours" | "Colour set" | "Choose how your portal looks. This only changes your view and your e-mails." |
| de | "Farben" | "Farbset" | "Wählen Sie, wie Ihr Portal aussieht. Das ändert nur Ihre Ansicht und Ihre E-Mails." |
| pl | "Kolory" | "Zestaw kolorów" | "Proszę wybrać wygląd portalu. Zmienia to tylko Państwa widok i Państwa e-maile." |
| ru | "Цвета" | "Цветовая схема" | "Выберите, как выглядит Ваш портал. Это меняет только Ваш вид и Ваши письма." |

`saved`: "Saved" / "Gespeichert" / "Zapisano" / "Сохранено".

- [ ] **Step 1: Write the failing tests**, mocking in the style used by `crmCommissionActions.test.ts`:
  - Staff action with a partners-only id returns `{ ok:false }` and the user row is unchanged.
  - Staff action with an offered id writes it; `null` clears it.
  - Partner action while logged out returns `{ ok:false }`; for a SUSPENDED partner it returns `{ ok:false }`; with a staff-only id it returns `{ ok:false }`.
  - Dictionary test: the `theme` keys exist in all 4 locales and are non-empty. Extend the existing partner i18n completeness test if there is one.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test` and tsc. Expected: PASS.
- [ ] **Step 5: Demo smoke (controller):**
  - Staff user A picks "Live website": the CRM is dark for A and unchanged for user B.
  - The demo partner picks "Navy": the portal is navy, and a partner email built through `notifySend` for that partner (dry, via a tsx script on the demo DB with the transport stubbed) carries Navy colours.
  - The owner deletes Navy: the partner falls back to the default and the switcher no longer lists Navy.
- [ ] **Step 6:** Commit: "Design settings: staff and partners choose their own colour set".

---

### Task 9: Wrap-up

- [ ] Full checks: `npm test`, `npx tsc --noEmit`, `npm run lint` (no new errors).
- [ ] PGlite migration check (controller).
- [ ] Demo pass over all three surfaces with Classic: screenshots before and after must be identical, saved as files for the operator. Then repeat the pass with "Live website".
- [ ] Final whole-branch review, fix wave, push the branch, open a PR against `main`.
- [ ] **Hand-over** (no deploy):
  - deploy with `CVP_RUN_MIGRATE=1 CVP_PROD_REF=origin/main ./scripts/deploy-prod.sh --yes` from a fresh worktree, outside the quiet windows;
  - check the live release for live-only changes first;
  - nothing in env or cron;
  - after the deploy, the owner opens `/crm/settings/design`.
