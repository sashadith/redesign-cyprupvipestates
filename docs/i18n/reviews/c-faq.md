# Review-Protokoll `c-faq` — FAQ-Inhalte `he` (Phase 5a, Task 4)

**Stand:** 2026-09-13 · **Status:** Pass A + Pass B (inline) + **Fix-Runde 1 nach Pass B (extern)** erledigt, Pass C (muttersprachlicher Lektor) offen · **Quelle:** `scripts/faq-translations/en.json`

## Dateien und Seiten

| Datei | Seite (`he`) | Umfang |
|---|---|---|
| `scripts/faq-translations/he.json` | `/he/faq` | 9 Kategorien (Label + Description), 60 Fragen, 244 Antwortabsätze, **322 geprüfte Strings** (9 + 9 + 60 + 244; die in Pass A und im Kritikbericht genannten 205 / 283 / 382 waren Zählfehler, nachgerechnet in Fix-Runde 1) |
| `scripts/seed-faq-translations.mjs` | — | `he` in die Sprachliste aufgenommen, Zwei-Schlüssel-Guard ergänzt |
| `src/app/preview-faq/[lang]/page.tsx` | alle Locales | JSON-LD `inLanguage` ergänzt |

Die 60 Q&A liegen nicht in `copy.ts` (das ist das Seiten-Chrome aus WP5), sondern im `faqPage`-SiteDocument. Damit ist das Ticket „`/he/faq` rendert 404" aus `wp5.md` „Offene Punkte" Nr. 1 inhaltlich abgearbeitet; sichtbar wird es erst nach dem Seed auf Staging.

**Struktur 1:1 gespiegelt:** gleiche Kategorie-Reihenfolge, gleiche `slug`s, gleiche Item-`id`s in gleicher Reihenfolge, gleiche Absatzzahl pro Antwort. Die Datei wird generativ aus `en.json` aufgebaut, sodass eine Drift strukturell ausgeschlossen ist; `buildForLang()` im Seeder prüft dasselbe noch einmal zur Laufzeit.

| Kategorie (`slug`) | Label `he` | Fragen |
|---|---|---|
| `foreigner` | רכישה בידי זרים | 3 |
| `process` | תהליך הרכישה | 8 |
| `legal` | מסמכים וליווי משפטי | 3 |
| `costs` | עלויות, מסים ומע"מ | 10 |
| `investment` | השקעה ותשואה משכירות | 7 |
| `residency` | תושבות ורילוקיישן | 7 |
| `location` | איפה כדאי לקנות | 3 |
| `financing` | מימון ומשכנתאות | 9 |
| `offplan` | רכישה על הנייר ופרויקטים חדשים | 10 |

## Kein `"review": "pending"` in der Datei

Global Constraint „jede Content-Datei trägt `review`-Metadaten" ist hier **nicht umsetzbar**: `buildForLang()` in `scripts/seed-faq-translations.mjs` baut jede Zeile strikt aus `EN_CATEGORIES` neu auf und übernimmt nur `label`, `description`, `question`, `answer` — ein zusätzliches Feld würde stillschweigend verworfen (und `mirrorCheck` würde es als „extra key" melden). Der Review-Status steht deshalb hier im Protokoll und als Kommentar im Kopf des Seeders. **Pass C offen.**

## Terminologie (Glossar-Bindung)

