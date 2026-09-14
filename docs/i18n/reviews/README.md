# Hebräisch-Lektorat (Pass C) — Handbuch für den muttersprachlichen Reviewer

**Stand:** 2026-09-13 · Gilt für alle Protokolle `wp1.md` … `wp7.md` (Phase 4, Oberflächen-Copy im Code) und `c-*.md` (Phase 5, CMS-Inhalte) in diesem Ordner.

## Was hier liegt

Jedes Arbeitspaket (WP) der hebräischen Oberflächen-Übersetzung hat ein Protokoll `wpN.md`. Es enthält für jeden übersetzten String eine Zeile: **Key · EN (Quelle) · HE (aktuell) · Anmerkung · Korrektur HE**. Die Übersetzung wurde in zwei maschinellen Durchgängen erstellt und kritisiert (Pass A: Übersetzung, Pass B: Kritik mit Rewrites, bereits eingearbeitet). **Pass C ist die verbindliche menschliche Freigabe** — ohne sie geht kein hebräischer String live.

Dazu kommen `wpN-glossary.md`: Begriffe, die das Paket neu eingeführt hat, mit Begründung. Das Hauptglossar ist `../he-glossary.md`; die Stilregeln stehen in `../he-styleguide.md`.

| Protokoll | Seiten | Umfang |
|---|---|---|
| `wp1.md` | Formulare, Cookie-Banner, Newsletter, Footer, Breadcrumbs, 404, WhatsApp-Vorbelegung | ~125 Strings |
| `wp2.md` | `/he/projects` (Filter, Sortierung, Karte, Karten) und jede Projektseite inkl. automatischer Meta-Titel/-Beschreibungen | ~230 Strings, **SEO-kritisch** |
| `wp3.md` | Startseite `/he` (alle Sektionen, Akzentwörter, Formular) und Landingpage-Blöcke | ~50 Strings + Formular |
| `wp4.md` | Blog-Rahmen (Artikel bleiben englisch), Bauträger-Übersicht, SEO-Fallbacks | ~30 Strings |
| `wp5.md` | Über uns, Kontakt (inkl. Beratungssprachen-Hinweis), FAQ-Rahmen | ~170 Strings |
| `wp6.md` | Kundengeschichten (Liste, Intro, Detailseite) | ~45 Strings |
| `wp7.md` | Präsentationsseite, Terminbuchung, Kunden-E-Mails, ROI-Rechner, Broschüren-Dialog | ~250 Strings, transaktional |

## So arbeiten Sie

1. **Erst lesen:** `../he-styleguide.md` (10 Minuten). Verbindlich sind vor allem: Register (professionell-warm, nominal/Infinitiv in Buttons, männlicher Plural nur wo unvermeidbar, keine Schrägstrich-Formen wie `מאשר/ת`), Zeichensetzung (kein Gedankenstrich, gerade Anführungszeichen, `נדל"ן` mit Gershayim, westliche Ziffern, `€` vor der Zahl) und die verbotenen Floskeln in §7. Der Kurzcheck in §10 ist Ihre Checkliste pro Zeile.
2. **Dann das Glossar** `../he-glossary.md`: Ortsnamen und Immobilienbegriffe sind festgelegt. Wenn Sie einen Glossarbegriff für falsch halten, korrigieren Sie ihn **einmal** im Glossar-Abschnitt des Protokolls, nicht in jeder Zeile — wir ziehen die Änderung dann überall nach.
3. **Pro Protokoll:** Öffnen Sie die im Kopf genannten Seiten auf der Staging-Umgebung (Zugang kommt vom Betreiber) und lesen Sie den String im Kontext. Beurteilen Sie pro Zeile:
   - ✓ **freigegeben** — Zelle `Korrektur HE` leer lassen.
   - ✗ **Korrektur** — die vollständige neue Fassung in `Korrektur HE` eintragen (ganzer String, nicht nur das geänderte Wort; Platzhalter wie `${name}` unverändert übernehmen).
   - ? **Rückfrage** — in `Korrektur HE` mit `?` beginnen und die Frage stellen.
