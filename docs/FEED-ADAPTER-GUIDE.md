# Feed-Adapter-Guide — Bauträger-Feeds & Bilder

Stand: August 2026, nach der Bild-Sanierung von BBF/INEX/Pafilia/Domenica.

**Kernregel: Bilder IMMER in der höchsten beim Bauträger verfügbaren Auflösung
holen, dann intern für die Website optimieren und speichern. Nie die vom
Feed vorgeschlagene mittlere Variante nehmen.**

## §1 Checkliste: neuer Bauträger/Feed

Bei jedem neuen Adapter zuerst der Reihe nach prüfen:

- [ ] **Bildauflösung** — siehe §2, eigene Messung, nicht raten
- [ ] Gibt es ein **Statusfeld pro Unit** (verfügbar/reserviert/verkauft)?
- [ ] **Vollständigkeit**: Unit-Zahl im Feed gegen die Preisliste des Bauträgers gegenprüfen
- [ ] **Flächenfelder**: Wohnfläche getrennt von Veranda/Balkon ausgewiesen, oder in einer Summe versteckt?
- [ ] **Grundstücksgröße** vorhanden (bei Villen/Häusern)?
- [ ] **Koordinaten** vorhanden und plausibel (nicht 0/0 oder Büroadresse)?
- [ ] **Echte Projektnamen** im Feed, oder generische/interne Bezeichnungen, die eine Übersetzung/Override brauchen?
- [ ] **Beschreibungen in vier Sprachen** (EN/DE/PL/RU) vorhanden, oder nur EN?
- [ ] **Verhalten bei ausverkauften Projekten**: bleiben sie im Feed (mit Status "sold"), oder verschwinden sie komplett? Bestimmt, ob "fehlt im Feed" später als Signal taugt (siehe §4)

## §2 Bilder im Detail

Für jeden neuen Adapter, bevor irgendetwas gemirrort wird:

1. **Bietet die Quelle Größenvarianten an** (small/medium/large wie qubehub)? —
   Prüfen: mehrere URL-Muster für dasselbe Bild im Feed suchen (Suffix wie
   `_medium`/`_large`, Präfix wie `MEDIUM_`/`LARGE_`).
2. **Gibt es Thumbnail-Suffixe zum Strippen** (WordPress: `-BREITExHÖHE.jpg`)? —
   Prüfen: Suffix aus der URL entfernen, Ergebnis herunterladen, schauen ob
   es 200 statt 404 liefert und ein größeres Bild ist.
3. **Funktionieren Größenparameter** (`?w=`, `?size=large` o. ä.), oder sind
   sie wirkungslos? — Prüfen: mit und ohne Parameter herunterladen, Dateien
   vergleichen (Pixelmaße + Dateigröße). Bei den meisten Feeds bisher wirkungslos.
4. **Alternative Pfade probieren** (`/originals/`, `/full/` o. ä.).

**Bei jedem Punkt gilt: echtes Bild herunterladen und die tatsächlichen
Pixelmaße auslesen (z. B. `sips`/`sharp`/PIL) — nie aus der URL oder dem
Dateinamen schließen.** Die Lehre aus BBF/INEX/Pafilia war genau das: die
URL sah nach der richtigen Größe aus, war es aber nicht.

Belege aus der Praxis:

| Feed | Wir zogen | Verfügbar war | Bemerkt nach |
|---|---|---|---|
| BBF/INEX (qubehub) | `medium`, ~800 px | `large`, 3000–4500 px | Wochen |
| Pafilia (WordPress) | Thumbnail, 1024–1621 px | Original, bis 8424 px | Wochen |

## §3 Weitere Bild-Regeln

- **Bilder immer spiegeln, nie externe URLs direkt speichern.** Jeder
  Admin-Auslöser muss `mirror:true` setzen — sonst überschreibt ein Klick
  bereits gespiegelte lokale URLs mit rohen Hotlinks (konkret beobachtet:
  581 von 584 Fällen).
- **Grundrisse nicht vergessen.** `mirrorAll()` muss auch für `plans`
  laufen, nicht nur für `gallery`/`photos` (55 % der Grundrisse waren nie
  gespiegelt, weil das vergessen wurde).
