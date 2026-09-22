# Phase 7 (Lead-Pipeline) + Phase 8 (SEO-Härtung) + Phase 2b (RTL-Rest) Hebräisch: Abnahme und Operator-Schritte

**Branch:** `worktree-he-phase7-8` (gestapelt auf `worktree-he-phase5-content`, PR #45) · **Plan:** `docs/superpowers/plans/2026-09-14-hebrew-phase7-8-pipeline-seo.md` · **Spec:** `docs/superpowers/specs/2026-09-13-hebrew-localization-design.md` §3.6, §5 Phase 7/8/9, §6 · **Ledger:** `.superpowers/sdd/2026-09-14-hebrew-phase7-8-pipeline-seo/progress.md` · **Stand:** 2026-09-14

## Was jetzt neu ist

Anders als Phase 4 (Code-Copy) und Phase 5 (Inhalte) schließt dieser Plan **Code-Lücken** in der Lead-Pipeline und im SEO-Stack, treibt die physischen RTL-CSS-Deklarationen auf null und liefert den Launch-Wächter für Phase 9.

| Task | Umfang | Commit(s) |
|---|---|---|
| Task 1 — Lead-Pipeline | `resolveProjectInterest()` (`src/lib/leads/projectInterest.ts`): für `he` Fallback von der legacy `Project`-Zeile auf die `Development`-Auflösung über deren EN-`Project`-Geschwister (`supersededByDevelopmentId`); Telegram-Alert zeigt `HE` aus `LOCALE_LABELS` statt einer Vier-Locale-Sonderbehandlung; `resolveSignature()` liest `signature.he`; ROI-/Partner-Formular-Telegram-Sender bekommen denselben Locale-Tag; CockpitCard-Sprach-Label-Map kommt aus `LOCALE_LABELS` | `ed317fe`, `637defe` |
| Task 2 — SEO/GSC-Locale-Plumbing | `localeFromPath()` neu in `src/lib/locale.ts`; `deriveLocale` (`src/lib/gsc/client.ts`) und `urlCanonical.localeOfPath` delegieren daran; `seo/queries.ts` und `pagePower/inventory.ts` iterieren `LOCALES` (Lesen) bzw. `PUBLIC_LOCALES` (Emittieren); `indexnow.ts`-Fan-out bereits `PUBLIC_LOCALES`-gated (verifiziert + getestet); Grep-Test verbietet neue hart kodierte Vier-Locale-Arrays außerhalb `src/lib/__tests__/` | `835658e` |
| Task 3 — Head-Signale + hreflang-Sampler | `ogLocale()`/`og:locale` in `[lang]/layout.tsx` + Preview-Layouts; JSON-LD `inLanguage` (`BCP47[lang]`) in den Schema-Emittern; Sitemap-`he`-Zeilen nur für `PUBLISHED` + `PUBLIC_LOCALES`; neues `scripts/qa/hreflang-check.mjs [host] [--json]` (curl-freier `fetch()`-Sampler: x-default, Reziprozität, Canonical, `og:locale`, `robots`, `inLanguage` über alle Seitentypen + 17 Landingpages) | `c474077` |
| Task 4 — Phase 2b (RTL-Rest) | Codemod + manuelle Fixes: 107 → 0 physische CSS-Deklarationen (`rtl-physical-count.mjs --strict`); `rtl-exceptions.txt` 63 → 84 (nach Review-Fixrunde, 3 weitere logikalisiert); Font-Doppelladen behoben (siehe unten) | `63532a1`, `12879ad` |
| Controller — Font-Fix (nach Task 3) | `[lang]/layout.tsx`: `rubik`-Variable trägt jetzt `--font-body-he` direkt (Rubik hat ein `hebrew`-Subset); der separate `rubikHebrew`-Import entfällt nur in dieser Datei — `rtl.css` und alle Preview-Layouts (die weiterhin Mulish als Body-Font nutzen und keine hebräischen Glyphen brauchen) sind unverändert und laden `rubikHebrew` weiterhin für ihren eigenen Bedarf | `c8eab9f` |
| Task 5 — Launch-Wächter + Phase-9-Checkliste + diese Abnahme | `scripts/qa/he-launch-check.mjs` (read-only, lokale Checks + optionaler `--host`-Modus); `docs/i18n/launch-checklist.md` (Operator-Checkliste, nicht von Claude ausgeführt); diese Datei | *(dieser Commit)* |

## Gate-Zahlen

Endstand nach allen Tasks, Fix-Rounds (Task 1, 3, 4) und der Gesamt-Review des Branches:

| Gate | Befehl | Ergebnis |
|---|---|---|
| Typen | `npx tsc --noEmit -p tsconfig.json` | sauber |
| Tests | `npm test` | 392 grün (Baseline 309 aus Phase 5 + 83 neue: Lead-Pipeline, Locale-Plumbing, Head-Signale, hreflang-Sampler, Launch-Wächter, Partners-Ausschluss, Final-Review-Fixes) |
| Platzhalter | `node scripts/qa/he-placeholders.mjs` | `TODO(he)`: 0 · `REVIEW(he)`: 115 (+1: Blog-Breadcrumb „דף הבית"; Pass C weiterhin zurückgestellt) |
| LTR-Snapshot | `node --import tsx scripts/qa/copy-snapshot.mjs --check` | sauber, 3.381 Blätter — kein en/de/pl/ru-String verändert |
| Content-Gate | `node scripts/qa/he-content-check.mjs` | `he-content: OK (31 files, 2941 strings)` |
| Physische CSS-Deklarationen | `node scripts/qa/rtl-physical-count.mjs --strict` | 0 (115 Dateien gescannt, 84 Ausnahmeregeln) — **Phase 2b abgeschlossen** |
| Launch-Wächter (lokal) | `node scripts/qa/he-launch-check.mjs` | PASS — alle sieben lokalen Checks grün (siehe Tabelle unten) |
| nginx-Regel | Zeile 172 in `ops/nginx/cyprusvipestates.conf` | enthält `he`: `^/(de|pl|ru|he)(/|$)` |

`node scripts/qa/he-launch-check.mjs`-Ausgabe (lokaler Modus, kein `--host`):

```
check                  | status | detail
-----------------------+--------+-------
placeholders (TODO=0)  | PASS   | TODO(he): 0  REVIEW(he): 114
content gate           | PASS   | he-content: OK (31 files, 2941 strings)
rtl-physical --strict  | PASS   | 0  TOTAL (115 files scanned, 84 exception rule(s))
review metadata        | PASS   | 30/30 content/he/**/*.he.json files carry "review"
content protocols      | PASS   | 6/6 packs have a c-*.md protocol
nginx he rule          | PASS   | locale rule includes "he": (de|pl|ru|he)(/|$)
seoLocalePlumbing test | PASS   | src/lib/__tests__/seoLocalePlumbing.test.ts exists

he-launch-check: PASS — all checks green
```

## Operator-Test-Lead auf Staging (Phase 7 Abnahme)

Landet in der **Produktions-DB** (geteilte DB, siehe „Local DB is production") — deshalb zwingend mit `[TEST]` im Namen markieren und danach in den Papierkorb legen. Reihenfolge:

1. Auf Staging (`https://design.cyprusvipestates.com/he/...`, `NEXT_PUBLIC_LIVE_LOCALES` mit `he`) ein Formular absenden — z. B. `/he/projects` → eine Projektkarte → Kontaktformular. Name: `[TEST] Phase 7-8 Abnahme`.
2. **CRM prüfen** (`/admin/crm` oder die Lead-Detailseite): `languagePreference: HE` gesetzt; falls das Formular über eine Development-Seite lief, `projectInterestId`/`source: PROJECT_ENQUIRY` über die neue `resolveProjectInterest()`-Fallback-Kette (Development → EN-Legacy-`Project`-Geschwister) gefüllt.
3. **Hebräische Auto-Reply** im Postfach der Test-E-Mail-Adresse prüfen: `<html lang="he" dir="rtl">`, Signatur-Block zeigt den `signature.he`-Text (oder den EN-Fallback, falls für den Absender kein `he`-Wert gepflegt ist — beides ist ein gültiges Ergebnis, geprüft wird nur, dass kein Fehler/leerer Block erscheint).
4. **Telegram-Alert** im internen Kanal: zeigt `HE` als Sprachcode (Admin-Copy bleibt Englisch, Projektkonvention) — sowohl für den Standard-Lead-Alert als auch, falls über ROI-Rechner/Partner-Formular ausgelöst, für deren Alerts (Task 1 Ruling: „ROI/partner Telegram senders get the same locale tag").
5. **Booking-Seite** (`/book/<token>`, aus dem Lead generiert oder manuell über die CRM-Aktion angestoßen): rendert hebräisch, `dir="rtl"`, Slot-Picker-Daten im `he-IL`-Format.
6. **Aufräumen:** den Test-Lead im CRM in den Papierkorb legen (nicht hart löschen — Projektregel gegen permanentes Löschen gilt auch hier).

## hreflang-Sampler gegen Staging

```bash
node scripts/qa/hreflang-check.mjs https://design.cyprusvipestates.com
```

Prüft x-default, Reziprozität, Canonical, `og:locale: he_IL`, `robots` (noindex nur auf `/he/blog*`) und JSON-LD `inLanguage: he-IL` über alle Seitentypen aus `rtl-matrix.mjs` + `case-studies`/`terms` + die 17 Landingpages (siehe Skript-Header für die vollständige Liste und den `--json`-Schalter). Gegen einen Host, auf dem `he` gated ist (z. B. Produktion vor Phase 9), zeigt jede `/he/*`-Zeile 404 und das Paar FAILt — das ist das korrekte, beabsichtigte Signal, kein Skriptfehler.

## Zurückgestellt / Tickets

- **`canonicalize()`-Bug** (pre-existing, nicht Teil dieses Plans): `canonicalize()` nutzt `deriveLocale` statt `urlCanonical.localeOfPath` an einer Stelle — beide delegieren seit Task 2 an dieselbe `localeFromPath()`, verhalten sich für `he` also bereits identisch; der historische Namens-/Nutzungs-Unterschied bleibt aber als Aufräum-Ticket bestehen (Task-2-Review-Notiz).
- **Partners (Entscheidung J):** Die Task-3-Review fand `/he/partners` in Sitemap und hreflang. Behoben in Commit 201f242: `UNLOCALIZED_ROUTES` in `src/lib/locale.ts` nimmt `partners` für `he` aus Alternates und Sitemap, `/he/partners` liefert 404, der hreflang-Sampler prüft das Paar (`/partners` ohne `he`-Alternate, `/he/partners` → 404).
- **Pass C** (muttersprachliches Lektorat) — weiterhin zurückgestellt (Controller-Entscheidung 2026-09-13, Phase 5); `REVIEW(he)`/`"review": "pending"` bleiben bestehen. Abbauregel: `docs/i18n/launch-checklist.md` §12.
- **Phase 9 (Launch)** — vollständig als Operator-Checkliste in `docs/i18n/launch-checklist.md` dokumentiert, **nicht ausgeführt**: nginx-Reload auf Produktion, `NEXT_PUBLIC_LIVE_LOCALES` in Produktion, Deploy, `he-launch-check.mjs --host` gegen Produktion, GSC-Property, Sitemap-Resubmit, IndexNow-Ping aller `he`-URLs, erste 6 URLs manuell in GSC (Quota ~6/Tag), 14-Tage-Monitoring mit den drei bekannten Fehlalarm-Klassen, AGB-§12-Sprachliste in allen vier LTR-Fassungen, Pass-C-Entscheidung erneut aufgreifen, `REVIEW(he)`-Abbauregel, Partner-Seite bleibt EN/`he/partners` darf nicht verlinkt oder indexiert sein.
- **Font-Doppelladen** — vom Controller nach Task 3 behoben (`c8eab9f`), siehe Tabelle oben; kein offenes Ticket mehr, hier nur zur Nachvollziehbarkeit gelistet.

## Referenzen

Spec `docs/superpowers/specs/2026-09-13-hebrew-localization-design.md` §3.6, §5 Phase 7/8/9, §6 · Plan `docs/superpowers/plans/2026-09-14-hebrew-phase7-8-pipeline-seo.md` · Ledger `.superpowers/sdd/2026-09-14-hebrew-phase7-8-pipeline-seo/progress.md` (nicht versioniert) · Launch-Checkliste `docs/i18n/launch-checklist.md` · Vorgänger `docs/i18n/acceptance/phase-5.md`, `phase-4.md`.