4. **Was Sie nicht ändern:** Keys, Platzhalter `${…}`, URLs, E-Mail-Adressen, Telefonnummern, lateinische Marken- und Projektnamen. Längenbudgets bei Meta-Titeln (≤ 60 Zeichen) und -Beschreibungen (≤ 155) sind hart; das Protokoll nennt die Zählung.
5. **Worauf besonders zu achten ist:**
   - Klingt es wie eine israelische Immobilienseite oder wie übersetztes Englisch? Wortstellung, Kalkierungen, Wiederholungen derselben Wurzel im Satz.
   - Genusneutralität: Wo der Text Besucher anspricht, muss die Form für Männer und Frauen funktionieren (1. Person Vergangenheit, Partizip Plural, unpersönliches `יש ל…`). Melden Sie jede Stelle, die nur ein Geschlecht anspricht.
   - Rechtsnähe: Consent-Zeilen, Cookie-Text, Datenschutz-Hinweise müssen dem englischen Sinn genau entsprechen — nichts weichzeichnen.
   - Ehrlichkeit: Die Kontaktseite sagt ausdrücklich, dass Beratungen auf Englisch oder Russisch stattfinden und Anfragen auf Hebräisch willkommen sind (Glossar §5, „Entscheidung E"). Kein String darf hebräischsprachige Betreuung versprechen.
   - Fachbegriffe: Zyprische Realität, nicht israelische (kein `ממ"ד`, kein Notar — in Zypern unterschreibt man beim Anwalt).
6. **Abgabe:** Die bearbeiteten `wpN.md`-Dateien (oder eine Kopie mit Ihren Einträgen) zurücksenden. Wir übernehmen jede Korrektur wörtlich in den Code, entfernen den Marker `REVIEW(he)` erst danach und dokumentieren offene Rückfragen im Protokoll.

## Reihenfolge, wenn die Zeit knapp ist (Phase 4, `wpN.md`)

1. `wp1.md` (jeder Besucher sieht Formulare und Cookie-Banner) → 2. `wp2.md` (Hunderte Projektseiten, Meta-Titel) → 3. `wp3.md` (Startseite) → 4. `wp5.md` → 5. `wp7.md` (E-Mails an Kunden) → 6. `wp4.md`, `wp6.md`.

## Was noch nicht in diesen `wpN.md`-Protokollen ist

Projektbeschreibungen aus der Datenbank (KI-generiert über die Übersetzungswarteschlange, Stichproben-Lektorat auf `/admin/content/hebrew`) und die Partnerseite (bleibt englisch, Entscheidung J). Rechtstexte, FAQ, Kundengeschichten und die CMS-Inhalte (Startseite, Landingpages usw.) sind seit Phase 5 in den `c-*.md`-Protokollen unten — nicht mehr „noch nicht vorhanden".

---

## Content-Pakete (Phase 5, `c-*.md`)

Phase 5 hat keine Oberflächen-Strings mehr übersetzt (das war Phase 4), sondern **Inhalte** — Seiten, FAQ, Kundengeschichten, Rechtstexte. Diese leben nicht im Code, sondern als versionierte Dateien unter `content/he/**` (JSON), `scripts/faq-translations/he.json` und `src/app/preview-legal/[lang]/[doc]/{privacy,terms}.he.ts` — siehe `content/he/README.md` für das vollständige Layout. Jedes Paket hat ein `c-<paket>.md`-Protokoll in diesem Ordner:

| Protokoll | Paket | Wo der hebräische Inhalt liegt |
|---|---|---|
| `c-site-documents.md` | Startseite, Header, Footer, 404, `/he/projects`-Meta, `/he/blog`-Rahmen, `/he/case-studies`-Rahmen, Formular-Chrome | `content/he/site-documents/*.he.json` |
| `c-landing-a.md` | Landingpages 1–9 (Cornerstone, Apartments, Investment, Preise, Limassol, Paphos) | `content/he/singlepages/*.he.json` |
| `c-landing-b.md` | Landingpages 10–17 (Villen, Häuser, Kaufprozess, Relocation, Aufenthalt, Steuern) | `content/he/singlepages/*.he.json` |
| `c-faq.md` | `/he/faq` — 9 Kategorien, 60 Fragen | `scripts/faq-translations/he.json` |
| `c-case-studies.md` | 3 Kundengeschichten, `/he/about-us`, `/he/contacts` | `content/he/case-studies/*.he.json`, `content/he/singlepages/{about-us,contacts}.he.json` |
| `c-legal.md` | `/he/privacy-policy`, `/he/terms-and-conditions` | `src/app/preview-legal/[lang]/[doc]/{privacy,terms}.he.ts` (Code, kein `content/he/**`) |

### Das leichte Format

Anders als `wpN.md` (eine Zeile pro String) sind `c-*.md`-Protokolle **leicht**: Datei(en) und Seite, ein Absatz Pass-B-Zusammenfassung (was geprüft und korrigiert wurde), eine Liste offener Fragen für Pass C. Grund: Controller-Entscheidung vom 2026-09-13, Pass C zurückzustellen und mit generiertem Hebräisch zu seeden (die Zeilen laufen als `PUBLISHED`, aber `he` ist in Produktion locale-gated und damit unsichtbar). Ohne diese Entscheidung hätte jedes Paket eine Pro-Key-Tabelle wie `wpN.md` bekommen. **Jede Content-Datei trägt deshalb `"review": "pending"`** als eigenes Feld (Ausnahme: `scripts/faq-translations/he.json` — die Datei wird strikt aus `en.json` neu aufgebaut und ein zusätzliches Feld würde stillschweigend verworfen; dort steht der Status nur im Protokoll).

Für Pass C bei `c-*.md` gilt dieselbe Arbeitsweise wie oben (✓/✗/? pro Zeile, Glossar-Korrekturen einmal im Protokoll, Keys/Platzhalter/URLs/Namen unverändert lassen) — nur dass die „Zeile" hier ein Absatz oder eine Tabellenzeile im leichten Format ist, nicht ein einzelner String.

### Das Konzept „kept identical" (unverändert übernommen)

Jede `content/he/**`-Datei mit einem EN-Gegenstück unter `content/he/source/**` ist ein **Deep Clone** der EN-Struktur — Keys, `_key`s, Array-Längen, `marks`/`markDefs` byte-genau gespiegelt. Übersetzt wurde ausschließlich menschenlesbarer Text; alles andere ist bewusst **identisch mit der EN-Quelle** stehen geblieben: Enum-Werte (`category`, `textAlign`), Layout-Token, `_ref`/Bild-Referenzen, Slugs, lateinische Namen. `node scripts/qa/he-content-check.mjs` meldet das je Datei als Notiz („N string(s) kept identical to EN"), nicht als Fehler — das ist erwartetes Verhalten, kein Übersetzungsloch. Neun der 17 Landingpages und alle acht 10–17-Seiten haben **kein** EN-Gegenstück (die Keyword-Map-Seiten sind frei auf Hebräisch verfasst); dort meldet der Gate „no EN source — skipping mirrorCheck" statt der „kept identical"-Notiz.

### Wie Korrekturen zurückfließen

1. Die Korrektur direkt in der betroffenen `*.he.json`-Datei (oder `scripts/faq-translations/he.json`, oder der `.he.ts`-Datei bei Legal) einpflegen — niemals in der Datenbank, niemals über die Sanity-Oberfläche (siehe „Warum Git, nicht CMS" in `content/he/README.md`: die lokale `DATABASE_URL` ist Produktion).
2. Gate laufen lassen: `node scripts/qa/he-content-check.mjs --only <pfad>` (Struktur, Stil, Links, Meta-Längen).
3. Commit mit Pathspec, wie jede andere Content-Änderung.
4. Auf Staging neu seeden: `CVP_ALLOW_DB_READ=yes CVP_CONFIRM_CONTENT_SEED=yes node scripts/he-content/seed.mjs --yes --only <kind>` (bzw. `node scripts/seed-faq-translations.mjs --yes` für die FAQ) — der Seeder ist idempotent, ein erneuter Lauf überschreibt nur die geänderten Felder.
5. Nach abgeschlossenem Pass C: `"review": "pending"` in der Datei auf `"review": "approved"` (oder das im Protokoll vereinbarte Feld) setzen und den Marker im Protokollkopf entfernen — siehe `docs/i18n/acceptance/phase-5.md` für den vollständigen Operator-Runbook.

### Priorität, wenn die Zeit knapp ist (Phase 5, `c-*.md`)

1. **Site-Dokumente** (`c-site-documents.md`) — jeder Besucher sieht Startseite, Header, Footer zuerst.
2. **Landingpages** (`c-landing-a.md`, dann `c-landing-b.md`) — der größte Teil des organischen Traffics läuft über diese 17 Seiten.
3. **FAQ** (`c-faq.md`) — hohe Suchnachfrage, aktuell 404 ohne Seed.
4. **Kundengeschichten** (`c-case-studies.md`) — geringste Reichweite der fünf Pakete (siehe „Was rendert" in `c-case-studies.md`: von 601 Strings erreichen nur ~60 tatsächlich eine Seite).
5. **Legal** (`c-legal.md`) — rechtlich am heikelsten, aber am seltensten gelesen; zusätzlich als Release-Gate für Phase 9 vermerkt (AGB §12 Sprachfassungsliste).

## Launch-Wächter und die `REVIEW(he)`-Abbauregel (Phase 8/9)

`node scripts/qa/he-launch-check.mjs` (Phase 8, Plan `docs/superpowers/plans/2026-09-14-hebrew-phase7-8-pipeline-seo.md` Task 5) prüft vor jedem Staging-/Produktions-Deploy unter anderem, dass jede `content/he/**/*.he.json`-Datei ein `"review"`-Feld trägt und dass jedes der sechs Content-Pakete oben sein `c-<paket>.md`-Protokoll in diesem Ordner hat — fehlt eines von beidem, schlägt der Wächter fehl. Er verlangt aber **nicht**, dass `REVIEW(he)` (Code-Copy, `wpN.md`) oder `"review": "pending"` (Content-Pack, `c-*.md`) bereits entfernt sind: der Wächter prüft nur `TODO(he) == 0`, nicht `REVIEW(he) == 0` — beide Marker dürfen bis zum echten Pass-C-Sign-off live bleiben, auch in Produktion (sie sind nur im Quelltext/JSON sichtbar, nie im gerenderten HTML). Die verbindliche Abbauregel — ein Marker/Feld wird erst nach protokolliertem Pass-C-Sign-off für genau die betroffene Zeile entfernt, nie pauschal für eine ganze Datei und nie vorab — steht ausführlich in `docs/i18n/launch-checklist.md` §12 und gilt für `wpN.md` und `c-*.md` gleichermaßen.
