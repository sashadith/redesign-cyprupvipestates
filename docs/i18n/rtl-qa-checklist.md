# RTL-Visual-QA-Checkliste (Hebräisch, Phase 2)

**Branch:** `worktree-he-phase2-3` · **Plan:** `docs/superpowers/plans/2026-09-13-hebrew-phase2-rtl.md` · **Stand:** 2026-09-13

## Zweck und Vorgehen

Diese Checkliste ist die manuelle Abnahme für die RTL-Layoutarbeit aus Phase 2
(Tasks 1–5): `dir="rtl"` für `he`, logische CSS-Eigenschaften, richtungsbewusste
Komponenten (Breadcrumbs, Carousels, Motion, Karten) und Bidi-Isolation für
Preise/Telefonnummern/E-Mails/lateinische Namen. Sie ersetzt keinen Test —
`node scripts/qa/rtl-physical-count.mjs` (Gate, siehe unten) und `npm test` /
`npx tsc --noEmit` bleiben die automatisierten Prüfungen. Diese Liste prüft,
was Automatisierung nicht sehen kann: ob das Layout tatsächlich gespiegelt
*aussieht* und sich *anfühlt*.

**Wichtig:** Das hebräische UI-Copy ist noch **nicht** übersetzt (das ist
Phase 4). `/he/*`-Seiten zeigen also englische Strings innerhalb eines
RTL-Rahmens (`dir="rtl"`, gespiegeltes Layout, hebräische Fonts nur dort, wo
bereits hebräischer Text vorkommt). Diese Matrix beurteilt **Layout und
Richtung**, nicht die Übersetzung — falscher/fehlender hebräischer Text ist
kein Fehler in diesem Durchgang.

**Ausführung:** Für jede Zeile: EN-URL und HE-URL aus
`node scripts/qa/rtl-matrix.mjs <staging-host>` öffnen, bei der angegebenen
Viewport-Größe (`desktop 1440×900` bzw. `mobile 390×844`) vergleichen,
Screenshot bei Abweichung. Nur ein Browser kann das — dieses Repo lässt
Browser-Werkzeuge nur nach ausdrücklicher Anweisung laufen, daher führt der
Operator (oder eine dafür ausdrücklich autorisierte Session) diesen Durchgang
nach dem Staging-Deploy aus (Schritte siehe
`docs/i18n/acceptance/phase-2.md`).

## Automatisiertes Gate (vor der visuellen Prüfung grün)

- `node scripts/qa/rtl-physical-count.mjs --strict` → Exit 0 (alle verbliebenen
  physischen `left`/`right`-Deklarationen sind entweder konvertiert oder in
  `scripts/qa/rtl-exceptions.txt` bewusst dokumentiert).
- `npx tsc --noEmit` sauber.
- `npm test` grün.

Der aktuelle Zählerstand nach Task 3 (hot-core CSS) ist in
`docs/i18n/acceptance/phase-2.md` protokolliert.

---

## 1. Header / Navigation / Sprachmenü

- [ ] **Logo, Hauptnavigation, Sprachumschalter** stehen spiegelbildlich zur
      LTR-Version (Logo rechts statt links, Nav-Reihenfolge gespiegelt,
      Sprachmenü-Trigger am linken statt rechten Rand).
      Erwartung: kein Element überlappt, keine abgeschnittenen Labels.
      Seite(n): `/he` (Desktop + Mobile).
- [ ] **Dropdown-Anker** (Nav-Dropdown, Sprachmenü) öffnen zur richtigen Seite
      (`inset-inline-start`/`-end` statt `left`/`right`).
      Erwartung: Dropdown bleibt innerhalb des Viewports, keine
      Horizontal-Scrollbar.
      Seite(n): `/he` (Desktop, Nav-Dropdown + Sprachmenü aufklappen).
- [ ] **Unterstreichungs-Animation** (Nav-Link-Hover, `::after`-Linie) wächst
      von der lesenden Seite her (rechts nach links unter Hebräisch), nicht
      von links.
      Seite(n): `/he`, Desktop, Hover auf einen Hauptnav-Link.

## 2. Mobile-Menü (Slide-in)

- [ ] **Slide-Richtung**: Das Mobile-Menü fährt von rechts ins Bild (nicht von
      links wie in LTR).
      Erwartung: Öffnen/Schließen-Animation spiegelt sich vollständig,
      Burger-Icon bleibt an seiner (gespiegelten) Position.
      Seite(n): `/he`, Mobile 390×844, Burger-Menü öffnen/schließen.
