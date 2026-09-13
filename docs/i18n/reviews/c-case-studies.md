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

## Entscheidung E (Beratungssprache)

Genau **eine** Platzierung, wörtlich nach Glossar §5:

- `contacts.he.json` → `contentBlocks[0]` (`contactFullBlock.description`), am Absatzende: `הייעוץ מתקיים באנגלית או ברוסית; פנייה בעברית מתקבלת בברכה.`

Begründung: Der Absatz ist genau der Text, der die Kontaktwege aufzählt („WhatsApp, phone, or email"), also der Kanal, auf den sich die „einmal pro Kanal"-Regel bezieht. In `about-us.he.json` steht der Satz **nicht** — die About-Zeile liefert nur Team, Reviews und Hero-Bild an die gerenderte Seite, und das Seiten-Chrome trägt ihn bereits (WP5, `preview-about/[lang]/copy.ts`). Die Case Studies tragen ihn ebenfalls nicht; dort steht er schon zweimal im Chrome (`formIndexSubtitle`, `formDetailSubtitle`, WP6 M6).

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

| Gate | Ergebnis |
|---|---|
| `node scripts/qa/he-content-check.mjs --only content/he/case-studies` | **85 Verstöße** — alle aus den vier unten beschriebenen Falsch-Positiv-Klassen des Checkers |
| `--only content/he/singlepages/about-us.he.json` | **82 Verstöße** — 71 × „no Hebrew script" auf bewusst unveränderten Werten, 11 × leere Spacer-Spans |
| `--only content/he/singlepages/contacts.he.json` | **32 Verstöße** — alle „no Hebrew script" auf bewusst unveränderten Werten |
| Ersatz-Gate (`mirrorCheck` mit den drei Relaxierungen unten, `styleCheck`/`linkCheck`/`metaCheck` unverändert) | **0 Verstöße**, 601 Strings, 5 Dateien |
| `npm test` | 294/294 grün |
| `grep -c "—\|–\|!"` je Datei | 0 / 0 / 0 / 0 / 0 |
| `node scripts/he-content/seed.mjs --dry-run --only case-studies` | druckt den `CVP_ALLOW_DB_READ=yes`-Hinweis, Exit 0 (kein DB-Zugriff, wie vorgesehen) |
| `metaCheck` (≤ 60 / ≤ 155 Graphem) | in allen fünf Dateien eingehalten (kein einziger Meta-Verstoß in den Läufen oben) |

### Blocker: `mirrorCheck` meldet vier Klassen von Falsch-Positiven — **offen, gehört dem Controller**

Wie bei Task 4 (`c-faq.md`, „Blocker: `mirrorCheck` behandelt `id` als Prosa") darf diese Runde `scripts/he-content/lib.mjs` nicht anfassen (Task 7 arbeitet parallel an derselben Datei, und der Pathspec dieses Commits schließt `scripts/` aus). Die Befunde, in der Reihenfolge ihrer Häufigkeit:

| Klasse | Fälle | Beispiel | Warum der Inhalt richtig ist |
|---|---:|---|---|
| **Leerer Spacer-Span** | 66 | `caseDetails.result[1].children[0].text: he value is empty` | Der EN-Span ist selbst leer (`""`) — Portable-Text-Abstandshalter. `mirrorCheck` prüft `!heValue.trim()` **bevor** es merkt, dass die Quelle leer war. Einen leeren Span mit Text zu füllen, würde das Layout ändern. |
| **Bewusst unveränderter Wert** | 124 | `category: … (he="relocation")`, `mainContent[0].textAlign: (he="left")`, `relatedProjects[0]: (he="palisandro-hills-inex")`, `contentBlocks[0].contacts[0].type: (he="Link")`, `…members[1].description: (he="русский, english")` | Enum-Schlüssel, Layout-Token, EN-Development-Slugs, Personennamen, Sprachlisten und Admin-Blocklabels **müssen** identisch bleiben (Entscheidungen 1, 12, 14, 16). |
| **`href` umgeschrieben** | 7 | `caseDetails.solution[0].markDefs[0].href: must be identical (en="/villas-in-paphos-with-private-pool", he="/he/paphos/villas")` | `href` steht in `IDENTICAL_KEYS`, gleichzeitig verlangt `linkCheck` ein `/he/…`-Ziel — die beiden Regeln schließen einander für jede Seite mit internen Links aus. Task 3 (SiteDocuments) trifft denselben Widerspruch, der Plan schreibt dort „link targets rewritten to `/he/...`". |
| **Pack-Slug fehlt noch** | 2 | `link not on the he allow-list: /he/villas-cyprus`, `/he/relocation-cyprus` | Beide Seiten entstehen in Task 6b (`he-keyword-map.md` §4, Zeilen 10 und 14). Sobald die Dateien liegen, verschwindet die Meldung von selbst — die vier Links auf bereits geschriebene Seiten (`/he/paphos/villas`, `/he/real-estate-cyprus`) sind heute schon grün. **Vor dem Gesamtlauf in Task 9 prüfen.** |

Vorschlag für den Fix in `scripts/he-content/lib.mjs` (drei Zeilen in `mirrorCheck`, keine neue Datei):

1. `if (enValue.trim() === "") return violations;` **vor** der Leer-Prüfung — ein leerer EN-String erlaubt einen leeren HE-String.
2. `if (enValue === heValue) return violations;` — wörtliche Gleichheit ist eine bewusste Entscheidung (Eigenname, Enum, Slug, Layout-Token, Sprachliste), keine vergessene Übersetzung. Das ist die allgemeine Form der Task-4-Lösung („`id` in `IDENTICAL_KEYS`") und deckt alle heute bekannten Fälle ab; das Restrisiko (eine tatsächlich unübersetzte Zeile rutscht durch) trägt Pass B/C, nicht der Checker.
3. `href` aus `IDENTICAL_KEYS` in eine eigene Behandlung: identisch **oder** ein `/he/`-Präfix-Rewrite; `linkCheck` validiert den Wert ohnehin.

Das Ersatz-Gate mit genau diesen drei Relaxierungen läuft über alle fünf Dateien auf **0 Verstöße** durch. Solange der Fix fehlt, schlägt auch der Gesamtlauf in Task 9 Schritt 3 fehl — er betrifft nicht nur diese fünf Dateien, sondern jede Pack-Datei mit EN-Quelle.

## Offene Punkte für Pass C

1. **`3 Month` vs. „within six weeks"** (UK-Investor-Case): Das Faktenpanel nennt drei Monate, der Ergebnisabsatz sechs Wochen. Beides steht so in der englischen Quelle und wurde nicht angeglichen. Redaktionell klären, nicht sprachlich.
2. **„decades of experience" vs. `10 שנות ניסיון`** auf `/he/about-us` (Entscheidung 10). Wenn die 10 Jahre stimmen, sollte auch die EN-Quelle korrigiert werden.
3. **`מבחר נכסים איכותיים`** für „A selection of exclusive properties": `בלעדיים` behauptet Exklusivvermarktung, die die Daten nicht hergeben; `מובחרים` kollidiert mit `מבחר`. Bestätigen oder Alternative nennen.
4. **`ראש תחום אסטרטגיה דיגיטלית וטכנולוגיות ווב`** — 6 Wörter auf einer Personenkarte, deren EN-Vorlage 5 hat. Kürzen (`ראש תחום דיגיטל וטכנולוגיה`) oder so lassen?
5. **`יועצת נדל"ן` für eine einzelne Karte** (Entscheidung 13): Trennung pro Person bestätigen, oder auf eine Form für alle zurückgehen. Die Frage hängt an Glossar §6 („Genus der Beraterzeile").
6. **`סמנכ"ל פיתוח עסקי` für `CBDO`** — Ausschreibung bestätigen; die Karte zeigt bei en/de/pl/ru weiterhin das Akronym.
7. **`כאן נמצא המשרד שלנו`** („Our office is here") über der Karte: knapper wäre `המשרד שלנו`. Der Kontakt-Chrome (WP5) nutzt `המשרד שלנו` bereits als Rubriktitel — mögliche Doppelung auf derselben Seite.
8. **Zwei `title`-Werte in `contacts.he.json`** (Seitentitel und `contactFullBlock.title`) tragen beide `יצירת קשר`, weil sie in der Quelle beide „Contacts" heißen. Falls der Blocktitel gerendert wird, ist eine der beiden Stellen redundant.
9. **`יתרונות`** als `benefitsBlock.title`: unklar, ob Anzeige- oder Admin-Label. Falls Admin, gehört er nach Konvention zurück auf Englisch.
