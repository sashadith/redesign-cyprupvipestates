# Phase 4 — UI-Copy Hebräisch: Abnahme und Operator-Schritte

**Branch:** `worktree-he-phase4-copy` (gestapelt auf `worktree-he-phase2-3`, PR #43) · **Plan:** `docs/superpowers/plans/2026-09-13-hebrew-phase4-copy.md` · **Ledger:** `.superpowers/sdd/2026-09-13-hebrew-phase4-copy/progress.md` · **Stand:** 2026-09-13

## Was jetzt hebräisch ist

Alle Oberflächen-Strings des Codes (nicht: CMS-Inhalte) in sieben Arbeitspaketen, jeweils **Pass A** (Übersetzung, Opus) → **Pass B** (unabhängige Kritik, Opus, Rewrites eingearbeitet) → Task-Review. **Pass C (muttersprachliches Lektorat) steht aus** — die Protokolle liegen in `docs/i18n/reviews/wp1.md` … `wp7.md`, das Handbuch in `docs/i18n/reviews/README.md`. Bis dahin tragen alle hebräischen Einträge den Marker `REVIEW(he)`.

| WP | Oberfläche | Protokoll |
|---|---|---|
| WP1 | Formulare, Consent, Cookie-Banner, Newsletter, Footer, Breadcrumbs, 404, WhatsApp | `wp1.md` |
| WP2 | `/he/projects`, Projektseite, automatische Meta-Titel/-Beschreibungen (`developmentSeo.ts`), Orts-Transliteration (`src/lib/hePlaces.ts`), Feed-Vokabular (`src/lib/heFeedVocab.ts`) | `wp2.md` |
| WP3 | Startseite (alle Sektionen, Akzentwörter, Formular), Landingpage-Blöcke | `wp3.md` |
| WP4 | Blog-Rahmen, Bauträger-Übersicht, SEO-Fallbacks der Catch-all-Route | `wp4.md` |
| WP5 | Über uns, Kontakt (Beratungssprachen-Hinweis, Entscheidung E), FAQ-Rahmen | `wp5.md` |
| WP6 | Kundengeschichten | `wp6.md` |
| WP7 | Präsentationsseite, Terminbuchung, Kunden-E-Mails (RTL), CRM-Nachrichten, ROI-Rechner, Broschüren-Dialog, Playbook-Abschnitt | `wp7.md` |

Verbindliche Sprachregeln: `docs/i18n/he-styleguide.md` (inkl. §11, Lernpunkte aus Pass B) und `docs/i18n/he-glossary.md`; paketweise Neubegriffe in `docs/i18n/reviews/wpN-glossary.md` (Konsolidierung: Task 11).

## Gate-Zahlen

| Gate | Befehl | Ergebnis |
|---|---|---|
| Platzhalter | `node scripts/qa/he-placeholders.mjs` | `TODO(he)`: 2 (nur `preview-legal/registry.ts`, Phase 5b) · `REVIEW(he)`: 111 Tabellen/Einträge |
| LTR-Snapshot | `node --import tsx scripts/qa/copy-snapshot.mjs --check` | sauber, 3.377 Blätter — kein en/de/pl/ru-String verändert (Ausnahmen unten). Seit dem Final-Review-Fix sind auch `consentCopy.ts`, `formFeedbackCopy.ts`, `qualifierFields.ts`, `crm/compose/greeting.ts`, `crm/compose/closing.ts` und `emailTemplates.ts` registriert. **Nicht abgedeckt:** `src/app/api/roi-calculator/route.ts` (`ROI_EMAIL`) — die Next-Route zieht `next/server`, nodemailer und den Prisma-Client beim Import; sie steht als `skip` mit Begründung in `scripts/qa/copy-modules.json`, ihre LTR-Invarianz ist nur per Removed-Line-Audit belegt |
| Meta-Längen | `node --import tsx scripts/qa/he-meta-length.mjs` | 56 Prüfungen, 0 Verstöße außer `preview-partners` metaTitle 73 Zeichen (EN, Entscheidung J, Phase 8) |
| Typen | `npx tsc --noEmit -p tsconfig.json` | sauber |
| Tests | `npm test` | 177 grün (Baseline 125 + 44 Phase-4-Tests + 8 aus dem Final-Review-Fix: Budget-Chip in allen vier Formen × fünf Locales, CRM-Opening/Closing auf `!`/Gedankenstrich/nicht isolierte Latein-Läufe) |
| Physische CSS-Deklarationen | `node scripts/qa/rtl-physical-count.mjs` | 107, unverändert gegenüber Phase 2 (Phase 2b) |

**Bewusste, sichtbare Änderungen für en/de/pl/ru** (alle im Ledger als Ruling): Nationalitäten-Dropdown im Qualifizierungsformular erhält die Option „Israeli"; `ClassicBlocks` reicht `lang` an `HowWeWorkSection` durch (Akzentwort-Hervorhebung greift nun auch auf de/pl/ru-Landingpages); ROI-Mail-Labels liegen in einer Tabelle (Text byte-identisch); `ProjectLink` zeigt für ru `м²` statt `m²` (Angleichung an `DEVELOPMENT_STRINGS.ru`).

**Was der Zähler nicht sieht:** `he`-Literale an Render-Stellen (Pluralverzweigungen, `lang === "he"`-Zweige in JSX) tragen keinen Marker; sie sind in den `wpN.md`-Protokollen gelistet und werden dort lektoriert.

## Staging-Verifikation

1. Deploy wie in `phase-1.md`/`phase-2.md` (Branch dieses Worktrees, `NEXT_PUBLIC_LIVE_LOCALES` mit `he`).
2. `node scripts/qa/rtl-matrix.mjs https://design.cyprusvipestates.com` — alle `/he/*`-Seiten 200, `dir="rtl"`, `lang="he"`.
3. Seiten aus den Protokoll-Köpfen aufrufen und lesen: `/he`, `/he/projects`, drei Projektseiten (View-Source: `<title>` und Description hebräisch, Ortsname transliteriert), Formular absenden (Erfolgs-/Fehlertext), Cookie-Banner, 404, `/he/about`, `/he/contacts`, `/he/case-studies`, `/he/blog`, `/he/developers`, eine paginierte Seite (`?page=2`, Suffix `(עמוד 2)`).
4. E-Mail-Vorschau: eine Test-Anfrage auf `he` auslösen und die Auto-Reply im Postfach prüfen (`<html lang="he" dir="rtl">`, Zahlen/Preise nicht gespiegelt).
5. `he-smoke.sh <host> live` und die Checkliste `docs/i18n/rtl-qa-checklist.md` für die neu übersetzten Seiten.

## Zurückgestellt (mit Ruling im Ledger)

- **Pass C** — muttersprachliches Lektorat aller sieben Protokolle; Marker `REVIEW(he)` werden erst danach entfernt. Lektor noch nicht benannt.
- **Phase 5 (Inhalte):** `/he/faq` liefert 404, bis eine hebräische FAQ-Seite in Sanity existiert; `/he/projects`-H1/-Meta und Sektions-H2 der Startseite kommen aus dem CMS (Akzentwörter greifen nur, wenn die H2 den dokumentierten Wortlaut in `wp3.md` haben); Kundengeschichten-Detailseiten brauchen hebräische Zeilen; Rechtstexte = Phase 5b (`registry.ts`, 2 Marker).
- **Phase 6 (Blog):** `/he/blog` muss englische Artikel abfragen, `noindex` tragen und den Zähler auf veröffentlichte Artikel beziehen — heute rendert die Route `0 Artikel`.
- **Phase 2b (RTL-Rest):** 107 physische CSS-Deklarationen; Hebrew-Font-Subset auf den Blog-Routen; zwei Desktop-Asymmetrien aus Phase 2.
- **Phase 8 (SEO-Härtung):** Partners metaTitle 73 Zeichen (Entscheidung J); Transliterationstabelle bei Bedarf um weitere Feed-Orte erweitern (`src/lib/hePlaces.ts`).
- **Eigene Tickets (nicht hebräisch-spezifisch):** FAQ-Quelltext EN/DE/PL/RU nennt einen Notartermin (in Zypern: Unterschrift beim Anwalt); Kundengeschichten-Index zeigt für en/de/pl/ru das rohe Typ-Enum; `preview-case-studies` hängt „ move?" an den Formulartitel aller LTR-Locales; tote Case-Study-Komponenten (`CaseStudyIntro/Overview/Details/All`, `[lang]/case-studies/**`); About-Seite rendert Teamsprachen als DB-Rohtext; `SlotPicker` ohne Locale-Datum (für `he` im WP7-Fix behandelt).

## Referenzen

Spec `docs/superpowers/specs/2026-09-13-hebrew-localization-design.md` §3.5, §4.1, §5 · Inventar `docs/i18n/he-copy-inventory.md` · Keyword-Map `docs/i18n/he-keyword-map.md` · Kritiken und Reviews unter `.superpowers/sdd/2026-09-13-hebrew-phase4-copy/` (nicht versioniert).