- **Published = eingefroren.** Bei veröffentlichten Projekten werden Bilder,
  Beschreibung, Amenities und Name nicht mehr überschrieben. Nur
  Unit-Daten (Status, Preis, Fläche) syncen weiter.
- **Größenvarianten desselben Fotos erkennen und deduplizieren.** Domenica
  lieferte `_optimized` und `_optimized_1396` als zwei separate
  Feed-Einträge für dasselbe Foto → landete doppelt in der Galerie, bis
  erkannt und zusammengeführt.
- **Unit-Fotos erben die Projektgalerie beim Sync — und die Anzeige
  bevorzugt sie.** Eine Bereinigung nur der Projekt-Galerie bleibt auf der
  Live-Seite unsichtbar, solange die geerbten Unit-Fotos nicht mit
  bereinigt werden. Immer beide Ebenen prüfen.
- **Der 1920-px-Deckel beim internen Resize bleibt bewusst bestehen.** Auch
  wenn das Original größer ist (z. B. 8424 px) — wir speichern nie mehr als
  1920 px, nur die Quelle, aus der gemirrort wird, darf größer sein.
- **Prüfen, ob die Bild-URLs dauerhaft sind.** Medousa lieferte zunächst
  vorsignierte S3-Links mit 24-Stunden-Ablauf — beim Spiegeln unkritisch,
  aber jede roh gespeicherte URL ist nach einem Tag tot. Ein weiteres
  Argument dafür, immer zu spiegeln.
- **Ein Hash über die Quell-URL erkennt keine echten Bildänderungen.**
  Mehrere Feeds (Weblium/Domenica, BBFs Unit-Backend) vergeben periodisch
  neue Asset-IDs für inhaltlich unveränderte Bilder — der Unterschied
  liegt im Pfad, Query-Parameter zu trimmen hilft nicht. Erste Messung
  meldete 72 Projekte mit 1.528 geänderten Bildern, nach inhaltlicher
  Prüfung blieben 19 Projekte mit 203 übrig. Wer Änderungen erkennen will,
  muss den Bildinhalt vergleichen, nicht die URL.

## §4 Nicht-Bild-Regeln

- **Projektnamen: Title Case, nie Versalien — unabhängig von der Quelle.**
  Jedes Wort beginnt groß, der Rest klein: "Trees Residences", nie "TREES
  RESIDENCES". Gilt für JEDE Quelle — Dropbox-/Drive-Ordnernamen, XML-Feeds,
  PDF-Überschriften, KI-Extraktion — egal wie die Quelle es liefert.
  Gemeinsame Funktion: `toTitleCaseName()` in `src/lib/textCase.ts`, genutzt
  von jedem Adapter in `src/app/preview-project/feeds.ts` sowie von
  `pricelistExtract.ts`/`pdfPricelistExtract.ts` (Drive/PDF-KI-Extraktion).
  Immer an der Stelle anwenden, wo der Anzeigename erstmals aus Rohtext
  entsteht, VOR einem `OVERRIDES`-Lookup — ein von Hand gesetzter
  Override-Name ist eine bewusste Entscheidung und wird nie neu
  großgeschrieben. Kein Ausnahme-Wortkatalog (kein "of"/"and"/"the" klein) —
  jedes Wort wird großgeschrieben, exakt wie die Regel lautet. Neuer
  Bauträger, neue Quelle: `toTitleCaseName()` importieren und an der Stelle
  anwenden, an der der Projektname zum ersten Mal aus der Quelle kommt —
  nicht neu erfinden.
  Wichtig: Bei bereits veröffentlichten Projekten greift das nicht rückwirkend
  — `publicName` ist für published-Projekte eingefroren (siehe §3). Ein
  bestehender Versalien-Name bleibt bestehen, bis er von Hand korrigiert
  oder gezielt nachgezogen wird.
