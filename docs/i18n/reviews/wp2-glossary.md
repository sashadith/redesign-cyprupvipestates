# Glossar-Ergänzungen aus WP2 (Projektliste + Development-Seite)

**Stand:** 2026-09-13 · **Quelle:** WP2 Pass A (Projektliste `/he/projects`, Development-Seite `/he/projects/<slug>`, Auto-SEO-Meta)

Begriffe, die WP2 gebraucht hat und die in `docs/i18n/he-glossary.md` §1–5 (und in §6.1 aus WP1) fehlen.
`he-glossary.md` wird in diesem Commit **nicht** angefasst — ein anderer Agent hält die Datei.
Nach dem Lektorat (Pass C) wandern die bestätigten Zeilen in §2/§4/§5.

| EN | HE | Kontext | Begründung |
|---|---|---|---|
| Commercial (Objekttyp-Filter) | נכס מסחרי | Filter „Property type" auf `/he/projects` | Glossar §2 kennt nur Wohntypen; „מסחרי" allein wirkt als Dropdown-Eintrag adjektivisch abgehängt |
| Any location / Any type / Any beds (Filter-Placeholder) | כל האזורים / כל הסוגים / הכל | Select-Placeholder Filterleiste | WP1 hat nur `בחרו…` als Placeholder; hier ist die „alles"-Semantik gemeint, nicht die Aufforderung |
| Reset (Filter) | איפוס | Filterleiste | Nominalform, kein Imperativ (§2.1) |
| More filters / Hide filters | עוד מסננים / הסתרת המסננים | Filterleiste, Toggle | Glossar hat nur „Filter = סינון"; für den Plural der Einzelfelder ist `מסננים` der übliche Portal-Begriff |
| Sort by | מיון לפי | `aria-label` der Sortierung | — |
| Recommended (Sortierung) | מומלצים | Sort-Option | maskulin Plural, bezieht sich auf `פרויקטים` |
| Price · low to high / high to low | מחיר: מהנמוך לגבוה / מהגבוה לנמוך | Sort-Optionen | Doppelpunkt statt `·`, siehe Anmerkung in `wp2.md` |
| min (Kurzform Minuten) | דק' | Distanz-Chips auf Karte und Karten-Kacheln | Glossar §4 hat nur `דקות` ausgeschrieben; in der Chip-Breite passt nur die Abkürzung |
| Golf course | מגרש גולף | Distanz-Kategorie | EN-Quelle schreibt fälschlich „Golf court"; Hebräisch korrigiert stillschweigend |
| Hospital | בית חולים | Distanz-Kategorie | fehlt im Glossar (DE nutzt „Klinik") |
| Shops | חנויות | Distanz-Kategorie | DE/RU sind zu „Supermarkt" abgedriftet; HE folgt der englischen Quelle |
| Supermarket / Pharmacy / Clinic (POI-Layer) | סופרמרקט / בית מרקחת / מרפאה | POI-Kontrolle auf der Karte | — |
| Public / private school | בית ספר ציבורי / בית ספר פרטי | POI-Kontrolle | — |
| LIFE NEARBY (Eyebrow über der POI-Leiste) | החיים בסביבה | Karte | Hebräisch kennt keine Versalien; die Aussage trägt allein |
| Zoom (Verb, Kartenbedienung) | זום | Gesten-Hinweis der Karte | israelischer Alltagsbegriff, `שינוי מרחק תצוגה` wäre Behördensprache |
| Coordinates / Copy / Copied | קואורדינטות / העתקה / הועתק | Karten-Popup | „Copied!" ohne Ausrufezeichen (§1) |
| Open in Google Maps / OSM | פתיחה ב-Google Maps / פתיחה ב-OSM | Karten-Popup | Markenname lateinisch, Präposition mit Bindestrich (§3) |
| Open project | מעבר לפרויקט | Karten-Popup-Link | — |
| Explore on the map | לצפייה במפה | Karten-Teaser-Kachel | „לחקור" wäre eine Kalkierung von „explore" (§7) |
| Loading… / Loading map… | בטעינה… / המפה בטעינה… | Lazy-Load-Fallbacks | genusfrei statt `טוען…` — dieselbe Lösung wie WP1s `בשליחה…` |
| Construction stage | שלב הבנייה | Faktenpanel Development-Seite | Glossar hat nur `בבנייה` als Status |
| District / Locality / Area (Nachbarschafts-Tags) | מחוז / יישוב / אזור | Tag-Zeile Development-Seite | drei Ebenen, die im Glossar nicht unterschieden werden |
| Cards / Table (Ansichts-Umschalter) | כרטיסים / טבלה | Einheiten-Ansicht | — |
| Factsheet PDF | דף נתונים PDF | Download-Button Einheit | en/de/pl/ru lassen „Factsheet" englisch; für HE ist das unlesbar |
| Visualisation | הדמיה | Bildunterschrift Galerie | Branchenbegriff für Renderings |
| Similar projects | פרויקטים דומים | Alternativen-Block + SEO-Description | — |
| Last unit available / Only {n} units left | נותרה יחידה אחרונה / נותרו רק {n} יחידות | Scarcity-Badge | — |
| Show less | הצגה מצומצמת | Einheiten-Karte | Gegenstück zu `הצגת עוד` (§4), ebenfalls nominal |
| quarter (Fertigstellung) | רבעון | Auto-SEO-Description, `localizeCompletion` | Styleguide §5 nennt das Format `רבעון 3 2027`, das Glossar führt den Begriff nicht |
| Property (Oberbegriff im SEO-Titel, Typ unbekannt) | נכס | `TYPE_LABEL.generic` in `developmentSeo.ts` | Glossar §2 hat `נכס` für „ein Objekt"; hier zusätzlich als Fallback-Typbezeichnung im Title |
| Energy (Kurzlabel auf der Projektkarte) | דירוג אנרגטי | Projektkarte | Glossar hat „energy class = דירוג אנרגטי"; hier steht es als Präfix vor dem Buchstaben (`דירוג אנרגטי A`) — Lektor bitte auf Kartenbreite prüfen |
