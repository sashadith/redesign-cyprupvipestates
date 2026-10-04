# Lektorat WP5 — Über uns, Kontakt (Berater-Sprachfilter), FAQ

**Stand:** 2026-09-13 · **Pass A (Erstübersetzung) + Fix-Runde 1 nach Pass B** · Marker im Code: `REVIEW(he)`
**Fix-Runde 1:** alle 10 „Must fix"- und 18 „Should fix"-Zeilen aus `.superpowers/sdd/2026-09-13-hebrew-phase4-copy/task-8-passB.md` sind in der Spalte `Korrektur HE` eingetragen und im Code angewandt (Ausnahmen und Begründungen: siehe „Offene Punkte").
**Umfang:** 4 Dateien, 3 `he`-Copy-Tabellen + 1 Label-Zeile, ~135 Einzelstrings.
**Quelle:** immer der englische Eintrag. Die deutschen Zeilen dienten nur als Tonreferenz.

---

## Welche Seiten das sind

| Seite | URL (`he`) | Datei |
|---|---|---|
| Über uns | `/he/about-us` (Slug bleibt lateinisch, Entscheidung A; `CORPORATE_SLUGS.about.he`) | `src/app/preview-about/[lang]/copy.ts` |
| Kontakt | `/he/contacts` (`CORPORATE_SLUGS.contacts.he`) | `src/app/preview-contacts/[lang]/copy.ts` |
| Kontakt — Sprachnamen der Filter-Chips | `/he/contacts` | `src/app/preview-contacts/[lang]/languages.ts` |
| FAQ | `/he/faq` | `src/app/preview-faq/[lang]/copy.ts` |

**Nicht in WP5:** die 60 FAQ-Fragen und -Antworten selbst (die liegen im `faqPage`-SiteDocument,
nicht in dieser Datei — hier steht nur das Seiten-Chrome), die Team-Namen, -Positionen und
-Sprachlisten (kommen aus der `singlepages`-Zeile in der DB) und die Kundenstimmen.

## Wo die Strings sichtbar sind

| Fläche | Element |
|---|---|
| Über uns — Hero | Eyebrow, H1 (dreiteilig, der mittlere Teil trägt den Gold-Akzent `.it`), Lead, Button „להכיר את הצוות", Bild-Alt |
| Über uns — Haltung / Zahlen / Arbeitsweise / Leistungen / Werte | Eyebrow + H2 + Fließtext bzw. Karten; die Zahlen 195/10/360°/100% kommen aus dem Code bzw. der DB und sind **nicht** übersetzt |
| Über uns — Team | H2, Lead (**trägt die Entscheidung-E-Zeile**), Label über der Sprachliste jeder Karte |
| Über uns — Kundenstimmen + Abschluss-CTA | H2, Lead, Button, die drei Kanalkarten (WhatsApp/Telefon/E-Mail) |
| Kontakt — Hero | Eyebrow, H1, Lead, Öffnungszeiten-Badge (live „offen/geschlossen", Zypern-Zeit) |
| Kontakt — Direktkanäle | Eyebrow, H2, drei Kanalkarten mit Hinweiszeile |
| Kontakt — Berater-Finder | Eyebrow, H2, Lead (**trägt die Entscheidung-E-Zeile**), Chip „הכול", Sprachnamen der Chips, Trefferzähler, Leerzustand, Label „שפות" auf jeder Personenkarte |
| Kontakt — Formular | Eyebrow, Titel (zweiteilig mit Gold-Akzent), Lead |
| Kontakt — Büro | Die fünf `office*`-Strings sind **derzeit nicht gerendert** (die Seite endet nach dem Formular), stehen aber in der Typdefinition und werden mitübersetzt, damit ein Wiedereinbau nicht auf Englisch herausfällt |
| Nicht gerendert (Regressionsschutz) | Vollständige Liste: About `heroScroll` und `teamContact`, Kontakt `officeEyebrow/Title/Company/Address/Directions` sowie `finderEmpty` (toter Zweig: `ConsultantFinder.tsx:52–68` baut die Chips aus den Mitgliedern, `visible.length === 0` ist unerreichbar). `heroScroll` fehlte in Pass A in dieser Liste — nachgetragen in Fix-Runde 1 |
| FAQ — Hero | Eyebrow, H1 (dreiteilig), Lead, Zähler „N שאלות ב-M נושאים" |
| FAQ — Toolbar/Liste | Chip „הכול", Trefferzähler, „alle auf-/zuklappen", aria-Label der Kategorienleiste |
| FAQ — Formular | Titel (der Fragezeichen steht **hartcodiert** im JSX hinter dem Gold-Teil: `נשארה `+`שאלה`+`?`), Lead |

## Wie zu lektorieren ist

1. Die Kurzcheckliste `docs/i18n/he-styleguide.md` §10 Punkt für Punkt durchgehen:
   kein englischer Restsatz · Genus nach §2 (Nominal/Infinitiv, sonst männlicher Plural, keine
   Schrägstriche) · Preise/Nummern nach §5, Bidi isoliert · Ortsnamen nach Glossar, Eigennamen
   lateinisch · Meta-Title ≤ 60, Description ≤ 155 · keine Zeile aus §7 · jede Zahl hat eine Quelle.
2. Zusätzlich §11 (Lernpunkte aus WP1): keine Schrägstrich-Formen, genusfrei mit natürlichen
   Mitteln, kein Wurzel-/Wortdoppel im selben String, duplizierte Strings wortgleich.
3. Länge mitdenken: Eyebrows und Buttons ≤ 3 Wörter, die Hero-H1 muss dreizeilig umbrechen können,
   die Chip-Labels stehen neben einer Zahl in einem schmalen Chip.
4. **Korrekturen in die Spalte `Korrektur HE` eintragen** — die vorhandene HE-Spalte bitte
   unverändert lassen, damit der Diff nachvollziehbar bleibt. Zeilen ohne Korrektur leer lassen
   (= freigegeben).
5. Zurück an den Controller; er übernimmt die Korrekturen und entfernt `REVIEW(he)`.

**Nicht ändern:** Keys, `{n}`-Platzhalter, Funktionssignaturen (`heroMeta`, `questionsCount`),
`href`s, Slugs, Telefonnummer und E-Mail-Adresse (die stehen ohnehin nicht in dieser Tabelle,
sondern einmal zentral in `CHANNEL_DETAILS`), Markenname `Cyprus VIP Estates`,
Firmenname `SecretBrand Solutions LTD`, `Google Maps`, die Straßenzeile der Büroadresse.

**Unsichtbare Zeichen:** `⟦LTR⟧…⟦/⟧` = mit `ltrIsolate()` (U+2066…U+2069) umschlossen (Adresse),
`⟦ISO⟧…⟦/⟧` = mit `bidiIsolate()` (U+2068…U+2069) umschlossen (lateinische Eigennamen im
hebräischen Satz, §11.4). Beim Korrigieren bitte nur den Text abtippen, nicht diese Marken.

---

## Die Entscheidung-E-Zeile (Beratungssprache) — bitte zuerst prüfen

Die Zeile aus `he-glossary.md` §5 steht **wortgleich an drei Stellen** und ist der ehrliche Kern
dieser beiden Seiten. Sie darf sprachlich verbessert, aber inhaltlich **nicht** abgeschwächt
werden — das Team spricht kein Hebräisch (`he-styleguide.md` §8):

> הייעוץ מתקיים באנגלית או ברוסית; פנייה בעברית מתקבלת בברכה.

| Fundstelle | Kontext |
|---|---|
| `preview-contacts/[lang]/copy.ts` → `finderLead` | direkt über dem Sprachfilter, wo der Besucher „seine" Sprache wählt |
| `preview-contacts/[lang]/copy.ts` → `metaDescription` | in der Suchergebnis-Beschreibung, damit die Erwartung schon vor dem Klick stimmt |
| `preview-about/[lang]/copy.ts` → `teamLead` | über dem Team-Grid, der einzigen Stelle der About-Seite, die von Sprachen spricht |

Wenn der Lektor eine Formulierung ändert, muss sie an **allen drei** Stellen gleich geändert
werden (und dann auch im Glossar §5).

**Fix-Runde 1 — Reihenfolge statt Wortlaut.** Pass B hat bestätigt, dass der Satz an allen drei
Stellen zeichengleich steht, aber zweimal durch benachbarte Zusagen unterlaufen wurde. Geändert
wurde deshalb **nicht der Satz**, sondern seine Umgebung (Glossar §5 bleibt unangetastet):

| Stelle | vorher | jetzt |
|---|---|---|
| `finderTitle` (H2 über dem Filter) | `למצוא יועץ שמדבר את השפה שלכם` — verspricht auf `/he` einen hebräischsprachigen Berater | `בחירת יועץ לפי שפה` — nominal, verspricht keine Sprache |
| `finderLead` | Ehrlichkeitszeile am **Ende**, davor `בחרו את שלכם` | Ehrlichkeitszeile **zuerst**, dann der Finder: `הייעוץ מתקיים באנגלית או ברוסית; פנייה בעברית מתקבלת בברכה. בצוות שלנו שש שפות, וכאן אפשר לראות בדיוק עם מי תדברו.` |
| `metaDescription` (Kontakt) | Ehrlichkeitszeile in der Mitte, danach ein Fragment | Ehrlichkeitszeile am Ende, davor Marke, Kanäle, Zeit + Zeitzone |
| `teamLead` (About) | `צוות שמדבר … וכולם` (Numerus-Bruch) | `בצוות שלנו שש שפות וארבע מדינות, וכולם גרים כאן.` + unveränderte Ehrlichkeitszeile |
| `finderEmpty` (toter Zweig) | `…ונמצא את האדם המתאים` — implizite Sprachzusage | `…ונחזור אליכם.` |

Repo-weit tragen nur diese beiden Dateien das Wort `עברית`/`בעברית` (plus `src/lib/locale.ts` als
Sprachumschalter-Label, das die Website-Sprache meint). Es gibt kein `preferredLanguage`-Feld und
keinen Formular-Dropdown, der Hebräisch als Kontaktsprache anbietet.

---

## 1. `src/app/preview-about/[lang]/copy.ts` — Über uns

| Key | EN | HE | Anmerkung | Korrektur HE |
|---|---|---|---|---|
| `metaTitle` | About Us — Cyprus VIP Estates | אודות סוכנות הנדל"ן שלנו בקפריסין \| Cyprus VIP Estates | 54 Zeichen. Hub-Keyword `נדל"ן בקפריסין` (320/Mon.) vorne, Marke hinten mit `\|` (§6). Das EN-`—` wird nie übernommen. |  **Must/Should #11:** `אודות Cyprus VIP Estates \| סוכנות נדל"ן בפאפוס ובלימסול` (55). Marke vorne (die About-Seite rankt für die Marke), Head-Term `נדל"ן בקפריסין` raus — der gehört der geplanten Cornerstone-Seite #1 `/he/real-estate-cyprus` (§6, `he-keyword-map.md` §4). |
| `metaDescription` | Who we are, how we work, and the team behind Cyprus VIP Estates — a full-service real estate marketing and consulting agency in Paphos, Cyprus. | מי אנחנו, איך עובדים ומי הצוות שמאחורי Cyprus VIP Estates, סוכנות נדל"ן ושיווק בפאפוס שמלווה רוכשים מהחיפוש הראשון ועד קבלת המפתחות. | 132 Zeichen. Statt der dritten Wiederholung von `אנחנו` (§11.5) steht `מי הצוות`; der Nutzen am Ende ersetzt die EN-Selbstbeschreibung. |  **Should #12:** `מי אנחנו, איך אנחנו עובדים ומי הצוות שמאחורי Cyprus VIP Estates, סוכנות נדל"ן בפאפוס שמלווה רוכשים מהחיפוש הראשון ועד קבלת המפתחות.` (131). `איך עובדים` war subjektlos; in der Dreier-Aufzählung ist das zweite `אנחנו` natürliches Hebräisch, keine §11.5-Redundanz. |
| `heroEyebrow` | About Cyprus VIP Estates | אודות ⟦ISO⟧Cyprus VIP Estates⟦/⟧ | §11.4 | |
| `heroTitle[0]` | A bridge to a new life under the  | גשר לחיים חדשים תחת שמי  | | |
| `heroTitle[1]` | Mediterranean | הים התיכון | Gold-Akzent; Glossar §1 | |
| `heroTitle[2]` |  sky |  | Leer: im Hebräischen steht das Nomen `שמי` (Smichut) schon vor dem Akzentwort, ein Nachlauf wäre grammatisch falsch. | |
| `heroLead` | We connect people with their dream home on the island of sunshine — not just as a property consultancy, but as the partner who stays with you from the first conversation to the day you get the keys. | אנחנו מחברים בין אנשים לבית שחלמו עליו באי השמש, לא רק כיועצי נדל"ן אלא כשותפים שנשארים איתכם מהשיחה הראשונה ועד היום שבו תקבלו את המפתחות. | `dream home` → `הבית שחלמו עליו` statt `בית חלומות` (Anzeigen-Hebräisch, §7). |  **Must #7:** `אנחנו עוזרים לכם למצוא את הבית שחלמתם עליו בקפריסין, לא רק כיועצי נדל"ן אלא כשותפים שנשארים איתכם מהשיחה הראשונה ועד היום שבו תקבלו את המפתחות.` Personenbruch (3. Pers. → 2. Pers. Pl. mitten im Satz) behoben, `אי השמש` gestrichen (§7, offene Frage 3). |
| `heroCta` | Meet the team | להכיר את הצוות | Infinitiv, §2.1 | |
| `heroImageAlt` | Limassol seafront at night, Cyprus | טיילת הים של לימסול בלילה, קפריסין | Alt-Text, nicht sichtbar | |
| `heroScroll` | Scroll | גלילה | Nominal |  unverändert — aber **derzeit nicht gerendert** (Pass B, Glossar #23): `preview-about/[lang]/page.tsx` verwendet `heroScroll` nirgends. Gehört zur „nicht gerendert"-Liste wie `teamContact` und die `office*`-Strings. |
| `stanceEyebrow` | What drives us | מה מניע אותנו | | |
| `stanceTitle[0]` | Moving to Cyprus is  | המעבר לקפריסין הוא  | | |
| `stanceTitle[1]` | more than | לא רק | Gold-Akzent. `יותר מ…` hätte `מעבר` doppelt ergeben (`המעבר … מעבר ל…`, §11.5). |  **Should #17:** `הרבה יותר`. Der Gold-Akzent trug die Negation — das Auge landete auf „nicht nur" (§11.3). `הרבה יותר מרכישת נכס` enthält `מעבר` gar nicht, die Pass-A-Begründung trug also nicht. |
| `stanceTitle[2]` |  buying property |  רכישת נכס | Der Satz endet auf dem sinntragenden Wort, nicht auf der Negation (§11.3). |  **Should #17:** ` מרכישת נכס` (die Präposition wandert an den dritten Teil). |
| `stanceBody[0]` | It is a step toward a self-determined, enjoyable life — and we put our whole heart into it. | זה צעד לחיים עצמאיים ומהנים יותר, ואנחנו משקיעים בו את כל הלב. | | |
| `stanceBody[1]` | Our mission is to help people find their ideal home under the Cypriot sun, with personal advice, absolute transparency, and a tireless commitment to the highest quality standards. | המשימה שלנו היא לעזור לאנשים למצוא את הבית המתאים להם תחת השמש הקפריסאית, עם ייעוץ אישי, שקיפות מלאה ועמידה עקבית בסטנדרטים הגבוהים ביותר. | `tireless commitment` → `עמידה עקבית`: das Pathos-Wort ist §7. | |
| `stanceBody[2]` | We combine deep local market knowledge with digital tools, so the entire process stays simple, secure and genuinely pleasant. | אנחנו משלבים היכרות עמוקה עם השוק המקומי וכלים דיגיטליים, כדי שכל התהליך יישאר פשוט, בטוח ונעים באמת. | Nur ein `עם` statt zwei. | |
| `statsEyebrow` | In numbers | במספרים | | |
| `statsTitle` | Ten years on the ground | עשר שנים בשטח | | |
| `stats[0].title` | Real estate projects | פרויקטי נדל"ן | Glossar §2 (`פרויקט`, nie `פיתוח`) | |
| `stats[0].description` | In southern Cyprus. From studio apartments to high-class villas | בדרום קפריסין. מדירות סטודיו ועד וילות יוקרה | Die Zahl selbst (195) kommt live aus der DB. | |
| `stats[1].title` | Years of experience | שנות ניסיון | | |
| `stats[1].description` | As a full-service real estate marketing agency | כסוכנות שיווק נדל"ן בשירות מלא | | |
| `stats[2].title` | Service for our clients | שירות ללקוחות שלנו | steht neben `360°` | |
| `stats[2].description` | From the first contact to the handover of the keys | מהפנייה הראשונה ועד מסירת המפתחות | `מסירה` = Glossar §2 | |
| `stats[3].title` | Satisfied clients | לקוחות מרוצים | steht neben `100%` | |
| `stats[3].description` | From Germany, Austria, Switzerland and beyond | מגרמניה, אוסטריה, שווייץ ומדינות נוספות | Faktentreu: Israel steht bewusst **nicht** in dieser Liste, die Bestandskunden kommen aus dem DACH-Raum. |  **Should #22:** `מכל רחבי אירופה`. Faktentreu bleibt es (DACH ist Teil Europas), aber unter `100%` sagte die Länderliste dem israelischen Leser wörtlich „Israelis sind nicht dabei". Die Oberkategorie kostet nichts. |
| `workEyebrow` | How we work | איך אנחנו עובדים | | |
| `workTitle` | Three things we never delegate | שלושה דברים שלא נעביר לאף אחד | | |
| `work[0].title` | Personal on-site consultation | ייעוץ אישי בשטח | | |
| `work[0].description` | We listen carefully to understand your needs, wishes and life goals — then find properties that actually fit them. | אנחנו מקשיבים בקפידה כדי להבין את הצרכים, הרצונות ומטרות החיים שלכם, ואז מאתרים נכסים שבאמת מתאימים להם. | |  **Should #18:** `אנחנו מקשיבים היטב כדי להבין את הצרכים, הרצונות ומטרות החיים שלכם, ואז מאתרים נכסים שבאמת מתאימים.` `בקפידה` kollokiert mit `בדיקה`/`בחירה`, nicht mit Zuhören; `מתאימים להם` verwies auf die Aufzählung statt auf den Leser. |
| `work[1].title` | Market and legal expertise | מומחיות בשוק ובחוק | | |
| `work[1].description` | Decades of experience and close cooperation with Cypriot authorities let us navigate negotiations and approval procedures with confidence. | עשרות שנות ניסיון ועבודה צמודה מול הרשויות בקפריסין מאפשרות לנו לנהל משא ומתן והליכי אישור בביטחון. | |  **Must #3:** `ניסיון רב ועבודה צמודה מול הרשויות בקפריסין מאפשרים לנו לנהל משא ומתן והליכי אישור בביטחון.` **Faktenwiderspruch:** zwei Sektionen darüber stehen `עשר שנים בשטח` und der Stat `10` + `שנות ניסיון`; auf der hebräischen Seite liegen beide im selben Scroll (§8, §10). Der Widerspruch steckt schon im EN — siehe „Offene Punkte". |
| `work[2].title` | Digitally supported processes | תהליכים בתמיכה דיגיטלית | | |
| `work[2].description` | From AI-assisted analysis to online document review, we pair modern tools with personal service for maximum transparency. | מניתוח בעזרת בינה מלאכותית ועד בדיקת מסמכים אונליין, כלים מודרניים לצד שירות אישי, לשקיפות מרבית. | Nominalstil im zweiten Teil, damit `משלבים` nicht dreimal auf der Seite steht. |  **Should #19:** `מניתוח בעזרת בינה מלאכותית ועד בדיקת מסמכים אונליין. הכלים המודרניים עובדים לצד שירות אישי, וכך התהליך נשאר שקוף.` Der prädikatlose Dreiteiler wird zu zwei Sätzen (§3); dafür braucht es kein drittes `משלבים`. |
| `receiveEyebrow` | What you receive | מה אתם מקבלים | | |
| `receiveTitle` | One partner, start to finish | שותף אחד, מההתחלה ועד הסוף | | |
| `receive[0].title` | A curated selection | בחירה מוקפדת | | |
| `receive[0].description` | You only see properties that meet our quality and return standards — not everything on the market. | אתם רואים רק נכסים שעומדים בסטנדרטים שלנו לאיכות ולתשואה, לא את כל מה שיש בשוק. | `תשואה` = Glossar §2 | |
| `receive[1].title` | Full-service support | ליווי מלא | | |
| `receive[1].description` | Viewings, financing, legal advice, the notary appointment: one point of contact for all of it. | סיורים בנכסים, מימון, ייעוץ משפטי וחתימה אצל עורך הדין, הכול מול איש קשר אחד. | **Bewusste Abweichung vom EN:** Zypern kennt keinen Notar deutscher Prägung, der Kauf läuft über den Anwalt (§7, Glossar §2). `נוטריון` wäre eine Falschaussage über den Ablauf. |  **Cross-WP:** `הכל` statt `הכול` (Controller-Entscheidung, siehe `wp5-glossary.md`). Wortlaut sonst unverändert — die Anwalts-Formulierung bleibt (Pass B, Must #10: die HE-Zeile ist richtig, die Quelle ist falsch). |
| `receive[2].title` | After-sales support | תמיכה אחרי הרכישה | | |
| `receive[2].description` | Moving-in service, property management and vetted local providers, so you feel at home immediately. | שירותי כניסה לדירה, ניהול הנכס וספקים מקומיים בדוקים, כדי שתרגישו בבית מהיום הראשון. | |  **Should #21:** `ליווי במעבר, ניהול הנכס וספקים מקומיים בדוקים, כדי שתרגישו בבית מהיום הראשון.` `שירותי כניסה לדירה` klang nach Zutrittsdiensten und verengte auf Wohnungen; die Karte gilt auch für Villen. |
| `valuesEyebrow` | Core values | ערכי הליבה | | |
| `valuesTitle` | What guides our actions | מה מנחה אותנו בעבודה | | |
| `values[0].title` | Integrity & transparency | יושרה ושקיפות | | |
| `values[0].description` | Open communication, and every agreement documented in writing. | תקשורת פתוחה, וכל סיכום מתועד בכתב. | | |
| `values[1].title` | Client focus | מיקוד בלקוח | | |
| `values[1].description` | Individual attention — the only way to meet personal wishes and build lasting trust. | יחס אישי לכל לקוח, הדרך היחידה לענות על רצונות אישיים ולבנות אמון לאורך זמן. | |  **Should #20:** `יחס אישי לכל לקוח, הדרך היחידה להתאים את הנכס למה שאתם באמת מחפשים ולבנות אמון לאורך זמן.` `אישי`/`אישיים` war eine Wurzeldopplung im selben String (§11.5). |
| `values[2].title` | Local expertise | מומחיות מקומית | | |
| `values[2].description` | Deep knowledge of Cypriot regions, laws and culture behind every decision. | היכרות מעמיקה עם האזורים, החוקים והתרבות בקפריסין מאחורי כל החלטה. | | |
| `values[3].title` | Excellence & professionalism | מצוינות ומקצועיות | | |
| `values[3].description` | Highest service quality, continuous training, a flawless presence offline and online. | איכות שירות גבוהה, הכשרה מתמשכת ונוכחות מוקפדת אונליין ומחוצה לו. | `flawless` → `מוקפדת`; `ללא רבב` wäre Pathos (§7). |  **Must #4:** `איכות שירות גבוהה, הכשרה מתמשכת ונוכחות מוקפדת ברשת ומחוצה לה.` `מחוצה לו` hatte kein Bezugswort — `אונליין` ist kein Nomen, das ein Pronomen binden kann. |
| `values[4].title` | Sustainability & responsibility | קיימות ואחריות | | |
| `values[4].description` | Environmental aspects in every project, and partners with fair labour and building practices. | שיקולים סביבתיים בכל פרויקט, ושותפים עם תנאי עבודה ובנייה הוגנים. | | |
| `values[5].title` | Innovation & efficiency | חדשנות ויעילות | | |
| `values[5].description` | Modern technology — AI tools, digital document management — to optimise processes and save your time. | טכנולוגיה מודרנית, כלי בינה מלאכותית וניהול מסמכים דיגיטלי, לייעול התהליכים ולחיסכון בזמן שלכם. | Die beiden EN-Gedankenstriche werden zu Kommas (§3). | |
| `teamEyebrow` | The people | האנשים | | |
| `teamTitle` | Who you will be working with | עם מי תעבדו | | |
| `teamLead` | A team spanning six languages and four countries. Whoever picks up the phone, you are talking to someone who lives here. | צוות שמדבר שש שפות ומגיע מארבע מדינות, וכולם גרים כאן. הייעוץ מתקיים באנגלית או ברוסית; פנייה בעברית מתקבלת בברכה. | **Entscheidung E.** Der EN-Satz „sechs Sprachen" weckt auf einer hebräischen Seite genau die Frage, die die zweite Zeile ehrlich beantwortet; „lebt hier" ist in den ersten Satz gezogen, damit der Absatz nicht dritteilig wird. |  **Should #23:** `בצוות שלנו שש שפות וארבע מדינות, וכולם גרים כאן. הייעוץ מתקיים באנגלית או ברוסית; פנייה בעברית מתקבלת בברכה.` Numerus-Bruch `צוות … שמדבר` (Sg.) → `וכולם` (Pl.) behoben. **Die Entscheidung-E-Zeile bleibt wortgleich.** |
| `teamSpeaks` | Speaks | שפות | **Bewusst kein Verb:** `מדבר`/`מדברת` würde jeder Personenkarte ein Geschlecht aufzwingen (§2, §11.2). Steht wortgleich als `speaks` auf der Kontaktseite. | |
| `teamContact` | Get in touch | ליצירת קשר | wortgleich mit `TEAM_BLOCK_COPY.he.contact` (WP3). Derzeit nicht gerendert. | |
| `storiesEyebrow` | Client stories | סיפורי לקוחות | Glossar §4 | |
| `storiesTitle` | What our clients say | מה הלקוחות שלנו אומרים | | |
| `storiesLead` | A few words from people who have already made the move. | כמה מילים מאנשים שכבר עשו את המעבר. | | |
| `storiesAll` | Read all client stories | לקריאת כל סיפורי הלקוחות | Nah an WP3s `לכל סיפורי הלקוחות` (Homepage) — falls der Lektor eine der beiden Formen bevorzugt, bitte beide angleichen. |  **Should #24:** `לכל סיפורי הלקוחות` — WP3 gewinnt (`wp3-glossary.md` Z. 19: Link im Listenkopf neben einem Pfeil, zwei Wörter). Offene Frage 5 damit beantwortet. |
| `ctaTitle` | Let's talk about your plans | נדבר על התוכניות שלכם | | |
| `ctaLead` | Tell us what you are looking for — we will come back to you personally, usually the same day. | ספרו לנו מה אתם מחפשים, ונחזור אליכם באופן אישי, בדרך כלל עוד באותו יום. | |  **Should #25:** `ספרו לנו מה אתם מחפשים, ונחזור אליכם אישית, בדרך כלל עוד באותו יום.` `באופן אישי` ist die Wort-für-Wort-Übertragung von „personally" (§7). |
| `channelWhatsapp` | WhatsApp | וואטסאפ | Glossar §4; **wortgleich** mit der Kontaktseite | |
| `channelPhone` | Phone | טלפון | **wortgleich** mit der Kontaktseite | |
| `channelEmail` | Email | אימייל | **wortgleich** mit der Kontaktseite | |
| `channelHint.whatsapp` | Fastest reply, usually within minutes | התשובה המהירה ביותר, בדרך כלל תוך דקות | **wortgleich** mit der Kontaktseite | |
| `channelHint.phone` | Call us directly during office hours | אפשר להתקשר אלינו ישירות בשעות הפעילות | **wortgleich** mit der Kontaktseite | |
| `channelHint.email` | For detailed enquiries and documents | לפניות מפורטות ולמסמכים | **wortgleich** mit der Kontaktseite | |

## 2. `src/app/preview-contacts/[lang]/copy.ts` — Kontakt

| Key | EN | HE | Anmerkung | Korrektur HE |
|---|---|---|---|---|
| `metaTitle` | Contact Us — Cyprus VIP Estates | צור קשר עם סוכנות הנדל"ן בקפריסין \| Cyprus VIP Estates | 54 Zeichen. `צור קשר` ist laut Glossar §4 der akzeptierte Standard für „Contact" (die einzige geduldete Imperativform). |  **Must #5:** `יצירת קשר עם הצוות שלנו בפאפוס \| Cyprus VIP Estates` (51). Zwei Gründe: `צור קשר` ist als **Navigationslabel** geduldet, hier war es der Kopf eines vollständigen Imperativsatzes im maskulinen Singular an eine unbekannte Leserin (§2.2); und der Head-Term `נדל"ן בקפריסין` gehört der geplanten Cornerstone-Seite #1 (§6). |
| `metaDescription` | Reach the Cyprus VIP Estates team by WhatsApp, phone or email — daily 9:00–18:00. Find a consultant who speaks your language, or visit our office in Paphos. | זמינים בוואטסאפ, בטלפון ובאימייל, מדי יום 9:00 עד 18:00. הייעוץ מתקיים באנגלית או ברוסית; פנייה בעברית מתקבלת בברכה. המשרד שלנו בפאפוס. | 135 Zeichen. **Entscheidung E** ersetzt den EN-Satz über den Sprachfilter: die Erwartung soll schon im Suchergebnis stimmen. Der Bis-Strich `–` wird zu `עד` (§3). |  **Should #13:** `Cyprus VIP Estates בוואטסאפ, בטלפון ובאימייל, מדי יום 9:00 עד 18:00 שעון קפריסין. הייעוץ מתקיים באנגלית או ברוסית; פנייה בעברית מתקבלת בברכה.` (141). Das subjektlose Partizip am Anfang nannte im SERP nicht, wer verfügbar ist; Marke und Zeitzone ergänzt, das Fragment `המשרד שלנו בפאפוס.` gestrichen (der Block wird derzeit nicht gerendert). **Entscheidung-E-Zeile wortgleich.** |
| `heroEyebrow` | Contacts | יצירת קשר | Nominal statt des Nav-Labels `צור קשר`, weil hier kein Button, sondern eine Rubrik steht. | |
| `heroTitle[0]` | Talk to someone who  | מדברים עם מי שגר  | Partizip Plural = genusfrei (§11.2) | |
| `heroTitle[1]` | lives | כאן | Der Gold-Akzent wandert auf `כאן`: das Verb `גר` hängt im Hebräischen am Relativsatz und kann nicht isoliert hervorgehoben werden, ohne `ש-` abzutrennen. Sinnträger ist ohnehin „hier". | |
| `heroTitle[2]` |  here |  | | |
| `heroLead` | Cyprus VIP Estates is a project of SecretBrand Solutions LTD. Whichever way you reach out, a real person answers — daily from 9:00 to 18:00 Cyprus time. | ⟦ISO⟧Cyprus VIP Estates⟦/⟧ הוא פרויקט של ⟦ISO⟧SecretBrand Solutions LTD⟦/⟧. בכל דרך שתפנו אלינו יענה אדם אמיתי, מדי יום בין 9:00 ל-18:00 שעון קפריסין. | Beide Firmennamen isoliert (§11.4). Offene Frage 2 unten: `פרויקט של` für eine Firmenbeziehung. |  **Must #8:** `⟦ISO⟧Cyprus VIP Estates⟦/⟧ הוא מותג של ⟦ISO⟧SecretBrand Solutions LTD⟦/⟧. בכל דרך שתפנו אלינו יענה אדם אמיתי, מדי יום, 9:00 עד 18:00 שעון קפריסין.` Zwei Fehler: (a) `פרויקט` ist laut Glossar §2 verbindlich das Bauprojekt — `פרויקט של SecretBrand` las sich als deren Bauvorhaben (offene Frage 2 → `מותג של`); (b) `בין 9:00 ל-18:00` brach das Öffnungszeiten-Muster, das `wp5-glossary.md` zwei Zeilen weiter selbst festlegt (§11.6). |
| `channelsEyebrow` | Direct lines | קווים ישירים | | |
| `channelsTitle` | Pick whatever suits you | לבחור את הדרך הנוחה לכם | Infinitiv, §2.1 |  **Should #26:** `הדרך שנוחה לכם`. Ein Infinitiv als Abschnitts-H2 liest sich wie ein Button; §2.1 nennt Nominal **vor** Infinitiv. |
| `channelWhatsapp` | WhatsApp | וואטסאפ | wortgleich mit About | |
| `channelPhone` | Phone | טלפון | wortgleich mit About | |
| `channelEmail` | Email | אימייל | wortgleich mit About | |
| `channelHint.whatsapp` | Fastest reply, usually within minutes | התשובה המהירה ביותר, בדרך כלל תוך דקות | wortgleich mit About | |
| `channelHint.phone` | Call us directly during office hours | אפשר להתקשר אלינו ישירות בשעות הפעילות | wortgleich mit About; unpersönliches `אפשר` statt Imperativ (§11.2) | |
| `channelHint.email` | For detailed enquiries and documents | לפניות מפורטות ולמסמכים | wortgleich mit About | |
| `hoursLabel` | Working hours | שעות פעילות | | |
| `hoursValue` | Daily, 9:00 – 18:00 | מדי יום, 9:00 עד 18:00 | Kein `–` (§3); westliche Ziffern (§5). Zeiten wie im EN, nicht verändert. | |
| `hoursOpen` | Open now | פתוח עכשיו | Live-Badge | |
| `hoursClosed` | Closed right now | סגור כרגע | Wird im JSX zu `סגור כרגע · נפתח ב-9:00` verkettet (Trenner ` · ` ist hartcodiert, in beiden Richtungen neutral). | |
| `hoursOpensAt` | Opens at 9:00 | נפתח ב-9:00 | Bindestrich vor der Ziffer nach §3. | |
| `hoursTimezone` | Cyprus time | שעון קפריסין | | |
| `finderEyebrow` | Your contact | איש הקשר שלכם | |  **Should #27:** `אנשי הקשר שלכם`. Maskulinum Singular über einem Grid aus zehn Personen beiderlei Geschlechts (§2); der Plural ist zugleich faktisch richtig. |
| `finderTitle` | Find a consultant who speaks your language | למצוא יועץ שמדבר את השפה שלכם | Infinitiv (§2.1). `יועץ` bleibt maskulin generisch — die Karten darunter nennen ohnehin konkrete Personen. |  **Must #1 (Entscheidung E):** `בחירת יועץ לפי שפה`. Auf `/he` ist „eure Sprache" Hebräisch — die H2 versprach einen hebräischsprachigen Berater, den die Ehrlichkeitszeile zwei Zeilen darunter zurücknimmt. Die Nominalform verspricht nichts und vermeidet zugleich zwei Infinitiv-H2 in Folge (§2.1). |
| `finderLead` | Our team covers six languages. Choose yours and see exactly who you will be talking to. | הצוות שלנו מכסה שש שפות. בחרו את שלכם ותראו בדיוק עם מי תדברו. הייעוץ מתקיים באנגלית או ברוסית; פנייה בעברית מתקבלת בברכה. | **Entscheidung E, Hauptfundstelle.** Sie steht direkt über dem Sprachfilter, weil dort die Erwartung entsteht, Hebräisch auswählen zu können. |  **Must #2 (Entscheidung E):** `הייעוץ מתקיים באנגלית או ברוסית; פנייה בעברית מתקבלת בברכה. בצוות שלנו שש שפות, וכאן אפשר לראות בדיוק עם מי תדברו.` Die Ehrlichkeitszeile steht jetzt **vorne**: so liest der Absatz als Tatsache statt als Rücknahme. Zusätzlich `מכסה שפות` (Kalkierung von „covers languages", §7) und die Aufforderung `בחרו את שלכם` ersetzt, die eine Auswahl verlangte, die die Chips nicht anbieten. **Der Boilerplate-Satz selbst ist zeichengleich geblieben — Glossar §5 bleibt unangetastet.** |
| `finderAll` | All | הכול | Chip neben einer Zahl; identisch mit dem FAQ-Chip |  **Cross-WP:** `הכל` statt `הכול` (Controller-Entscheidung; WP2/WP4/WP5 jetzt wortgleich). |
| `finderLanguageLabel` | Language | שפה | Glossar §4; aria-label der Chipgruppe | |
| `finderEmpty` | No one listed for this language yet — write to us and we will find the right person. | עדיין אין יועץ לשפה הזו. כתבו לנו ונמצא את האדם המתאים. | Zwei Sätze statt Gedankenstrich (§3). |  **Should #32:** `עדיין אין יועץ לשפה הזו. כתבו לנו ונחזור אליכם.` Toter Zweig (`ConsultantFinder.tsx:52–68` baut die Chips aus den Mitgliedern, `visible.length === 0` ist unerreichbar) — er bleibt übersetzt als Regressionsschutz, aber `ונמצא את האדם המתאים` hätte, falls er je erscheint, wieder eine Sprachzusage gemacht (Entscheidung E). |
| `finderCountOne` | 1 consultant | יועץ אחד | Hebräisch stellt das Zahlwort nach — nicht `1 יועץ`. | |
| `finderCountMany` | {n} consultants | {n} יועצים | `{n}` wird zur Laufzeit ersetzt (kein `${…}`, weil der String eine Client-Grenze überquert) — Platzhalter unverändert lassen. | |
| `speaks` | Speaks | שפות | wortgleich mit `teamSpeaks` auf der About-Seite; kein Verb wegen des Genus (§11.2) | |
| `formEyebrow` | Write to us | כתבו לנו | | |
| `formTitle[0]` | Let us  | נחזור אליכם  | |  **Should #28:** `השאירו פרטים ` — angeglichen an `preview-home/sections/Form.tsx:50` (`titleNode("he")`, WP3), das für dieselbe Formularüberschrift `השאירו פרטים ונחזור אליכם בהקדם` rendert. §11.6 verlangt bei duplizierten Strings auch denselben Gold-Akzent. Den Override ganz zu entfernen war die andere Option, hätte aber die Struktur für en/de/pl/ru mitgeändert. |
| `formTitle[1]` | come back | בהקדם | Gold-Akzent auf dem Versprechen („bald"), weil `נחזור אליכם` als Ganzes nicht teilbar ist. |  **Should #28:** `ונחזור אליכם` (der Gold-Akzent wandert auf denselben Teil wie in WP3s `titleNode("he")`). |
| `formTitle[2]` |  to you |  | |  **Should #28:** ` בהקדם`. |
| `formLead` | Leave your details and tell us how you would rather be reached. One of our consultants gets in touch personally — usually the same day. | השאירו פרטים וספרו לנו איך נוח לכם שניצור קשר. אחד היועצים שלנו יחזור אליכם באופן אישי, בדרך כלל עוד באותו יום. | |  **Should #25:** `השאירו פרטים וספרו לנו איך נוח לכם שניצור קשר. אחד היועצים שלנו יענה לכם אישית, בדרך כלל עוד באותו יום.` `באופן אישי` ist die Kalkierung von „personally" (§7); zugleich stand `נחזור` im `formTitle` und `יחזור` im Lead direkt darunter (§11.5). |
| `officeEyebrow` | Visit us | לבקר אצלנו | derzeit nicht gerendert | |
| `officeTitle` | Our office in Paphos | המשרד שלנו בפאפוס | derzeit nicht gerendert; `פאפוס` = Glossar §1 | |
| `officeCompany` | SecretBrand Solutions LTD | SecretBrand Solutions LTD | Firmenname bleibt lateinisch (§4) | |
| `officeAddress` | Palaion Patron Germanou 11, 8011 Paphos, Cyprus | ⟦LTR⟧Palaion Patron Germanou 11, 8011⟦/⟧ פאפוס, קפריסין | Straße und Hausnummer bleiben lateinisch **und** LTR-isoliert, damit `11` nicht neben die Postleitzahl rutscht; nur Stadt und Land werden umgeschrieben. | |
| `officeDirections` | Open in Google Maps | לפתיחה ב-⟦ISO⟧Google Maps⟦/⟧ | Produktname lateinisch, hebräische Präposition mit Bindestrich davor (§5). |  **Should #29:** `פתיחה ב-⟦ISO⟧Google Maps⟦/⟧`. WP2 (`wp2-glossary.md` Z. 27) hat für dieselbe EN-Quelle die Nominalform; sie folgt dem Glossar-Muster §4 und gewinnt (§11.6). Umgekehrt fehlt WP2 die Bidi-Isolation, die hier richtig gesetzt ist. |

## 3. `src/app/preview-contacts/[lang]/languages.ts` — Sprachnamen der Filter-Chips

Neue `he`-Zeile in `LABELS`; `ALIASES` (die Erkennung der gespeicherten Rohtexte) und `ORDER`
(Sortierung der Chips) bleiben unverändert. Fällt eine Sprache durch die Erkennung, zeigt die
Seite weiterhin den gespeicherten Originaltext — der ist im JSX jetzt bidi-isoliert.

| Key | EN | HE | Anmerkung | Korrektur HE |
|---|---|---|---|---|
| `en` | English | אנגלית | | |
| `de` | German | גרמנית | | |
| `ru` | Russian | רוסית | | |
| `pl` | Polish | פולנית | | |
| `es` | Spanish | ספרדית | | |
| `fr` | French | צרפתית | | |
| `nl` | Dutch | הולנדית | | |
| `el` | Greek | יוונית | | |
| `kk` | Kazakh | קזחית | | |
| `uz` | Uzbek | אוזבקית | | |

## 4. `src/app/preview-faq/[lang]/copy.ts` — FAQ (nur das Seiten-Chrome)

| Key | EN | HE | Anmerkung | Korrektur HE |
|---|---|---|---|---|
| `metaTitle` | Cyprus Property FAQ for Foreign Buyers | שאלות נפוצות על נדל"ן בקפריסין \| Cyprus VIP Estates | 51 Zeichen. `שאלות נפוצות` als Überschriftenform ist in WP3 entschieden; `שאלות ותשובות` bleibt das Menü-Label. |  **Must #6:** `שאלות נפוצות על קניית נכס בקפריסין \| Cyprus VIP Estates` (55). **Exact-Match-Kannibalisierung:** `נדל"ן בקפריסין` (320/Mon., CPC $6,70) ist das Primär-KW der geplanten Cornerstone-Seite #1 (`he-keyword-map.md` §4); eine FAQ-Seite ohne Inventar darf ihn nicht vorbelegen (§6). Der FAQ gehört der Long-Tail-Cluster `קניית נכס בקפריסין` (30) / `קניית דירה בקפריסין` (40), der zugleich Seite #13 stützt statt sie zu verdrängen. |
| `metaDescription` | Answers to the questions we hear most from international buyers — foreigner eligibility, costs & VAT, residency, financing, and buying off-plan in Cyprus. | תשובות לשאלות שרוכשים מחו"ל שואלים אותנו הכי הרבה: זכאות לזרים, עלויות ומע"מ, תושבות, מימון ורכישת דירה על הנייר בקפריסין. | 122 Zeichen. Begriffe streng wie im EN: `מע"מ`, `תושבות`, `על הנייר` (Glossar §2/§3) — **keine** Sätze oder Zusicherungen über Steuern oder Aufenthalt, die das EN nicht macht. |  **Should #14:** `מה שרוכשים מישראל הכי רוצים לדעת לפני קניית נכס בקפריסין: זכאות לזרים, עלויות ומע"מ, תושבות קבע, מימון ופרויקטים חדשים.` (119). Drei Punkte: (a) `על הנייר` hat laut `he-keyword-map.md` §2/§6.5 **null** Volumen — die hebräische Nachfrage heißt `פרויקטים חדשים`; (b) `שאלות … שואלים` war eine Wurzeldopplung (§11.5); (c) `רוכשים מחו"ל` liest ein israelischer Leser zuerst als Ausländer in Israel — §6 nennt `לרוכשים מישראל` als Muster. 119 statt der 120–155 aus §6: bewusst ein Zeichen darunter, weil die Alternative `…ופרויקטים חדשים בקפריסין.` (130) `בקפריסין` im selben Satz verdoppelt hätte. |
| `eyebrow` | Support | תמיכה | | |
| `heroTitlePart1` | Frequently  | שאלות  | |  **Should #15:** `שאלות נפוצות על ` — die H1 lautete nur `שאלות נפוצות`, ein Rubriklabel statt einer H1 (§6: „H1 = Suchintention in natürlicher Sprache"). Der dreiteilige Split bleibt, `Part2` bleibt leer. |
| `heroTitlePart2` | Asked  |  | Leer: das Hebräische braucht für „frequently asked questions" nur zwei Wörter. Der mittlere Teil ist im JSX nur die Umbruchsperre um den Gold-Teil, er darf leer sein. | |
| `heroTitlePart3Italic` | Questions | נפוצות | Gold-Akzent |  **Should #15:** `קניית נכס בקפריסין` (trägt den Gold-Akzent und zugleich den Ziel-Cluster). |
| `heroLead` | Straight answers to what international buyers ask us most — before, during and after purchasing property in Cyprus. | תשובות ישירות לשאלות שרוכשים מחו"ל שואלים אותנו לפני רכישת נכס בקפריסין, במהלכה ואחריה. | `רוכשים מחו"ל` wie in WP3 (Homepage). |  **Should #16:** `תשובות ישירות למה שרוכשים מישראל הכי רוצים לדעת לפני קניית נכס בקפריסין, במהלכה ואחריה.` `שאלות … שואלים` (§11.5) und `רוכשים מחו"ל` wie in #14. Der Rückbezug `במהלכה ואחריה` auf `רכישת`/`קניית` (fem.) bleibt korrekt. |
| `heroMeta(q, t)` | 3 questions across 9 topics | 3 שאלות ב-9 נושאים | Funktion, Signatur unverändert. Bindestrich vor der Ziffer (§3). | |
| `allChipLabel` | All | הכול | identisch mit dem Kontakt-Chip |  **Cross-WP:** `הכל` statt `הכול` (Controller-Entscheidung; identisch mit dem Kontakt-Chip). |
| `questionsCount(n)` | 3 questions / 1 questions | 3 שאלות / שאלה אחת | **Verbesserung gegenüber dem EN:** die Funktion unterscheidet Singular und Plural, das EN sagt auch bei einer Frage „1 questions". Signatur unverändert. | |
| `expandAll` | Expand all | פתיחת הכול | Nominal (§2.1) |  **Cross-WP:** `פתיחת הכל`. |
| `collapseAll` | Collapse all | סגירת הכול | Nominal |  **Cross-WP:** `סגירת הכל`. |
| `categoriesAriaLabel` | FAQ categories | קטגוריות שאלות ותשובות | Nur für Screenreader; hier passt das Menü-Label aus Glossar §4. |  **Should #30:** `קטגוריות שאלות נפוצות`. Das Menü-Label `שאלות ותשובות` gehört nicht auf die Seite, deren eigene H1 `שאלות נפוצות` heißt — WP3 hat die beiden Register getrennt (`wp3-glossary.md` Z. 13). |
| `formTitlePlain` | Still  | נשארה  | |  **Should #31:** `נשארה לכם `. Unpersönlich; israelisch fragt man `נשארה לכם שאלה?`. Das hartcodierte `?` im JSX und der Gold-Teil `שאלה` bleiben unverändert. |
| `formTitleItalic` | have a question | שאלה | Ergibt mit dem hartcodierten Fragezeichen im JSX: `נשארה שאלה?` | |
| `formSubtitle` | Every buyer's situation is a little different. Send us yours and we'll answer it directly. | המצב של כל רוכש קצת שונה. שלחו לנו את השאלה שלכם ונענה עליה ישירות. | | |

---

## Zweiter Durchgang über das rendernde JSX (§11.3)

| Datei | Befund | Behandlung |
|---|---|---|
| `preview-about/[lang]/page.tsx` | Die Sprachliste jeder Team-Karte kommt roh aus der DB („deutsch, english, русский") und steht direkt unter dem hebräischen Label. | Liste in `<Bdi>` gesetzt. Für en/de/pl/ru ändert das nichts (ein `<bdi>` um reinen LTR-Text in einem LTR-Absatz ist wirkungslos). |
| `preview-contacts/[lang]/ConsultantFinder.tsx` | Eine nicht erkannte Sprache fällt als gespeicherter Originaltext durch und kann die hebräische Zeile mischen. | Liste in `<Bdi>` gesetzt, gleiche Begründung. |
| `ContactChannels.tsx` | Telefonnummer und E-Mail | waren bereits in `<Bdi ltr>` — unverändert. |
| `OfficeHours.tsx` | Verkettung `${closed} · ${opensAt}` | Beide Teile hebräisch, der Trenner ist richtungsneutral — keine Änderung nötig. |
| `preview-faq/[lang]/page.tsx` | Hartcodiertes `?` hinter dem Gold-Teil des Formulartitels | Im RTL-Absatz landet es korrekt am linken Satzende — keine Änderung nötig. |
| Alle drei Seiten | Hero-H1 und Formulartitel sind dreiteilig, der mittlere Teil trägt `.it` | Die hebräischen Splits sind so gewählt, dass kein Präfix (`ש-`, `ב-`, `מ-`) vom Wort getrennt wird und der Satz nicht auf einer Negation endet (§11.3). |
| Nummerierungen `01/02/03` (Werte, Schritte, Kanäle) | rein numerisch, `aria-hidden` | keine Änderung |

## Offene Punkte (Tickets außerhalb von WP5)

Beides sind **Inhalts-Tickets, keine Code-Änderungen in diesem Work Package** — die hebräischen
Strings bleiben, wie sie hier stehen.

1. **`/he/faq` rendert derzeit nicht (404).** `preview-faq/[lang]/page.tsx:53–54` ruft
   `getFaqPageByLang(lang)` und läuft in `notFound()`, wenn es keine `siteDocument`-Zeile
   `type="faqPage"` für die Sprache gibt; `scripts/seed-faq-translations.mjs:53` seedet nur
   `["en","de","pl","ru"]`. Das übersetzte FAQ-Chrome ist damit unsichtbar und die 60 Q&A sind
   unübersetzt. **Phase-5-Content-Task:** `he`-Zeile seeden, Q&A übersetzen und **danach**
   faktenprüfen (keine Steuersätze, Fristen oder Aufenthaltszusagen über die EN-Vorlage in
   `src/app/preview-faq/faqData.ts` hinaus). Bis dahin darf `/he/faq` nicht in Sitemap oder Nav.
2. **Zwei Falschaussagen in der EN/DE/PL/RU-Quelle der About-Seite.**
   (a) `receive[1]` sagt „the notary appointment" / „Notartermin": Zypern ist eine
   Common-Law-Rechtsordnung, die Kaufabwicklung läuft über den Anwalt (§7, Glossar §2). Die
   hebräische Zeile weicht deshalb bewusst ab (`חתימה אצל עורך הדין`) und **bleibt so** — Pass B
   hat sie ausdrücklich bestätigt. Vorschlag für die Quelle: EN
   `Viewings, financing, legal advice, signing at the lawyer's: one point of contact for all of it.`,
   DE `…, die Unterzeichnung beim Anwalt: …`.
   (b) `work[1]` sagt „Decades of experience", während zwei Sektionen darüber `10` +
   „Years of experience" und die H2 „Ten years on the ground" stehen. Die hebräische Zeile sagt
   jetzt `ניסיון רב`; EN/DE/PL/RU tragen den Widerspruch weiter.
   **Ticket:** EN/DE/PL/RU `receive[1]` und `work[1]` in `src/app/preview-about/[lang]/copy.ts`
   korrigieren — in einem Zug, weil beide dieselbe Datei und dieselbe Sektion betreffen und der
   `copy-snapshot`-Gate den LTR-Text absichert.

## Offene Fragen an den Lektor (Pass C)

Die Fragen 1–6 sind durch Pass B beantwortet — siehe `wp5-glossary.md`, Abschnitt
„Nach Pass B beantwortet". Der Vollständigkeit halber der ursprüngliche Wortlaut:

1. **`שפות` statt eines Verbs als Kartenlabel** (`teamSpeaks` / `speaks`). Alternative wäre
   `דוברים` (Partizip Plural) — auf einer Karte mit **einer** Person klingt der Plural aber falsch.
   Wenn der Lektor eine bessere genusfreie Einwortform kennt: bitte an beiden Stellen eintragen.
2. **`הוא פרויקט של`** für „is a project of" (`heroLead`, Kontakt). `פרויקט` ist im Glossar §2 der
   Fachbegriff für ein Bauprojekt — hier steht er für eine Firmenbeziehung. Alternativen:
   `הוא מותג של` oder `פועל תחת`. Der englische Satz soll inhaltlich nicht verändert werden.
3. **`אי השמש`** für „the island of sunshine" (About `heroLead`). Klingt das als hebräische
   Wendung natürlich oder eher übersetzt? Falls Letzteres: streichen und nur `בקפריסין` sagen.
4. **`המעבר לקפריסין`** vs. `מעבר לקפריסין` in der Stance-H1 — bestimmt oder unbestimmt.
5. **`לקריאת כל סיפורי הלקוחות`** (About) neben WP3s `לכל סיפורי הלקוחות` (Homepage). Eine der
   beiden Formen sollte gewinnen; wir haben die längere gewählt, weil das EN „Read all" sagt.
6. **Sprachnamen der Chips** — `הולנדית`, `קזחית`, `אוזבקית` sind die Standardformen, aber selten
   im Alltag; bitte bestätigen.

## Gate-Abdeckung (in Fix-Runde 1 geschlossen)

Pass A hatte gemeldet, dass `preview-about` und `preview-contacts` **nicht** in
`scripts/qa/copy-modules.json` stehen, weil ihre `ALL`-Tabelle nicht exportiert ist — ihre
`he`-Meta-Strings liefen deshalb weder durch `he-meta-length.mjs` noch durch den
`copy-snapshot`-Gate. Beide Tabellen heißen jetzt `ABOUT_COPY` bzw. `CONTACTS_COPY`, sind
exportiert und in `copy-modules.json` registriert; die Snapshot-Baseline für beide Module ist
mit `--write --only` erzeugt.

Graphem-Zählung nach den Korrekturen (dieselbe Metrik wie `he-meta-length.mjs`,
`Intl.Segmenter`): About Title 55 / Description 131 · Kontakt Title 51 / Description 141 ·
FAQ Title 55 / Description 119. Alle innerhalb 60 bzw. 155.

## Nicht in diesem Pass erledigt (für den Controller)

- `ConsultantFinder.tsx:63` isoliert das Chip-Label nicht: `languageLabel(k, lang, raws.get(k))`
  fällt bei unbekanntem Schlüssel auf den gespeicherten Rohtext zurück (`oʻzbekcha`, `русский`),
  der ungeschützt neben `{c.count}` im Button steht — derselbe Fallback, der auf der Personenkarte
  als isolierungsbedürftig eingestuft wurde. In der Praxis harmlos (ein Button ist ein eigener
  Bidi-Kontext, `ALIASES` deckt die zehn bekannten Sprachen ab), aber die Behandlung sollte an
  beiden Stellen gleich sein. Pass B, „Systemic" 5.
- Die About-Seite zeigt die Team-Sprachen als **Rohtext aus der DB**, nicht über
  `languageLabel()` wie die Kontaktseite. Sie erschiene auf `/he/about-us` also lateinisch.
  Das zu vereinheitlichen würde die Ausgabe der LTR-Locales verändern (`deutsch` → `Deutsch`)
  und gehört deshalb in ein eigenes Ticket.
