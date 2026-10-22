# Design settings for CRM, partner portal and partner emails — Design

## Intent

The operator finds the new CRM, the partner portal and the partner emails "far too beige". Instead of asking for a redesign each time, he wants to adjust the look himself on a settings page.

He also wants **several saved colour sets**. Each staff user (Sascha Dith, Alisher, Aliaksander, …) and each partner picks the set they like for their own interface. One set must look like the live public website (dark green with ivory text and champagne gold).

The settings must not become a sprawl of single colours. Every colour that is shared today between the three surfaces becomes **one setting**. When the portal and the emails share a background now, they keep sharing it: one control changes both. Which surface uses which role stays fixed. The operator adjusts the tone of each role, the font sizes, the fonts and the corner rounding.

## Goals

- One settings page **"Design"** in the new CRM (`/crm/settings/design`), owner only.
- Shared **colour roles**, each used by CRM, portal and partner emails wherever that role appears today. Changing a role changes it everywhere at once.
- **Font sizes**, **fonts** (from a fixed list) and **corner rounding**, adjustable.
- **Live preview** on the same page: a piece of the CRM, a piece of the portal and a sample partner email, side by side, updated while editing and before saving.
- **Contrast warnings** when text on a chosen background falls below WCAG AA.
- **"Reset to default"**: back to today's CI values.
- **Colour sets:** several named sets of the colour roles, each saved on its own. Built in: **"Classic"** (today's look, the default) and **"Live website"** (the public site's dark green look).
- **Personal choice:** every staff user switches the CRM, and every partner switches the portal, between the sets the owner has made available. The choice is per person and stays saved.
- Changes apply to all three surfaces right after saving, without a deploy.

## Non-goals

- The public website (cyprusvipestates.com pages): untouched.
- Customer emails sent from the CRM ("they look good"): untouched.
- Telegram texts (no styling).
- An automatic dark mode that follows the operating system. A dark look exists only as a colour set someone picks ("Live website" or one the owner makes).
- Per-surface overrides of a shared role. Splitting a shared colour into two is explicitly not wanted.
- Logo upload or changing the layout or structure of pages.
- The credit-note PDF (a formal document with its own fixed look).

## Anti-goals

- Settings that make text unreadable without the operator noticing: the contrast check must warn before saving.
- A half-applied state, for example the portal in new colours while the emails still use old ones because of a cache.
- A long list of technical knobs nobody understands. Labels are plain English (the CRM is English), with a one-line hint where the role appears ("Page background — CRM, portal and email background").

## Colour roles (fixed mapping; each colour set gives every role a value)

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
| Field | `#FFFFFF` | input, select and search field backgrounds (white today; a dark set needs a dark field) |

Semantic colours (success / warning / danger) and the CRM's per-stage colours are not editable. They carry meaning and are not part of the beige problem. Because a set can now be dark, each of them has a light-background and a dark-background variant, picked automatically by how light the set's Card is. A test checks that every semantic and stage colour reaches 4.5:1 on Card in every built-in set.

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

## Colour sets

- A **colour set** is a name plus a value for each of the 12 colour roles. Fonts, font sizes and corner rounding are **not** part of a set: they stay one global setting, so the operator's size choices apply whichever set someone uses.
- **Built-in sets** (cannot be deleted; can be edited, with "Restore original"):

  | Role | Classic (default) | Live website |
  |---|---|---|
  | Page background | `#F5F1E8` | `#081512` |
  | Surface | `#EDE7D9` | `#0C1E1B` |
  | Card | `#FBF9F3` | `#102826` |
  | Text | `#221C15` | `#EFE9DB` |
  | Muted text | `#59534C` | `#AEAEA3` |
  | Accent | `#8E6B3D` | `#C29A5E` |
  | Accent text | `#7A5A30` | `#C29A5E` |
  | Accent hover | `#6E512B` | `#D8B268` |
  | Gold line | `#C29A5E` | `#C29A5E` |
  | Border | `#E4DCCB` | `#2D3732` |
  | On accent | `#FFFFFF` | `#081512` |
  | Field | `#FFFFFF` | `#0B1A17` |

  "Live website" values come from the public site's dark theme in `src/app/design-tokens.css` (`--sea-deep`, `--sea`, `--ivory`, `--champagne`, `--accent-ink`, `--glow-strong`); its translucent text and hairline values are flattened onto the green background.
