# Glossar-Ergänzungen aus WP2 (Projektliste + Development-Seite)

**Stand:** 2026-09-13 · **Quelle:** WP2 Pass A, korrigiert nach Pass B Fix Round 1 (Projektliste `/he/projects`, Development-Seite `/he/projects/<slug>`, Auto-SEO-Meta)

Begriffe, die WP2 gebraucht hat und die in `docs/i18n/he-glossary.md` §1–5 (und in §6.1 aus WP1) fehlen.
`he-glossary.md` wird in diesem Commit **nicht** angefasst — ein anderer Agent hält die Datei.
Nach dem Lektorat (Pass C) wandern die bestätigten Zeilen in §2/§4/§5.

| EN | HE | Kontext | Begründung |
|---|---|---|---|
| Commercial (Objekttyp-Filter) | נכס מסחרי | Filter „Property type" auf `/he/projects` | Glossar §2 kennt nur Wohntypen; „מסחרי" allein wirkt als Dropdown-Eintrag adjektivisch abgehängt |
| Any location / Any type / Any beds (Filter-Placeholder) | כל הערים / כל הסוגים / הכל | Select-Placeholder Filterleiste | WP1 hat nur `בחרו…` als Placeholder; hier ist die „alles"-Semantik gemeint, nicht die Aufforderung. **Pass B #13:** `כל האזורים` versprach eine Ebene, die das Feld nicht hat (Label `עיר`, drei Städte als Optionen) und kollidierte mit dem dreifach belegten `אזור` → `כל הערים`. `הכל` für „Any beds" bleibt als **bewusste Ausnahme** vom `כל ה…`-Muster (`כל המספרים` ist zu lang für die Chip-Breite) |
| Reset (Filter) | איפוס | Filterleiste | Nominalform, kein Imperativ (§2.1) |
| More filters / Hide filters | עוד מסננים / הסתרת מסננים | Filterleiste, Toggle | Glossar hat nur „Filter = סינון"; für den Plural der Einzelfelder ist `מסננים` der übliche Portal-Begriff. **Pass B #15:** beide Zustände desselben Buttons stehen jetzt indefinit — die Determination darf zwischen ihnen nicht springen |
| Sort by | מיון לפי | `aria-label` der Sortierung | — |
| Recommended (Sortierung) | מומלצים | Sort-Option | maskulin Plural, bezieht sich auf `פרויקטים` |
| Price · low to high / high to low | מחיר: מהנמוך לגבוה / מהגבוה לנמוך | Sort-Optionen | Doppelpunkt statt `·`, siehe Anmerkung in `wp2.md` |
| min (Kurzform Minuten) | דק' | Distanz-Chips auf Karte und Karten-Kacheln | Glossar §4 hat nur `דקות` ausgeschrieben; in der Chip-Breite passt nur die Abkürzung |
| Golf course | מגרש גולף | Distanz-Kategorie | EN-Quelle schreibt fälschlich „Golf court"; Hebräisch korrigiert stillschweigend |
| Hospital | בית חולים | Distanz-Kategorie | fehlt im Glossar (DE nutzt „Klinik") |
| Shops | חנויות | Distanz-Kategorie | DE/RU sind zu „Supermarkt" abgedriftet; HE folgt der englischen Quelle |
| Supermarkets / Pharmacies / Clinics (POI-Layer) | סופרמרקטים / בתי מרקחת / מרפאות | POI-Kontrolle auf der Karte | **Pass B #33:** die EN-Quelle ist Plural („Clinics/Supermarkets/Pharmacies") und der Code folgt ihr korrekt — der Singular in dieser Zeile war der Fehler, nicht der Code |
| Public / private school | בית ספר ציבורי / בית ספר פרטי | POI-Kontrolle | — |
| LIFE NEARBY (Eyebrow über der POI-Leiste) | החיים בסביבה | Karte | Hebräisch kennt keine Versalien; die Aussage trägt allein |
| Zoom (Verb, Kartenbedienung) | זום | Gesten-Hinweis der Karte | israelischer Alltagsbegriff, `שינוי מרחק תצוגה` wäre Behördensprache |
| Coordinates / Copy / Copied | קואורדינטות / העתקה / הועתק ללוח | Karten-Popup (`PropertyMap.tsx` **und** `ProjectsMapAll.tsx`, wortgleich §11.6) | „Copied!" ohne Ausrufezeichen (§1). **Pass B #28:** `הועתק` kongruiert nicht mit `קואורדינטות` (fem. Pl.); die im israelischen UI übliche bezugsfreie Form nennt das Ziel |
| Open in Google Maps / OSM | פתיחה ב-Google Maps / פתיחה ב-OSM | Karten-Popup | Markenname lateinisch, Präposition mit Bindestrich (§3) |
| Open project | מעבר לפרויקט | Karten-Popup-Link | — |
| Explore on the map | לצפייה במפה | Karten-Teaser-Kachel | „לחקור" wäre eine Kalkierung von „explore" (§7) |
| Loading… / Loading map… | טוענים… / טוענים את המפה… | Lazy-Load-Fallbacks | **Pass B #1/#2, verbindlich:** `ב` + Verbalnomen als Zustandsangabe existiert im israelischen UI nicht. Die alte Begründung berief sich auf WP1s `בשליחה…` — genau den String, den `he-glossary.md` §6.1 als Fehlgriff verzeichnet und durch das Partizip Plural `שולחים…` ersetzt hat. `טוענים…` ist das Gegenstück dazu (Styleguide §11.2) |
| Construction stage | שלב הבנייה | Faktenpanel Development-Seite | Glossar hat nur `בבנייה` als Status |
| District / Locality / Area (Nachbarschafts-Tags) | מחוז / יישוב / אזור | Tag-Zeile Development-Seite | drei Ebenen, die im Glossar nicht unterschieden werden |
| Cards / Table (Ansichts-Umschalter) | כרטיסים / טבלה | Einheiten-Ansicht | — |
| Factsheet PDF | דף נתונים PDF | Download-Button Einheit | en/de/pl/ru lassen „Factsheet" englisch; für HE ist das unlesbar |
| Visualisation | הדמיה | Bildunterschrift Galerie | Branchenbegriff für Renderings |
| Similar projects | פרויקטים דומים | Alternativen-Block + SEO-Description | — |
| Last unit available / Only {n} units left | יחידה אחרונה / נותרו רק {n} יחידות | Scarcity-**Badge** | **Pass B #31:** ein Badge ist kein Satz; das Verb trägt nichts und die Zweiwortform passt zum Nachbar-Badge `נמכר`. Die Satzform `נותרה יחידה אחרונה` bleibt als Fließtextvariante gültig |
| Show less | הצגת פחות | Einheiten-Karte | **Pass B #16:** Gegenstück zu `הצגת עוד` (§4, so auch in `ProjectCardSlider`) — das Paar ist regelmäßig nominal gebildet; `הצגה מצומצמת` ist ein anderes Wortbildungsmuster und im israelischen UI unüblich |
| quarter (Fertigstellung) | רבעון | Auto-SEO-Description, `localizeCompletion` | Styleguide §5 nennt das Format `רבעון 3 2027`, das Glossar führt den Begriff nicht |
| Property (Oberbegriff im SEO-Titel, Typ unbekannt) | נכס | `TYPE_LABEL.generic` in `developmentSeo.ts` | Glossar §2 hat `נכס` für „ein Objekt"; hier zusätzlich als Fallback-Typbezeichnung im Title |
| Energy (Kurzlabel auf der Projektkarte) | אנרגיה | Projektkarte (`energyPrefix`) | **Pass B #14:** 12 Zeichen für einen Chip, dessen EN-Vorlage 6 hat. Die Vorlage unterscheidet selbst `Energy` (Karte) von `Energy rating` (Faktenpanel) — genau diese Paarung ist jetzt abgebildet: Chip `אנרגיה A`, Faktenpanel `דירוג אנרגטי` (`factEnergyRating`, glossarkonform) |

---

## Nach Pass B ergänzt (Fix Round 1, 2026-09-13)

| EN | HE | Kontext | Begründung |
|---|---|---|---|
| Ortsnamen aus dem Feed (Städte, Bezirke, Ortsteile) | Umschrift nach `he-glossary.md` §1 | Auto-SEO-Title/Description, Projektkarte, Faktenpanel, „Weitere Projekte in …" | **Pass B #5, der teuerste Befund des Pakets.** Die hebräische Nachfrage lautet `וילות בפאפוס` / `דירות בלימסול` — mit umschriebenem Ort. Ein Snippet mit `ב-Paphos` matcht keine dieser Queries. Die verbindliche Tabelle liegt jetzt als Code in `src/lib/hePlaces.ts` (Glossar §1 + die Schreibvarianten, die die Feeds tatsächlich liefern: `Pafos`, `Lemesos`, `Chlorakas`, `Yeroskipou`, …). **Für §1 nachzutragen:** `Paralimni פראלימני`, `Tsada צאדה`, `Konia קוניה`, `Mesa Chorio מסה חוריו`, `Universal יוניברסל`, `Episkopi אפיסקופי`, `Pyrgos פירגוס`, `Parekklisia פרקליסיה`, `Oroklini אורוקליני`, `Pyla פילה`, `Livadia ליבאדיה`, `Dhekelia דקליה`, `Kouklia קוקליה`, `Neapolis נאפוליס`, `Venus Rock ונוס רוק`, `Famagusta פמגוסטה`, `Ayia Thekla איה תקלה`, `Cape Greco כף גרקו`. Projekt-, Bauträger- und Resortmarken bleiben lateinisch (§4) und stehen bewusst **nicht** in der Tabelle |
| Präposition „in <Ort>" | `בפאפוס` (hebräischer Ort) · `ב-⁨Konia, Paphos⁩` (lateinischer Ort) | Auto-SEO, alle Ortsinterpolationen | **Pass B #5:** das Bindestrich-Kriterium ist der **Schrifttyp des Ortes**, nicht die Locale. Ein gebundenes Präfix nimmt vor hebräischer Schrift keinen Bindestrich; `ב-פאפוס` ist falsch. Implementiert als `heLocative()` in `src/lib/hePlaces.ts` |
| Price from (Caption unter einer Preisfigur) | מחיר התחלתי | Hero der Development-Seite, `ProjectLink`-Karte | **Pass B #3/#4/#25:** `החל מ-` bleibt die Inline-Form, die direkt an der Zahl klebt (`החל מ-€450,000`, Glossar §2). Steht das Label dagegen auf einer **eigenen Zeile** oder durch `&nbsp;` getrennt vor der Zahl, bleibt ein Bindestrich ohne Anschluss stehen — dort gilt das freie Wort. Sold-out-Variante: `נמכר במחיר התחלתי` |
| bedrooms auf Karten-Chips | `סטודיו` · `חדר שינה אחד` · `3 חדרי שינה` · `⁦2-4⁩ חדרי שינה` | Projektkarte (`resolveBedRange()`-Ausgabe) | **Pass B #9, mit Entscheidung gegen die Kurzform.** Die vorgeschlagene Abkürzung `חד' שינה` löst zwar die Chip-Breite, verlässt aber die Glossarform `חדרי שינה` (§2, „Zypern zählt Schlafzimmer") und verdeckt, dass Hebräisch **nicht** zahlinvariant ist. Stattdessen die volle Zählform: die Eins wird ausgeschrieben und nachgestellt, ein Studio bekommt gar kein Einheitswort, eine Spanne behält den einfachen Bindestrich (§3 verbietet den Halbgeviertstrich) in einem LRI-Isolat. Implementiert als `heBedrooms()` in `src/lib/heFeedVocab.ts` |
| unit status (Einheitentabelle / Status-Pill) | זמינה / שמורה / נמכרה | `UnitsView` Status-Spalte und Preis-Spalte | **Pass B #10 + gemeldete Dev-Aufgabe:** Bezug ist `יחידה` (fem.), deshalb die feminine Reihe. `DEVELOPMENT_STRINGS.he.unitStatus.available = זמין` bleibt **maskulin**, weil dieser Eintrag ausschließlich das Hero-Badge über dem **Projekt** trägt. Implementiert als `heFeedLabel()` in `src/lib/heFeedVocab.ts` |
| Objekttypen aus dem Feed | דירה / וילה / בית פרטי / בית טורי / פנטהאוז / דופלקס / בונגלו / סטודיו / מגרש / נכס מסחרי | Projektkarte, Hero-Typ, Faktenpanel, Einheitentabelle | **Pass B systemic #1:** die Feed-Werte kamen roh auf die hebräische Seite („Villa" über `וילה`). Anzeige-Mapping, nur für `he`; die englischen Werte steuern weiterhin Filter und Matching |
| Loading (verbindliche Form) | טוענים… | alle Lazy-Load-Fallbacks | Gegenstück zu §6.1s `שולחים…`; siehe die korrigierte Zeile oben |
| View tour (3D-/Virtual-Tour-Link) | לסיור וירטואלי ↗ | Einheiten-Karte | **Pass B #21:** `סיור` allein liest sich für einen israelischen Käufer wie eine Besichtigung vor Ort — ein Bedeutungsunterschied, kein Stilthema |
| +VAT | `+ מע"מ` | Preisangaben Hero und Einheitentabelle | **Pass B #22:** israelische Preisangaben schreiben `+ מע"מ` getrennt (oder `לא כולל מע"מ`); ohne Leerzeichen liest es sich als ein Wort |
| Min price / Max price (`aria-label` Preisfilter) | מחיר מינימלי / מחיר מקסימלי | Filterleiste | **Pass B #32 — Entscheidung: beibehalten, als dokumentierte Ausnahme.** `he-glossary.md` §6.1 (WP1 Fix Round 1, Should fix #19) hat die **Substantive** `מינימום`/`מקסימום` als überflüssige Fremdwörter verworfen. Hier steht die **Adjektivform**, und `מחיר מינימלי` ist exakt das, was Yad2 im Preisfilter schreibt. Beim Pass-C-Übertrag gehört diese Ausnahme ausdrücklich in §6.1, sonst kippt sie beim nächsten Durchlauf zurück |
