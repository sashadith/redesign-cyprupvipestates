# Phase 1 — Locale-Plumbing: Abnahme und Operator-Schritte

**Branch:** `worktree-he-phase1-locale-plumbing` · **Plan:** `docs/superpowers/plans/2026-09-13-hebrew-phase1-locale-plumbing.md` · **Stand:** 2026-09-13

## Was Phase 1 liefert

- `src/lib/locale.ts` ist die einzige Locale-Quelle: `LOCALES` (en, de, pl, ru, he) und `PUBLIC_LOCALES` (live; gesteuert über `NEXT_PUBLIC_LIVE_LOCALES`, ohne Variable = alle außer `he`; `en` ist nie abschaltbar).
- Middleware, hreflang, Sitemaps, `generateStaticParams`, Sprachumschalter und Corporate-Slugs folgen `PUBLIC_LOCALES`. Ein Gated-Locale-Guard in der Middleware beantwortet `/he/*` auf Produktion mit 404.
- Alle `(de|pl|ru)`-Regexe werden aus `lib/locale` generiert (Middleware, Nav, SEO-Klassifikatoren, Canonical-Helfer).
- Prisma: Enum-Wert `he`, Spalten `DevelopmentOverride.descriptionHE` und `AreaDescription.textHE` (zwei additive Migrationen, noch nicht angewendet).
- `<html dir>` aus `localeDir()` in allen acht lokalisierten Root-Layouts; hebräische Fonts (`--font-display-he` = Frank Ruhl Libre, `--font-body-he` = Rubik Hebrew) mit `var()`-Fallback; geteiltes `src/app/rtl.css`.
- Eine `BCP47`-Map für alle Intl-Aufrufe; Lead-APIs und MCP-Tools akzeptieren `languagePreference = he`.
- Exhaustive Copy-Tabellen tragen 19 `TODO(he)`-Platzhalter (englischer Text), gezählt von `node scripts/qa/he-placeholders.mjs` (Phase-4-Backlog).
- nginx-Regel `^/(de|pl|ru|he)(/|$)` im Repo vorbereitet; `DEPLOYMENT.md` und `.env.example` dokumentieren die Variable.
- Smoke-Skript `scripts/qa/he-smoke.sh [host] [live|gated]`: `live` (Staging, `he` geroutet) verlangt RTL und keine 500er; `gated` (Produktion) verlangt 404 für jeden `/he*`-Pfad und 0 `hreflang="he"`.

## Operator-Schritte für Staging (in dieser Reihenfolge)

1. **Env auf Staging setzen** (die Deploy-Skripte synchronisieren `.env` nicht):
   ```bash
   echo 'NEXT_PUBLIC_LIVE_LOCALES=en,de,pl,ru,he' >> /var/www/cve-staging/.env
   ```
