# Pass C — Muttersprachliches Review: WP2 (Projektliste, Development-Seite, Auto-SEO-Meta)

**Stand:** 2026-09-13 · **Status:** Pass A (Erstübersetzung) + **Pass B Fix Round 1 eingearbeitet**, alle Einträge tragen `REVIEW(he)` · **Freigabe erst mit ausgefülltem Protokoll** (Styleguide §9.5)

Die HE-Spalte unten zeigt durchgehend den **ausgelieferten** Stand nach Fix Round 1. Was Pass B geändert hat und warum, steht kompakt in **§7**; die Kritik selbst liegt in `.superpowers/sdd/2026-09-13-hebrew-phase4-copy/task-5-passB.md`.

**Gegenstand:** die hebräische Projektliste und die Projekt-/Development-Detailseite samt der automatisch erzeugten SEO-Meta, die auf mehreren hundert Projektseiten ausgeliefert wird. Quelle jeder Übersetzung ist die **englische** Fassung; Deutsch stand nur für den Ton daneben.

---

## 1. Was anzusehen ist

| Seite | Was dort geprüft wird |
|---|---|
| `/he/projects` | H1 und Intro (kommen aus Sanity, **nicht** aus diesem Paket), Filterleiste (Stadt, Objekttyp, Schlafzimmer, Preis-von/bis, Suche), Sortier-Dropdown, Ergebniszähler („N פרויקטים…"), Leerzustand (Filter so eng stellen, dass nichts übrig bleibt), Projektkarten (Badges, `3 חדרי שינה`, `120 מ"ר`, Energie, `החל מ-€…`, Distanz-Chips), Karten-Teaser-Kachel |
| `/he/projects` → Karte öffnen | Gesten-Hinweis („zwei Finger" / „Ctrl + Zoom"), POI-Leiste `החיים בסביבה`, POI-Kategorien, „Zoom in to load places", Marker-Popup (Koordinaten, Kopieren/Kopiert, Google Maps, Route, OSM, „Projekt öffnen") |
| `/he/projects/<slug>` (Development, verfügbar) | Hero-Captions (`החל מ-`, `סוג`, `זמינות`), Abschnittsüberschriften, Faktenpanel, Nachbarschafts-Tags, Ausstattung, Pläne, Distanzleiste (8 Kategorien), Einheiten-Ansicht (Karten/Tabelle, Spaltenköpfe, Status), Scarcity-Badge, Anfrage-Überschrift mit Projektnamen, Galerie/Lightbox |
| `/he/projects/<slug>` (ausverkauft) | Sold-out-Banner (beide Varianten: mit und ohne Alternativen), Off-Market-CTA, `נמכר החל מ-` |
| `/he/projects/<slug>` (Legacy-Projekt aus Sanity) | „Details zum Projekt", Bauträger-Zeile, ROI-Button, FAQ-Überschrift, Distanzen (Legacy-Komponente), Foto-Galerie „+5 נוספות", „Weitere Projekte in <Stadt>" |
| **View-Source auf beiden Detailseiten** | `<title>` und `<meta name="description">` — die werden pro Projekt automatisch gebaut (`developmentSeo.ts`). Bitte an mindestens drei Projekten prüfen: eines verfügbar mit Preis, eines ohne Preis, eines ausverkauft. |

**Karten-/POI-Text steht bewusst in einem `dir="ltr"`-Container** (die Kartenkomponente selbst ist LTR). Wenn hebräische Labels dort verdreht wirken, ist das ein Layout-Befund, kein Übersetzungsfehler — bitte trotzdem notieren.

## 2. Checkliste (Styleguide §10)

- [ ] Kein `TODO(he)`, kein englischer Restsatz (Ausnahmen: `Google Maps`, `Apple`, `OSM`, `Ctrl`, `PDF`, Projekt- und Bauträgernamen — die bleiben lateinisch, §4)
- [ ] Genus gemäss §2: Nominal-/Infinitivstil, sonst maskuliner Plural; **keine** Schrägstrichformen
- [ ] Preise/Zahlen nach §5: westliche Ziffern, `€` vor der Zahl, `מ"ר`, `חדרי שינה` (nie `חדרים`), Fertigstellung als `רבעון 3 2029`
- [ ] Bidi: Preise, Koordinaten, Projektnamen und Ortsnamen laufen nicht ineinander (besonders in Meta-Title und Description)
- [ ] Ortsnamen nach Glossar (`פאפוס`, `לימסול`, `לרנקה`), Eigennamen lateinisch
- [ ] Meta-Title ≤ 60 Zeichen, Description ≤ 155 — an echten Projektseiten nachmessen, nicht nur an der Vorlage
- [ ] Keine Zeile aus §7 (Marketing-Verben, Adjektiv-Stapel, kalkierte Idiome, `בין אם … ובין אם`, englische Wortfolge, Höflichkeitsfloskeln, Doppelpunkt-Titel, Gedankenstrich)
- [ ] Kein `—` und kein `–` in irgendeinem hebräischen String (maschinell geprüft, bitte visuell gegenlesen)
- [ ] Faktencheck: keine Zahl ohne Quelle; kein Text verspricht Verfügbarkeit oder Rendite

**Korrekturen bitte in die Spalte `Korrektur HE` eintragen** — eine Zeile pro Key, Begründung in `Anmerkung` ergänzen, wenn sie über „klingt besser" hinausgeht. Wiederkehrende Korrekturen wandern anschliessend ins Glossar (§6) oder in §7 des Styleguides.

## 3. Bewusste Entscheidungen dieses Passes (bitte bestätigen oder kippen)

1. **Sortier-Labels mit Doppelpunkt** (`מחיר: מהנמוך לגבוה`) statt des `·`-Trenners der LTR-Sprachen. Begründung siehe Tabelle.
2. **`בעיר` in „Weitere Projekte in <Stadt>"** — das gebundene Präfix `ב` kann im vorhandenen JSX (`{title} {city}`) nicht direkt am Ortsnamen kleben. **Fix Round 1:** das Präfix war nur die halbe Miete — der Ortsname selbst kam als roher DB-Freitext („Paphos") in die hebräische Überschrift, während `PropertyFeatures` auf **derselben Seite** `פאפוס` schreibt. `ProjectSameCity.tsx` transliteriert jetzt über `hePlaceList()`.
3. **`החל מ-` bleibt nur dort, wo es an der Zahl klebt.** Auf der Projektkarte steht das Label direkt vor dem Preis (`החל מ-€450,000`) — korrekt. **Fix Round 1:** an zwei Stellen tut es das nicht, und ein Bindestrich ohne Anschluss ist im Hebräischen ein Setzfehler, keine Präposition: die Hero-Caption der Development-Seite ist eine **eigene Zeile** unter der Preisfigur (`.pp-hero__stats > div { flex-direction: column }`) und `ProjectLink` schiebt ein `&nbsp;` dazwischen. Beide tragen jetzt `מחיר התחלתי` (sold out: `נמכר במחיר התחלתי`).
4. **Meta-Title-Trenner `|` statt `–`** (Styleguide §6). Die LTR-Sprachen behalten ihren Halbgeviertstrich; nur `he` schaltet um.
5. **Sold-out-Description** beginnt mit `נמכר במלואו.` plus neuem Satz statt mit einem Gedankenstrich.
6. **`רבעון 3 2029`** in der Auto-Description — nur `he` lokalisiert das gespeicherte `Q3 2029`; en/de behalten `Q3 2029`, pl/ru bleiben in diesem Satz unverändert (bestehender Zustand, kein Regress durch WP2).
7. **Ortsnamen in der Auto-Meta werden umschrieben** — `בפאפוס`, nicht `ב-Paphos`. **Diese Zeile war in Pass A der größte Fehler des Pakets und ist in Fix Round 1 die zentrale Änderung.** Sie stand hier als „offene Frage … das wäre eine eigene Aufgabe"; tatsächlich hängt an ihr die gesamte SEO-Wirkung: die hebräische Nachfrage lautet `וילות בפאפוס` (170/Mon.), `דירות בלימסול` (110/Mon.), `דירות בפאפוס` (90/Mon.) — durchgehend mit umschriebenem Ort (`he-keyword-map.md` §2), und `he-glossary.md` §1 schreibt die Umschrift für Städte und Regionen ohnehin vor. Ein Snippet mit `ב-Paphos` trifft keine der 144 hebräischen Queries. Die Tabelle liegt jetzt als `src/lib/hePlaces.ts` vor (Glossar §1 plus die Schreibvarianten der Feeds); unbekannte Freitext-Orte fallen weiterhin auf `ב-⁨Konia, Paphos⁩` zurück. **Das Bindestrich-Kriterium ist der Schrifttyp des Ortes, nicht die Locale** — `ב-פאפוס` wäre falsch.
8. **„Golf court" wird stillschweigend zu `מגרש גולף`** (golf course) — der englische Quelltext trägt seit Jahren einen Tippfehler, den Hebräisch nicht mitnimmt.

