# Pass C — Muttersprachliches Review: WP2 (Projektliste, Development-Seite, Auto-SEO-Meta)

**Stand:** 2026-09-13 · **Status:** Pass A (Erstübersetzung) fertig, alle Einträge tragen `REVIEW(he)` · **Freigabe erst mit ausgefülltem Protokoll** (Styleguide §9.5)

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
2. **`בעיר` in „Weitere Projekte in <Stadt>"** — das gebundene Präfix `ב` kann im vorhandenen JSX (`{title} {city}`) nicht direkt am Ortsnamen kleben.
3. **`החל מ-` als eigenständiges Label** vor dem Preis. Wortlaut nach Glossar, aber zwischen Label und Zahl steht ein Leerzeichen aus dem Markup, also `החל מ- €450,000`. Falls das stört, ist die Alternative, das Trennzeichen im Markup zu entfernen (Entwicklungsaufgabe, nicht Übersetzung).
4. **Meta-Title-Trenner `|` statt `–`** (Styleguide §6). Die LTR-Sprachen behalten ihren Halbgeviertstrich; nur `he` schaltet um.
5. **Sold-out-Description** beginnt mit `נמכר במלואו.` plus neuem Satz statt mit einem Gedankenstrich.
6. **`רבעון 3 2029`** in der Auto-Description — nur `he` lokalisiert das gespeicherte `Q3 2029`; en/de behalten `Q3 2029`, pl/ru bleiben in diesem Satz unverändert (bestehender Zustand, kein Regress durch WP2).
7. **Ortsnamen in der Auto-Meta bleiben lateinisch** (`ב-Paphos`, `ב-Kato Paphos`): `vm.area`/`vm.district` sind Freitextfelder aus der Datenbank und haben keine hebräische Entsprechung. Der Bindestrich vor dem lateinischen Wort ist Styleguide §3. **Offene Frage an den Lektor und an das Produkt:** lohnt sich eine Umschrifttabelle für die ~20 häufigsten Gebiete, damit die Snippets `בפאפוס` statt `ב-Paphos` lesen? Das wäre eine eigene Aufgabe.
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
| `cityPlaceholder` | Any location | כל האזורים | „Any location" wird zu „alle Gebiete" — Hebräisch hat keinen neutralen „beliebig"-Platzhalter, der in einem Select nicht nach Fragebogen klingt. |  |
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
| `hideFilters` | Hide filters | הסתרת המסננים |  |  |
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
| `bedUnit` | bed | חדרי שינה | EN „bed" (Singular, Kartenchip `3 bed`) wird zum vollen `חדרי שינה` — Glossar-Pflicht: Zypern zählt Schlafzimmer, Israel Zimmer; die Kurzform wäre missverständlich. Lektor: passt die Länge in den Kartenchip? |  |
| `areaUnit` | m² | מ"ר |  |  |
| `energyPrefix` | Energy | דירוג אנרגטי | Rendert als `דירוג אנרגטי A`. Lang für einen Kartenchip; wenn es umbricht, wäre `אנרגיה` die Ausweichform. |  |
| `priceFrom` | from  | החל מ- | Steht als eigenes `<span>` VOR dem Preis, nicht direkt angeklebt — es erscheint also `החל מ- €450,000` mit Lücke statt `החל מ-€450,000` wie im Glossar. Wortlaut bewusst nach Glossar; die Lücke ist ein Layout-Thema. |  |
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
| `loading` | Loading… | בטעינה… | `בטעינה…` statt `טוען…`: genusfrei, wie WP1s `בשליחה…`. |  |
| `loadingMap` | Loading map… | המפה בטעינה… |  |  |
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
| `enquireNow` | Enquire this amazing project now! | לקבלת פרטים על הפרויקט | Ausrufezeichen und „amazing" entfallen (§1 / §7 Adjektiv-Stapel). Der Button öffnet das Broschüren-Modal, daher „Details zum Projekt erhalten". |  |
| `developer` | Developer | יזם |  |  |
| `calculateRoi` | Calculate ROI | חישוב תשואה | ROI = `תשואה`. Das Akronym „ROI" ist im israelischen Privatkäufer-Segment nicht selbsterklärend. |  |
| `faq` | FAQ | שאלות ותשובות |  |  |

### src/lib/developmentCopy.ts — DEVELOPMENT_STRINGS