2. **Migration einspielen — VOR dem Deploy** (additiv; Staging und Produktion teilen die Datenbank, deshalb ist das ein Produktions-Schreibzugriff — bewusst und freigegeben). Die Migrationsdateien müssen dafür schon auf dem Server liegen; falls noch kein Deploy gelaufen ist, nur den Prisma-Ordner synchronisieren:
   ```bash
   rsync -az -e "ssh -i ~/.ssh/cvp_vps" prisma/ root@72.60.89.239:/var/www/cve-staging/prisma/
   ```
   dann auf dem Server:
   ```bash
   cd /var/www/cve-staging && CVP_CONFIRM_PROD_MIGRATE=yes ./scripts/migrate-deploy-safe.sh migrate deploy
   ```
   Warum zuerst: `next build` ruft `generateStaticParams` auf, und die fragen seit Phase 5 die Datenbank mit `language: "he"` ab — ohne den Enum-Wert bricht der Build bei „Collecting page data" mit `invalid input value for enum "Locale": "he"` ab (so passiert 2026-09-16). Voraussetzung Postgres ≥ 12 (`ADD VALUE` in Transaktion; der VPS läuft 16). Die laufende Produktions-App kennt den Wert `he` nicht und schreibt ihn nie; die zusätzlichen Spalten stören sie nicht. Kontrolle (nur lesend):
   ```bash
   sudo -u postgres psql -d cyprusvipestates -tAc 'select enum_range(null::"Locale")'
   ```
   Erwartung: `{en,de,pl,ru,he}`. Falls ein früherer Lauf mit `P3018 … relation "DevelopmentOverride" does not exist` abgebrochen ist (Stand vor dem 2026-09-20, falsche Tabellennamen in `he_content_columns`): den fehlgeschlagenen Eintrag zurücksetzen und erneut deployen — nichts davon war teilweise angewendet, Postgres hat die Transaktion zurückgerollt:
   ```bash
   cd /var/www/cve-staging && CVP_CONFIRM_PROD_MIGRATE=yes ./scripts/migrate-deploy-safe.sh migrate resolve --rolled-back 20260914100100_he_content_columns
   cd /var/www/cve-staging && CVP_CONFIRM_PROD_MIGRATE=yes ./scripts/migrate-deploy-safe.sh migrate deploy
   ```
   `migrate deploy` spielt dabei alle drei Hebräisch-Migrationen ein: `20260914100000_locale_add_he`, `20260914100100_he_content_columns` und `20260920100000_he_promo_blocks` (Spalte `promoBlocksHE` für den Promo-Block aus PR #58; additiv).
3. **Deploy von diesem Branch** (aus dem Worktree-Checkout, damit der Branch-Stand gesynct wird; beim ersten Deploy nach einer `package-lock.json`-Änderung zusätzlich `CVP_RUN_INSTALL=1` voranstellen):
   ```bash
   ./scripts/deploy-staging.sh
   ```
   Erwartung: Build grün, `pm2 reload` inklusive.
4. **Smoke-Test gegen Staging:**
   ```bash
   scripts/qa/he-smoke.sh https://design.cyprusvipestates.com
   ```
   Erwartung: keine 500; `rtl: yes`; `/he/projects` → 200; `/de/faq`, `/projects`, `/blog` → 200; `hreflang="he"` in `/sitemaps/pages` = 0 (noch keine hebräischen Inhalte).

## Produktions-Gate (nichts zu tun, nur wissen)

- Produktion bleibt unverändert, solange `NEXT_PUBLIC_LIVE_LOCALES` dort nicht gesetzt ist: `/he/*` → 404, kein `hreflang="he"`, keine `/he/`-Sitemap-Einträge. Nach dem nächsten Produktions-Deploy prüfbar mit `scripts/qa/he-smoke.sh https://cyprusvipestates.com gated`.
- **Vor dem nächsten Produktions-Deploy dieses Codes** muss die Migration angewendet sein (Schritt 3 erledigt das bereits, weil die DB geteilt ist).
- Die hebräische Freischaltung in Produktion ist Phase 9 (Variable setzen, nginx-Zeile einspielen, deployen) und passiert nur auf ausdrückliche Anweisung.

## Abnahmekriterien Phase 1 (Spec §5)

| Kriterium | Status |
|---|---|
| `/he` rendert Chrome mit `dir="rtl"`, Fonts laden | offen bis Staging-Smoke (Schritte 1–4) |
| `/he/projects` listet | offen bis Staging-Smoke |
| Sprachumschalter zeigt HE nur bei vorhandener Übersetzung | im Code (bestehendes Verhalten, `i18n.languages` = `PUBLIC_LOCALES`) |
| Produktion antwortet 404 auf `/he` | im Code (Gated-Locale-Guard + `isPublicLocale`-Layout-Guard); lokal nicht prüfbar, bis die Migration den Build erlaubt |
| `npm run build` grün | lokal blockiert bis Migration; Staging-Build ist der Nachweis |
| `he-placeholders.mjs` zeigt die Ausgangszahl | 19 |
| `npm test` | 95/95 |
| `npx tsc --noEmit` | sauber |

## Bekannte Nacharbeiten (an Phase 2–4 übergeben)

- Phase 2 (RTL): `text-align: left` in `about.css:241`, `landing.css:109`, `faq.css:175` und ~450 weitere physische Deklarationen; `urlCanonical.ts` baut Regexe pro Aufruf.
- Phase 3 (Admin): Vier-Locale-Typen in `admin/(panel)/developments/[id]/SeoMetaFields.tsx:8`, `DescriptionField.tsx:7`; IndexNow-Fan-out in `developments/[id]/actions.ts`.
- Phase 4 (UI-Copy): 19 `TODO(he)`-Platzhalter; Vier-Locale-Unions in `qualifierFields.ts:53`, `formFeedbackCopy.ts:20`, `ScarcityBanner.tsx:5`, `PropertyFeatures.tsx:84`, `DistancesStrip.tsx:37`, `QualificationForm.tsx:13`; stille Fallbacks in `bookingActions.ts:35-37` (`toLocale`) und `developmentSeo.ts` (`localizeCompletion`).
- Kosmetik: veralteter nginx-Kommentar Zeile 169; `'-- AlterTable'`-Marker in Migration 2; ungenutzter `CorporateLocale`-Import in `preview-legal/[lang]/[doc]/page.tsx`.