## 4. Was NICHT in diesem Paket steckt

- H1, Intro-Text und die von Hand gepflegte Meta der Listenseite `/he/projects` kommen aus Sanity (`getProjectsPageByLang`), nicht aus einer Copy-Tabelle. Sie sind Inhalt für Phase 5, nicht Phase 4.
- Der PDF-Export der Projektseite (`ProjectPdfButton`, `pdf/ProjectPdfDocument`) gehört zu WP7.
- Projekt- und Gebietstexte selbst (Beschreibung, Ausstattungslisten) sind Datenbankinhalte, keine UI-Copy.

---

## 5. Tabellen (eine je Datei)

Alle Werte sind die tatsächlichen Laufzeitwerte. Funktionswerte sind mit dem Beispielargument `3` bzw. dem Projektnamen-Platzhalter aufgerufen; `⁨…⁩` in der HE-Spalte sind die unsichtbaren Bidi-Isolatoren (FSI/PDI), keine Zeichen im Text.

### src/app/[lang]/projects/projectsI18n.ts — PROJECTS_STRINGS

| Key | EN | HE | Anmerkung | Korrektur HE |
|---|---|---|---|---|
| `numLocale` | en-US | en-US |  |  |
| `cityLabel` | City | עיר |  |  |
| `cityPlaceholder` | Any location | כל הערים | Hebräisch hat keinen neutralen „beliebig"-Platzhalter, der in einem Select nicht nach Fragebogen klingt. **Fix Round 1:** `כל האזורים` versprach eine Ebene, die das Feld nicht hat (Label `עיר`, drei Städte als Optionen), und `אזור` ist bereits dreifach belegt (`tagArea`, `inThisArea`, `nearby`). |  |
| `cities[0].value` | Paphos | Paphos |  |  |
| `cities[0].label` | Paphos | פאפוס |  |  |
| `cities[1].value` | Limassol | Limassol |  |  |
| `cities[1].label` | Limassol | לימסול |  |  |
| `cities[2].value` | Larnaca | Larnaca |  |  |
| `cities[2].label` | Larnaca | לרנקה |  |  |
| `typeLabel` | Property type | סוג נכס |  |  |
| `typePlaceholder` | Any type | כל הסוגים |  |  |
| `types[0].value` | Apartment | Apartment |  |  |
| `types[0].label` | Apartment | דירה |  |  |
| `types[1].value` | Villa | Villa |  |  |
| `types[1].label` | Villa | וילה |  |  |
| `types[2].value` | Townhouse | Townhouse |  |  |
| `types[2].label` | Townhouse | בית טורי |  |  |
| `types[3].value` | Commercial | Commercial |  |  |
| `types[3].label` | Commercial | נכס מסחרי | Neu im Glossar (wp2-glossary.md). |  |
| `bedsLabel` | Bedrooms | חדרי שינה |  |  |
| `bedsPlaceholder` | Any beds | הכל | Kurzform `הכל`; Alternative `כל האפשרויות` war für die Feldbreite zu lang. |  |
| `beds[0].value` | 1 | 1 |  |  |
| `beds[0].label` | 1+ | 1+ |  |  |
| `beds[1].value` | 2 | 2 |  |  |
| `beds[1].label` | 2+ | 2+ |  |  |
| `beds[2].value` | 3 | 3 |  |  |
| `beds[2].label` | 3+ | 3+ |  |  |
| `beds[3].value` | 4 | 4 |  |  |
| `beds[3].label` | 4+ | 4+ |  |  |
| `beds[4].value` | 5 | 5 |  |  |
| `beds[4].label` | 5+ | 5+ |  |  |
| `priceMin` | Min € | מ-€ | Preis-Inputs: `מ-€` / `עד €`. Bindestrich vor dem Fremdzeichen nach §3. Lektor: liest sich das im RTL-Input sauber? |  |
| `priceMax` | Max € | עד € |  |  |
| `priceMinAria` | Min price | מחיר מינימלי |  |  |
| `priceMaxAria` | Max price | מחיר מקסימלי |  |  |
| `searchPlaceholder` | Search projects… | חיפוש פרויקטים… |  |  |
| `searchAria` | Search projects | חיפוש פרויקטים |  |  |
| `mapBtn` | Map | מפה |  |  |
| `reset` | Reset | איפוס |  |  |
| `moreFilters` | More filters | עוד מסננים |  |  |
| `hideFilters` | Hide filters | הסתרת מסננים | **Fix Round 1:** indefinit, damit die Determination nicht zwischen den beiden Zuständen desselben Buttons springt (`עוד מסננים` ↔ `הסתרת מסננים`). |  |
| `sortAria` | Sort by | מיון לפי |  |  |
| `sorts[0].value` | recommended | recommended |  |  |
| `sorts[0].label` | Recommended | מומלצים |  |  |
| `sorts[1].value` | priceAsc | priceAsc |  |  |
| `sorts[1].label` | Price · low to high | מחיר: מהנמוך לגבוה | Der `·`-Trenner der LTR-Locales wird zum Doppelpunkt. §3 verbietet Doppelpunkt-ÜBERSCHRIFTEN — eine Dropdown-Option ist keine Überschrift, und `מחיר · מהנמוך לגבוה` liest sich im RTL-Fluss wie ein Textfehler. Bewusste Abweichung. |  |
| `sorts[2].value` | priceDesc | priceDesc |  |  |
| `sorts[2].label` | Price · high to low | מחיר: מהגבוה לנמוך |  |  |
| `sorts[3].value` | completionSoon | completionSoon |  |  |
| `sorts[3].label` | Completion · soonest | מסירה: הקרובה ביותר |  |  |
| `projectOne` | project | פרויקט |  |  |
| `projectMany` | projects | פרויקטים |  |  |
| `inThisMapArea` | in this map area | באזור הזה במפה |  |  |
| `inThisArea` | in this area | באזור הזה |  |  |
| `empty` | No projects match your search. Try widening the filters. | לא נמצאו פרויקטים שמתאימים לחיפוש. כדאי להרחיב את הסינון. | Kein „bitte" (§7 „höfliche Überflüssigkeiten"); `כדאי` trägt die Empfehlung. |  |
| `badgeNew` | New | חדש |  |  |
| `badgeFeatured` | Featured | מובחר |  |  |
| `badgeSoldOut` | Sold out | נמכר |  |  |
| `bedUnit` | bed | חדרי שינה | Glossar-Pflicht: Zypern zählt Schlafzimmer, Israel Zimmer. **Fix Round 1:** dieser Key wird auf der `he`-Karte **nicht mehr gerendert**. `resolveBedRange()` liefert `""` / `"Studio"` / `"3"` / `"1-3"`, und `{wert} {bedUnit}` erzeugte daraus `1 חדרי שינה` (ungrammatisch) und `Studio חדרי שינה` (lateinischer Rest). Die Karte ruft für `he` jetzt `heBedrooms()` auf: `סטודיו` / `חדר שינה אחד` / `3 חדרי שינה` / `⁦1-3⁩ חדרי שינה`. Der Key bleibt für en/de/pl/ru unverändert in Gebrauch. |  |
| `areaUnit` | m² | מ"ר |  |  |
| `energyPrefix` | Energy | אנרגיה | Rendert als `אנרגיה A`. **Fix Round 1:** 12 Zeichen für einen Chip, dessen EN-Vorlage 6 hat — und die Vorlage unterscheidet selbst `Energy` (Karte) von `Energy rating` (Faktenpanel). Die Glossarform `דירוג אנרגטי` bleibt über `factEnergyRating` erhalten. |  |
| `priceFrom` | from  | החל מ- | Steht als eigenes `<span>` direkt vor dem Preis; JSX schluckt den Zeilenumbruch dazwischen, gerendert also `החל מ-€450,000` — glossarkonform. **Fix Round 1:** dieser Wert wird für `he` **nicht mehr** in die Hero-Caption der Development-Seite gespiegelt (siehe §3.3). |  |
| `priceOnRequest` | Price on request | מחיר לפי פנייה |  |  |
| `minShort` | min | דק' | Abkürzung, weil der Chip `10 דק'` schmal ist. |  |
| `distBeach` | Beach | חוף |  |  |
| `distSchool` | School | בית ספר |  |  |
| `distGolf` | Golf | גולף |  |  |
| `distAirport` | Airport | שדה תעופה |  |  |
| `distCenter` | Center | מרכז |  |  |
| `distHospital` | Hospital | בית חולים |  |  |
| `distShops` | Shops | חנויות |  |  |
| `distDining` | Dining | מסעדות |  |  |
| `exploreOnMap` | Explore on the map | לצפייה במפה |  |  |
| `mapTileSub(3)` | 3 projects · live filters & nearby places | ⁨3⁩ פרויקטים · סינון בזמן אמת ומקומות בסביבה | Die Zahl ist FSI-isoliert (`bidiIsolate`), damit das Tausender-Komma im RTL-Absatz nicht wandert. |  |
| `mapFab` | Map | מפה |  |  |
| `close` | Close | סגירה |  |  |
| `nearby` | LIFE NEARBY | החיים בסביבה | EN steht in Versalien (Eyebrow-Stil). Hebräisch kennt keine Versalien; die Auszeichnung macht das CSS. |  |
| `zoomToLoad` | Zoom in to load places | יש להתקרב כדי לטעון מקומות | Unpersönlich (`יש להתקרב`) statt Imperativ — §2.1. |  |
| `loading` | Loading… | טוענים… | **Fix Round 1, Must fix:** `בטעינה…` war ein Neologismus, den kein Israeli schreibt, und die Begründung berief sich auf WP1s `בשליחה…` — genau den String, den `he-glossary.md` §6.1 als Fehlgriff verzeichnet und **ersetzt** hat. Das Partizip Plural ist die genusfreie Form, die Styleguide §11.2 vorschreibt. |  |
| `loadingMap` | Loading map… | טוענים את המפה… | wie oben |  |
| `mapShort` | Map… | מפה… |  |  |
| `poi.school_private` | Private School | בית ספר פרטי |  |  |
| `poi.school_public` | Public School | בית ספר ציבורי |  |  |
| `poi.clinic` | Clinics | מרפאות |  |  |
| `poi.supermarket` | Supermarkets | סופרמרקטים |  |  |
| `poi.pharmacy` | Pharmacies | בתי מרקחת |  |  |
| `poi.beach` | Beaches | חופים |  |  |
| `poi.restaurant` | Restaurants | מסעדות |  |  |
| `poi.golf` | Golf | גולף |  |  |
| `poi.airport` | Airport | שדה תעופה |  |  |

### src/app/[lang]/projects/[slug]/page.copy.ts — PROJECT_PAGE_COPY

| Key | EN | HE | Anmerkung | Korrektur HE |
|---|---|---|---|---|
| `enquireNow` | Enquire this amazing project now! | לפרטים על הפרויקט | Ausrufezeichen und „amazing" entfallen (§1 / §7 Adjektiv-Stapel). **Fix Round 1:** von vier auf drei Wörter gekürzt (§11.7 Buttons ≤ 3 Wörter) — der Seitenkontext trägt „on this project" ohnehin. |  |
| `developer` | Developer | יזם |  |  |
| `calculateRoi` | Calculate ROI | חישוב תשואה | ROI = `תשואה`. Das Akronym „ROI" ist im israelischen Privatkäufer-Segment nicht selbsterklärend. |  |
| `faq` | FAQ | שאלות ותשובות |  |  |

### src/lib/developmentCopy.ts — DEVELOPMENT_STRINGS

| Key | EN | HE | Anmerkung | Korrektur HE |
|---|---|---|---|---|
| `galleryLabel(3)` | View 3 photos | לצפייה ב-3 תמונות |  |  |
| `openGallery` | Open gallery | פתיחת הגלריה |  |  |
| `heroFrom` | from | מחיר התחלתי | **Fix Round 1, Must fix:** eigene Caption-Zeile unter der Preisfigur, kein Inline-Präfix — gerendert stand dort `החל מ- · +מע"מ`, ein Bindestrich mit nichts dahinter. Siehe §3.3. |  |
| `heroType` | type | סוג |  |  |
| `heroAvailable` | available | זמינות | Caption unter der Stückzahl. `זמינות` (Verfügbarkeit) statt eines Adjektivs, das sich nach dem Genus des Objekttyps richten müsste. |  |
| `vatSuffix` | +VAT | +&nbsp;מע"מ (`"+ מע\"מ"`) | `מע\"מ` mit Gershayim (§4); Bidi korrekt (das `+` landet rechts vom Wort). **Fix Round 1:** mit Leerzeichen — israelische Preisangaben schreiben `+ מע"מ` getrennt; ohne Leerzeichen liest es sich als ein Wort. |  |
| `aboutHeading` | About this development | על הפרויקט |  |  |
| `amenitiesHeading` | Features & amenities | מתקנים ושירותים |  |  |
| `plansHeading` | Development Plans | תוכניות הפרויקט |  |  |
| `distancesHeading` | Distances | מרחקים |  |  |
| `unitsHeading` | Available units | היחידות בפרויקט | **Fix Round 1:** die Überschrift wird entwurzelt, damit die Unterzeile darunter vollständig sein kann, statt zum bezugslosen Adjektiv `3 זמינות` verkürzt zu werden. |  |
| `unitsSubAvailable(1)` | 1 available | יחידה אחת זמינה | **Zählfall geprüft** (in Pass A fehlte er): die Eins wird ausgeschrieben und nachgestellt. |  |
| `unitsSubAvailable(3)` | 3 available | 3 יחידות זמינות | **Fix Round 1:** `3 זמינות` war ein bezugsloses Adjektiv; mit der neuen Überschrift `היחידות בפרויקט` darf die Zeile vollständig sein. |  |
| `unitsSubSold(3)` |  · 3 sold |  · 3 נמכרו |  |  |
| `factLocation` | Location | מיקום |  |  |
| `factPropertyType` | Property type | סוג נכס |  |  |
| `factUnits` | Units | יחידות |  |  |
| `factUnitsAvailable(1)` | (1 available) | (יחידה אחת זמינה) | **Zählfall geprüft.** |  |
| `factUnitsAvailable(3)` | (3 available) | (3 יחידות זמינות) | **Fix Round 1:** wie `unitsSubAvailable`. |  |
| `factStatus` | Status | סטטוס |  |  |
| `factConstructionStage` | Construction stage | שלב הבנייה |  |  |
| `factPlot` | Plot | מגרש |  |  |
| `factBuildArea` | Build area | שטח בנוי |  |  |
| `factCompletion` | Completion | מסירה |  |  |
| `factEnergyRating` | Energy rating | דירוג אנרגטי |  |  |
| `priceOnRequest` | Price on request | מחיר לפי פנייה |  |  |
| `heroFromSoldOut` | sold from | נמכר במחיר התחלתי | **Fix Round 1:** dieselbe Caption-Zeile wie `heroFrom`. |  |
| `soldOutBannerHeadline.lead` | Sold out — take it as  | נמכר במלואו. סימן שיש לכם  | Der Gedankenstrich wird zu einem Punkt und einem neuen Satz (§3). **Fix Round 1:** `אפשר לראות בזה אישור ל…` war gehobenes Schriftregister und las sich als Übersetzung; die EN-Zeile ist ein Schulterklopfen. Das Goldwort trägt weiterhin das Satzende (§11.3). |  |
| `soldOutBannerHeadline.gold` | confirmation of your taste. | טעם טוב. |  |  |
| `soldOutBannerHeadline.trail` |  |  |  |  |
| `soldOutBannerBody` | Homes like these move quickly, and fortunately Cyprus isn't done building beautiful ones. These projects come closest to what brought you here — and are still open: | נכסים כאלה נחטפים מהר, ולמזלנו בקפריסין ממשיכים לבנות כאלה. הפרויקטים האלה הכי קרובים למה שהביא אתכם לכאן, והם עדיין זמינים: | `נחטפים` ist der idiomatische israelische Immobilienausdruck für „move quickly". Der Doppelpunkt am Ende ist funktional — darunter folgt die Alternativen-Liste. **Fix Round 1, Must fix, zwei Fehler in einem Satz:** (a) `לבנות יפים` — ein nacktes Adjektiv im maskulinen Plural ohne Bezugsnomen; Hebräisch kann „beautiful ones" nicht elliptisch nachbauen. (b) `עדיין פתוחים` ist eine Kalkierung von „still open" (§7) — ein Projekt ist im Hebräischen `זמין`, nicht `פתוח`. |  |
| `soldOutBannerBodyNoAlternatives` | Homes like these move quickly, and fortunately Cyprus isn't done building beautiful ones. Tell us what brought you here — we'll find what comes closest. | נכסים כאלה נחטפים מהר, ולמזלנו בקפריסין ממשיכים לבנות כאלה. ספרו לנו מה הביא אתכם לכאן, ונמצא לכם את הקרוב ביותר. | Satz 1 ist mit `soldOutBannerBody` **wortgleich** und muss es nach §11.6 bleiben — beide Zeilen wurden gemeinsam korrigiert. |  |
| `offMarketCtaHeadline.lead` | Get there  | להגיע לנכס  |  |  |
| `offMarketCtaHeadline.gold` | before the listing | לפני המודעה | „before the listing does" → `לפני המודעה` (vor der Anzeige). Akzentwort ist wie im EN die Verzögerungsquelle, nicht das Verb. |  |
| `offMarketCtaHeadline.trail` |  does. | . |  |  |
| `enquiryHeadline(3).lead` | Request a consultation —  | לקבוע פגישת ייעוץ בנושא  | Glossar-CTA `לקבוע פגישת ייעוץ`; der Gedankenstrich der Quelle wird zu `בנושא` („zum Thema"). |  |
| `enquiryHeadline("Cap St Georges").gold` | Cap St Georges | ⁨Cap St Georges⁩ | **Fix Round 1:** in Pass A stand hier das Beispielargument `3`, sodass der Lektor nie gesehen hat, wie ein lateinischer Projektname in der hebräischen Zeile aussieht. Gerendert: `לקבוע פגישת ייעוץ בנושא ⁨Cap St Georges⁩`. Der Name ist lateinisch in einem hebräischen Satz, deshalb `bidiIsolate()` (FSI…PDI). |  |
| `enquiryHeadline(3).trail` |  |  |  |  |
| `offMarketCtaBody` | Describe your ideal home in one message — we often know about units before they go public, and when we do, we'll think of you first. | תארו לנו את הנכס שאתם מחפשים, בהודעה אחת. אנחנו שומעים על נכסים עוד לפני שהם מגיעים לשוק, וכשזה קורה נחשוב עליכם ראשונים. | Zwei kurze Sätze statt einer Gedankenstrich-Konstruktion (§3). **Fix Round 1, drei Punkte:** englische Wortfolge (Adverbial zwischen Verb und Objekt, §7); `יחידות` ist Maklerjargon, der Käufer sagt `נכסים`; und `מתפרסמות` wiederholte die Wurzel פרסם aus dem direkt darüberstehenden Goldwort `לפני המודעה` (§11.5). |  |
| `alternativesHeading` | Similar projects | פרויקטים דומים |  |  |
| `tagDistrict` | District | מחוז |  |  |
| `tagLocality` | Locality | יישוב |  |  |
| `tagArea` | Area | אזור |  |  |
| `soldOut` | Sold out | נמכר |  |  |
| `stage.off-plan` | Off-plan | על הנייר | Glossar-Begriff. Achtung: als SUCHBEGRIFF hat `על הנייר` null Volumen (Keyword-Map §6.5) — als Statuslabel auf der Seite ist er trotzdem der richtige Fachterminus. |  |
| `stage.under construction` | Under construction | בבנייה |  |  |
| `stage.completed` | Completed | הושלם |  |  |
| `stage.available` | Available | זמין |  |  |
| `stage.key-ready` | Key-Ready | מוכן למגורים |  |  |
| `stage.sold` | Sold | נמכר |  |  |
| `unitStatus.available` | Available | זמין |  |  |
| `unitStatus.sold` | Sold | נמכר |  |  |
| `unitStatus.reserved` | Reserved | שמורה | **Fix Round 1, Must fix:** der Wert wird nicht als neutrales Status-Tag gerendert, sondern in der **Preisspalte einer Einheiten-Zeile** (`UnitsView.tsx:70`) — Bezug ist also `יחידה` (fem.). Das Glossar führt `שמור`; die feminine Form gehört als Kontextregel nach §2. `unitStatus.available` bleibt maskulin `זמין`, weil dieser Eintrag ausschließlich das Hero-Badge über dem **Projekt** trägt (`ProjectPageBody.tsx:162`). |  |
| `viewCards` | Cards | כרטיסים |  |  |
| `viewTable` | Table | טבלה |  |  |
| `unitDisplayAria` | Unit display | תצוגת היחידות |  |  |
| `colUnit` | Unit | יחידה |  |  |
| `colType` | Type | סוג |  |  |
| `colFloor` | Floor | קומה |  |  |
| `colBeds` | Beds | חדרי שינה |  |  |
| `colBuilt` | Built | שטח בנוי |  |  |
| `colPlot` | Plot | מגרש |  |  |
| `colPrice` | Price | מחיר |  |  |
| `colStatus` | Status | סטטוס |  |  |
| `factBeds` | Beds | חדרי שינה |  |  |
| `factBaths` | Baths | חדרי רחצה |  |  |
| `factBuilt` | Built | שטח בנוי |  |  |
| `factVeranda` | Veranda | מרפסת |  |  |
| `factCovered` | Covered | שטח מקורה |  |  |
| `factFloor` | Floor | קומה |  |  |
| `unitM2` | m² | מ"ר | `מ\"ר` mit Gershayim, wie im Glossar. |  |
| `viewTour` | View tour ↗ | לסיור וירטואלי ↗ | Pfeil ↗ unverändert; er ist ein Icon, kein Zeichen des Satzes. **Fix Round 1:** „View tour" meint den 3D-/Virtual-Tour-Link; `סיור` allein liest sich für einen israelischen Käufer wie eine Besichtigung vor Ort — ein Bedeutungsunterschied, kein Stilthema. |  |
| `watch` | Watch ↗ | לצפייה ↗ |  |  |
| `showLess` | Show less | הצגת פחות | **Fix Round 1:** das Paar zu `הצגת עוד` (Glossar §4, so auch im `ProjectCardSlider`) ist regelmäßig nominal gebildet; `הצגה מצומצמת` ist ein anderes Wortbildungsmuster und im israelischen UI unüblich. |  |
| `allDetails` | All details | כל הפרטים |  |  |
| `showMoreUnits(3)` | Show 3 more units | הצגת 3 יחידות נוספות |  |  |
| `factsheetPdf` | Factsheet PDF | דף נתונים PDF | en/de/pl/ru lassen „Factsheet" englisch stehen; für HE unlesbar, daher `דף נתונים PDF`. |  |
| `soon` | soon | בקרוב |  |  |
| `enlargePhotos` | Enlarge photos | הגדלת התמונות |  |  |
| `enlargePhotoN(3)` | Enlarge photo 3 | הגדלת תמונה 3 |  |  |
| `showAllPhotos(3)` | Show all 3 photos | הצגת כל 3 התמונות |  |  |
| `enlargeImageN(3)` | Enlarge image 3 | הגדלת תמונה 3 |  |  |
| `visualisationN(3)` | Visualisation 3 | הדמיה 3 |  |  |
| `close` | Close | סגירה |  |  |
| `previous` | Previous | הקודם |  |  |
| `next` | Next | הבא |  |  |
| `imageN(3)` | Image 3 | תמונה 3 |  |  |

