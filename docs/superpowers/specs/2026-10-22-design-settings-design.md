# Design settings for CRM, partner portal and partner emails — Design

## Intent

The operator finds the new CRM, the partner portal and the partner emails "far too beige". Instead of asking for a redesign each time, he wants to adjust the look himself on a settings page.

The settings must not become a sprawl of single colours. Every colour that is shared today between the three surfaces becomes **one setting**. When the portal and the emails share a background now, they keep sharing it: one control changes both. Which surface uses which role stays fixed. The operator adjusts the tone of each role, the font sizes, the fonts and the corner rounding.

## Goals

- One settings page **"Design"** in the new CRM (`/crm/settings/design`), owner only.
- Shared **colour roles**, each used by CRM, portal and partner emails wherever that role appears today. Changing a role changes it everywhere at once.
- **Font sizes**, **fonts** (from a fixed list) and **corner rounding**, adjustable.
- **Live preview** on the same page: a piece of the CRM, a piece of the portal and a sample partner email, side by side, updated while editing and before saving.
- **Contrast warnings** when text on a chosen background falls below WCAG AA.
- **"Reset to default"**: back to today's CI values.
- Changes apply to all three surfaces right after saving, without a deploy.

## Non-goals

- The public website (cyprusvipestates.com pages): untouched.
- Customer emails sent from the CRM ("they look good"): untouched.
- Telegram texts (no styling).
- Dark mode (CRM and portal are light-only today).
- Per-surface overrides of a shared role. Splitting a shared colour into two is explicitly not wanted.
- Logo upload or changing the layout or structure of pages.
- The credit-note PDF (a formal document with its own fixed look).

## Anti-goals

- Settings that make text unreadable without the operator noticing: the contrast check must warn before saving.
- A half-applied state, for example the portal in new colours while the emails still use old ones because of a cache.
- A long list of technical knobs nobody understands. Labels are plain English (the CRM is English), with a one-line hint where the role appears ("Page background — CRM, portal and email background").

## Colour roles (fixed mapping; the operator only changes the values)

Taken from the current CSS (`src/app/crm/crm.css`, `src/app/partner-portal/portal.css`, `src/lib/partner/mail.ts`). Defaults are today's values.