- **Wo der Bauträger pro Projekt eine eigene Preisliste pflegt, ist der ORDNER
  die Projekt-Identität — nicht ein gemeinsames Master-Sheet.** Olias Homes
  (2026-08-24): jeder Projektordner in der Drive enthält seine eigene "Sales
  Catalogue - <Projekt>"-Datei, das Master-Sheet im Wurzelverzeichnis ist eine
  veraltete Teilkopie. Vier Projekte hatten wochenlang Ordner samt eigener
  Preisliste, standen aber in keiner Zeile des Master-Sheets — und existierten
  für uns damit gar nicht, weil die Projektanlage ausschließlich dieses eine
  Sheet las. Reihenfolge deshalb: erst jeder Ordner mit eigener Preisliste,
  danach das Master-Sheet nur noch für das, was keinen eigenen Ordner hat
  (bei Olias: Alder Park, Pine Park, Triangle House). Dieselbe Logik wie bei
  Kuutio/Dropbox, aus demselben Grund: eine aus der Quellstruktur GELESENE
  Identität ist eine Tatsache, eine von der KI aus einem Sammeldokument
  GERATENE nicht.
- **Für die Ordner→Projekt-Zuordnung nie `buildCanonicalMatcher()` verwenden.**
  Dessen Wort-Overlap-Score akzeptiert ab 0.5 — innerhalb eines Bauträger-
  Portfolios endet aber fast jeder Name auf dasselbe Substantiv, ein einziges
  gemeinsames Wort reicht also. An den echten Olias-Daten gemessen: "Amalfi
  Homes" traf "Olivelia Homes", "Birch Park" traf "Blossom Park" — beide neuen
  Projekte wären auf die Zeile eines bestehenden, veröffentlichten Projekts
  geschrieben worden und hätten dessen Units gegen eine völlig fremde
  Preisliste weggeprunt. Stattdessen `matchProjectByName()`
  (`src/lib/driveFolderNames.ts`): gespeicherte `driveFolderId` zuerst, dann
  exakter normalisierter Namensschlüssel, dann Präfix-Beziehung ab 6 Zeichen —
  und mehr als ein Treffer ist AMBIG und ergibt nichts. Lieber ein Ordner, der
  gemeldet nicht zugeordnet werden konnte, als ein falsch zugeordneter.
- **MIME-Typen von Drive kleingeschrieben vergleichen.** Drive liefert `.xlsm`
  als `application/vnd.ms-excel.sheet.macroenabled.12` — nicht in der bei IANA
  registrierten CamelCase-Schreibweise `…macroEnabled.12`. Gegen die Spec
  verglichen las Calderas Ordner trotz vorhandener Preisliste als "keine
  Preisliste". Erkannt werden `.xlsx`, `.xlsm`, `.xls` und native Google Sheets.
- **Zuordnung von Quell-Ordnern/-Einträgen zu Datensätzen bleibt strikt pro
  Bauträger.** `buildCanonicalMatcher()` (`pricelistExtract.ts`) darf NIE mit
  Namen aus mehreren Bauträgern gleichzeitig aufgerufen werden — beide
  bestehenden Aufrufstellen sind bereits so gebaut (gescoped auf eine
  `developerAccountId` bzw. ein einzelnes Preislisten-Dokument). Nicht wegen
  Namensüberschneidungen (die sind unwahrscheinlich), sondern strukturell:
  ein Ordner/Eintrag darf nie versehentlich das Projekt eines ANDEREN
  Bauträgers treffen — das ist dieselbe Fehlerklasse wie der
  Venara/Venara-View-Bug (2026-08-13), nur eine Ebene höher (Bauträger statt
  Projekt). Jeder neue Adapter, der eine Zuordnungs-/Matching-Funktion
  braucht, muss sie genauso scopen.
- **Verschwundene Units werden `unlisted`, nie `sold`.** "Fehlt im Feed" ist
  kein Beleg für "verkauft" — ein Feed-Fehler oder eine Datenlücke sieht
  identisch aus. Konkreter Fall: Salt war aus dem Feed verschwunden, wurde
  vom Bauträger aber weiter aktiv beworben.
- **`feedRef` vs. `ref`/`label` nicht verwechseln — eigene Fehlerklasse,
  bei Cirvis dreimal repariert.** `feedRef` ist die Referenz des
  Bauträgers, der unveränderliche Match-Anker, nie von Hand bearbeiten.
  `ref`/`label` ist der Anzeigewert auf der Website, jederzeit im Admin
  editierbar. Der Match läuft ausschließlich über `feedRef` — und die
  Bitte an den Bauträger lautet entsprechend, seine eigene Referenz nie
  neu zu vergeben, nicht unseren Anzeigewert.