### src/app/components/NoProjects/NoProjects.copy.ts — NO_PROJECTS_COPY

| Key | EN | HE | Anmerkung | Korrektur HE |
|---|---|---|---|---|
| `message` | No projects found. Please try searching with different parameters. | לא נמצאו פרויקטים. אפשר לנסות לחפש לפי פרמטרים אחרים. | Kein „bitte" (§7). **Fix Round 1:** `לחפש עם X` ist eine `with`-Kalkierung (§7 „englische Wortfolge") — Hebräisch sucht `לפי`; und die EN-Quelle sagt „parameters", nicht „filters" (der Unterschied zu `projectsI18n.empty` ist gewollt). |  |

### src/app/components/ProjectSameCity/ProjectSameCity.copy.ts — PROJECT_SAME_CITY_COPY

| Key | EN | HE | Anmerkung | Korrektur HE |
|---|---|---|---|---|
| `title` | Other projects in | פרויקטים נוספים בעיר | Rendert als `{title} {city}`. Hebräisches `ב` ist ein gebundenes Präfix und kann nicht allein vor dem Leerzeichen stehen; `בעיר` („in der Stadt") nimmt das Leerzeichen natürlich auf — derselbe Kunstgriff wie pl/ru. **Fix Round 1:** der String bleibt, der **Ortsname** wird jetzt transliteriert (`hePlaceList()` in `ProjectSameCity.tsx`) — gerendert `פרויקטים נוספים בעיר פאפוס` statt `… בעיר Paphos`. |  |

### src/app/components/PropertyDistances/PropertyDistances.copy.ts — PROPERTY_DISTANCES_COPY

| Key | EN | HE | Anmerkung | Korrektur HE |
|---|---|---|---|---|
| `minSuffix` |  min |  דק' | Führendes Leerzeichen bleibt erhalten (wird an die Zahl angehängt). |  |
| `beach.alt` | Distance from Cyprus villa to the beach | מרחק מהוילה בקפריסין לחוף |  |  |
| `beach.label` | Beach | חוף |  |  |
| `restaurants.alt` | Distance from Cyprus villa to the restaurants | מרחק מהוילה בקפריסין למסעדות |  |  |
| `restaurants.label` | Restaurants | מסעדות |  |  |
| `shops.alt` | Distance from Cyprus villa to the shops | מרחק מהוילה בקפריסין לחנויות |  |  |
| `shops.label` | Shops | חנויות | Folgt der englischen Quelle (`חנויות`), nicht der de/ru-Abweichung zu „Supermarkt". |  |
| `airport.alt` | Distance from Cyprus villa to the airport | מרחק מהוילה בקפריסין לשדה התעופה |  |  |
| `airport.label` | Airport | שדה תעופה |  |  |
| `hospital.alt` | Distance from Cyprus villa to the hospital | מרחק מהוילה בקפריסין לבית החולים |  |  |
| `hospital.label` | Hospital | בית חולים |  |  |
| `school.alt` | Distance from Cyprus villa to the school | מרחק מהוילה בקפריסין לבית הספר |  |  |
| `school.label` | School | בית ספר |  |  |
| `cityCenter.alt` | Distance from Cyprus villa to the city center | מרחק מהוילה בקפריסין למרכז העיר |  |  |
| `cityCenter.label` | City center | מרכז העיר |  |  |
| `golfCourt.alt` | Distance from Cyprus villa to the golf court | מרחק מהוילה בקפריסין למגרש הגולף | s. o. — Alt-Text ebenfalls korrigiert. |  |
| `golfCourt.label` | Golf court | מגרש גולף | EN „Golf court" ist ein alter Tippfehler für golf COURSE. Hebräisch schreibt korrekt `מגרש גולף`. |  |

### src/app/components/PropertyIntro/PropertyIntro.copy.ts — PROPERTY_INTRO_COPY

| Key | EN | HE | Anmerkung | Korrektur HE |
|---|---|---|---|---|
| `requestOffer` | Request Personal Offer | לקבלת הצעה אישית | Nominal-CTA (§2.1). |  |

### src/app/components/PropertyPhotoGallery/PropertyPhotoGallery.copy.ts — PROPERTY_PHOTO_GALLERY_COPY

| Key | EN | HE | Anmerkung | Korrektur HE |
|---|---|---|---|---|
| `more` |  more |  נוספות | Rendert als `+{n}{more}`. Wörtliches ` עוד` stünde im Hebräischen falsch herum; ` נוספות` (fem. Plural, kongruent zu `תמונות`) ergibt `+5 נוספות`. |  |

### src/app/components/ProjectLink/ProjectLink.copy.ts — PROJECT_LINK_COPY

| Key | EN | HE | Anmerkung | Korrektur HE |
|---|---|---|---|---|
| `priceOnRequest` | Price on request | מחיר לפי פנייה |  |  |
| `priceFrom` | Price from | מחיר התחלתי | **Fix Round 1:** hier steht ein festes `&nbsp;` zwischen Label und Zahl (`ProjectLink.tsx:88`), also `מחיר החל מ- €450,000` — ein Bindestrich mit Leerzeichen dahinter ist kein gebundenes Präfix, sondern ein Setzfehler. Die Formulierung mit freiem Wort braucht ihn nicht und passt zur Hero-Caption. |  |
| `areaUnit` | m² | מ"ר | **Fix Round 1, neuer Key:** `ProjectLink.tsx` hatte `m²` für **alle** Locales hartcodiert. Neu als Copy-Key geführt: en/de/pl `m²`, ru `м²` (dieselbe kyrillische Form, die `DEVELOPMENT_STRINGS.ru.unitM2` auf der Nachbarfläche schon benutzt), he `מ"ר`. |  |
| `bedrooms` | Bedrooms | חדרי שינה |  |  |
| `coveredArea` | Covered area | שטח מקורה | Glossar `שטח מקורה`. **Hinweis an die Entwicklung:** direkt darunter steht ein fest verdrahtetes `m²` im JSX (nicht in dieser Tabelle) — für HE müsste dort `מ\"ר` stehen. Ausserhalb des Copy-Tables, deshalb hier nur gemeldet. |  |
| `plotSize` | Plot size | שטח מגרש |  |  |

### src/lib/developmentSeo.ts — TYPE_LABEL (Objekttyp im Auto-Meta-Title und -Description)

| Key | EN | HE | Anmerkung | Korrektur HE |
|---|---|---|---|---|
| `villa` | Villa | וילה | Keyword-Map: `וילות בקפריסין` 320/Mon., aber überwiegend Ferienvermietungs-Intent; die Kaufabsicht steckt in den `למכירה`-Varianten. Auf einer Projektseite ist der Kontext ohnehin Kauf. |  |
| `apartment` | Apartment | דירה | Head-Term `דירות בקפריסין` 260/Mon. |  |
| `house` | House | בית פרטי | Glossar; `בתים למכירה בקפריסין` 70/Mon. `בית` allein wäre mehrdeutig (Haus/Zuhause). |  |
| `townhouse` | Townhouse | בית טורי | Glossar (ausdrücklich nicht `קוטג'`). |  |
| `generic` | Property | נכס | Fallback, wenn die Einheiten gemischte Typen haben. |  |

### src/lib/developmentSeo.ts — LABELS (Bausteine der Auto-Meta)

| Key | EN | HE | Anmerkung | Korrektur HE |
|---|---|---|---|---|
| `in` | in | ב- | Gebundenes Präfix mit Bindestrich, weil der Ortsname lateinisch folgt (§3). Das Leerzeichen der LTR-Sprachen entfällt für `he`. |  |
| `from` | from | החל מ- | Ergibt `החל מ-€450,000` (Glossar). |  |
| `unitsAvailable` | units available | יחידות זמינות | Zahlinvariant, wie in de/pl/ru — keine Genus-/Numerusfalle. |  |
| `completion` | Completion | מסירה | Glossar. |  |
| `cyprus` | Cyprus | קפריסין | |  |
| `soldOut` | Sold out | נמכר במלואו | Volle Form für den Fliesstext der Description; das kurze Badge heisst `נמכר`. |  |
| `similar` | See similar projects | לצפייה בפרויקטים דומים | Nominal-CTA. |  |
| `cta` | View availability & prices | לצפייה בזמינות ובמחירים | Der Standard-CTA aus dem Glossar §5, damit Snippet und Button dieselbe Handlung anbieten. |  |

**Beispiel-Snippets, die daraus entstehen** (bitte an echten Seiten gegenprüfen):

- Title: `Cap St Georges | וילה ב-Peyia, Paphos`
- Description (verfügbar): `וילה ב-Peyia, Paphos, קפריסין. 12 יחידות זמינות החל מ-€1,250,000. מסירה: רבעון 3 2029. לצפייה בזמינות ובמחירים.`
- Description (ausverkauft): `נמכר במלואו. דירה ב-Kato Paphos, Paphos, קפריסין. לצפייה בפרויקטים דומים.`

### src/app/components/ProjectsMapAll/ProjectsMapAll.tsx (Karte der Listenseite)

| Key | EN | HE | Anmerkung | Korrektur HE |
|---|---|---|---|---|
| `CITY_I18N.Paphos` | Paphos | פאפוס | Glossar §1. |  |
| `CITY_I18N.Limassol` | Limassol | לימסול | Glossar §1 (nicht `לימאסול`). |  |
| `CITY_I18N.Larnaca` | Larnaca | לרנקה | Glossar §1. Larnaka wird nicht beworben, taucht aber als Filterwert auf. |  |
| `t.coords` | Coordinates | קואורדינטות | |  |
| `t.copy` | Copy | העתקה | Nominal. |  |
| `t.copied` | Copied! | הועתק ללוח | Ohne Ausrufezeichen (§1). **Fix Round 1:** Bezug sind `קואורדינטות` (fem. Pl.) — `הועתק` kongruiert nicht. Die im israelischen UI übliche, bezugsfreie Form nennt das Ziel. **In beiden Kartendateien wortgleich geändert** (§11.6). |  |
| `t.open` | Open in Google Maps | פתיחה ב-Google Maps | Markenname lateinisch, Präfix mit Bindestrich. |  |
| `t.route` | Route (Google/Apple) | מסלול (Google/Apple) | |  |
| `t.osm` | Open in OSM | פתיחה ב-OSM | |  |
| `GESTURE_TEXT.touch` | Use two fingers to pan | השתמשו בשתי אצבעות כדי להזיז את המפה | **Fix Round 1:** `יש ל…` ist für einen Gesten-Hinweis Behördenton; §2.2 erlaubt den maskulinen Plural, und das ist wörtlich die Zeile, die Israelis aus Google Maps kennen. |  |
| `GESTURE_TEXT.scroll` | Ctrl + scroll to zoom | Ctrl + גלילה כדי לקרב | `Ctrl` ist eine Tastenbeschriftung und bleibt lateinisch. **Fix Round 1:** `גלילה לזום` ist telegrafisch — `לזום` liest sich als Nomen mit Zweck-ל. Der Container ist `dir="ltr"`, Bidi also unkritisch; rein eine Formulierungsfrage. |  |
| `GESTURE_TEXT.scrollMac` | ⌘ + scroll to zoom | ⌘ + גלילה כדי לקרב | |  |

### src/app/components/PropertyMap/PropertyMap.tsx (Karte der Projektseite)

| Key | EN | HE | Anmerkung | Korrektur HE |
|---|---|---|---|---|
| `CITY_I18N.Paphos` | Paphos | פאפוס | |  |
| `CITY_I18N.Limassol` | Limassol | לימסול | |  |
| `CITY_I18N.Larnaca` | Larnaca | לרנקה | |  |
| `t.coords` | Coordinates | קואורדינטות | Wortgleich mit der Listenkarte — dieselbe Bedienung, dieselbe Formulierung. |  |
| `t.copy` | Copy | העתקה | |  |
| `t.copied` | Copied! | הועתק ללוח | Wortgleich mit `ProjectsMapAll.tsx` (§11.6) — siehe dort. |  |
| `t.open` | Open in Google Maps | פתיחה ב-Google Maps | |  |
| `t.route` | Route (Google/Apple) | מסלול (Google/Apple) | |  |
| `t.osm` | Open in OSM | פתיחה ב-OSM | |  |
| `PROJECT_LINK_LABEL` | Open project | מעבר לפרויקט | „Öffnen" wäre im Hebräischen für einen Seitenwechsel unüblich; `מעבר` = hingehen. |  |
| `popupMessages` | This property is located here. | הנכס נמצא כאן | **Fix Round 1:** der Popup steht in einem `dir="ltr"`-Container (`PropertyMap.tsx:208`); der Schlusspunkt ist bidi-neutral und rutscht ans **rechte** Ende, im Hebräischen gehört er nach links. Ein Popup-Label braucht ihn ohnehin nicht. |  |

### src/app/components/DistancesStrip/DistancesStrip.tsx (Distanzleiste Development-Seite)

| Key | EN | HE | Anmerkung | Korrektur HE |
|---|---|---|---|---|
| `labels.beach` | Beach | חוף | |  |
| `labels.restaurants` | Restaurants | מסעדות | |  |
| `labels.shops` | Shops | חנויות | Folgt der englischen Quelle, nicht der de/ru-Abweichung „Supermarkt". |  |
| `labels.airport` | Airport | שדה תעופה | |  |
| `labels.hospital` | Hospital | בית חולים | |  |
| `labels.school` | School | בית ספר | |  |
| `labels.cityCenter` | City center | מרכז העיר | |  |
| `labels.golf` | Golf court | מגרש גולף | Tippfehler der Quelle („court" statt „course") wird nicht mitübersetzt. |  |
| `min` | min | דק' | Abkürzung wegen Chip-Breite. |  |

### src/app/components/ScarcityBanner/ScarcityBanner.tsx

| Key | EN | HE | Anmerkung | Korrektur HE |
|---|---|---|---|---|
| `last` | Last unit available | יחידה אחרונה | **Fix Round 1:** Badge, kein Satz — das Verb trägt nichts, und die Zweiwortform passt zur Kürze des Nachbar-Badges `נמכר`. |  |
| `left(3)` | Only 3 units left | נותרו רק 3 יחידות | Keine Zählverzweigung nötig: der Auslöser begrenzt auf 2–5, und mit westlicher Ziffer davor ist `יחידות` durchgehend richtig. |  |

### src/app/components/PropertyFeatures/PropertyFeatures.tsx (Stadtnamen im Faktenpanel)

| Key | EN | HE | Anmerkung | Korrektur HE |
|---|---|---|---|---|
| `Paphos` | Paphos | פאפוס | |  |
| `Limassol` | Limassol | לימסול | |  |
| `Larnaca` | Larnaca | לרנקה | |  |

### src/app/components/ProjectCardSlider/ProjectCardSlider.tsx

| Key | EN | HE | Anmerkung | Korrektur HE |
|---|---|---|---|---|
| `VIEW_MORE_LABEL` | View more | הצגת עוד | Glossar §4 („Show more"). |  |

---

## 6. Offene Fragen an den Lektor

1. `מ-€` / `עד €` als Preis-Placeholder — oder lieber `מחיר מ` / `מחיר עד` ohne Währungszeichen, weil das `€` im RTL-Input verrutscht?
2. ~~`דירוג אנרגטי` als Kartenchip-Präfix: zu lang?~~ **Von Pass B entschieden:** Chip `אנרגיה`, Faktenpanel `דירוג אנרגטי`.
3. `נחטפים` im Sold-out-Banner: idiomatisch stark, aber grenzt an Immobilienanzeigen-Sprache (§1 „Nicht"). Bleibt es, oder lieber nüchtern `נמכרים מהר`?
4. `הכל` als Placeholder im Schlafzimmer-Filter, während Stadt und Typ jetzt `כל הערים` / `כל הסוגים` heissen. Pass B lässt `הכל` stehen (`כל המספרים` ist zu lang) und verlangt, die Ausnahme bewusst zu dokumentieren — sie steht in `wp2-glossary.md`. Bitte bestätigen oder kippen.
5. `דף נתונים PDF` für „Factsheet PDF" — oder ist das englische Wort im israelischen Immobilienkontext geläufig genug?
6. `יישוב` vs. `עיירה` für „Locality" in der Tag-Zeile.
7. ~~Ortsnamen in der Auto-Meta: Umschrifttabelle bauen oder `ב-Paphos` akzeptieren?~~ **Von Pass B entschieden: Tabelle gebaut** (`src/lib/hePlaces.ts`). Zu prüfen bleibt die **Schreibweise** der Orte, die `he-glossary.md` §1 noch nicht führt — sie sind in `wp2-glossary.md` einzeln aufgelistet.
8. `מחיר מינימלי` / `מחיר מקסימלי` im Preisfilter stehen gegen §6.1, das die **Substantive** `מינימום`/`מקסימום` verworfen hat. Pass B empfiehlt, die **Adjektivform** zu behalten (Yad2-Standard) und die Ausnahme in §6.1 zu dokumentieren. Bitte bestätigen.
9. Statusspalte der Einheitentabelle: `זמינה / שמורה / נמכרה` (feminin, Bezug `יחידה`) gegen das Hero-Badge `זמין` (maskulin, Bezug Projekt). Absichtlich unterschiedlich — bitte gegenlesen.

---

## 7. Auto-SEO nach Fix Round 1 — gemessene Beispiele

Gemessen in **Graphemen** (`Intl.Segmenter("he")`). Die unsichtbaren Isolatoren FSI/PDI und LRI/PDI (`⁨…⁩`, `⁦…⁩`) zählen für die Kürzung mit; „sichtbar" ist die Zahl ohne sie. Grenzen: Title ≤ 60, Description ≤ 155.

**Was sich strukturell geändert hat**

1. **Keyword vorn, Marke hinten.** Für `he` führt jetzt die Phrase, die Israelis suchen (`דירה עם 2 חדרי שינה בלימסול`), und der lateinische Projektname steht hinter dem `|` — dem Slot, den §6 ohnehin für die Marke vorsieht. en/de/pl/ru behalten `Name – Typ in Ort` **zeichengleich**.
2. **Kein nackter Trenner mehr.** `fit()` warf Klauseln von hinten weg; der Separator war eine eigene Klausel und überlebte die Klausel, die er einleitete (`⁨Limassol Del Mar Residences Tower B⁩ |`, 39 Zeichen). Der Trenner hängt jetzt an seiner Klausel, und `fit()` verwirft zusätzlich jede Endklausel, die nur aus Satzzeichen besteht. Ein Regressionstest hält genau diesen Fall fest (`src/lib/__tests__/developmentSeoHe.test.ts`).
3. **Zählform.** `1 יחידות זמינות` ist ungrammatisch; die Eins wird ausgeschrieben und nachgestellt.
4. **`מסירה ברבעון 3 2029`** statt `מסירה: רבעון 3 2029` — ein Doppelpunkt mitten im Snippet liest sich wie ein Datenbankfeld. Nur für den Quartalsfall; Freitextwerte des Feldes behalten den Doppelpunkt und werden isoliert.
5. **Sold-out bekommt einen dritten Satz** (`באזור יש נכסים חדשים שעדיין זמינים לרכישה.`) — die bisherigen 67–73 sichtbaren Zeichen lagen weit unter dem in §6 geforderten Korridor 120–155, und Google füllte den Rest mit gescraptem Seitentext. Bei sehr langen Ortsnamen wirft `fit()` den Satz automatisch wieder heraus.
6. **Isolatoren gezielt statt großzügig.** `bidiIsolate(rawPriceClause)` umschloss die ganze Klausel samt führendem Leerzeichen und hebräischem `החל מ`; isoliert wird jetzt genau der LTR-Ausschnitt, also die Preisfigur (`ltrIsolate`).
7. **`DESC_MAX`.** Die Checkliste in §2 verlangt ≤ 155, der Code klemmte auf 160. **Entscheidung: 155 nur für `he`.** Belegt durch einen Sweep der LTR-Templates: mit realistischen Werten (Quartalsformat, Preise bis €5 Mio., echte Gebietsnamen) liegt das Maximum bei **150** (de), aber `completion` ist ein Freitextfeld — mit „Ready to move in" erreicht de **160** und pl **158**. Eine globale Senkung hätte also live ausgelieferte LTR-Snippets verändert; das exportierte `DESC_MAX = 160` bleibt außerdem die Obergrenze, die der Admin-Editor und `src/lib/ai/seoMeta.ts` anzeigen.

**Gerenderte Beispiele (`he`)**

| Fall | Title | Graphemes (sichtbar) |
|---|---|---|
| „Cap St Georges", Peyia/Paphos, Villa, 3 SZ | `וילה עם 3 חדרי שינה בפאפוס \| ⁨Cap St Georges⁩` | 45 (43) ✓ |
| „Celestia Residences", Kato Paphos/Paphos, Apartment, 2 SZ, ausverkauft | `דירה עם 2 חדרי שינה בפאפוס \| ⁨Celestia Residences⁩` | 50 (48) ✓ |
| „The Blue Residences", Germasogeia/Limassol, Apartment, 2 SZ, **1 Einheit** | `דירה עם 2 חדרי שינה בלימסול \| ⁨The Blue Residences⁩` | 51 (49) ✓ |
| „Aurora Court", Universal/Paphos, **Studio** | `דירה בפאפוס \| ⁨Aurora Court⁩` | 28 (26) ✓ |
| „Limassol Del Mar Residences Tower B", Neapolis/Limassol (der frühere Abbruchfall) | `דירה בלימסול \| ⁨Limassol Del Mar Residences Tower B⁩` | 52 (50) ✓ — kein nackter `\|` mehr |
| „Hidden Grove", **unbekannter Ort** | `וילה עם 4 חדרי שינה ב-⁨Nowhere Village⁩ \| ⁨Hidden Grove⁩` | 56 (52) ✓ |

| Fall | Description | Graphemes (sichtbar) |
|---|---|---|
| Villa, Peyia/Paphos, 12 verfügbar, ab €850,000, Q3 2029 | `וילה בפאפוס, קפריסין. 12 יחידות זמינות החל מ-⁦€850,000⁩. מסירה ברבעון 3 2029. לצפייה בזמינות ובמחירים.` | 102 (100) ✓ |
| Apartment, Germasogeia/Limassol, **1** verfügbar, ab €420,000, Q2 2027 | `דירה בלימסול, קפריסין. יחידה אחת זמינה החל מ-⁦€420,000⁩. מסירה ברבעון 2 2027. לצפייה בזמינות ובמחירים.` | 102 (100) ✓ |
| Apartment, Universal/Paphos, **Studio**, 5 verfügbar, ab €165,000, Q1 2028 | `דירה בפאפוס, קפריסין. 5 יחידות זמינות החל מ-⁦€165,000⁩. מסירה ברבעון 1 2028. לצפייה בזמינות ובמחירים.` | 101 (99) ✓ |
| Apartment, Kato Paphos/Paphos, **ausverkauft** | `נמכר במלואו. דירה בפאפוס, קפריסין. באזור יש נכסים חדשים שעדיין זמינים לרכישה. לצפייה בפרויקטים דומים.` | 101 (101) ✓ |
| Villa, **unbekannter Ort**, 3 verfügbar, ab €700,000, Q2 2030 | `וילה ב-⁨Nowhere Village⁩, קפריסין. 3 יחידות זמינות החל מ-⁦€700,000⁩. מסירה ברבעון 2 2030. לצפייה בזמינות ובמחירים.` | 114 (110) ✓ |

**Bitte an mindestens drei echten Projektseiten gegenlesen** (View-Source, `<title>` und `<meta name="description">`): eines verfügbar mit Preis, eines ohne Preis, eines ausverkauft. Wenn ein Ortsname dort noch lateinisch erscheint, fehlt er in `src/lib/hePlaces.ts` — bitte mit der gewünschten Schreibweise notieren, das ist eine Ein-Zeilen-Ergänzung.

## 8. Zweiter Durchgang über das rendernde JSX (§11.3) — Nachtrag

Pass A hatte `&nbsp;` in `ProjectLink`, das hartcodierte `m²`, den `dir="ltr"`-Container der Karten und `{title} {city}` erkannt. Pass B hat fünf weitere Fundstellen nachgetragen; alle sind in Fix Round 1 behoben, **nur für `he`**, die LTR-Ausgabe ist überall unverändert:

| Fundstelle | Befund | Behebung |
|---|---|---|
| `preview-project/project.css:152` + `ProjectPageBody.tsx:167` | `.pp-hero__stats > div { flex-direction: column }` — die Preis-Caption ist eine eigene Zeile, `החל מ-` stand als Bindestrich ohne Anschluss | `heroFrom`/`heroFromSoldOut` für `he` nicht mehr aus der Listen-Copy gespiegelt |
| `UnitsView.tsx:76` (`StatusPill`) | rendert `u.statusLabel \|\| u.status`, also den **englischen** DB-Wert — die Statusspalte war die einzige lateinische Spalte einer hebräischen Seite | `heFeedLabel()` für `he`; Bezug `יחידה`, daher feminin (`זמינה / שמורה / נמכרה`) |
| `ProjectCard.tsx:125` | `{c.bedrooms} {s.bedUnit}` über `resolveBedRange()` → `1 חדרי שינה`, `Studio חדרי שינה` | `heBedrooms()` für `he` |
| `[lang]/projects/page.tsx:141/146` → `ProjectCard.tsx` | `city` und `type` kommen als roher Feed-Wert (`Paphos`, `Villa`) auf die Karte, während Filterleiste und Faktenpanel `פאפוס` / `וילה` zeigen | `hePlaceList()` / `heFeedLabel()` für `he` |
| `ProjectPageBody.tsx:83/128/163` | `resolveDevelopmentType()` liefert die englische Feed-Vokabel in Hero **und** Faktenpanel; `p.location` ist roher Ortsfreitext an zwei Stellen | am Render-Ort übersetzt; `resolveDevelopmentType()` selbst bleibt englisch, weil `matchesPropertyTypeFilter` und die City+Type-Landingpages dagegen matchen |

**Weiterhin offen (Dev-Aufgaben, absichtlich nicht in dieser Runde):**

- `ProjectCard.tsx` — `aria-label="Distances"` hartcodiert englisch, alle Locales.
- `UnitsView.tsx` — `title="Branded PDF factsheet (built in the backend phase)"` hartcodiert englisch, alle Locales.
- `ProjectCard.tsx` — `Studio` als Bettenwert zeigt in **en** weiterhin `Studio bed`. Das betrifft alle LTR-Locales und wurde hier nicht angefasst, weil diese Runde die LTR-Ausgabe zeichengleich lassen muss.