| EN | HE | Quelle |
|---|---|---|
| lawyer | עורך דין | Glossar §2 |
| Land Registry | רשם המקרקעין | Glossar §2 |
| contract of sale / purchase contract | חוזה מכר | Glossar §2 |
| transfer fees (Grundbuch) | דמי העברה | Glossar §2 — **nicht** `מס העברה` (das wäre eine Steuer, die Quelle sagt „fees") |
| transfer fees (Bank, Auslandsüberweisung) | עמלות ההעברה | Glossar §2, in Fix-Runde 1 aufgenommen — bewusste Abgrenzung zu `דמי העברה`; beides heißt im EN „transfer fees", meint aber zwei verschiedene Kosten |
| stamp duty | מס בולים | Glossar §2 |
| VAT | מע"מ | Glossar §2 |
| capital gains | מס רווחי הון / רווח הון | Glossar §2, §3.1 |
| off-plan | על הנייר | Glossar §2 |
| resale | יד שנייה | Glossar §2 |
| new development | פרויקט חדש | Glossar §2 |
| developer | יזם / יזמים | Glossar §2 (nie `חברות בנייה`, nie `קבלן`) |
| rental yield | תשואה משכירות | Glossar §2 |
| permanent residency | תושבות קבע | Glossar §3 |
| relocation | רילוקיישן | Glossar §3 |
| buyers | רוכשים | Glossar §3 |
| expats | תושבים זרים | Glossar §3 |
| cost of living | יוקר המחיה | Glossar §3 |
| visualisation / rendering | הדמיה | Glossar §2 |
| Paphos / Limassol | פאפוס / לימסול | Glossar §1 |

Neu vergeben, weil das Glossar den Term nicht führt (Vorschlag zur Aufnahme, siehe „Offene Fragen"):

| EN | HE | Begründung |
|---|---|---|
| reservation agreement | הסכם שמירת נכס | beschreibt die Funktion. **Bewusst nicht `זיכרון דברים`** — das ist in Israel ein eigenständig bindender Vorvertrag und würde die Rechtslage falsch darstellen |
| reservation deposit | דמי רצינות | Glossar §2 führt `דמי רצינות / פיקדון הרשמה`; hier durchgehend die erste Form |
| due diligence | בדיקת נאותות | israelischer Standardterm; im Prozess-Schritt einmal als Klammerglosse hinter `בדיקות משפטיות` |
| Council of Ministers | מועצת השרים | zyprisches Organ, keine amtliche hebräische Bezeichnung |
| power of attorney | ייפוי כוח | |
| down payment (Hypothek) | הון עצמי | israelischer Standardterm |
| occupancy | תפוסה | |
| immovable property tax (abgeschafft) | מס רכוש ארצי | nur in der Aussage „wurde abgeschafft", nie als laufende Kostenposition |
| municipal charges | אגרות עירוניות | |
| specifications | מפרט טכני | |

## Pass B (inline, Selbstkritik) — was korrigiert wurde

1. **Wurzel- und Floskelwiederholung** (§11.5): `בדרך כלל` stand 3× in einer Antwort (`can-foreigners-buy-property-in-cyprus`) und 2× in `how-does-the-property-buying-process-work-in-cyprus` → auf `בדרך כלל` / `לרוב` / `ברוב המקרים` verteilt; `לרוב` 2× in `which-city-in-cyprus-is-best-for-buying-property` → Schlusssatz auf `עדיף לשאול` umgestellt; `לעיתים` 2× in `why-do-investors-buy-off-plan-properties-in-cyprus` → `לא פעם`; `להניח … הנחות` in `what-guarantees-do-developers-usually-provide` → `לא להסתפק בהשערות בדיעבד`.
2. **`במידה ניכרת`** stand 7× (die Quelle sagt 7× „significantly"/„considerably"). Drei Stellen auf `מקטינים מאוד` / `מגדילה מאוד` / `לשנות מאוד` umgestellt, damit die Formel nicht zur Masche wird. *(Fix-Runde 1: `מקטינים מאוד` → `יכולים להקטין מאוד`, E2; `מגדילה מאוד` → `עלולה להגדיל מאוד`, S23 — die Verteilung bleibt, die Modalität kommt zurück.)*
3. **`את`-Ketten** in Aufzählungsabsätzen (fünf Akkusativpartikel hintereinander lesen sich wie ein Formular): in `are-fixed-rate-mortgages-available`, `should-buyers-pay-in-euros-or-transfer-from-another-currency`, `are-off-plan-properties-cheaper-than-completed-homes` und `can-buying-property-help-obtain-residency-in-cyprus` auf ein einleitendes `את` reduziert; umgekehrt in `what-happens-if-construction-is-delayed` die `מה…`-Kette (`מהו … מהם … מהן …`) zu einer `את`-Reihe geglättet. *(Fix-Runde 1: die Regel war in zwei Items nicht angewandt — `what-is-a-reservation-agreement` answer[2] und `what-happens-if-construction-is-delayed` answer[3] standen weiter auf vier `את`. Nachgezogen mit S11/S45; gilt jetzt ausnahmslos.)*
4. **Glossar-Nuance `צפייה` vs. `סיור`** (§2): Die Fernbesichtigung heißt jetzt `צפייה מקוונת בנכס או סיור וידאו`. Das Glossar warnt vor `צפייה בנכס` als Ersatz für die Vor-Ort-Besichtigung — hier ist das Anschauen am Bildschirm *genau* gemeint, die Warnung greift also nicht. `סרטוני וידאו` (Pass A) war zu wörtlich.
5. **Fehlendes Subjekt** in `does-buying-property-automatically-grant-permanent-residency` (`ייתכן שיידרשו…` ohne Bezug) → `ייתכן שהמבקשים יידרשו…`.
6. **`הכול`-Gate-Treffer:** Die Regel `hakol-spelling` prüft ohne Wortgrenze und schlägt deshalb auch bei `הכולל`/`הכוללת` an (6 Treffer). Alle sechs Stellen sind sachlich umformuliert (`סך עלות הרכישה`, `תקציב הרכישה כולו`, `סך הערך לטווח ארוך`), nicht nur umgangen — die Kurzformen lesen sich ohnehin besser.
7. **§7-Verbotsliste** geprüft: keine Werbeverben (`גלו`, `שחררו`), keine Adjektivstapel, keine Doppelpunkt-Überschriften, kein `בין אם … ובין אם`, keine `אל תהססו`-Höflichkeit, keine Ausrufezeichen. `grep -c "—\|–\|!"` = 0.
8. **Genus:** durchgehend unpersönlich/nominal (`כדאי ל…`, `יש ל…`, `אפשר ל…`) oder Partizip Plural (`רוכשים בוחנים`, `הבנקים בודקים`). Zweite Person nur als männlicher Plural in zwei Kategorie-Descriptions (`עבורכם`, `שלכם`). Keine Schrägstrichformen.

## Fix-Runde 1 (Pass B extern) — `task-4-passB.md`

**Stand:** 2026-09-13 · **Quelle der Kritik:** `.superpowers/sdd/2026-09-13-hebrew-phase5-content/task-4-passB.md` (Note B−, 12 „Must fix", 49 „Should fix") · **Angewandt:** alle 61 Zeilen, ohne Ausnahme, plus 11 abgeleitete Modalitäts-Korrekturen (E1–E11, siehe unten).

Spalte `Korrektur HE` = der Wortlaut, der jetzt in `scripts/faq-translations/he.json` steht. Die alte Fassung steht in der Spalte „Aktuell HE" des Kritikberichts und im Git-Diff dieses Commits.

| # | Item / Feld | Klasse | Korrektur HE |
|---|---|---|---|
| M1 | `foreigner` / `can-foreigners-buy-property-in-cyprus` — answer[0] | Modalität/§8 | כן. זרים יכולים לקנות נכס בקפריסין, והמדינה נשארת אחד היעדים הנגישים יותר באירופה לרוכשים מחו"ל. אזרחי מדינות האיחוד האירופי נתקלים לרוב בפחות מגבלות ברכישה, ואילו רוכשים מחוץ לאיחוד עשויים להידרש לאישור ממועצת השרים. בפועל, האישור הזה מטופל לא פעם כחלק מההליך המשפטי, ובדרך כלל אינו עוצר את התקדמות העסקה. |
| M2 | `foreigner` / `can-i-buy-property-in-cyprus-remotely` — answer[4] | Modalität/§8 | רכישה מרחוק עשויה לחסוך זמן, אבל אין לוותר על בדיקת נאותות. |
| M3 | `costs` / `what-vat-rates-apply-to-property-purchases-in-cyprus` — answer[2] | Modalität/§8, Terminologie | בתנאים מסוימים עשוי לחול שיעור מופחת, ובמקרים אחרים השיעור הרגיל. |
| M4 | `costs` / `can-reduced-vat-apply-when-buying-property` — answer[0] | Modalität/§8 | בנסיבות מסוימות עשוי לחול מע"מ מופחת, בעיקר כאשר הנכס משמש למגורים עיקריים ולא כנכס להשקעה בלבד. |
| M5 | `costs` / `can-reduced-vat-apply-when-buying-property` — answer[3] | Modalität/§8 | מע"מ מופחת יכול להוריד מאוד את עלות הרכישה, ולכן מי ששוקל רילוקיישן בוחן את הכללים האלה בקפידה. |
| M6 | `investment` / `what-rental-yields-can-investors-expect-in-cyprus` — answer[1] | Modalität/§8 | נכסים שמיועדים לשוק התיירות עשויים להניב תשואה עונתית גבוהה יותר, אם כי התפוסה משתנה לאורך השנה. השכרה לטווח ארוך יציבה יותר, אבל התשואה בשיא העונה עלולה להיות נמוכה יותר. |
| M7 | `investment` / `is-short-term-rental-more-profitable-than-long-term-rental` — answer[0] | Modalität/§8, Wiederholung §11.5 | השכרה לטווח קצר עשויה להניב הכנסה גדולה יותר בתקופות של תפוסה גבוהה, בעיקר באזורי תיירות. |
| M8 | `offplan` / `is-buying-off-plan-property-risky` — answer[2] | Modalität/§8, Wiederholung §11.5, Listenkonvention | הסיכון אינו בהכרח סיבה להימנע מפרויקטים חדשים. הוא מדגיש עד כמה חשובות הבדיקות המשפטיות, ההיכרות עם היזם והציפיות הריאליות. |
| M9 | `offplan` / `are-new-developments-safer-investments-than-resale-propertie` — answer[1] | Modalität/§8 | לפרויקטים חדשים יש לא פעם יתרונות כמו תקנים מודרניים, אחריות ותשתיות חדשות. לנכסי יד שנייה יש לעיתים היסטוריית השכרה קיימת, אפשרות לכניסה מיידית ונתוני שוק ברורים יותר. |
| M10 | `investment` / `what-rental-yields-can-investors-expect-in-cyprus` — question | Grammatik, SEO | לאיזו תשואה משכירות אפשר לצפות בקפריסין? |
| M11 | `costs` / `how-much-extra-money-should-buyers-budget-beyond-the-propert` — answer[2] | Listenkonvention | אם חל מע"מ, אם נדרש מימון, מידת המורכבות המשפטית, שווי הנכס, ההסכמים מול היזם והשימוש המתוכנן (השקעה או מגורים). |
| M12 | `financing` / `can-foreigners-get-a-mortgage-in-cyprus` — answer[0] | Modalität/§8, Terminologie | כן. רוכשים זרים עשויים לקבל משכנתא בקפריסין, אם כי תנאי האישור משתנים לפי אזרחות, מעמד תושבות, הכנסה ודרישות הבנק. |
| S1 | `foreigner` — label | Naturalness §3 | רכישה בידי זרים |
| S2 | `foreigner` — description | Naturalness §3 | זכאות של רוכשים מהאיחוד האירופי, מחוצה לו ומרחוק. |
| S3 | `foreigner` / `can-i-buy-property-in-cyprus-remotely` — answer[2] | Terminologie | צפייה מקוונת בנכס או סיור וידאו, תקשורת דיגיטלית עם סוכני נדל"ן ועם עורכי דין, בדיקת חוזים באימייל, העברות בנקאיות לתשלומים בשלבים וייצוג בהליכים המשפטיים. |
| S4 | `foreigner` / `can-i-buy-property-in-cyprus-remotely` — answer[3] | Grammatik | גם כשקונים מרחוק, בדיקה משפטית עצמאית נשארת חשובה. לפני התחייבות יש לוודא שכל ההיתרים הנדרשים קיימים, לבדוק את מצב הבעלות ולהבין את לוח התשלומים. |
| S5 | `foreigner` / `can-non-eu-citizens-buy-property-in-cyprus` — answer[2] | Modalität/§8 | רוכשים שאינם אזרחי האיחוד קונים נכס לא פעם לצרכים האלה: |
| S6 | `process` / `how-does-the-property-buying-process-work-in-cyprus` — answer[1] | Listenkonvention | שלב 1: בחירת הנכס. הרוכשים משווים פרויקטים, מיקומים, יזמים ופוטנציאל השקעה לפני שהם בוחרים נכס. שלב 2: הסכם שמירת נכס. אפשר לחתום על הסכם שמירה כדי להוריד את הנכס מהשוק באופן זמני. שלב 3: בדיקות משפטיות (בדיקת נאותות). עורכי הדין בודקים מסמכי בעלות, היתרים, חובות, שעבודים ואישורי הפרויקט. שלב 4: הכנת החוזה וחתימה. חוזה המכר מוכן ונחתם בידי שני הצדדים. שלב 5: רישום החוזה. החוזה מופקד לרוב אצל הרשויות כדי להבטיח את זכויות הרוכש. שלב 6: השלמת התשלומים והליכי ההעברה. יתרת התשלומים משולמת לפי לוח הזמנים שסוכם. |
| S7 | `process` / `how-does-the-property-buying-process-work-in-cyprus` — question | SEO | איך קונים נכס בקפריסין, שלב אחר שלב? |
| S8 | `process` / `how-long-does-buying-property-in-cyprus-take` — answer[1] | Modalität/§8 | עסקה פשוטה עשויה להסתיים בתוך כמה שבועות, ואילו עסקאות מורכבות יותר, שכוללות משכנתא, רכישה על הנייר או אישורים נוספים, נמשכות לא פעם זמן רב יותר. |
| S9 | `process` / `how-long-does-buying-property-in-cyprus-take` — answer[4] | Modalität/§8 | מי שקונה נכס להשקעה שם לרוב דגש על מהירות, ומי שעובר לגור בקפריסין נוטה להקדיש יותר זמן לבדיקת נאותות. |
| S10 | `process` / `is-visiting-cyprus-necessary-before-purchase` — answer[0] | Modalität/§8, Grammatik | לא תמיד, אבל ביקור יכול לתת תמונה טובה על המיקומים, על התשתיות, על השכונות ועל אורח החיים. |
| S11 | `process` / `what-is-a-reservation-agreement` — answer[2] | Wiederholung §11.5 | את סכום השמירה, משך התקופה, התנאים וכללי ההחזר. |
| S12 | `process` / `what-happens-after-signing-the-contract` — answer[2] | Wiederholung §11.5 | לוחות תשלומים, הליכי העברה, סגירת המשכנתא ורישום הבעלות הסופי. |
| S13 | `process` / `what-mistakes-do-foreign-buyers-make-when-purchasing-propert` — question | Modalität/§8, SEO | אילו טעויות עושים רוכשים זרים בקניית נכס בקפריסין? |
| S14 | `legal` / `do-i-need-a-lawyer-when-buying-property-in-cyprus` — answer[0] | Grammatik | ייצוג משפטי עצמאי מומלץ מאוד ונחשב לאחת ההגנות החשובות ביותר בתהליך הרכישה. |
| S15 | `legal` / `what-does-a-lawyer-check-during-the-purchase-process` — answer[1] | Grammatik | שהמוכר אכן הבעלים החוקי של הנכס, אם קיימות הלוואות או שעבודים, היתרי בנייה, אישורי תכנון, דיוק החוזה ודרישות הרישום. |
| S16 | `costs` / `what-additional-costs-should-i-expect-besides-the-property-p` — answer[2] | Modalität/§8 | שכר טרחת עורך דין. עורכי דין עצמאיים גובים בדרך כלל תשלום עבור בדיקת החוזה, אימות הבעלות וליווי העסקה. מס בולים. אגרה ממשלתית שמחושבת לפי שווי הנכס. מע"מ. חלק מהפרויקטים החדשים כוללים מס ערך מוסף, ובנכסי יד שנייה הוא לא תמיד חל. דמי העברה. חלים במקרים מסוימים, בהתאם לשאלה אם כבר שולם מע"מ על הנכס. ביטוח נכס. רלוונטי במיוחד לנכסים שנרכשים במימון. עלויות בנק והמרת מטבע. העברות בינלאומיות עלולות לייצר הוצאות לא צפויות. |
| S17 | `costs` / `what-additional-costs-should-i-expect-besides-the-property-p` — answer[3] | Wiederholung §11.5 | חשוב להכיר את סך עלות הרכישה, בעיקר כשמשווים תשואה משכירות חזויה או רווח לטווח ארוך. |
| S18 | `costs` / `is-vat-included-when-buying-property-in-cyprus` — answer[2] | Modalität/§8 | כללי המע"מ משתנים והזכאות תלויה בנסיבות האישיות, ולכן תמיד יש לוודא מה הדרישות התקפות לפני סגירת העסקה. |
| S19 | `costs` / `how-much-extra-money-should-buyers-budget-beyond-the-propert` — answer[4] | Naturalness §3 | בחינה של מחיר הרכישה בלבד עלולה ליצור ציפיות לא ריאליות לגבי הרווחיות. |
| S20 | `costs` / `are-resale-properties-taxed-differently-from-new-development` — question | Naturalness §3 | האם יש הבדל במיסוי בין נכסי יד שנייה לפרויקטים חדשים? |
| S21 | `costs` / `are-resale-properties-taxed-differently-from-new-development` — answer[4] | Terminologie | כשמשווים רכישה על הנייר לנכס יד שנייה, כדאי לבחון את סך עלות הבעלות ולא רק את המחירים המפורסמים. |
| S22 | `costs` / `what-are-transfer-fees-when-buying-property` — answer[1] | Modalität/§8, Terminologie | השאלה אם דמי ההעברה חלים, ואיך הם מחושבים, תלויה בכמה גורמים, ובהם אופן החלת המע"מ על הנכס בעבר והרגולציה התקפה. |
| S23 | `costs` / `how-much-are-legal-fees-when-buying-property-in-cyprus` — answer[4] | Wiederholung §11.5 | יש מי שמנסה לצמצם את ההוצאה על עורך דין, אבל בדיקה חלקית עלולה להגדיל מאוד את הסיכון. |
| S24 | `investment` / `is-cyprus-good-for-property-investment` — answer[0] | Modalität/§8 | קפריסין ממשיכה למשוך משקיעי נדל"ן בזכות התיירות, הביקוש לרילוקיישן, האקלים הנוח והעניין הגובר של רוכשים מחו"ל. בין אסטרטגיות ההשקעה הנפוצות: השכרה לטווח ארוך, השכרת נופש, מכירה לאחר סיום הבנייה ודירות שמניבות הכנסה. |
| S25 | `investment` / `what-is-considered-a-good-rental-yield` — question | Modalität/§8, SEO | איזו תשואה משכירות נחשבת טובה? |
| S26 | `investment` / `is-short-term-rental-more-profitable-than-long-term-rental` — answer[3] | Modalität/§8 | השכרה לטווח ארוך מספקת לרוב תפוסה צפויה יותר. |
| S27 | `residency` / `what-residency-options-exist-for-foreigners-moving-to-cyprus` — question | SEO | אילו מסלולי תושבות קיימים למי שעושה רילוקיישן לקפריסין? |
| S28 | `residency` / `is-cyprus-a-good-place-for-retirement` — answer[1] | Naturalness §3 | חורף מתון, אורח חיים ים תיכוני, קהילות בינלאומיות, בילוי בחוץ, זמינות שירותי בריאות וקצב חיים רגוע יותר מזה של ערים אירופיות גדולות. |
| S29 | `residency` / `does-buying-property-automatically-grant-permanent-residency` — answer[4] | Modalität/§8 | ההנחה שהבעלות לבדה מבטיחה תושבות עלולה ליצור ציפיות לא ריאליות. |
| S30 | `location` / `which-city-in-cyprus-is-best-for-buying-property` — answer[1] | Naturalness §3 | מי שקונה בעיקר לשם הכנסה משכירות בוחן מיקומים אחרת ממשפחה שעוברת לגור בקפריסין. גם רוכשים לקראת פרישה מתמקדים לרוב באקלים, בגישה למערכת הבריאות ובקצב החיים, ולא רק בעליית ערך. |
| S31 | `location` / `which-city-in-cyprus-is-best-for-buying-property` — answer[4] | Naturalness §3 | השאלה הנכונה היא לא "איזו עיר הכי טובה" אלא "איזו עיר מתאימה למטרות שלי". |
| S32 | `location` / `how-should-buyers-choose-the-right-location-in-cyprus` — answer[2] | Terminologie | האם הנכס מיועד להשקעה או לשימוש אישי? האם הוא ישמש להשכרה? האם מתוכנן מעבר קבע? עד כמה בתי ספר חשובים? האם פרישה היא המניע העיקרי? עד כמה חשובה הגישה לשדות התעופה ולשירותי הבריאות? |
| S33 | `financing` — description | Terminologie | לקיחת משכנתא כרוכשים זרים, מההון העצמי ועד האישור. |
| S34 | `financing` / `can-foreigners-get-a-mortgage-in-cyprus` — answer[1] | Modalität/§8 | הבנקים בודקים בדרך כלל את היציבות הכלכלית לפני אישור המימון. הקריטריונים עשויים להשתנות בין רכישת בית נופש, נכס להשקעה ובית מגורים קבוע. |
| S35 | `financing` / `can-foreigners-get-a-mortgage-in-cyprus` — answer[2] | Naturalness §3 | זמינות המשכנתא תלויה בגורמים כמו: |
| S36 | `financing` / `can-foreigners-get-a-mortgage-in-cyprus` — answer[5] | Modalität/§8, Terminologie, Wiederholung §11.5 | מדיניות האשראי משתנה עם הזמן, ולכן כדאי לברר את תנאי המשכנתא העדכניים ישירות מול הגופים הפיננסיים או מול יועץ. |
| S37 | `financing` / `which-banks-offer-mortgages-to-overseas-property-buyers` — answer[0] | Wiederholung §11.5 | זמינות המשכנתאות משתנה עם הזמן, וכל בנק בוחן פונים מחו"ל אחרת. |
| S38 | `financing` / `which-banks-offer-mortgages-to-overseas-property-buyers` — answer[3] | Naturalness §3 | כדאי להשוות בין כמה אפשרויות מימון ולא להסתמך על מוסד אחד, כי התנאים, מהירות האישור וגובה ההלוואה משתנים מאוד מבנק לבנק. |
| S39 | `financing` / `how-much-deposit-is-required-when-buying-property` — answer[3] | Naturalness §3 | סך התשלום הראשוני שונה מעסקה לעסקה, ותמיד יש לוודא אותו לפני כל התחייבות. |
| S40 | `financing` / `are-fixed-rate-mortgages-available` — answer[0] | Grammatik | סוגי המשכנתאות משתנים עם הזמן ועשויים לכלול מודלי החזר שונים. |
| S41 | `financing` / `are-fixed-rate-mortgages-available` — answer[3] | Grammatik | בבחירת מימון לפי הריבית ההתחלתית בלבד קל להחמיץ את העלויות לטווח הארוך. |
| S42 | `financing` / `should-buyers-pay-in-euros-or-transfer-from-another-currency` — answer[1] | Modalität/§8 | תנודות בשער החליפין עשויות להשפיע במידה ניכרת על סך עלות הרכישה, בעיקר בעסקאות גדולות. |
| S43 | `offplan` / `what-does-off-plan-property-mean` — answer[2] | Wiederholung §11.5 | רכישה לפני סיום הבנייה מבוססת לרוב על תוכניות, על מפרט טכני, על הדמיות ועל מידע מהיזם, ולא על בית גמור. לצד ההזדמנות שבכך יש גם שיקולים נוספים. |
| S44 | `offplan` / `is-buying-off-plan-property-risky` — answer[1] | Wiederholung §11.5 | בין החששות האפשריים: איחור במועד המסירה, שינויים במפרט, תנודות בתנאי השוק ופערים בין הציפיות לתוצאה הסופית. |
| S45 | `offplan` / `what-happens-if-construction-is-delayed` — answer[3] | Wiederholung §11.5 | את מועד המסירה הצפוי, סעיפי ההארכה, חובות התשלום והתנאים שחלים במקרה של עיכוב. |
| S46 | `offplan` / `can-the-final-property-differ-from-marketing-materials` — answer[2] | Modalität/§8 | אין בכך בהכרח עדות לאיכות ירודה. עם זאת, כדאי לקרוא את המפרט בעיון ולהבין מה בדיוק כלול בחוזה. |
| S47 | `offplan` / `how-do-payment-schedules-work-for-new-developments` — answer[1] | Modalität/§8 | הפריסה הזאת היא אחת הסיבות שיש רוכשים שמעדיפים לקנות על הנייר. |
| S48 | `offplan` / `why-do-developers-offer-staged-payment-plans` — answer[0] | Modalität/§8 | פריסת תשלומים יכולה להקל על רכישות בסכומים גבוהים ולחלק את ההתחייבות הכספית על פני תקופה ארוכה יותר. |
| S49 | `offplan` / `why-do-developers-offer-staged-payment-plans` — answer[3] | Modalität/§8 | תשלומים גמישים אינם מבטלים את סיכון ההשקעה, אבל הם יכולים לשנות את יכולת העמידה בתשלום. |

### Abgeleitete Korrekturen E1–E11 (Systemic 1 des Kritikberichts)

Der Bericht formuliert unter „Systemic" 1 eine Regel, die über die 61 Einzelzeilen hinausgeht: **jedes `may`/`can`/`should` in einer Aussage über Steuern, Renditen, Fristen, Kreditvergabe oder Aufenthalt braucht im Hebräischen einen expliziten Marker.** Ein Modalitäts-Audit über alle 322 Strings hat elf weitere Stellen gefunden, an denen die HE-Fassung eine Zusicherung macht, die das EN nicht macht. E9 und E11 nennt der Bericht selbst im Fließtext (S29 „dieselbe Wendung wortgleich in `what-happens-if-construction-is-delayed` answer[4]"; „should always" als vierter Fall neben S18/S39), ohne ihnen eine eigene Zeile zu geben.

| # | Item / Feld | EN | Korrektur HE |
|---|---|---|---|
| E1 | `foreigner` / `can-non-eu-citizens-buy-property-in-cyprus` — answer[4] | buyers **should always** confirm | `… ולכן תמיד יש לוודא מה הדרישות המשפטיות התקפות לפני שמתקדמים.` (statt `כדאי`, wie S18/S39) |
| E2 | `process` / `what-mistakes-do-foreign-buyers-make-when-purchasing-propert` — answer[1] | advice **can** reduce risk | `תכנון מוקפד וייעוץ עצמאי יכולים להקטין מאוד את הסיכון.` |
| E3 | `costs` / `what-taxes-do-property-buyers-pay-in-cyprus` — answer[3] | obligations **may** differ | `חובות המס מתעדכנות עם הזמן ועשויות להשתנות לפי הנסיבות של הרוכש.` (`מתעדכנות`, weil `משתנות … להשתנות` §11.5 verletzt hätte) |
| E4 | `costs` / `are-resale-properties-taxed-differently-from-new-development` — answer[2] | distinction **can** affect | `ההבחנה הזאת יכולה להשפיע על:` |
| E5 | `costs` / `what-are-transfer-fees-when-buying-property` — answer[2] | **can** influence … considerably | `ההוצאות האלה עשויות להשפיע במידה ניכרת על סך עלות הרכישה, ולכן חשוב לכלול אותן בתקציב.` |
| E6 | `investment` / `is-short-term-rental-more-profitable-than-long-term-rental` — answer[1] | they **may** also involve | `מנגד, היא עשויה להיות כרוכה גם בגורמים האלה:` |
| E7 | `residency` / `can-families-relocate-permanently-to-cyprus` — answer[3] | regions **may** appeal | `אזורים שונים עשויים להתאים לסדרי עדיפויות משפחתיים שונים.` |
| E8 | `financing` / `what-payment-schedules-exist-for-off-plan-properties` — answer[1] | payments **may** occur | `התשלומים עשויים להתבצע בשלבים כמו:` |
| E9 | `offplan` / `what-happens-if-construction-is-delayed` — answer[4] | **may** create unrealistic expectations | `ההנחה שכל פרויקט נמסר בדיוק בזמן עלולה ליצור ציפיות לא ריאליות.` (dritte Fundstelle derselben Wendung, vgl. S19/S29) |
| E10 | `offplan` / `why-do-developers-offer-staged-payment-plans` — answer[2] | staged payments **may** align | `למי שעובר לגור בקפריסין, הפריסה עשויה להתיישב נוח יותר עם תכנון ארוך טווח.` |
| E11 | `offplan` / `why-do-investors-buy-off-plan-properties-in-cyprus` — answer[2] | **should always** be balanced | `עם זאת, תמיד יש לאזן את ציפיות ההשקעה מול סיכוני הבנייה ומול תנאי שוק משתנים.` |

### Modalitäts-Audit nach der Fix-Runde

Skript: EN-Zähler `may|can|should|might|could` je String gegen HE-Marker `עשוי|עלול|ייתכן|אפשר|ניתן|יכול|כדאי|מומלץ|רצוי|יש ל|צריך|אין ל|בדרך כלל|לרוב|לא פעם|לעיתים|לפעמים|נוטה`.

| Kategorie | EN-Modale | HE-Marker |
|---|---|---|
| `foreigner` | 14 | 20 |
| `process` | 11 | 15 |
| `legal` | 1 | 6 |
| `costs` | 29 | 29 |
| `investment` | 13 | 14 |
| `residency` | 11 | 16 |
| `location` | 4 | 7 |
| `financing` | 21 | 29 |
| `offplan` | 21 | 26 |
| **Summe** | **125** | **162** |

Vor der Fix-Runde stand die Summe bei **125 : 128 mit 39** unterdeckten Strings; jetzt **125 : 162 mit 15**. Die 15 verbleibenden sind einzeln geprüft und **kein** Fidelity-Verlust:

- **Vier sind Fragen** (`what-additional-costs…`, `can-buying-property-help…`, `how-should-buyers-choose…`, `should-buyers-pay-in-euros…`): das EN-Modal steckt in der Frageform (`Should buyers …?`, `Can buying property help …?`), die im Hebräischen selbst der Hedge ist (`האם …?`).
- **Neun tragen den Hedge in einer Wendung, die das Suchmuster nicht kennt:** `חלק מהפרויקטים…`, `לא תמיד חל`, `במקרים מסוימים`, `יש מקרים ש… ויש מקרים שלא`, `אינו בהכרח`, `במקרים אחרים`, `מעת לעת`, `לפעמים`, `ממגוון סיבות`. Semantisch vollständig, lexikalisch anders. Dazu gehören auch die Doppelmodale, bei denen ein Marker für zwei EN-Modale im Parallelbau steht (`עשוי לחול שיעור מופחת, ובמקרים אחרים השיעור הרגיל`).
- **Zwei sind Wortlaut des Kritikers selbst** (M3, S37 `וכל בנק בוחן פונים מחו"ל אחרת`) und bleiben unverändert.

`may vary → משתנים` und `can be → אפשר` bleiben laut Bericht (Fidelity A) legitime Auflösungen und wurden nicht künstlich remodalisiert. In **keinem** Fall wurde ein Hedge hinzugefügt, den das EN nicht hat.

### Protokollregeln aus dieser Runde

1. **Die Behauptung „die Hedges der Quelle sind erhalten" (Abweichung 6, Pass A) war falsch.** Pass B hat 27 verhärtete Stellen nachgewiesen; mit E1–E11 sind es 38. Abweichung 6 ist unten entsprechend korrigiert. Lehre für künftige `he`-Übersetzungen: Modalität wird gezählt, nicht behauptet.
2. **Die `את`-Kettenregel (Pass B inline #3) galt in zwei Items nicht** — `what-is-a-reservation-agreement` answer[2] und `what-happens-if-construction-is-delayed` answer[3] standen weiter auf vier `את` hintereinander. Beide sind mit S11/S45 nachgezogen; die Regel gilt jetzt ausnahmslos.
3. **Listenkonvention (Abweichung 1) bestätigt, mit drei Zusatzregeln:**
   (a) **Klammern der Quelle bleiben Klammern** — eine EN-Klammer darf in einer kommagegliederten Liste nicht zu Kommas werden, sonst liest der Leser zusätzliche Listenglieder (M11).
   (b) **Label-Sätze behalten ihren Punkt** (`דמי רצינות. משולמים…`) — unverändert gültig.
   (c) **Kein Semikolon.** `;` ist im israelischen Web-Register Behördensprache und wird nicht eingeführt.
4. **`שלב 1,` → `שלב 1:`.** Styleguide §3 verbietet Doppelpunkt-**Überschriften**, nicht die Inline-Marke innerhalb eines Absatzes; `שלב 1:` ist das israelische Standardmuster. Der Ersatz `שלב 1 —` scheidet nach §3 aus (kein Gedankenstrich). Abweichung 2 unten ist entsprechend korrigiert.
5. **Terminologie `רוכשים זרים` / `רוכשים מחו"ל` / `רוכשים מישראל`** (Controller-Entscheidung, jetzt im Glossar §3):
   - `רוכשים זרים` (bzw. `רוכשים שאינם אזרחי האיחוד האירופי`), wo das EN „foreigners"/„foreign buyers" als **zyprische Rechtskategorie** meint — Genehmigung der `מועצת השרים`, Nicht-EU-Status, Kreditvergabe. Angewandt in M12, S13, S33. `אזרחי`, nicht `תושבי`, solange das EN „citizens" sagt.
   - `רוכשים מחו"ל` bleibt, wo das EN „international"/„overseas buyers" als **Marktgruppe** sagt (12 Fundstellen von insgesamt 16 `מחו"ל`; die übrigen vier sind `משקיעים מחו"ל`, `פונים מחו"ל`, `כספים מחו"ל` und folgen demselben EN-Wort). Alle einzeln gegen `en.json` geprüft.
   - `רוכשים מישראל` bleibt dem **Seiten-Chrome** vorbehalten (`copy.ts`, H1/Meta/Intro). In den 60 Antworten spricht kein einziger EN-String den Leser direkt an — alle Aussagen stehen in der dritten Person über den Markt. `רוכשים מישראל` in einen solchen Satz zu setzen wäre ein Zusatz gegenüber der Quelle und ist deshalb bewusst **nicht** geschehen.
6. **Glossar ergänzt** (`he-glossary.md` §2/§3, dieser Commit): `דמי העברה` (staatliche Übertragungsgebühr) vs. `עמלות ההעברה` (Bankgebühr bei Auslandsüberweisung) als bewusste Trennung zweier EN-„transfer fees"; die drei Käufer-Termini aus Punkt 5.
7. **SEO-Korrekturen** (`he-keyword-map.md` §2/§6.4): `תהליך רכישת נכס` (0 Volumen) ist aus der Prozessfrage verschwunden — sie lautet jetzt `איך קונים נכס בקפריסין, שלב אחר שלב?` und zielt auf `קניית נכס בקפריסין` (30) / `קניית דירה בקפריסין` (40). Die Residency-Frage trägt jetzt `רילוקיישן לקפריסין` (170, stärkster informationaler HE-Term der Map). Bedeutung in beiden Fällen unverändert.
8. **Grammatikfixes durchgängig gemacht:** `נחשב` regiert `ל־` (zwei Fundstellen: `do-i-need-a-lawyer…` answer[0], `can-non-eu-citizens…` answer[1] — letztere in S14 mitgenannt), `צפה` regiert `ל־` (`לאיזו תשואה … אפשר לצפות`, M10). Weitere Fundstellen beider Verben gibt es in der Datei nicht (verifiziert per `grep`).

### Noch nicht umgesetzt (Folge-Tickets)

1. **`<ul>`-Renderer für Listenabsätze.** 30 der 244 Absätze sind in Wahrheit Listen mit 5–7 kommagetrennten Gliedern, die `FaqExplorer.tsx:197` als ein `<p>` ausgibt. Im RTL-Fließtext ist das schwer scanbar und die Stelle, an der die drei Konventionsbrüche dieser Runde passiert sind (M11, S11, S45). Nach Controller-Entscheidung ist das ein **eigenes Ticket** (Renderer, alle fünf Locales), keine Textänderung in dieser Runde. Der bisherige Vermerk „Folgeaufgabe (optional)" in Abweichung 1 gilt damit als aufgewertet.
2. **Quell-Lücken in `en.json`** (Fidelity E3 des Berichts): weder Title Deed noch Bankgarantie kommen vor — die zwei Punkte, an denen israelische Käufer laut `he-keyword-map.md` §6.9 am misstrauischsten sind. Das ist ein Ticket an der **Quelle** (dann in alle fünf Locales), nichts, was `he.json` einseitig ergänzen darf.
3. **Glossar §2 `immovable property tax`.** Der Eintrag sagt „nicht erwähnen"; die Quelle nennt die Steuer ausdrücklich als *abgeschafft*, was für den israelischen Leser eine Entwarnung ist. Die HE-Fassung folgt der Quelle (`are-annual-property-taxes-payable-in-cyprus`). Vorschlag des Kritikers, eine Kontextausnahme ins Glossar aufzunehmen — nicht umgesetzt, weil der Auftrag dieser Runde das Glossar auf zwei Einträge begrenzt hat. Entscheidung des Controllers.
4. **`כדאי`-Frequenz** (Systemic 3): von 26 auf 22 gesunken (S18, S39, E1, E11 auf `תמיד יש ל…` umgestellt). Die verbleibenden 22 sind vertretbar, aber eine weitere Verteilung auf `צריך`, `חשוב ש…`, `מומלץ` gehört auf die Liste für Pass C.
5. **`למה משקיעים קונים על הנייר בקפריסין?`** — der Kritiker schlägt `למה משקיעים קונים פרויקטים חדשים על הנייר בקפריסין?` vor (`על הנייר` hat 0 Suchvolumen), hat es aber bewusst nicht in die Should-Tabelle aufgenommen, weil es die Frage verlängert. Nicht umgesetzt; Entscheidung des Controllers.

## Abweichungen von der englischen Vorlage

1. **Aufzählungsabsätze bekommen Kommas.** Die Quelle setzt Listen ohne Trennzeichen in einen Fließabsatz (`Online property viewings or video tours Digital communication with agents and lawyers Contract reviews via email …`); `FaqExplorer.tsx:197` rendert jeden Absatz als ein `<p>`. Im Lateinischen tragen die Großbuchstaben die Gliederung, **Hebräisch hat keine Majuskeln** — die wörtliche Übernahme ergäbe eine unlesbare Wortkette. Alle 30 solchen Absätze sind deshalb mit Komma gegliedert und mit `ו`+Punkt geschlossen. Absatzzahl und Inhalt unverändert. `de.json`/`ru.json` haben die Kette übernommen; das ist dort ein anderer, milderer Fall. **Fix-Runde 1:** Konvention bestätigt, mit drei Zusatzregeln (Klammern bleiben Klammern, Label-Sätze behalten den Punkt, kein Semikolon) — siehe „Protokollregeln aus dieser Runde" Nr. 3. Der `<ul>`-Renderer ist dort vom „optional" zum **eigenen Folge-Ticket** aufgewertet.
2. **`Step 1: …` → `שלב 1: …`.** Styleguide §3 verbietet Doppelpunkt-**Überschriften**, nicht die Inline-Marke innerhalb eines Absatzes; `שלב 1:` ist das israelische Standardmuster. Die Ziffer bleibt westlich, die Schrittzahl (6) unverändert. *(Pass A hatte `שלב 1,` gesetzt — das liest sich als Apposition statt als Marke; korrigiert in Fix-Runde 1, S6.)*
3. **`Which city is best?` / `new is always better`** — die Quelle setzt geschweifte Anführungszeichen, die `he`-Fassung gerade doppelte (§4). Das Fragezeichen innerhalb des Zitats entfällt in `השאלה הנכונה היא לא "איזו עיר הכי טובה" אלא …`, weil der hebräische Satz keine Frage ist. *(Pass A hatte `עדיף לשאול לא … אלא …` — englische Wortfolge nach §7; korrigiert in Fix-Runde 1, S31.)*
4. **Notartermin: keine Fundstelle.** Die für WP5 dokumentierte Abweichung („EN spricht vom Notartermin, Zypern kennt keinen") betrifft `preview-about/copy.ts`, **nicht** diese Quelle: `en.json` enthält weder „notary" noch „notarial". Die zyprische Realität ist trotzdem ausdrücklich abgebildet — Unterzeichnung und Prüfung laufen überall über `עורך דין`, die Hinterlegung über `רשם המקרקעין` (`can-foreigners-buy-property-in-cyprus` Abs. 3, `how-does-the-property-buying-process-work-in-cyprus` Abs. 2, gesamte Kategorie `legal`). Die Gate-Regel `notary` (`נוטריון`) schlägt nicht an.
5. **Keine Zahlen ergänzt.** Die Quelle nennt in 60 Antworten keinen einzigen Steuersatz, keine Frist, keinen Schwellenwert und keine Rendite — die hebräische Fassung ebenso wenig. Insbesondere steht **kein** `5%`-Satz beim reduzierten Mehrwertsteuersatz, obwohl Glossar §2 die Formulierung kennt: die Quelle sagt nur „reduced rates may apply". Ebenso keine Aussage zu Mindestinvestitionen bei der Aufenthaltsgenehmigung.
6. **Keine Weichzeichnung von Rechtsaussagen.** Wo die Quelle hart formuliert, tut es die Übersetzung auch: `לא. רכישת נכס אינה מקנה מעמד של תושבות קבע באופן אוטומטי.`, `רכישה בלי בדיקות משפטיות מעלה את הסיכון במידה ניכרת.`, `אין לוותר על בדיקת נאותות.` Pass B hat das bestätigt: kein einziger Fall von Weichzeichnung einer Warnung. **Der zweite Halbsatz dieser Zeile war jedoch falsch** — die Behauptung „die Hedges der Quelle sind erhalten und nicht zu Zusicherungen verdichtet" hat Pass B an 27 Stellen widerlegt, mit dem eigenen Audit sind es 38 (Steuern, Rendite, Kreditvergabe, Off-Plan-Risiko). Alle sind in Fix-Runde 1 remodalisiert; die Drift lief ausschließlich in Richtung Verhärtung, nie in Richtung zusätzlicher Hedges. Siehe „Modalitäts-Audit nach der Fix-Runde".
7. **`Cyprus VIP Estates` kommt nicht vor** — die Quelle nennt die Marke in keiner Antwort, es gibt also keine lateinische Interpolation und keinen Bidi-Fall in dieser Datei. Ebenso keine Preise, keine Telefonnummern, keine URLs, keine Links.

## JSON-LD `inLanguage`

`src/app/preview-faq/[lang]/page.tsx` erzeugte bisher `FAQPage` ohne Sprachangabe. Ergänzt: `inLanguage: isLocale(lang) ? BCP47[lang] : BCP47.en`. **Das Feld erscheint jetzt in allen Locales** (`en-GB`, `de-DE`, `pl-PL`, `ru-RU`, `he-IL`) — laut Plan akzeptabel und hiermit dokumentiert. Kein Copy-Modul betroffen, `copy-snapshot` unverändert.

## Seeder

`scripts/seed-faq-translations.mjs`:

- Sprachliste ist jetzt `["en","de","pl","ru","he"]` (Konstante `LANGUAGES`).
- Zwei-Schlüssel-Guard wie `scripts/he-content/seed.mjs`: **Dry Run ist der Default** und konstruiert keinen `PrismaClient`; ein echter Lauf braucht `CVP_CONFIRM_CONTENT_SEED=yes` **und** `--yes`. `--yes` ohne die Umgebungsvariable ist ein Fehler (Exit 1), kein stiller Rückfall auf Dry Run.
- Der Dry Run baut alle fünf Sprachen und ist damit zugleich der Strukturcheck (`buildForLang()` wirft bei fehlender Kategorie/Item und bei Absatz-Drift).

Geprüft (ohne DB-Zugriff): `node scripts/seed-faq-translations.mjs` → 5× `faqPage-<lang>: upsert — 9 categories, 60 questions`, Exit 0; `node scripts/seed-faq-translations.mjs --yes` ohne Env → Exit 1.

## Gates

Stand **nach Fix-Runde 1** (die Zeile in Klammern ist das Ergebnis aus Pass A):

| Gate | Ergebnis |
|---|---|
| `node scripts/qa/he-content-check.mjs --only scripts/faq-translations/he.json` | `he-content: OK (1 files, 322 strings)` *(Pass A: 60 Scheinverstöße durch den Checker-Bug — inzwischen behoben, siehe unten)* |
| `node -e` Strukturvergleich (Kategorien/Items/Absatzzahlen) | identisch zu `en.json` (9 / 60 / 244) |
| Modalitäts-Audit (EN `may\|can\|should\|might\|could` gegen HE-Marker) | 125 : 162, 15 unterdeckte Strings, alle geprüft und erklärt |
| `npm test` | 294/294 grün |
| `grep -c "—\|–\|!" scripts/faq-translations/he.json` | 0 |

### Blocker: `mirrorCheck` behandelt `id` als Prosa — **erledigt**

**Stand Fix-Runde 1:** behoben. `scripts/he-content/lib.mjs:33` führt `id` jetzt in `IDENTICAL_KEYS`, `:249` in `NON_TEXT_KEYS`; das Gate läuft auf `OK (322 strings)` durch. Die Änderung kam aus Task 7, nicht aus dieser Runde. Der ursprüngliche Befund bleibt zur Nachvollziehbarkeit stehen:

`scripts/he-content/lib.mjs` führte `IDENTICAL_KEYS = ["_key","_ref","_type","url","slug","href","marks","style","listItem","level"]` — **`id` fehlt**. Für jedes der 60 FAQ-Items meldet das Gate deshalb:

```
[0].items[0].id: en has letters but he has no Hebrew script (he="can-foreigners-buy-property-in-cyprus")
```

Das ist genau umgekehrt zur Anforderung: die `id` **muss** lateinisch und byte-identisch bleiben, sonst findet der Seeder die Übersetzung nicht. Fix ist eine Zeile — `id` in `IDENTICAL_KEYS` **und** in `NON_TEXT_KEYS` derselben Datei aufnehmen. Task 4 durfte `lib.mjs` nicht anfassen (Task 7 arbeitet parallel an derselben Datei), deshalb liegt die Änderung beim Controller. **Solange sie fehlt, schlägt auch der Gesamtlauf in Task 9 Schritt 3 fehl.** Nach dem Fix bleiben laut Ersatz-Gate 0 Verstöße.

## Offene Fragen für Pass C

1. **`רכישה בידי זרים` als Kategorie-Label.** Sachlich richtig (aus zyprischer Sicht ist der israelische Käufer Ausländer), aber der Leser bezeichnet sich selbst ungern als „Fremden". Fix-Runde 1 hat `על ידי` → `בידי` gesetzt (S1: Schriftregister statt Amtsdeutsch, parallel zu den acht anderen Labels); die Grundfrage bleibt offen. Alternative: `רכישה כתושב חוץ`.
2. **`הסכם שמירת נכס`** für „reservation agreement". Es gibt keinen etablierten israelischen Term für die zyprische Reservierung; `זיכרון דברים` ist bewusst ausgeschlossen (bindender Vorvertrag nach israelischem Recht). Falls der Lektor eine Kanzleiformulierung kennt, gehört sie ins Glossar §2 und dann an alle sieben Fundstellen.
3. **`דמי רצינות` vs. `פיקדון הרשמה`.** Glossar §2 lässt beides zu; hier durchgehend `דמי רצינות`. Bestätigen oder vereinheitlichen.
4. **`הון עצמי` für „deposit" und „down payment".** Die Quelle unterscheidet: `how-much-deposit-is-required-when-buying-property` meint alle Vorauszahlungen (deshalb `כמה צריך לשלם מראש`), `what-down-payment-is-typically-required-for-mortgages` nur den Eigenkapitalanteil (deshalb `הון עצמי`). Trennung bestätigen.
5. **`מס רכוש ארצי`** für die abgeschaffte „immovable property tax". Glossar §2 sagt „nicht erwähnen" — die Quelle erwähnt sie aber ausdrücklich als *abgeschafft*, was für den israelischen Leser eine relevante Entwarnung ist. Beibehalten oder streichen?
6. **`גמלאים`** für „retirees" (3 Fundstellen). Alternative `פנסיונרים`. Glossar führt keinen der beiden.
7. **Kommagliederung der Listenabsätze** (Abweichung 1). Falls der Lektor die Absätze lieber als echte Listen sähe, ist das eine Renderer-Änderung und keine Textänderung — bitte im Protokoll vermerken, nicht in der Datei.
8. **Register der Kategorie-Descriptions.** Zwei von neun sprechen den Leser direkt an (`עבורכם`, `שלכם`), sieben sind nominal. Das folgt der Quelle („what a lawyer checks for you", „your goals"). Vereinheitlichen oder so lassen?
9. **`רוכשים זרים` vs. `רוכשים מחו"ל` vs. `רוכשים מישראל` — eine Regel für Body und Chrome.** Der Controller hat für Fix-Runde 1 entschieden (siehe „Protokollregeln" Nr. 5, jetzt im Glossar §3): Rechtskategorie → `רוכשים זרים`, Marktgruppe → `רוכשים מחו"ל`, Leseransprache → `רוכשים מישראל`, letzteres nur im Chrome. Der Leser sieht beim Scrollen trotzdem `רוכשים מישראל` (H1) und `רוכשים מחו"ל` (Body) nebeneinander. Trägt das für einen israelischen Leser, oder wirkt es inkonsistent? Betrifft auch WP2/WP3/WP5.
10. **Rechtsvorbehalt aus Glossar §5** (`המידע אינו מהווה ייעוץ משפטי או מס. בכפוף לבדיקה פרטנית.`) — soll die FAQ-Seite ihn **einmal** tragen? Empfehlung des Kritikers: ja, aber im Chrome (`copy.ts`, unter der Akkordeon-Liste), **nicht** in den 60 Antworten — dort wäre er ein Zusatz gegenüber der Quelle und stünde 60× im Weg. Entscheidung Controller/Lektor; in dieser Runde nicht umgesetzt (`copy.ts` gehört zu WP5, nicht zu Task 4).
