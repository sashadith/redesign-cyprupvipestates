# Hebräisch-Lektorat (Pass C) — Handbuch für den muttersprachlichen Reviewer

**Stand:** 2026-09-13 · Gilt für alle Protokolle `wp1.md` … `wp7.md` in diesem Ordner.

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

## Reihenfolge, wenn die Zeit knapp ist

1. `wp1.md` (jeder Besucher sieht Formulare und Cookie-Banner) → 2. `wp2.md` (Hunderte Projektseiten, Meta-Titel) → 3. `wp3.md` (Startseite) → 4. `wp5.md` → 5. `wp7.md` (E-Mails an Kunden) → 6. `wp4.md`, `wp6.md`.

## Was noch nicht in diesen Protokollen ist

Rechtstexte (Datenschutz, AGB; eigener Durchgang, „Phase 5b"), Projektbeschreibungen aus der Datenbank (KI-generiert, Stichproben-Lektorat), Blogartikel (bleiben vorerst englisch), FAQ-Fragen und -Antworten sowie Kundengeschichten (CMS-Inhalte, eigener Durchgang „Phase 5"), Partnerseite (bleibt englisch).