- **Starter sets** (Claude's proposal, seeded once, ordinary sets the owner may edit or delete): "Stone grey" (cool light greys, graphite text, deep-teal accent), "Navy" (light, navy accent), "Anthracite gold" (dark charcoal, champagne accent). Exact values are the builder's, with every contrast check passing.
- **The owner** (on `/crm/settings/design`):
  - creates a set (empty from Classic, or "Duplicate" of any set), renames, edits and saves each set on its own;
  - deletes a non-built-in set; anyone using it falls back to the default set;
  - marks each set "offered to staff" and/or "offered to partners";
  - picks the **default set** (used by anyone who hasn't chosen one, and for new partners). Classic is the default at deploy.
- **Staff users** (all active CRM users, not only the owner): a "Colour set" picker in the CRM user menu in the top bar lists the sets offered to staff, with a small swatch each. Picking one applies at once and is saved on the user.
- **Partners:** the same picker on the portal profile page and as a small control in the portal header, listing the sets offered to partners. Saved on the partner.
- If a person's chosen set is deleted or no longer offered to their side, they see the default set; their stored choice is cleared.

## Behaviour

- **Storage:** the colour sets, the global typography/shape setting, and each person's choice live in the database. Every save of a set or of the global setting keeps a history of the last 20 versions of that thing and is audited (who, when, before/after).
  - "Reset to default" on the global setting saves today's typography and radius as a new version; "Restore original" does the same for a built-in set.
  - The history list allows going back to any of the last 20 versions.
- **Applying:**
  - CRM and portal layouts render the viewer's set (their choice, or the default) plus the global setting as CSS custom properties. The existing stylesheets keep working unchanged underneath.
  - **Partner emails use the recipient partner's chosen set** (or the default), so the mail looks like the portal that partner sees. Claude's call: a dark set in email is rendered as written (dark body, light text); most mail apps keep it, and the plain-text part is unchanged.
  - A cached read is used and invalidated on save. CRM, portal and emails switch together, with no half-applied state.
- **Preview:**
  - Edits update the preview instantly in the browser before saving.
  - The preview shows the set being edited. It shows a small CRM board column with a card and a button, a portal card with heading, text, link and button, and a rendered sample partner email (from the real email builder, with sample data).
- **Validation:** colours as hex values (a colour picker plus a hex field), sizes and radius within their ranges. Out-of-range or malformed values are refused with a clear message.
- **Contrast check** (live, WCAG 2.1, per set): text on page background, text on card, muted text on card, accent text on page background and on card, on-accent on accent, text on field. Below 4.5:1 shows a warning next to the affected control. Saving is still allowed after an explicit "save anyway" confirmation, because it is the owner's call.
- **Access:** the design page is owner only (`isOwner` from the DB); other staff do not see the page or its nav entry. Choosing one's own set is open to every active staff user and every active partner, limited to the sets offered to their side; the server rejects any other set id.

## Constraints

- No change to the public website or to customer emails, including shared CSS such as `design-tokens.css` used by the main site. The overrides are scoped to the CRM and portal layouts.
- Next.js 14.2 App Router, Prisma (additive migration only). The local DB is production: no local migrations.
- Default values must reproduce today's look exactly, so deploying the feature changes nothing visible until someone saves or picks a different set. Classic is the default and nobody has a choice stored at deploy.
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
4. **Cache and consistency.** No in-memory cache. The CRM and portal layouts (already `force-dynamic`) read the viewer's set, the default set and the global row per request; small indexed queries, combinable into one. Email builders read the same row when they build a message, which covers server actions, crons and scripts, so all three surfaces switch together.
5. **Storage and audit** (additive migration):
   - `design_themes` (id, name, key nullable unique for built-ins `classic` / `website`, values JSON, offeredToStaff, offeredToPartners, isDefault, sort, createdAt, updatedAt, updatedById). Exactly one row has `isDefault` (partial unique index). Built-ins and starter sets are seeded by the migration.
   - `design_theme_versions` (id, themeId, values JSON, createdAt, createdById): history per set, last 20 shown.
   - `design_settings_versions` (id, values JSON, createdAt, createdById, note) for the global typography/shape setting; newest row is active, no row means today's defaults.
   - `User.designThemeId` and `Partner.designThemeId`, nullable, FK with `ON DELETE SET NULL`. Null means "use the default".
   - Every owner save writes `AdminAuditLog` (`design_theme_save`, `design_theme_delete`, `design_theme_default`, `design_settings_save`, before/after). A person switching their own set is not audited (it is a preference); the partner's switch only updates their row.
6. **Partner emails.** All partner emails go through the shared layout `renderPartnerEmail` in `src/lib/partner/mail.ts` (used by `notify.ts` and `digest.ts` as well), so theming that one function covers every partner email. It gets a pure signature that takes a theme, and the preview renders it with sample data.
   - **Email fonts:** a serif heading font maps to Georgia for headings; the body always maps to Arial/Helvetica, as today.
7. **Derived accent variants.** "Accent text" and "Accent hover" are stored values per set, so Classic stays byte-identical. In derived mode they are recomputed only when the operator changes Accent: moved away from the background in steps (darkened on a light set, lightened on a dark set) until 4.5:1 on Page background and Card, with hover one step further. "Adjust manually" unlocks both fields.
   - The contrast check runs on the final values, derived or manual. "Save anyway" covers all warnings at once.
8. **Preview.** The preview is an `<iframe>` (srcdoc), with one pane each for CRM, portal and email. Each pane loads the real stylesheet scope and the draft values, so global selectors don't clash with the settings page itself.
9. **Who the users are.** "Users" means the CRM staff accounts (`User` rows: Sascha Dith, Alisher, Aliaksander, …). Each one has their own choice. The old `/admin` area is untouched.
10. **Switching feel.** Picking a set saves via a server action and refreshes the page; no flash of the old colours on the next load, because the layout renders the chosen set server-side.
