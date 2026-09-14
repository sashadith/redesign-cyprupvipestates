# c-case-studies — Case Studies ×3 + About- und Kontakt-Zeile (Phase 5, Task 5)

**Stand:** 2026-09-13 · **Pass A + Pass B (inline)** · Review-Status aller fünf Dateien: `"review": "pending"` (Pass C offen, Entscheidung des Controllers vom 2026-09-13).

Quelle: `content/he/source/case-studies/*.en.json` (3) und `content/he/source/singlepages/{about-us,contacts}.en.json`. Struktur (Keys, `_key`s, `marks`/`markDefs`, Bild-Refs, Array-Längen) ist ein Deep Clone der EN-Snapshots; übersetzt wurden ausschließlich lesbare Textfelder.

## Dateien

| Datei | Seite | Strings gesamt | davon hebräisch | Rest |
|---|---|---:|---:|---|
| `content/he/case-studies/how-a-german-family-purchased-a-luxury-villa-in-paphos-for-relocation.he.json` | `/he/case-studies/how-a-german-family-…` | 112 | 43 | 17 leere Spacer-Spans, 52 bewusst unveränderte Werte (Enum, Layout-Token, Projekt-Slugs, `Form Minimal`) |
| `content/he/case-studies/how-a-uk-investor-diversified-wealth-through-property-in-limassol.he.json` | `/he/case-studies/how-a-uk-investor-…` | 119 | 39 | 22 / 58 |
| `content/he/case-studies/relocating-from-the-uk-to-cyprus-finding-the-right-home.he.json` | `/he/case-studies/relocating-from-the-uk-…` | 96 | 34 | 16 / 46 |
| `content/he/singlepages/about-us.he.json` | `/he/about-us` | 214 | 89 | 11 / 114 |
| `content/he/singlepages/contacts.he.json` | `/he/contacts` | 60 | 24 | 0 / 36 |

Summe: **601 Strings, 229 hebräische Strings** in fünf Dateien.

`translationGroupSlugEn` = jeweils der EN-Slug (`…`-Case-Study-Slug, `about-us`, `contacts`); `slug` bleibt lateinisch (Entscheidung A; `src/lib/corporatePageSlugs.ts` erwartet für `he` genau `about-us`/`contacts`). `relatedProjects` sind unverändert die EN-Development-Slugs aus der Quelle. `relatedLandingPages` bleibt in beiden Singlepages `null` wie in der Quelle (sonst meldet `mirrorCheck` eine Presence-Mismatch).

## Was rendert (ergänzt nach Pass B, Task-5-Fix-Runde 1)

Von den **601 Strings der fünf Dateien erreichen rund 60 eine Seite.** Der Rest ist gespeichert, aber tot — wichtig für jeden zukünftigen Lektoratsdurchgang, damit keine Zeit auf unsichtbare Felder geht.

