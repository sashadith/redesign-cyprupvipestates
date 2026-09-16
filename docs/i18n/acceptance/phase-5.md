# Phase 5 — Content (+ Phase 6 Blog-Index) Hebräisch: Abnahme und Operator-Schritte

**Branch:** `worktree-he-phase5-content` (gestapelt auf `worktree-he-phase4-copy`, PR #44) · **Plan:** `docs/superpowers/plans/2026-09-13-hebrew-phase5-content.md` · **Spec:** `docs/superpowers/specs/2026-09-13-hebrew-localization-design.md` §1.3, §3.5, §3.6, §4.1/§4.2, §5 Phase 5+6, §6 · **Ledger:** `.superpowers/sdd/2026-09-13-hebrew-phase5-content/progress.md` · **Stand:** 2026-09-13

## Was jetzt hebräisch ist

Anders als Phase 4 (Code-Copy) liefert Phase 5 **Inhalte** — versioniert unter `content/he/**` (siehe `content/he/README.md`), nie direkt aus einem Laptop in die Datenbank geschrieben (die lokale `DATABASE_URL` ist Produktion). Jede Datei durchlief **Pass A** (Übersetzung/Verfassen, Opus) → **Pass B** (unabhängige Kritik, Rewrites eingearbeitet) → Task-Review. **Pass C (muttersprachliches Lektorat) ist zurückgestellt** (Controller-Entscheidung 2026-09-13): jede Datei trägt `"review": "pending"`; die Protokolle sind "leicht" (Datei, Seite, Pass-B-Zusammenfassung, offene Fragen) statt vollständiger Pro-Key-Tabellen.

| Paket | Umfang | Dateien | Strings | Protokoll |
|---|---|---:|---:|---|
| Site-Dokumente | `/he` (alle Sektionen), Header, Footer, 404, `/he/projects`-Meta, `/he/blog`-Rahmen, `/he/case-studies`-Rahmen, Formular-Chrome | 8 | 930 | `c-site-documents.md` |
| FAQ | `/he/faq` — 9 Kategorien, 60 Fragen, 244 Antwortabsätze | 1 (`scripts/faq-translations/he.json`) | 322 geprüfte Strings | `c-faq.md` |
| Kundengeschichten + About/Kontakt | 3 Case-Study-Detailseiten, `/he/about-us` (Team, Reviews), `/he/contacts` (Team, Adresse) | 5 | 601 (229 hebräisch, Rest gespeichert/unverändert — siehe „Was rendert" in `c-case-studies.md`) | `c-case-studies.md` |
| Landingpages 1–9 (Cornerstone, Apartments, Investment, Preise, Limassol-Hub + Neubau, Paphos-Hub + Apartments + Villen) | `docs/i18n/he-keyword-map.md` §4 Zeilen 1–9 | 9 | 794 | `c-landing-a.md` |
| Landingpages 10–17 (Villen-Hub, Meer-Villen, Häuser, Kaufprozess, Relocation, Aufenthalt, Steuern, Limassol-Investment) | Zeilen 10–17 | 8 | 1.266 | `c-landing-b.md` |
| Legal (Phase 5b) | `/he/privacy-policy`, `/he/terms-and-conditions` (`PRIVACY_HE`/`TERMS_HE`, `registry.ts`) | 2 (Code, kein `content/he/**`) | 10+13 Sektionen, spiegelgleich zu EN | `c-legal.md` |
| Blog-Index (Phase 6) | `/he/blog` — cross-locale (EN-Artikel + Badge), `noindex` solange `he` < 5 eigene Artikel | Code (`blogIndexMode.ts`, `BlogInsights.tsx`, Sitemap) | — | `task-8-report.md` |
| EN→HE-Übersetzungswarteschlange | Development-Beschreibungen/SEO, Gebietstexte, Bauträgerprofile — Server-Cron + Admin-Steuerung | Code (`translateHe.ts`, `heTranslateQueue.ts`, Cron-Route, Admin-Seite) | Export-Basis: 251 veröffentlichte Developments / 18 Inventar-Buckets, 23 Bauträger | `task-7-report.md` |

Gesamt-Pack (Stand dieser Doku, `node scripts/qa/he-content-check.mjs`): **31 Dateien, 2.848 Strings** (8 Site-Dokumente + 1 FAQ-Datei + 3 Case Studies + 2 About/Kontakt + 17 Landingpages). 17 der 17 Keyword-Map-Seiten sind gebaut, inklusive der optionalen Welle-2-Seite #17 (`limassol/investment-apartments`).

**Wichtig für den Seed:** keine der 17 Landingpages hat ein EN-Gegenstück (`export-en.mjs` fand keinen Treffer der Map-Slugs unter den EN-Singlepages) — sie sind frei auf Hebräisch verfasst aus der Keyword-Map, `content/he/source/inventory.json`, `content/he/source/developers.en.json`, sechs EN-Referenzseiten (`content/he/source/reference/*.en.json`) und `scripts/faq-translations/en.json` als Faktenbasis. `mirrorCheck` überspringt diese Dateien entsprechend (der Gate meldet das je Datei als Notiz, kein Fehler).

## Gate-Zahlen

| Gate | Befehl | Ergebnis |
|---|---|---|
| Content-Gate (ganzes Pack) | `node scripts/qa/he-content-check.mjs` | `he-content: OK (31 files, 2941 strings)`, 0 Verstöße |
| Tests | `npm test` | 309 grün (Baseline 177 aus Phase 4 + 132 neue: Content-Gate, Seeder, translateHe/Queue, Blog-Cross-Locale, Final-Review-Fixes) |
| Typen | `npx tsc --noEmit -p tsconfig.json` | sauber |
| Platzhalter | `node scripts/qa/he-placeholders.mjs` | `TODO(he)`: 0 (Legal-Marker aus Phase 4/5b ersetzt) · `REVIEW(he)`: 114, bleibt bis Pass C |
| LTR-Snapshot | `node --import tsx scripts/qa/copy-snapshot.mjs --check` | sauber, 3.381 Blätter — kein en/de/pl/ru-String verändert (Ausnahmen siehe unten) |
| Meta-Längen | `node --import tsx scripts/qa/he-meta-length.mjs` | 0 neue Verstöße; einzig `preview-partners` metaTitle 73 Zeichen (EN, Entscheidung J) |

**Bewusste, sichtbare Änderungen für en/de/pl/ru** (beide im Ledger als Ruling protokolliert; sonst nichts):

- `getTotalBlogPostsByLang` (`src/sanity/sanity.utils.ts`) zählt jetzt nur `PUBLISHED`-Artikel — ein Bugfix (die Zahl war vorher zu hoch), betrifft auch `preview-insights/InsightsIndex.tsx` und `api/getMorePosts/route.ts` für alle Locales gleichermaßen.
- Die FAQ-JSON-LD (`src/app/preview-faq/[lang]/page.tsx`) trägt jetzt `inLanguage` für **alle** Locales (nicht nur `he`) — akzeptierter Nebeneffekt, im Ledger als Ruling festgehalten.

Alles andere in Phase 5/6 ist entweder `he`-only (Sprachlisten-Chips auf About/Kontakt via `lang === "he"`-Zweig, Fallback auf die EN-Legacy-`Project`-Zeile bei Case-Study-Projektkarten) oder betrifft nur `content/he/**`-Dateien und Legal-`*.he.ts`, die für andere Locales nicht existieren.

## Operator-Schritte auf Staging (in dieser Reihenfolge)

1. **Phase-1-Migration anwenden, falls auf dieser Umgebung noch nicht geschehen — VOR dem Deploy** (additiv, geteilte DB — bewusst freigegeben; Details, Vorab-Sync des `prisma/`-Ordners und Kontrollabfrage in `phase-1.md` Schritt 2). Der Build braucht den Enum-Wert `he`, weil `generateStaticParams` die Datenbank damit abfragt:
   ```bash
   cd /var/www/cve-staging && CVP_CONFIRM_PROD_MIGRATE=yes ./scripts/migrate-deploy-safe.sh migrate deploy
   ```
2. **Deploy des gestapelten Branches** (wie in `phase-1.md`/`phase-4.md`):
   ```bash
   ./scripts/deploy-staging.sh
   ```
3. **Content-Pack seeden** (im Checkout auf dem Staging-Server, niemals vom Laptop):
   ```bash
   cd /var/www/cve-staging
   CVP_ALLOW_DB_READ=yes node scripts/he-content/seed.mjs --dry-run
   # → Plan lesen: jede Zeile insert/update/skip, alle relatedLandingPages/parentSlug/relatedProjects aufgelöst
   CVP_ALLOW_DB_READ=yes CVP_CONFIRM_CONTENT_SEED=yes node scripts/he-content/seed.mjs --yes
   ```
   **Ausnahme zur „nur `he`-Zeilen"-Regel, im Plan sichtbar:** Zeilen mit
   `translationGroupSlugEn` (`about-us`, `contacts`, die drei Case Studies)
   können der **EN**-Zeile die `translationGroupId` schreiben, die ihr bisher
   fehlt — dieselbe Konvention wie `createTranslation`. Der Dry-Run listet das
   als eigene `link-group`-Zeile („will set translationGroupId … on the EN row
   …"); erscheint keine solche Zeile, wird keine Nicht-`he`-Zeile angefasst.
4. **FAQ seeden** (gleiche Zwei-Flag-Regel wie oben, **plus `--lang he`**): ein echter Lauf schreibt genau die eine benannte Sprache. Ohne `--lang` schreibt das Skript gar nichts, sondern druckt nur den Plan aller fünf Sprachen (Exit 0) — so können die von Redakteur:innen in `/admin/content/faq` gepflegten `en/de/pl/ru`-Zeilen nicht überschrieben werden:
   ```bash
   CVP_CONFIRM_CONTENT_SEED=yes node scripts/seed-faq-translations.mjs --lang he --yes
   ```
   (Alternativ erzeugt `CVP_ALLOW_DB_READ=yes CVP_CONFIRM_CONTENT_SEED=yes node scripts/he-content/seed.mjs --only faq --yes` dieselbe `he`-Zeile.)
5. **Idempotenz-Probe:** den Dry-Run beider Seeder ein zweites Mal laufen lassen — erwartet **0 Schreibvorgänge** (alle Zeilen `skip (unchanged)`):
   ```bash
   CVP_ALLOW_DB_READ=yes node scripts/he-content/seed.mjs --dry-run
   node scripts/seed-faq-translations.mjs
   ```
6. **App neu laden**, damit sie die neuen Zeilen sieht:
   ```bash
   pm2 reload cve-staging --update-env
   ```
7. **Filter-Gate für die beiden scharfen Projektfilter** (hartes Pre-Publish-Gate, nicht nur eine Randnotiz — siehe Task-6b-Review „Minor"): auf `/he/seafront-villas-cyprus` (`maxBeachMinutes: 10`) und auf `/he/limassol/investment-apartments` (`filterStage: "off-plan"`) prüfen, dass der Projekte-Block mindestens ein paar Karten zeigt und **nicht** den leeren Zustand (`pl-grid__empty`) — `LandingBody.tsx` hat keine `MIN_LIVE_RESULTS`-Untergrenze, ein zu enger Filter liefert also lautlos null Treffer. Bei leerem Grid: den Filterwert in der jeweiligen Quelldatei lockern (`content/he/singlepages/seafront-villas-cyprus.he.json` bzw. `content/he/singlepages/limassol/investment-apartments.he.json`) und gezielt nachseeden:
   ```bash
   CVP_ALLOW_DB_READ=yes node scripts/he-content/seed.mjs --only singlepages --dry-run
   CVP_ALLOW_DB_READ=yes CVP_CONFIRM_CONTENT_SEED=yes node scripts/he-content/seed.mjs --only singlepages --yes
   pm2 reload cve-staging --update-env
   ```
   Erst danach mit Schritt 8 weitermachen.
8. **Übersetzungswarteschlange öffnen:** `/admin/content/hebrew` aufrufen → **„Enqueue 15 sample"** klicken.
9. **Cron-Route einmal manuell auslösen** (verarbeitet die 15 Sample-Zeilen; Auth ist ein Query-Parameter, kein Header — wie bei `api/cron/psi-sync`, siehe `src/app/api/cron/he-translate/route.ts:25`):
   ```bash
   curl -s "https://design.cyprusvipestates.com/api/cron/he-translate?key=$CRON_SECRET&limit=15"
   ```
10. **Samples lesen** auf `/admin/content/hebrew` (EN/HE nebeneinander, `dir="rtl"` auf der HE-Spalte) — bei schlechten Ergebnissen **„Reject → re-enqueue with force"** pro Zeile.
11. **Restliche Zeilen einreihen** — je Kind einzeln:
    ```
    „Enqueue missing developments" / „Enqueue missing areas" / „Enqueue missing developers"
    ```
12. **Staging-Crontab-Zeile** (drainiert die Warteschlange automatisch, alle 10 Minuten, 10 Zeilen pro Lauf, Log-Datei):
    ```
    */10 * * * * curl -s "https://design.cyprusvipestates.com/api/cron/he-translate?key=REPLACE_WITH_CRON_SECRET&limit=10" >> /var/log/he-translate-cron.log 2>&1
    ```
    (Crontab-Zeilen erben keine Shell-Umgebung — den tatsächlichen `CRON_SECRET`-Wert einsetzen, nicht die Variable.) Zähler auf `/admin/content/hebrew` beobachten, bis „mit HE" für Developments/Gebiete/Bauträger den „veröffentlicht"-Zähler erreicht.
13. **Automatisierte Smoke-Checks:**
    ```bash
    scripts/qa/he-smoke.sh https://design.cyprusvipestates.com live
    node scripts/qa/rtl-matrix.mjs https://design.cyprusvipestates.com
    ```
14. **Manueller Seiten-Walk** (Inhalt lesen, nicht nur Statuscode):
    - `/he`, `/he/projects`
    - drei Projektseiten
    - `/he/faq` (vorher 404 — muss jetzt die 9 Kategorien/60 Fragen zeigen)
    - `/he/about-us`, `/he/contacts`
    - `/he/case-studies` + eine Detailseite
    - `/he/blog` (EN-Artikelkarten mit Badge „באנגלית"/`englishBadge`, `noindex` im Quelltext solange < 5 eigene `he`-Artikel)
    - `/he/developers`
    - alle 17 Landingpages: `/he/real-estate-cyprus`, `/he/apartments-for-sale-cyprus`, `/he/property-investment-cyprus`, `/he/property-prices-cyprus`, `/he/limassol`, `/he/limassol/new-projects`, `/he/paphos`, `/he/paphos/apartments`, `/he/paphos/villas`, `/he/villas-cyprus`, `/he/seafront-villas-cyprus`, `/he/houses-for-sale-cyprus`, `/he/buying-property-in-cyprus`, `/he/relocation-cyprus`, `/he/permanent-residency-cyprus`, `/he/property-tax-cyprus`, `/he/limassol/investment-apartments` — auf `/he/seafront-villas-cyprus` und `/he/limassol/investment-apartments` erneut bestätigen, dass der Projekte-Block Karten zeigt (Schritt 7 ist hier bereits erledigt, nicht nochmal lockern, nur gegenlesen)
    - `/he/privacy-policy`, `/he/terms-and-conditions` (Verbindlichkeits-Hinweis unter der H1 prüfen)
    - eine paginierte Seite (z. B. `/he/projects?page=2`)

## Zurückgestellt / Tickets

- **Pass C** — muttersprachliches Lektorat aller Content-Protokolle (`c-*.md`); Lektor noch nicht benannt. Bis dahin trägt jede Datei `"review": "pending"`.
- **`<ul>`-Renderer** — FAQ-Antworten mit Aufzählungen rendern derzeit ohne Listenelement (Ticket aus `c-faq.md`/Pass-B-Fixrunde 1, Task 4).
- **Bidi-Isolation lateinischer Tokens in JSON-Inhalten** — Renderer-seitige Lücke (kein `<bdi>`/U+2066 in `content/he/**`-Strings selbst): betrifft Telefonnummer/Firmenname/USt-ID im Footer, E-Mail/Telefon in Formular-Fehlermeldungen, `שטר הבעלות (Title Deed)` im Blog-Chrome und jede lateinische Marke in einem hebräischen Satz (`c-site-documents.md`). Entweder tragen die Renderer die Isolation nach, oder die JSON-Strings erhalten die Steuerzeichen selbst — Phase 8.
- **S24** (`caseStudiesPage.seo.metaDescription`) — bewusst unverändert gelassen, weil wortgleich mit `preview-case-studies/[lang]/copy.ts:230` (§11.6, außerhalb des Task-3-Pathspecs) und von der Vollständigkeit der Case-Study-Datenfelder abhängig; Pass-C-Frage 7 in `c-site-documents.md`.
- **Partnerseite** bleibt englisch (Entscheidung J) — der Header-Sublink zeigt bewusst auf `/partners`, nicht auf eine nicht existierende `/he/partners`-Übersetzung.
- **Phase 7 (Lead-Pipeline)** — noch nicht Teil dieses Plans.
- **Phase 8 (SEO-Härtung)** — u. a. hreflang für `/he/blog` (cross-locale Sonderfall, noch nicht spezifiziert), Sitemap-Einschlussregeln für `he`, sobald `/he/blog` indexierbar wird; Transliterationstabelle (`src/lib/hePlaces.ts`) bei Bedarf erweitern.
- **Phase 2b (RTL-Rest)** — siehe `phase-4.md`, unverändert offen.
- **Phase 9 (Launch)** — `NEXT_PUBLIC_LIVE_LOCALES` in Produktion setzen (niemals ohne ausdrückliche Anweisung); Hebräisch zur AGB-§12-Sprachfassungsliste in **allen** Versionen (`en/de/pl/ru/he`) in einem gemeinsamen Commit hinzufügen — bis dahin nennt §12 bewusst nur die vier bestehenden Sprachen (siehe `c-legal.md`, Release-Gate-Vermerk).

## Referenzen

Spec `docs/superpowers/specs/2026-09-13-hebrew-localization-design.md` §1.3, §3.5, §3.6, §4.1/§4.2, §5, §6 · Keyword-Map `docs/i18n/he-keyword-map.md` §4 · Content-Pack-Layout `content/he/README.md` · Styleguide `docs/i18n/he-styleguide.md` · Glossar `docs/i18n/he-glossary.md` · Reviewer-Handbuch `docs/i18n/reviews/README.md` · Protokolle `docs/i18n/reviews/c-{site-documents,faq,case-studies,landing-a,landing-b,legal}.md` · Ledger `.superpowers/sdd/2026-09-13-hebrew-phase5-content/progress.md` (nicht versioniert) · Vorgänger `docs/i18n/acceptance/phase-4.md`.