- [ ] **Untermenüs / Chevron** im Mobile-Menü zeigen zur richtigen Seite und
      klappen an der korrekten Kante ein (`inset-inline-start`).
      Seite(n): `/he`, Mobile, ein Untermenü mit Kindern öffnen (z. B.
      Projekte-Untermenü, falls vorhanden).

## 3. Breadcrumbs

- [ ] **Trennzeichen/Pfeil** zwischen Breadcrumb-Segmenten zeigt nach links
      (`←`) statt nach rechts, und die Segmentreihenfolge liest sich von
      rechts nach links (Startseite ganz rechts).
      Seite(n): `/he/projects/cypress-park`, `/he/blog` (Artikel, falls
      erreichbar), `/he/case-studies/…`.

## 4. Cards + Badges

- [ ] **Projekt-/Blog-/Entwickler-Cards**: Bild, Titel, Meta-Zeile, Badge
      (z. B. "Neu", Preis-Badge) spiegeln sich konsistent — Badge sitzt an
      der Ecke, die in RTL "vorne" ist (i. d. R. oben rechts statt oben
      links).
      Seite(n): `/he/projects` (Grid), `/he/developers/<slug>` (Projekte-Grid
      des Entwicklers), `/he/blog`.
- [ ] **Overlay-Chips** auf Card-Bildern (z. B. Statuschip) bleiben innerhalb
      des Bildes, keine abgeschnittenen Ecken.
      Seite(n): `/he/projects`.

## 5. Carousels (Reihenfolge, Pfeile, Tastatur)

- [ ] **Slide-Reihenfolge**: Der erste Slide in LTR ist unter RTL weiterhin
      logisch der erste (Swiper `dir="rtl"` kehrt die visuelle
      Fortschrittsrichtung um, nicht die Dateninhalte).
      Seite(n): `/he` (Featured-Projects-Slider auf der Startseite),
      `/he/projects/cypress-park` (Foto-Galerie).
- [ ] **Pfeil-Icons**: Prev-Pfeil zeigt nach rechts, Next-Pfeil nach links
      (gespiegelt gegenüber LTR); ein Klick auf den optisch rechten Pfeil
      bewegt in RTL-Leserichtung vorwärts.
      Seite(n): `/he/projects/cypress-park` (Galerie/Lightbox),
      `/he` (Slider mit Pfeilen).
- [ ] **Tastatur**: `ArrowLeft`/`ArrowRight` sind für RTL vertauscht (Pfeil
      nach rechts = vorheriger Slide, Pfeil nach links = nächster).
      Seite(n): `/he/projects/cypress-park`, Lightbox mit Tastatur bedienen.

## 6. Formulare

- [ ] **Label-Ausrichtung**: Feld-Labels und Platzhaltertexte sind
      rechtsbündig/beginnen an der RTL-Startkante, nicht mehr links
      ausgerichtet.
      Seite(n): `/he/contacts` (Kontaktformular), `/he` (Qualifizierungs-/
      Beratungsformular im Formularabschnitt).
- [ ] **Telefon-Input**: Ländervorwahl-Präfix und Ziffernfolge bleiben
      LTR-intern lesbar (nicht zeichenweise gespiegelt), auch wenn das
      Eingabefeld selbst rechtsbündig sitzt.
      Seite(n): `/he/contacts`, Telefonfeld fokussieren und eine Nummer
      eingeben.
- [ ] **Fehlertexte mit Telefonnummer**: Eine Validierungsfehlermeldung, die
      eine Beispiel- oder eingegebene Telefonnummer enthält, zeigt die Nummer
      unverdreht (Bidi-isoliert) innerhalb des (noch englischen) Fehlersatzes.
      Seite(n): `/he/contacts`, ungültige Telefonnummer eingeben und Fehler
      auslösen.

## 7. Footer

- [ ] **Spalten-Reihenfolge** im Footer ist gespiegelt (letzte LTR-Spalte
      steht jetzt zuerst/rechts), Icons (Social, WhatsApp) sitzen an der
      gespiegelten Position.
      Seite(n): `/he` (bis ans Seitenende scrollen), `/he/faq`.
- [ ] **Kontaktzeile im Footer** (Telefon, E-Mail) — siehe Abschnitt 8.

## 8. Preise / Telefonnummern / E-Mails (keine Umkehrung)