| Datei | Wird gerendert | Gespeichert, nicht gerendert |
|---|---|---|
| `content/he/case-studies/*.he.json` (alle drei) | Alles außer `seo` selbst rendert über `[slug]/page.tsx` (Titel, `excerpt`, `clientOverview`, `caseDetails.*`, `mainContent`, `relatedProjects`) — die Case-Study-Detailseite ist die einzige der fünf Dateien, deren Prosa vollständig lebt. `seo` rendert ebenfalls (`generateMetadata`, Fallback auf `title`/`excerpt`). | Nichts nennenswertes — nur Layout-Token, Enum-Schlüssel und Admin-Blocklabels (siehe „Kept identical" in `task-5-passB.md`). |
| `content/he/singlepages/about-us.he.json` | `contentBlocks[5].members[*]` (Name, Bild-`alt`, `position`, `description`/Sprachen) und `contentBlocks[9].reviews[0..2]` (die ersten drei Kundenstimmen, `page.tsx:137` `reviews.slice(0, 3)`) — via `preview-about/[lang]/data.ts` → `getAboutPageData()`. Hero-Bild, Hero-`alt` und alle Fließtexte kommen stattdessen aus der Konstante `HERO_IMAGE` und aus `preview-about/[lang]/copy.ts`. | `title`, `excerpt`, `seo` (`metaTitle`/`metaDescription` — `generateMetadata` baut ausschließlich aus `copy.ts`), `contentBlocks[0]` (`imageFullBlock`), `contentBlocks[1]–[4]` (die beiden Mission-/Werte-Blöcke, `doubleTextBlock`×3, `buttonBlock`), `contentBlocks[6]–[8]` (Mission-Wiederholung, Werte-Überschrift, `imageBulletsBlock`), `contentBlocks[9].reviews[3..9]` (sieben von zehn Reviews), `contentBlocks[10]` (`benefitsBlock`). |
| `content/he/singlepages/contacts.he.json` | `contentBlocks[1].members[*]` (dieselben Felder wie oben, über `preview-contacts/[lang]/data.ts` → `getContactsPageData()`) und `previewImage` (Hero-Bild/`alt`). | `title`, `excerpt`, `seo`, `contentBlocks[0]` (`contactFullBlock` inkl. der Entscheidung-E-Zeile, s. o.), `contentBlocks[2]` (`locationBlock`, Titel `כאן נמצא המשרד שלנו`). |

Konsequenz: die „Offene Punkte"-Nummern 7 (`כאן נמצא המשרד שלנו`), 8 (zwei `title`-Werte in `contacts.he.json`) und 9 (`יתרונות` Anzeige- oder Admin-Label) sind gegenstandslos — keines der drei Felder erreicht je eine Seite. Sie sind unten aus der Liste entfernt. Umgekehrt ist die Sorge in der alten Nummer 4 (`ראש תחום אסטרטגיה דיגיטלית וטכנולוגיות ווב`) **nicht** gegenstandslos: `position` rendert auf beiden Seiten (About **und** Contacts) und ist mit sechs Wörtern die längste Rollenzeile im Grid.

## Entscheidung E (Beratungssprache)

Genau **eine** Platzierung, wörtlich nach Glossar §5:

- `contacts.he.json` → `contentBlocks[0]` (`contactFullBlock.description`), am Absatzende: `הייעוץ מתקיים באנגלית או ברוסית; פנייה בעברית מתקבלת בברכה.`

Begründung (korrigiert nach Pass B, Task-5-Fix-Runde 1): `/he/contacts` rendert von der Zeile ausschließlich `contentBlocks[1].members[*]` und `previewImage` (`preview-contacts/[lang]/data.ts`) — `contactFullBlock.description` erreicht die Seite **nicht**. Die Platzierung sichert also den **Datensatz** (Admin/Sanity, alter Block-Renderer als Fallback), nicht den gerenderten Kanal. Auf der Seite selbst steht der Satz trotzdem, weil `preview-contacts/[lang]/copy.ts` (`finderLead`) ihn trägt — pro Kanal genau einmal, wie gefordert. In `about-us.he.json` steht der Satz **nicht**; die About-Zeile liefert nur Team, Reviews und Hero-Bild an die gerenderte Seite, und das Seiten-Chrome trägt ihn bereits (`preview-about/[lang]/copy.ts`, `teamLead`). Die Case Studies tragen ihn ebenfalls nicht; dort steht er schon zweimal im Chrome (`formIndexSubtitle`, `formDetailSubtitle`, WP6 M6).

## Terminologie und Entscheidungen

Übernommen aus `he-glossary.md` (verbindlich) und WP5/WP6: `סיפור לקוח`, `וילת יוקרה`, `רילוקיישן`, `רוכשים מחו"ל` (Marktgruppe, nicht Rechtskategorie), `סיור בנכס`, `חתימה אצל עורך הדין`, `תשואה`, `עסקה`, `בית שני`, `מסירת המפתחות`, `ליווי מלא`, `ליווי במעבר`, `תמיכה אחרי הרכישה`, `ערכי הליבה`, `יושרה`, `קיימות`, `בינה מלאכותית`, `בשירות מלא`, `מותג של`, `שפות`, `יועץ`, `המשרד שלנו`, `מדי יום, 9:00 עד 18:00`, `הכל` (nie `הכול`).

| # | Entscheidung | Begründung |
|---|---|---|
| 1 | `category` (`relocation`, `investment`) und `clientOverview.propertyType` (`villa`, `apartment`) bleiben **roh** | Beides sind Schlüssel: `CASE_CATEGORY_LABELS.he` (`homeI18n.ts`) und `PROPERTY_TYPE_LABELS` (`preview-case-studies/[lang]/page.tsx`, `[slug]/page.tsx`) mappen sie zur Anzeige. Eine Übersetzung im Datenfeld würde beide Labels ins Leere laufen lassen. |
| 2 | `clientOverview.location` **wird** umgeschrieben (`Paphos` → `פאפוס`, `Limassol` → `לימסול`) | Der Wert wird roh gerendert (`iso(overview.location)`), Glossar §1 schreibt für `he` die Umschrift vor. |
| 3 | `purchaseTimeline` als Fließzahl (`9 שבועות`, `7 שבועות`, `3 חודשים`), `budget` unverändert (`€1,650,000`) | Ziffern westlich, `€` vor der Zahl (Styleguide §5); die Beträge sind Fakten der Quelle. |
| 4 | Preisspannen mit `בין … ל-…` statt Bis-Strich (`התקציב שלהם נע בין €1,500,000 ל-€1,800,000 בקירוב`) | Styleguide §5 sieht einen Bis-Strich vor, aber `styleCheck` verbietet `–` (en dash) ausnahmslos. Die ausgeschriebene Form folgt dem Öffnungszeiten-Muster aus Glossar §5 (`9:00 עד 18:00`). **Für Pass C / Styleguide:** §5 und der Gate widersprechen sich an dieser Stelle; hier gewinnt der Gate. |
| 5 | „approximately €1.5 million to €1.8 million" → `€1,500,000` / `€1,800,000` | Hebräische Immobilientexte schreiben den vollen Betrag; „מיליון" mit Dezimalstelle (`1.5 מיליון`) ist im Preiskontext unüblich. Kein Faktenzusatz. |
| 6 | Links auf EN-Landingpages sind auf `/he/…` umgeschrieben | `RichText.tsx` rendert `value.href` ungeprefixt, ein `/villas-in-cyprus` auf einer `/he`-Seite landet also im englischen Auftritt. Mapping: `/villas-in-paphos-with-private-pool` → `/he/paphos/villas`, `/villas-in-cyprus-for-emigrating` → `/he/relocation-cyprus`, `/villas-in-cyprus` → `/he/villas-cyprus`, `/properties-in-cyprus` → `/he/real-estate-cyprus`, `/projects` → `/he/projects` (Slugs aus `he-keyword-map.md` §4, Tasks 6a/6b). `/blog/how-to-move-to-cyprus-from-the-uk` bleibt unverändert (Entscheidung C). |
| 7 | „notary appointment" → `החתימה אצל עורך הדין` (About `receive[1]`, Review „Stefan B.") | Styleguide §7 / Glossar §2: Zypern kennt keinen Notar deutscher Prägung. Sachliche Abweichung von der Quelle, bewusst. |
| 8 | „the form on the right" → `הטופס שבעמוד` (Kontakt) | Die hebräische Seite ist RTL; „rechts" wäre schlicht falsch. |
| 9 | „island of sunshine" ersatzlos gestrichen (`בקפריסין`) | WP5 Fix-Runde 1 (Pass B Must #7): keine etablierte hebräische Wendung, liest sich als Übersetzung (§7). |
| 10 | „decades of experience" → `ניסיון רב שנים` statt `עשרות שנות ניסיון` | Der `benefitsBlock` derselben Seite nennt **10** Jahre. Die wörtliche Übersetzung würde auf einer Seite zwei widersprüchliche Angaben zeigen; die unbestimmte Form ist quellentreu genug und erfindet nichts. Quellen-Inkonsistenz, siehe „Offene Punkte". |
| 11 | „your Best Real Estate Partner" → `השותף שלכם לנדל"ן` (ohne Superlativ), alle `!` entfernt | Styleguide §1/§7: kein Werbe-Hebräisch, keine Ausrufezeichen. Betrifft H1, `buttonText` („Contact our team!") und vier Reviews. |
| 12 | Team-Positionen übersetzt, Personennamen lateinisch | Glossar §4. `CEO` → `מנכ"ל`, `CBDO` → `סמנכ"ל פיתוח עסקי` (ausgeschrieben, das Akronym ist im Hebräischen unbekannt), `Quality control` → `בקרת איכות` (nominal, genusfrei), `Digital Strategy & Web Technology Lead` → `ראש תחום אסטרטגיה דיגיטלית וטכנולוגיות ווב` (`ראש תחום` statt `אחראי`, damit die Zeile genusfrei bleibt), `Property consultant` → `יועץ נדל"ן`. |
| 13 | **Ausnahme zu 12:** `Denise Prusko` bekommt `יועצת נדל"ן` | Einzige Frau unter den fünf `Property consultant`-Karten. Glossar §6 hält die maskuline Rollenzeile unter weiblichem Namen ausdrücklich für einen offenen Punkt; wo das Geschlecht aus Name und Foto eindeutig ist und die Karte pro Person gespeichert wird, kostet die korrekte Form nichts. Nominalstil (§11.1) ist bei einer Berufsbezeichnung nicht verfügbar. |
| 14 | `member.description` (`"deutsch, english, русский"`) bleibt **wortgleich** | `preview-contacts/[lang]/languages.ts` mappt genau diese Rohstrings auf Sprachschlüssel und rendert das hebräische Label (`גרמנית` …). Eine Übersetzung im Datenfeld würde jeden Chip auf den Fallback „stored native text, capitalised" werfen. |
| 15 | Bild-`alt` übersetzt, Personen-`alt` bleibt der Name | `alt="Katrin Dith"` ist als Alternativtext eines Porträts korrekt; wo der EN-`alt` eine Rolle beschreibt, steht sie jetzt hebräisch mit lateinischem Namen (`Sascha Dith, מנכ"ל Cyprus VIP Estates`). |
| 16 | Admin-Blocklabels bleiben englisch (`Image Full Block`, `About main Block`, `Button`, `Form Minimal`) | Projektkonvention „Admin-facing copy: English"; diese Werte erscheinen nur im BlockEditor. Anzeigetitel (`Our Team`, `What our customers say?`, `Core Values`, `Our office is here`, `Contacts`) sind übersetzt. |
| 17 | Reviews wörtlich übersetzt, Namen unverändert, Larnaka bleibt stehen | Drei Kundenstimmen nennen Larnaka. Die Regel „Larnaka nicht bewerben" (Styleguide §8) gilt für Marketingtexte, nicht für ein Zitat über einen tatsächlichen Kauf. Verben in 1. Person Vergangenheit sind genusfrei (§11.2); nur `ממליץ בחום` (Stefan B.) und `הייתי יכול` stehen maskulin, passend zum Namen. |
| 18 | Case-Study-Überschriften ohne Doppelpunkt | „Relocating from the UK to Cyprus: Finding the Right Home" → `כך מצאה משפחה מבריטניה את הבית הנכון בקפריסין` (Styleguide §3, keine Doppelpunkt-Titel). |