| Role | Default | Used for |
|---|---|---|
| Page background | `#F5F1E8` | CRM page, portal page, email body, email quote box |
| Surface | `#EDE7D9` | CRM board columns and secondary areas, portal secondary surfaces |
| Card | `#FBF9F3` | CRM panels and cards, portal cards, email card |
| Text | `#221C15` | main text everywhere |
| Muted text | `#59534C` | secondary text everywhere (the email's `#6B5E4E` is merged into this role) |
| Accent | `#8E6B3D` | buttons, badges, large figures, focus ring, email button |
| Accent text | `#7A5A30` | links and small accent text (AA on light backgrounds) |
| Accent hover | `#6E512B` | hover and pressed states |
| Gold line | `#C29A5E` | the gold contours and dividers (decorative, never text) |
| Border | `#E4DCCB` | card borders, the email card border; the CRM's translucent hairlines are derived from Text at fixed opacities |
| On accent | `#FFFFFF` | text on accent buttons and badges |

Semantic colours (success / warning / danger) and the CRM's per-stage colours stay fixed. They carry meaning and are not part of the beige problem.

Builder's call (marked as such): whether "Accent text" and "Accent hover" are separate controls or derived automatically from "Accent" (darkened until AA is reached). The default is **derived, with an "adjust manually" toggle**. That keeps the page short and contrast safe.

## Typography

- **Fonts:** heading font and body font, each picked from the fonts already vendored in the app (`src/app/fonts`: Fraunces, Playfair Display, Cormorant Garamond, Bodoni Moda, EB Garamond, Spectral for headings; Mulish, Manrope, Onest, Commissioner, Tenor Sans for body). Defaults are Fraunces and Mulish.
  - Emails cannot rely on web fonts. They use a matching web-safe stack: a serif choice maps to Georgia, a sans choice to Arial/Helvetica, as they do today.
- **Font sizes:** a base size per surface, plus one heading scale shared by all.
  - CRM base: default 14 px, range 12–18.
  - Portal base: default 16 px, range 14–20.
  - Email base: default 15 px, range 13–18.
  - Heading scale: one factor that grows or shrinks all headings together, range 0.8–1.3, default 1.0.
- Text with fixed small sizes (badges, captions) scales proportionally with the base size.

## Shape

- **Corner rounding:** one value for cards, buttons, fields and the email card (default 16 px, range 0–24). Pills (nav pills, round badges) stay pills.

## Behaviour

- **Storage:** a single settings record in the database (JSON, versioned), plus a history of the last 20 saved versions. Each save is audited (who, when, before/after).
  - "Reset to default" saves the defaults as a new version.
  - The history list allows going back to any of the last 20 versions.
- **Applying:**
  - CRM and portal layouts render the saved values as CSS custom properties that override the current token values. The existing stylesheets keep working unchanged underneath.
  - Partner emails read the same values when they are built.
  - A cached read is used and invalidated on save. CRM, portal and emails switch together, with no half-applied state.
- **Preview:**
  - Edits update the preview instantly in the browser before saving.
  - The preview shows a small CRM board column with a card and a button, a portal card with heading, text, link and button, and a rendered sample partner email (from the real email builder, with sample data).
- **Validation:** colours as hex values (a colour picker plus a hex field), sizes and radius within their ranges. Out-of-range or malformed values are refused with a clear message.
- **Contrast check** (live, WCAG 2.1): text on page background, text on card, muted text on card, accent text on page background, on-accent on accent. Below 4.5:1 shows a warning next to the affected control. Saving is still allowed after an explicit "save anyway" confirmation, because it is the owner's call.
- **Access:** owner only (`isOwner` from the DB). Other staff do not see the page or its nav entry.

## Constraints

- No change to the public website or to customer emails, including shared CSS such as `design-tokens.css` used by the main site. The overrides are scoped to the CRM and portal layouts.
- Next.js 14.2 App Router, Prisma (additive migration only). The local DB is production: no local migrations.
- Default values must reproduce today's look exactly, so deploying the feature changes nothing visible until the operator saves.
- Partner-facing pages keep their four languages. The settings page itself is English (internal).

## Left to the builder

- Exact component structure of the settings page and preview.
- How the CSS overrides are injected (a `<style>` with `:root` / `.crm-app` / `.pp-app` variables is the expected approach).
- Whether the accent variants are derived (default) or manual, per the builder's-call note above.
- The cache mechanism, as long as all three surfaces switch together.

## Calls made after the builder check (Claude's calls, not the operator's)

1. **Fonts and loading.** Fonts are vendored with `unicode-range` `@font-face` rules: a face downloads only when the page uses it. So the font setting can switch the CSS font-family variables without per-selection loaders, and only the chosen pair is fetched.
   - **Cyrillic:** the portal is also in Russian. Playfair Display stays the Cyrillic fallback for any heading font without Cyrillic glyphs (Fraunces, Cormorant Garamond, Bodoni Moda). Every body font offered has Cyrillic (Mulish, Manrope, Onest, Commissioner, Tenor Sans).
2. **Font sizes.** The hard-coded px sizes in `crm.css` and `portal.css` are converted to values relative to a per-surface base variable (e.g. `calc(var(--ds-crm-base) * 0.786)` for 11 px at 14 px base), and headings additionally multiply by the heading scale.
   - The conversion must reproduce today's sizes exactly at the defaults. A test compares computed default sizes before and after for a list of key selectors.
   - "Existing stylesheets keep working unchanged underneath" means the visual result at the defaults, not that the CSS files stay untouched.
3. **Role variables.** New `--ds-*` role variables are introduced and the CRM and portal stylesheets are re-pointed at them. The shared main-site token names (`--bg`, `--text`, `--bronze` from `design-tokens.css`) are not overridden, so nothing can leak into the public website.
   - Hard-coded translucents become `color-mix()` of the roles, so changing Accent also changes its soft/hover tints. This covers the top bar glass, accent-soft, hover fills and the CRM hairlines (from Text).
   - The browser-chrome `themeColor` and the `<html>` background follow Page background.
4. **Cache and consistency.** No in-memory cache. The CRM and portal layouts (already `force-dynamic`) read the single settings row per request; it is one small indexed query. Email builders read the same row when they build a message, which covers server actions, crons and scripts, so all three surfaces switch together.
5. **Storage and audit.** One new table `design_settings_versions` (id, values JSON, createdAt, createdById, note). The newest row is the active setting, and the last 20 are the history. Restore and reset each insert a new row. Every save also writes the existing `AdminAuditLog` (`design_settings_save`, before/after). No row means "defaults", so deploying changes nothing.
6. **Partner emails.** All partner emails go through the shared layout `renderPartnerEmail` in `src/lib/partner/mail.ts` (used by `notify.ts` and `digest.ts` as well), so theming that one function covers every partner email. It gets a pure signature that takes a theme, and the preview renders it with sample data.
   - **Email fonts:** a serif heading font maps to Georgia for headings; the body always maps to Arial/Helvetica, as today.
7. **Derived accent variants.** "Accent text" and "Accent hover" are stored values with today's defaults (`#7A5A30`, `#6E512B`), so the defaults are byte-identical. In derived mode they are recomputed only when the operator changes Accent: darkened in steps until 4.5:1 on Page background and Card, with hover one step darker. "Adjust manually" unlocks both fields.
   - The contrast check runs on the final values, derived or manual. "Save anyway" covers all warnings at once.
8. **Preview.** The preview is an `<iframe>` (srcdoc), with one pane each for CRM, portal and email. Each pane loads the real stylesheet scope and the draft values, so global selectors don't clash with the settings page itself.