- [ ] **Preis-Format**: Der Preis erscheint als `€1.234` (bzw. lokalisiertes
      Tausendertrennzeichen) mit **vorangestelltem** `€`-Zeichen — das
      gleiche Präfix-Format wie jetzt für en/de/pl/ru (siehe "Absichtliche
      Änderung" unten), nicht als `1 234 €`-Suffix. Innerhalb der Zahl sind
      Ziffern und Trennzeichen nicht vertauscht oder gespiegelt.
      Seite(n): `/he/projects` (Card-Preise), `/he/projects/cypress-park`
      (Preistabelle/Einheiten), `/he/blog` (falls ein Slide mit Preis
      erscheint).
- [ ] **Kompakter Preis** (`.prj--compact .prj__price`, Card-Kompaktansicht):
      In RTL steht der Preis in normaler (nicht umgekehrter) Flex-Reihenfolge
      und bleibt LTR-isoliert.
      Seite(n): `/he/projects` (kompakte Kartenansicht/Filterergebnisse,
      falls vorhanden).
- [ ] **Telefonnummern**: `+357 …` liest sich von links nach rechts (Ziffern
      nicht gespiegelt), unabhängig davon, wo im hebräischen Satz sie
      steht.
      Seite(n): `/he/contacts`, `/he` Footer, `/he` Formularabschnitt
      (Berater-Kontaktzeile).
- [ ] **E-Mail-Adressen**: bleiben als zusammenhängender LTR-Block lesbar,
      `@` und Domain nicht umgestellt.
      Seite(n): `/he/contacts`, Footer.
- [ ] **Lateinische Namen** (z. B. Entwicklername, Beraternamen) innerhalb
      eines hebräischen/englischen Satzes werden nicht in die Zeichenfolge
      des umgebenden Textes hineingezogen.
      Seite(n): `/he/developers/<slug>`, `/he` (Berater-Sektion im
      Formularabschnitt).

## 9. Karten (Maps) bleiben LTR

- [ ] **MapLibre/Leaflet-Container** bleiben `dir="ltr"` — Kartenausschnitt,
      Zoom-Regler und Attribution sind NICHT gespiegelt, Regler-Position
      bleibt unten rechts wie in LTR.
      Seite(n): `/he/projects/cypress-park` (Standortkarte),
      `/he/projects` (Kartenansicht/Explorer, falls über die Seite
      erreichbar).

## 10. Typografie

- [ ] **Keine Letter-Spacing-Artefakte**: Hebräischer Text hat kein
      `letter-spacing` (in Hebräisch führt Sperrung zu sichtbaren
      Wortzwischenraum-Artefakten); Ausnahme nur, wo `.keep-tracking`
      bewusst gesetzt ist.
      Seite(n): `/he` (Headlines, Badges, Buttons mit Versalien-Stil in
      LTR).
- [ ] **Keine Uppercase-Artefakte**: Kein hebräischer Text erscheint durch
      `text-transform: uppercase` visuell verzerrt (Hebräisch kennt keine
      Groß-/Kleinschreibung — das CSS muss unter `:lang(he)` neutralisiert
      sein, außer `.keep-case`).
      Seite(n): `/he` (Buttons, Badges, Eyebrow-Labels).
- [ ] **Headings in Frank Ruhl Libre**: `h1`–`h4` und `.display`/`.h1`-Klassen
      laden `--font-display-he` (Frank Ruhl Libre), sobald der Text
      hebräische Zeichen enthält — sichtbar an der Serifen-Anmutung, sobald
      hebräischer Content vorhanden ist (aktuell selten, da Phase 4 noch
      aussteht; ggf. an einem manuell eingegebenen hebräischen Testwert in
      der Admin-Vorschau prüfen).
      Seite(n): `/he` Headlines (mit englischem Platzhaltertext — Font-Stack
      selbst per `:lang(he)`-Regel prüfen, nicht nur visuell).
- [ ] **Body-Text in Rubik**: Fließtext lädt `--font-body-he` (Rubik Hebrew)
      für hebräischen Content, Fallback-Kette bleibt für englische
      Platzhaltertexte unauffällig (kein Font-Flackern/FOUT-Sprung).
      Seite(n): `/he` Fließtext-Absätze.

## 11. Motion-Richtung

- [ ] **Slide-in-Animationen** (Scroll-Reveal auf About-, Artikel-, Legal-,
      Case-Study- und Preview-Seiten) fahren in RTL von **rechts** ins Bild
      (`x: 40` statt `x: -40`), nicht mehr von links.
      Seite(n): `/he/about-us`, `/he/blog/<slug>` (falls ein Artikel mit
      Motion-Elementen erreichbar ist), `/he/case-studies/<slug>`,
      `/he/privacy-policy`.

## 12. 404-Seite

- [ ] **Layout gespiegelt**: Die Not-Found-Seite zeigt `dir="rtl"`, Icon/
      Illustration und CTA-Button stehen an der gespiegelten Position, kein
      LTR-Rest (z. B. linksbündiger Text in einer sonst gespiegelten Seite).
      Seite(n): `/he/no-such-page`.
- [ ] **Header/Footer auf der 404-Seite** sind ebenso gespiegelt wie auf
      jeder anderen `/he`-Seite (gemeinsame Chrome-Komponenten).
      Seite(n): `/he/no-such-page`.

## 13. Bekannte Asymmetrien (aus Task 3, bewusst zurückgestellt)

Diese zwei Stellen sind bekannt physisch (nicht gespiegelt) geblieben, weil
eine reine CSS-Eigenschaftsumbenennung die Positionierung nicht korrekt
reproduziert (siehe `scripts/qa/rtl-exceptions.txt` und
`docs/superpowers/sdd/2026-09-13-hebrew-phase2-rtl/task-3-report.md`). Sie
werden hier bewusst geprüft und ggf. in einem Folge-Task gefixt, **nicht**
automatisch vom `rtl-physical-count`-Gate erfasst (das eine bleibt sogar
außerhalb der Exceptions-Liste, siehe Formsec-Punkt unten):

- [ ] **`preview-home/tokens.css` `.formsec__consultant-wrap` /
      `.formsec__caption`** (Berater-Porträt-Komposition im
      Formularabschnitt der Startseite, nur Desktop-Breakpoint): Foto
      (`transform: translateX(-150px)`) und Bildunterschrift
      (`left: calc(54% + 10px)`) sind fest nach links positioniert.
      **Erwartung für diesen Durchgang:** In `/he` erscheint die Komposition
      seitenverkehrt / auf der falschen Seite relativ zum umgebenden
      Formular — das ist bekannt und **kein neuer Fehler**, sondern der
      offene Punkt aus Task 3. Screenshot zur Dokumentation aufnehmen; Fix
      nach dieser Matrix als eigener Task.
      Seite(n): `/he`, Desktop 1440×900, Formularabschnitt.
- [ ] **`.howwork`-Connector-Pfeil** (goldener Pfeil zwischen den
      Ablaufschritt-Medaillons im "So arbeiten wir"-Abschnitt der
      Startseite, `preview-home/sections/HowWeWork.tsx` /
      `preview-home/tokens.css:~1091`, Desktop-only): Positionierung
      (`left: calc(100% + …)`) und die Pfeilspitze selbst (fest gerichtetes
      SVG-Data-URI-Masken-Icon) zeigen weiterhin nach links, unabhängig von
      `dir`.
      **Erwartung für diesen Durchgang:** Pfeil zeigt in `/he` weiterhin in
      LTR-Richtung zwischen den Schritten — bekannt, kein neuer Fehler.
      Screenshot zur Dokumentation; Fix nach dieser Matrix als eigener Task.
      Seite(n): `/he`, Desktop 1440×900, "So arbeiten wir"-Abschnitt.

## 14. LTR-Regression (Stichprobe: unverändert)

Ziel: sicherstellen, dass die RTL-Arbeit **keine** sichtbare Änderung an
en/de/pl/ru verursacht hat (logische Eigenschaften müssen in LTR auf dieselbe
physische Seite auflösen wie vorher).

- [ ] `/` (Startseite, en) — Layout, Header, Formularabschnitt, "So arbeiten
      wir"-Sektion identisch zum Stand vor Phase 2.
- [ ] `/de` (Startseite, de) — dieselbe Prüfung wie oben, deutsche Sprache.
- [ ] `/projects` (en) — Grid, Cards, Badges, kompakter Preis
      (`1.234 €`-Suffixformat für de/pl/ru bzw. Prefix `€1,234` gemäß der
      Task-1-Umstellung, siehe unten) unverändert positioniert.
- [ ] `/de/faq` — Akkordeon-Ausrichtung, Breadcrumb-Pfeilrichtung (`→`, nicht
      `←`) unverändert.

**Absichtliche Änderung für ALLE Locales (nicht nur `he`):** Aus Task 1
rendern `ProjectLink`, `BlogSlide` und `PropertyFeatures` Preise jetzt
einheitlich über das eine `fmtPrice` als `€1.234`/`€1,234` (Präfix) statt
wie vorher `1 234 €` (Suffix). Das ist beim LTR-Regressionscheck **kein
Fehler**, sondern die bewusste, spezifikationskonforme Formatvereinheitlichung
— nur auf diesen drei Komponenten prüfen, dass das Präfix-Format konsistent
und nicht abgeschnitten erscheint.

---

## Nach der Prüfung

Für jede gefundene Abweichung: Screenshot + Seite + Viewport + kurze
Beschreibung in einem Ticket/PR-Kommentar festhalten und gegen die
betroffene Regel in `docs/superpowers/plans/2026-09-13-hebrew-phase2-rtl.md`
(Task 3/4/Global Constraints) verlinken, damit der Fix denselben Task-Kontext
trägt.