| Key | EN | HE | Anmerkung | Korrektur HE |
|---|---|---|---|---|
| `galleryLabel(3)` | View 3 photos | לצפייה ב-3 תמונות |  |  |
| `openGallery` | Open gallery | פתיחת הגלריה |  |  |
| `heroFrom` | from | החל מ- |  |  |
| `heroType` | type | סוג |  |  |
| `heroAvailable` | available | זמינות | Caption unter der Stückzahl. `זמינות` (Verfügbarkeit) statt eines Adjektivs, das sich nach dem Genus des Objekttyps richten müsste. |  |
| `vatSuffix` | +VAT | +מע"מ | `מע\"מ` mit Gershayim (§4). |  |
| `aboutHeading` | About this development | על הפרויקט |  |  |
| `amenitiesHeading` | Features & amenities | מתקנים ושירותים |  |  |
| `plansHeading` | Development Plans | תוכניות הפרויקט |  |  |
| `distancesHeading` | Distances | מרחקים |  |  |
| `unitsHeading` | Available units | יחידות זמינות |  |  |
| `unitsSubAvailable(3)` | 3 available | 3 זמינות | Kurz gehalten, weil direkt unter der Überschrift `יחידות זמינות` — sonst stünde „Einheiten" zweimal. |  |
| `unitsSubSold(3)` |  · 3 sold |  · 3 נמכרו |  |  |
| `factLocation` | Location | מיקום |  |  |
| `factPropertyType` | Property type | סוג נכס |  |  |
| `factUnits` | Units | יחידות |  |  |
| `factUnitsAvailable(3)` | (3 available) | (3 זמינות) |  |  |
| `factStatus` | Status | סטטוס |  |  |
| `factConstructionStage` | Construction stage | שלב הבנייה |  |  |
| `factPlot` | Plot | מגרש |  |  |
| `factBuildArea` | Build area | שטח בנוי |  |  |
| `factCompletion` | Completion | מסירה |  |  |
| `factEnergyRating` | Energy rating | דירוג אנרגטי |  |  |
| `priceOnRequest` | Price on request | מחיר לפי פנייה |  |  |
| `heroFromSoldOut` | sold from | נמכר החל מ- |  |  |
| `soldOutBannerHeadline.lead` | Sold out — take it as  | נמכר במלואו. אפשר לראות בזה  | Der Gedankenstrich wird zu einem Punkt und einem neuen Satz (§3). „confirmation of your taste" → `אישור לטעם הטוב שלכם` (maskuliner Plural, §2.2). |  |
| `soldOutBannerHeadline.gold` | confirmation of your taste. | אישור לטעם הטוב שלכם. |  |  |
| `soldOutBannerHeadline.trail` |  |  |  |  |
| `soldOutBannerBody` | Homes like these move quickly, and fortunately Cyprus isn't done building beautiful ones. These projects come closest to what brought you here — and are still open: | נכסים כאלה נחטפים מהר, ולמזלנו קפריסין עוד לא סיימה לבנות יפים. הפרויקטים האלה הכי קרובים למה שהביא אתכם לכאן, והם עדיין פתוחים: | `נחטפים` ist der idiomatische israelische Immobilienausdruck für „move quickly"; wörtlich „werden weggeschnappt". Kein Superlativ, keine erfundene Zahl. Der Doppelpunkt am Ende ist funktional — darunter folgt die Alternativen-Liste. |  |
| `soldOutBannerBodyNoAlternatives` | Homes like these move quickly, and fortunately Cyprus isn't done building beautiful ones. Tell us what brought you here — we'll find what comes closest. | נכסים כאלה נחטפים מהר, ולמזלנו קפריסין עוד לא סיימה לבנות יפים. ספרו לנו מה הביא אתכם לכאן, ונמצא את מה שהכי קרוב. |  |  |
| `offMarketCtaHeadline.lead` | Get there  | להגיע לנכס  |  |  |
| `offMarketCtaHeadline.gold` | before the listing | לפני המודעה | „before the listing does" → `לפני המודעה` (vor der Anzeige). Akzentwort ist wie im EN die Verzögerungsquelle, nicht das Verb. |  |
| `offMarketCtaHeadline.trail` |  does. | . |  |  |
| `enquiryHeadline(3).lead` | Request a consultation —  | לקבוע פגישת ייעוץ בנושא  | Glossar-CTA `לקבוע פגישת ייעוץ`; der Gedankenstrich der Quelle wird zu `בנושא` („zum Thema"). |  |
| `enquiryHeadline(3).gold` | 3 | ⁨3⁩ | Der Projektname ist lateinisch und steckt in einem hebräischen Satz — deshalb `bidiIsolate()` (FSI…PDI). Im Beispiel oben ist der Platzhalter eine 3, daher die Isolatoren um die Ziffer. |  |
| `enquiryHeadline(3).trail` |  |  |  |  |
| `offMarketCtaBody` | Describe your ideal home in one message — we often know about units before they go public, and when we do, we'll think of you first. | תארו לנו בהודעה אחת את הנכס שאתם מחפשים. אנחנו יודעים על יחידות עוד לפני שהן מתפרסמות, ואז נחשוב עליכם ראשונים. | Zwei kurze Sätze statt einer Gedankenstrich-Konstruktion (§3). |  |
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
| `unitStatus.reserved` | Reserved | שמור | Glossar `שמור`. |  |
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
| `viewTour` | View tour ↗ | לצפייה בסיור ↗ | Pfeil ↗ unverändert; er ist ein Icon, kein Zeichen des Satzes. |  |
| `watch` | Watch ↗ | לצפייה ↗ |  |  |
| `showLess` | Show less | הצגה מצומצמת | Nominal (`הצגה מצומצמת`), Gegenstück zum Glossar-`הצגת עוד`. |  |
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
| `message` | No projects found. Please try searching with different parameters. | לא נמצאו פרויקטים. אפשר לנסות לחפש עם מסננים אחרים. |  |  |

### src/app/components/ProjectSameCity/ProjectSameCity.copy.ts — PROJECT_SAME_CITY_COPY

| Key | EN | HE | Anmerkung | Korrektur HE |
|---|---|---|---|---|
| `title` | Other projects in | פרויקטים נוספים בעיר | Rendert als `{title} {city}`. Hebräisches `ב` ist ein gebundenes Präfix und kann nicht allein vor dem Leerzeichen stehen; `בעיר` („in der Stadt") nimmt das Leerzeichen natürlich auf — derselbe Kunstgriff wie pl/ru. |  |

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
| `priceFrom` | Price from | מחיר החל מ- | Steht als eigenes `<span>` VOR dem Preis, nicht direkt angeklebt — es erscheint also `החל מ- €450,000` mit Lücke statt `החל מ-€450,000` wie im Glossar. Wortlaut bewusst nach Glossar; die Lücke ist ein Layout-Thema. |  |
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
| `t.copied` | Copied! | הועתק | Ohne Ausrufezeichen (§1). |  |
| `t.open` | Open in Google Maps | פתיחה ב-Google Maps | Markenname lateinisch, Präfix mit Bindestrich. |  |
| `t.route` | Route (Google/Apple) | מסלול (Google/Apple) | |  |
| `t.osm` | Open in OSM | פתיחה ב-OSM | |  |
| `GESTURE_TEXT.touch` | Use two fingers to pan | יש להשתמש בשתי אצבעות כדי להזיז את המפה | Unpersönlich statt Imperativ (§2.1). |  |
| `GESTURE_TEXT.scroll` | Ctrl + scroll to zoom | Ctrl + גלילה לזום | `Ctrl` ist eine Tastenbeschriftung und bleibt lateinisch. |  |
| `GESTURE_TEXT.scrollMac` | ⌘ + scroll to zoom | ⌘ + גלילה לזום | |  |

### src/app/components/PropertyMap/PropertyMap.tsx (Karte der Projektseite)

| Key | EN | HE | Anmerkung | Korrektur HE |
|---|---|---|---|---|
| `CITY_I18N.Paphos` | Paphos | פאפוס | |  |
| `CITY_I18N.Limassol` | Limassol | לימסול | |  |
| `CITY_I18N.Larnaca` | Larnaca | לרנקה | |  |
| `t.coords` | Coordinates | קואורדינטות | Wortgleich mit der Listenkarte — dieselbe Bedienung, dieselbe Formulierung. |  |
| `t.copy` | Copy | העתקה | |  |
| `t.copied` | Copied! | הועתק | |  |
| `t.open` | Open in Google Maps | פתיחה ב-Google Maps | |  |
| `t.route` | Route (Google/Apple) | מסלול (Google/Apple) | |  |
| `t.osm` | Open in OSM | פתיחה ב-OSM | |  |
| `PROJECT_LINK_LABEL` | Open project | מעבר לפרויקט | „Öffnen" wäre im Hebräischen für einen Seitenwechsel unüblich; `מעבר` = hingehen. |  |
| `popupMessages` | This property is located here. | הנכס נמצא כאן. | |  |

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
| `last` | Last unit available | נותרה יחידה אחרונה | |  |
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
2. `דירוג אנרגטי` als Kartenchip-Präfix: zu lang? Ausweichform `אנרגיה`.
3. `נחטפים` im Sold-out-Banner: idiomatisch stark, aber grenzt an Immobilienanzeigen-Sprache (§1 „Nicht"). Bleibt es, oder lieber nüchtern `נמכרים מהר`?
4. `הכל` als Placeholder im Schlafzimmer-Filter, während Stadt und Typ `כל האזורים` / `כל הסוגים` heissen — inkonsistent oder in der Feldbreite gerechtfertigt?
5. `דף נתונים PDF` für „Factsheet PDF" — oder ist das englische Wort im israelischen Immobilienkontext geläufig genug?
6. `יישוב` vs. `עיירה` für „Locality" in der Tag-Zeile.
7. Ortsnamen in der Auto-Meta (Punkt 7 oben): Umschrifttabelle bauen oder `ב-Paphos` akzeptieren?