## Pass B (inline) — was geändert wurde

16 Stellen, alle sprachlich, keine Faktenänderung:

1. `title` CS1: `לקראת המעבר` → `לקראת רילוקיישן` (bezugslos „der Umzug"; `רילוקיישן` ist zugleich Kategorie und Suchbegriff).
2. CS1 `mainContent`: `למי ששוקל נדל"ן יוקרה` → `למי ששוקל לרכוש נדל"ן יוקרה` (ein Verb fehlte).
3./4. CS1: zweimal `הם` → `בני המשפחה` (Numerus-Sprung nach `המשפחה חיפשה`).
5. CS1: `מרוויחים … מהתמקדות` → `משתלם … להתמקד` (Kalkierung von „benefit from").
6. CS2 `excerpt`: `לפזר … דרך נדל"ן` → `באמצעות נדל"ן`.
7. CS2 `result[0]`: Satzstellung, `וכך פיזר המשקיע …`.
8. CS2: `כמה שווה לבחור מיקום` → `עד כמה חשובה בחירת המיקום` (umgangssprachliches `שווה`).
9. CS3: `בסוף בחרה` → `בסופו של תהליך בחרה`.
10. CS3: `ממוקמת נסיעה קצרה` → `ממוקמת במרחק נסיעה קצרה` (fehlende Präposition).
11. About: `היכרות עם השוק ועם ההיבטים המשפטיים` → `מומחיות בשוק ובהיבטים המשפטיים` (dritte Wiederholung von `היכרות` auf derselben Seite, §11.5).
12. About: `עשרות שנות ניסיון` → `ניסיון רב שנים` (Widerspruch zu „10 Jahre", siehe Entscheidung 10).
13. About: `איש הקשר האחד שלכם` → `איש הקשר היחיד שלכם`.
14. About: `לשקיפות ולייעול מרביים` → `כדי שהתהליך יהיה שקוף ויעיל ככל האפשר` (Nominalstapel).
15. About: `מבחר נכסים מובחרים` → `מבחר נכסים איכותיים` (Wurzelwiederholung ב.ח.ר, §11.5).
16. About, Review „Andreas W.": Wortstellung `מכמה מהר ופשוט הכל עבר` → `מכמה שהכל עבר מהר ופשוט`.

## Gates

Stand nach Task-5-Fix-Runde 1 (Pass B umgesetzt). Die alten Zahlen unten (85/82/32 Verstöße) waren ein veralteter Zwischenstand aus der Zeit vor dem `mirrorCheck`-Fix von Task 7 — korrigiert:

| Gate | Ergebnis |
|---|---|
| `node scripts/qa/he-content-check.mjs --only content/he/case-studies --only content/he/singlepages` | **OK — 0 Verstöße, 22 files, 1593 strings**. `styleCheck` 0, `metaCheck` 0, `mirrorCheck` 0, `linkCheck` 0. `keptIdentical` je Datei: CS1 7, CS2 7, CS3 7, `about-us.he.json` 71, `contacts.he.json` 32 — alle 124 berechtigt (siehe „Kept identical" in `task-5-passB.md`). |
| `npm test` | 298/298 grün |
| `npx tsc --noEmit -p tsconfig.json` | sauber |
| `node --import tsx scripts/qa/copy-snapshot.mjs --check` | clean (3381 leaves match) |
| `grep -c "—\|–\|!"` je Datei | 0 / 0 / 0 / 0 / 0 |
| `grep -c "ברמה גבוהה"` über die drei Case Studies | 0 (Pass B Must #1 hat alle acht Vorkommen in CS1 aufgelöst) |
| `metaCheck` (≤ 60 / ≤ 155 Graphem) | in allen fünf Dateien eingehalten |

### Blocker `mirrorCheck` — durch Task 7 erledigt

Der frühere Abschnitt „Blocker: `mirrorCheck` meldet vier Klassen von Falsch-Positiven" ist obsolet. `scripts/he-content/lib.mjs` enthält alle drei damals vorgeschlagenen Relaxierungen (leerer EN-String erlaubt leeren HE-String; wörtliche Gleichheit zählt als `stats.keptIdentical` statt als Verstoß; `href`/Link-Keys sind über `isLinkKey()` von der Identitätsprüfung ausgenommen). Kein offener Blocker mehr — der Gate-Lauf oben ist der reale, nicht ein Ersatz-Gate.

## Offene Punkte für Pass C

Punkte 7–9 der Vorrunde (`כאן נמצא המשרד שלנו`, die zwei `title`-Werte in `contacts.he.json`, `יתרונות` als Admin-/Anzeigelabel) sind nach dem „Was rendert“-Abschnitt oben **gegenstandslos** und aus der Liste entfernt — keines der drei Felder erreicht eine Seite.

1. **`3 Month` vs. „within six weeks“** (UK-Investor-Case): Das Faktenpanel nennt drei Monate, der Ergebnisabsatz sechs Wochen. Beides steht so in der englischen Quelle und wurde nicht angeglichen. Redaktionell klären, nicht sprachlich (Pass B, „Source contradictions“ — bestätigt, kein Sprachfehler).
2. **„decades of experience“ vs. `10 שנות ניסיון`** auf `/he/about-us` (Entscheidung 10). Wenn die 10 Jahre stimmen, sollte auch die EN-Quelle korrigiert werden. Pass B bestätigt: die hebräische unbestimmte Form (`ניסיון רב שנים`) ist mit 10 Jahren vereinbar und erfindet nichts — besser gelöst als die parallele Stelle in CS2. Bleibt ein EN-Quellenproblem, kein `he`-Problem.
3. **`מבחר נכסים איכותיים`** für „A selection of exclusive properties“: `בלעדיים` behauptet Exklusivvermarktung, die die Daten nicht hergeben; `מובחרים` kollidiert mit `מבחר`. Bestätigen oder Alternative nennen.
4. **`ראש תחום אסטרטגיה דיגיטלית וטכנולוגיות ווב`** — 6 Wörter auf einer Personenkarte, deren EN-Vorlage 5 hat. **Nicht gegenstandslos:** `position` rendert auf beiden Seiten (`/he/about-us` **und** `/he/contacts`) und ist mit sechs Wörtern die längste Rollenzeile im Grid. Kürzen (`ראש תחום דיגיטל וטכנולוגיה`) empfohlen.
5. **`יועצת נדל"ן` für eine einzelne Karte** (Entscheidung 13): Trennung pro Person bestätigen, oder auf eine Form für alle zurückgehen. Die Frage hängt an Glossar §6 („Genus der Beraterzeile“).
6. **`סמנכ"ל פיתוח עסקי` für `CBDO`** — Ausschreibung bestätigen; die Karte zeigt bei en/de/pl/ru weiterhin das Akronym.

**In Task-5-Fix-Runde 1 gefunden und bereits behoben** (nicht mehr offen, hier nur zur Nachvollziehbarkeit dokumentiert):

- **„Offices in Paphos and Limassol“ vs. ein Büro:** `contacts.he.json` `seo.metaDescription` behauptete gespiegelt zwei Büros (`משרדים בפאפוס ובלימסול`), während das gerenderte Kontakt-Chrome (`preview-contacts/[lang]/copy.ts`, `officeTitle`) und die tatsächliche Adresse nur ein Büro in Paphos kennen. Feld ist zwar tot (siehe „Was rendert“), aber jetzt auf `המשרד שלנו נמצא בפאפוס` korrigiert — keine Behauptung mehr über das EN-Chrome hinaus.
- **Drei §11.6-Divergenzen zum About-Chrome** (Pass B M6, S13): `about-us.he.json` `contentBlocks[10].benefits[0]` (`וילות ברמה גבוהה` / `פרויקטים בנדל"ן`) und `contentBlocks[6].content[2]`/`content[4]` (zwei Mission-/Stance-Sätze) wichen von der wortgleichen Fassung im gerenderten Chrome (`preview-about/[lang]/copy.ts`, `stats[0]`, `stanceBody[1]`/`[2]`) ab. Alle drei jetzt wortgleich mit dem Chrome übernommen.
- **`/he/about-us` rendert die Sprachlisten ungemappt** (Pass B Systemic S-1): `preview-about/[lang]/page.tsx` zeigte `m.languages.join(" · ")` roh (`deutsch · english · русский`) statt wie `/he/contacts` durch `toLanguageKey()`/`languageLabel()` zu mappen. Für `lang === "he"` jetzt behoben (`page.tsx` importiert dieselben Helfer aus `preview-contacts/[lang]/languages.ts`); en/de/pl/ru unverändert, `copy-snapshot --check` bleibt clean.
