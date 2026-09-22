# Lektorat WP3 — Startseite und Landingpage-Blöcke (`he`)

**Stand:** 2026-09-13 · **Pass A + Pass B (Fix-Runde 1) abgeschlossen, wartet auf Pass C (Muttersprachler)**
**Work Package:** WP3 (Homepage `/he` + Landing-Block-Copy)
**Marker im Code:** jede Zeile trägt `// REVIEW(he)`; nach Freigabe wird der Marker entfernt (Phase 8).

## Seiten zum Anschauen

| Seite | URL | Was dort sichtbar ist |
|---|---|---|
| Startseite | `/he` | Hero-H1, alle Abschnitts-H2 mit Gold-Akzent, Städte-Absatz, Projektkarten, FAQ, Formular |
| Case-Studies-Übersicht | `/he/case-studies` | die sechs Kategorie-Labels |
| Landingpage-Template | jede lokalisierte Singlepage unter `/he/…`, die den `bulletsBlock`, den `howWeWorkBlock` oder einen FAQ-Block ohne eigenen Titel führt | die sechs Zypern-Fakten, die sechs Ablaufschritte, die FAQ-Überschrift, der Gold-Akzent im `howWeWorkBlock`-H2 |

> **Hinweis:** Die HE-Startseite existiert erst, wenn Phase 6 die CMS-Inhalte anlegt. Bis dahin
> lässt sich WP3 gegen `/en` bzw. `/de` mit umgeschaltetem `lang` prüfen; die hier gelisteten
> Strings sind vollständig, die **Abschnitts-H2 dagegen kommen aus dem CMS** (siehe nächster Abschnitt).

## Worauf besonders zu achten ist

- **Hero-H1** — trägt bewusst den Suchbegriff `נדל"ן בקפריסין`. Klingt er als Überschrift natürlich oder nach Keyword?
  **Keyword-Abgrenzung (Pass B #14):** derselbe Hub-Term ist in `he-keyword-map.md` §4 das Primär-KW
  der Cornerstone-Seite #1 (`/he/real-estate-cyprus`, H1 `נדל"ן בקפריסין: פרויקטים חדשים למכירה בלימסול ובפאפוס`).
  Die H1 der Startseite **bleibt** — Startseite = Marken-/Expertise-Intent, Cornerstone = Listing-Intent.
  Damit die Cornerstone den nackten Term behält, schneidet Phase 6 den **Meta-Title der Startseite**
  auf Marke + Zielgruppe: `מומחי נדל"ן בקפריסין לרוכשים מישראל | Cyprus VIP Estates` (52 Zeichen).
  WP3 selbst liefert keine Meta-Strings; der Titel gehört in den Phase-6-CMS-Brief unten.
- **Akzentwörter in den H2** — jeder Abschnitt hebt genau ein Wort/eine Wortgruppe gold-kursiv hervor. Die Hervorhebung funktioniert nur, wenn das Wort **wörtlich** im CMS-Titel steht. Der jeweils vorgesehene hebräische H2 steht als Kommentar direkt neben dem Akzent im Code und in der Tabelle unten. Wenn der Lektor einen H2 umformuliert, **muss** das Akzentwort mitgeändert werden.
- **Städte-Absatz** — Larnaka wurde gegenüber dem Englischen bewusst gestrichen (Styleguide §8: kein Inventar, wird nicht beworben). Bitte bestätigen.
- **Ablaufschritte (How we work)** — Wechsel zwischen `אתם` und `אנחנו`; liest sich das als Dialog oder als Belehrung?
- **Kundenstimmen-Slider / Team-Block** — keine erfundenen Aussagen, nur der CTA-Text.
- **FAQ-Überschrift** — `שאלות נפוצות` statt des Nav-Labels `שאלות ותשובות` (siehe `wp3-glossary.md`).
- **Bauträger-Logoleiste** — `יזמים` (Glossar §2), nicht `מפתחים`.
- **Formular-Überschrift** — der gold-kursive Teil ist `ונחזור אליכם`. Sie steht an **zwei** Stellen:
  `preview-home/sections/Form.tsx` `titleNode("he")` und `FormStatic.copy.ts:115` (`he.title`). Beide sind
  seit Pass B wortgleich auf `השאירו פרטים ונחזור אליכם בהקדם` gezogen (§11.6); `השאירו פנייה` (Kalkierung
  von «Оставьте заявку») ist entfallen. Eine Korrektur hier muss immer beide Dateien treffen.
- **Formularfelder** — das gesamte Feld-Dictionary (Labels, Legende, Send-Button, alle Validierungen,
  Success/Error) liegt seit Pass B in `preview-home/sections/Form.copy.ts`, Tabelle unten. Vorher hatte
  `Form.tsx` nur ein `DICT` ohne `he`-Zweig, sodass jede `/he/…`-Seite ein **englisches Formular unter
  der hebräischen Überschrift** ausgeliefert hätte (§10).
- **Preiszelle** — `החל מ-` steht in einem eigenen `<span>` vor dem Preis. Der Präfix-Bindestrich in `מ-`
  ist ein Anschlusszeichen und darf nie von dem getrennt werden, was folgt (§5: `החל מ-€450,000`); die
  vorherigen `margin-inline-end: 0.45em` waren also ein Typografiefehler, keine Geschmacksfrage.
  **Erledigt:** `src/app/preview-home/tokens.css` trägt neben `.pcard__from` die Regel
  `[dir="rtl"] .pcard__from { margin-inline-end: 0; }` (LTR unverändert; betrifft `FeaturedSlider.tsx`
  und `LatestDevelopments.tsx`, beide nutzen dieselbe Klasse). Der Text bleibt `החל מ-`.

## Checkliste Styleguide §10

- [ ] Kein `TODO(he)`, kein englischer Restsatz
- [ ] Genus gemäß §2 (Nominal-/Infinitivstil, sonst männlicher Plural), keine Schrägstriche
- [ ] Preise/Nummern nach §5, Bidi isoliert (Preise laufen bereits durch `<Bdi ltr>`)
- [ ] Ortsnamen nach Glossar (`לימסול`, `פאפוס`), Eigennamen lateinisch
- [ ] Meta-Title ≤ 60, Description ≤ 155 (WP3 enthält keine Meta-Strings — n/a)
- [ ] Keine Zeile aus §7 (keine `גלו`, keine Adjektivstapel, kein `—`, keine Doppelpunkt-Titel)
- [ ] Faktencheck: jede Zahl hat eine Quelle (WP3: nur „340 ימי שמש", aus der EN-Quelle übernommen)
- [ ] Akzentwort steht wörtlich im zugehörigen H2 — prüfbar gegen den **Phase-6-CMS-Brief** am Ende dieses Dokuments (die hebräischen CMS-Titel selbst entstehen erst in Phase 6)

**Korrekturen bitte in die Spalte `Korrektur HE` eintragen.** Leere Zelle = unverändert übernommen.

---

## `src/app/preview-home/sections/homeI18n.ts` — `HOME_STRINGS.he`

| Key | EN | HE | Anmerkung | Korrektur HE |
|---|---|---|---|---|
| `heroLine1` | `Cyprus ` | `מומחי ` | H1, Teil 1 von 3. Leerzeichen am Ende beibehalten. | |
| `heroAccent` | `Property` | `נדל"ן` | H1, gold-kursiv. Gershayim (§4) ist SEO-relevant. | |
| `heroLine2` | ` Experts` | ` בקפריסין` | H1, Teil 3. Ganze H1: `מומחי נדל"ן בקפריסין`. | |
| `getConsultation` | `Get Consultation` | `לקבלת ייעוץ` | Hero-Button; identisch mit WP1 (Header-CTA). | |
| `viewAllProjects` | `View All Projects` | `לצפייה בכל הפרויקטים` | Zweiter Hero-Button. | |
| `citiesLead` | `From lively marinas to quiet old towns, … Limassol, … Paphos, or … Larnaca — … 340 days of sunshine each year.` | `מהמרינות ההומות ועד לסמטאות העיר העתיקה, בכל מקום בקפריסין יש דרך אחרת לחיות מול הים. בלימסול תמצאו אנרגיה קוסמופוליטית ובפאפוס קסם היסטורי, ובשתיהן תשתיות ברמה עולמית, מסגרת משפטית יציבה ויותר מ-340 ימי שמש בשנה.` | **Larnaka gestrichen** (§8, bestätigt). Gedankenstrich der Quelle in zwei Sätze aufgelöst (§3). **Pass B #2 neu geschrieben:** Satz 2 hatte kein regierendes Verb (die vorangestellte Präpositionalphrase aus dem englischen „Whether you are drawn to…" war ersatzlos gestrichen); zusätzlich Plural `מהמרינות` wie im EN und `ברמה עולמית` für „world-class". | |
| `newLead2` | `Latest ` | `פרויקטים ` | H2 „Latest Developments", Teil 1. | |
| `newAccent` | `Developments` | `חדשים` | gold-kursiv. Ganze H2: `פרויקטים חדשים`. | |
| `showAllProjects` | `Show all projects` | `לכל הפרויקטים` | Link im Listenkopf. **Pass B #12 geändert** (war `הצגת כל הפרויקטים` — Software-Register; §4 `הצגת עוד` ist ein Pagination-Control). Jetzt dasselbe Muster wie `exploreAllCases`. | |
| `priceFrom` | `from` | `החל מ-` | Glossar §2. Steht direkt vor dem `<Bdi>`-Preis. | |
| `priceOnRequest` | `Price on request` | `מחיר לפי פנייה` | Glossar §2. | |
| `onRequest` | `On request` | `לפי פנייה` | Kurzform in der Karte. | |
| `sold` | `Sold` | `נמכר` | Badge, Glossar §4. | |
| `contentTitle` | `Your Guide to Property in Cyprus` | `המדריך שלכם לנדל"ן בקפריסין` | Das **letzte** Wort wird automatisch gold-kursiv, hier also `בקפריסין`. | |
| `contentLead` | `What to know before you buy — the regions, the property types, the process for international clients, and where the long-term value lies.` | `מה כדאי לדעת לפני הרכישה: האזורים, סוגי הנכסים, התהליך לרוכשים מחו"ל והיכן טמון הערך לטווח הארוך.` | Gedankenstrich → Doppelpunkt (erlaubt im Fließtext, verboten nur in Überschriften §3). **Pass B #9:** `ואיפה נמצא` → `והיכן טמון` — `איפה` ist gesprochene Umgangssprache in einem geschriebenen Satz, `נמצא` die flache Übersetzung von „lies" (§1 Register). | |
| `faqLead` | `Everything buyers ask us about property in Cyprus, in one place.` | `כל מה שרוכשים שואלים אותנו על נדל"ן בקפריסין, במקום אחד.` | | |
| `readCaseStudy` | `Read case study` | `לקריאת סיפור הלקוח` | | |
| `exploreAllCases` | `Explore all cases` | `לכל סיפורי הלקוחות` | Glossar §4: `סיפורי לקוחות`. **Rendert derzeit nicht:** `CaseStudies.tsx:89` liest `{button.label \|\| t.exploreAllCases}` innerhalb von `{button?.label && …}`, der Fallback ist also unerreichbar (wie die auskommentierte `trustedBy`-H2). String bleibt korrekt hinterlegt, muss aber nicht geprüft werden. | |

## `src/app/preview-home/sections/homeI18n.ts` — `CASE_CATEGORY_LABELS.he`

| Key | EN | HE | Anmerkung | Korrektur HE |
|---|---|---|---|---|
| `luxury-villa` | `Luxury Villa Purchase` | `רכישת וילת יוקרה` | Chip, kurz halten. | |
| `apartment` | `Apartment Purchase` | `רכישת דירה` | | |
| `investment` | `Investment Property` | `נכס להשקעה` | | |
| `relocation` | `Relocation to Cyprus` | `רילוקיישן לקפריסין` | Glossar §3, zugleich Suchbegriff (170/Mon.). | |
| `permanent-residency` | `Permanent Residency` | `תושבות קבע` | Glossar §3. Keine Zusicherung im Label. | |
| `new-development` | `New Development` | `פרויקט חדש` | Glossar §2. | |

## Akzentwörter der Abschnitts-H2 (`ACCENTS_BY_LANG.he`)

Der Titel kommt aus dem CMS; das Akzentwort muss **wörtlich** darin vorkommen.
`highlightAccents` sucht per `indexOf` **ohne Wortgrenze**. Ein einzelnes unpräfigiertes Wort trifft
auch mitten in einem präfigierten Wort (`קפריסין` in `בקפריסין`) und vergoldet dann nur den Wortrest —
das `ב` bliebe ungold. Akzentphrasen deshalb **mit ihrem Präfix** oder **zweiwortig** notieren, und der
Phase-6-CMS-Brief legt den H2 wörtlich fest.
Die Spalte „HE (Akzent)" ist der Code-Wert, „vorgesehener H2" die Vorgabe für die CMS-Redaktion in Phase 6.

| Key (Datei) | EN (heutiger CMS-Titel) | HE (Akzent) | Anmerkung: vorgesehener H2 | Korrektur HE |
|---|---|---|---|---|
| `About.tsx` | `There is Only One Cyprus` | `קפריסין` | `יש רק קפריסין אחת` — wie DE/PL/RU wird der Ländername hervorgehoben, nicht „only one". | |
| `CaseStudies.tsx` | `… Success Stories …` | `סיפורי לקוחות` | `סיפורי לקוחות מקפריסין` — zwei Wörter als **eine** Akzentphrase (ein zusammenhängender Gold-Span). | |
| `Cities.tsx` | `Properties for Sale in Cyprus` | `נכסים למכירה` | `נכסים למכירה בקפריסין` — `בקפריסין` bleibt bewusst ungold (wie EN). Alternative siehe `wp3-glossary.md`, offene Frage 1. | |
| `Description.tsx` | `Why … We …` | `בוחרים בנו` | `למה רוכשים מישראל בוחרים בנו` — **Pass B #4 geändert** (war `בנו`): ein gebundenes Pronomen ist in Goldkursiv ein 3-Zeichen-Fragment (`בנו` allein heißt isoliert „sie bauten"/„sein Sohn") und kollidiert leicht als Substring. Verb + Pronomen als eine Phrase, damit zugleich präfixfest. | |
| `Faq.tsx` | `… Questions … Cyprus` | `שאלות` | `שאלות נפוצות על נדל"ן בקפריסין` — `שאלות` passt auch, falls die Redaktion `שאלות ותשובות` schreibt. **Einwortig:** der CMS-Titel muss `שאלות` ohne Artikel führen (`השאלות` ergäbe einen halb vergoldeten Wortrest). | |
| `FeaturedProjects.tsx` | `Featured Real Estate Projects` | `פרויקטים` | `פרויקטים נבחרים בקפריסין` — `נבחרים` bewusst statt Glossar §4 `מובחר` (das taugt nur als Badge). **Einwortig:** CMS-Titel muss `פרויקטים` ohne Artikel führen. | |
| `HowWeWork.tsx` | `How We Work` | `אנחנו` | `כך אנחנו עובדים` — Pronomen wie DE/RU; anders als im Polnischen ist `אנחנו` hier ein isoliertes Wort und kollisionsfrei (kein hebräisches Wort enthält `אנחנו`). Greift seit Pass B #7 auch auf Landingpages: `ClassicBlocks.tsx` reicht `lang` an beide `HowWeWorkSection`-Aufrufe durch. | |

Alle sieben Akzente sind gegen den jeweils vorgesehenen H2 maschinell geprüft: wörtlicher Substring,
und keiner davon Teil eines längeren Wortes in diesem H2.

## `src/app/preview-landing/blockCopy.ts` — `BULLETS_TEXT.he`

Die LTR-Locales schreiben diese Bullets teils in Versalien; Hebräisch kennt keine Groß-/Kleinschreibung, daher normale Schreibung.

| Key | EN | HE | Anmerkung | Korrektur HE |
|---|---|---|---|---|
| `[0]` | `340 SUNNY DAYS A YEAR` | `340 ימי שמש בשנה` | Westliche Ziffern (§5). | |
| `[1]` | `MEMBER OF THE EUROPEAN UNION` | `מדינה חברה באיחוד האירופי` | Bezug ist das Land (feminin). **Pass B #3 geändert** (war `חברה באיחוד האירופי`): als alleinstehender Bullet liest sich `חברה` zuerst als „eine Firma", der Bezug `קפריסין` steht nicht in der Zeile. | |
| `[2]` | `ONE OF THE BEST TAX SYSTEMS` | `אחת ממערכות המס הטובות ביותר` | Keine Zahl, keine Zusicherung. | |
| `[3]` | `excellent quality of life` | `איכות חיים גבוהה` | | |
| `[4]` | `VERY HIGH STANDARD OF EDUCATION` | `רמת חינוך גבוהה מאוד` | | |
| `[5]` | `MODERN healthcare system` | `מערכת בריאות מודרנית` | GESY wird hier nicht genannt (Quelle nennt es auch nicht). | |

## `src/app/preview-landing/blockCopy.ts` — `STEPS_TEXT.he`

| Key | EN | HE | Anmerkung | Korrektur HE |
|---|---|---|---|---|
| `[0]` | `You contact us via the form on our website` | `אתם פונים אלינו דרך הטופס באתר` | Männlicher Plural (§2.2). | |
| `[1]` | `We will contact you and discuss your requirements` | `אנחנו חוזרים אליכם ומבררים מה אתם מחפשים` | Präsens statt Futur — im Hebräischen der natürliche Ablauf-Ton (Pass B bestätigt: liest sich als Dialog, nicht als Belehrung). **Pass B #10 geändert** (war `…ועוברים יחד על הדרישות שלכם`): `דרישות` klingt nach Lastenheft, und `יחד` stand doppelt in `[1]` und `[3]` (§11.5). | |
| `[2]` | `You plan your trip to Cyprus with us` | `אתם מתכננים איתנו את הנסיעה לקפריסין` | | |
| `[3]` | `We visit all suitable projects together` | `אנחנו מבקרים יחד בכל הפרויקטים המתאימים` | | |
| `[4]` | `You sign the purchase agreement with the developer` | `אתם חותמים על חוזה המכר מול היזם` | Glossar §2: `חוזה מכר`, `יזם` (kein Notar, §7). | |
| `[5]` | `After completion, we will ceremoniously hand over the keys to you` | `עם סיום הבנייה אנחנו מוסרים לכם את המפתחות בטקס חגיגי` | „completion" = Bauende, nicht Zahlungsabschluss. | |

## `src/app/preview-landing/blockCopy.ts` — `FAQ_TITLE.he`

| Key | EN | HE | Anmerkung | Korrektur HE |
|---|---|---|---|---|
| `FAQ_TITLE` | `Frequently asked questions` | `שאלות נפוצות` | Abschnittsüberschrift, nicht das Nav-Label `שאלות ותשובות` (§4). | |

## `src/app/components/DevelopersLogos/DevelopersLogos.copy.ts`

| Key | EN | HE | Anmerkung | Korrektur HE |
|---|---|---|---|---|
| `trustedBy` | `We work with the best developers in Cyprus` | `אנחנו עובדים עם היזמים המובילים בקפריסין` | `מובילים` statt `הטובים ביותר` (Boilerplate §5, weniger Superlativ). Die H2 ist derzeit im Markup auskommentiert. | |

## `src/app/components/ProjectsSectionSlider/ProjectsSectionSlider.copy.ts`

| Key | EN | HE | Anmerkung | Korrektur HE |
|---|---|---|---|---|
| `viewProject` | `View project` | `לצפייה בפרויקט` | Infinitiv (§2.1). | |

## `src/app/components/SliderReviewsFull/SliderReviewsFull.copy.ts`

| Key | EN | HE | Anmerkung | Korrektur HE |
|---|---|---|---|---|
| `readFullReview` | `Read full review` | `לקריאת ההמלצה המלאה` | **Pass B #5 geändert** (war `לקריאת חוות הדעת המלאה`): `חוות דעת` ist das Fachgutachten (משפטית/רפואית), nicht die Kundenstimme; die heißt `המלצה`. Zugleich 3 statt 4 Wörter (§11.7). Register-Trennung siehe `wp3-glossary.md`, Frage 2 (beantwortet). | |

## `src/app/components/TeamBlockComponent/TeamBlockComponent.copy.ts`

| Key | EN | HE | Anmerkung | Korrektur HE |
|---|---|---|---|---|
| `contact` | `Contact` | `ליצירת קשר` | Button auf der Beraterkarte. Erinnerung §8: das Team spricht kein Hebräisch — die Sprachnotiz steht auf der Kontaktseite (WP1), nicht hier. | |

## `src/app/preview-home/sections/Form.tsx` — `titleNode("he")`

| Key | EN | HE | Anmerkung | Korrektur HE |
|---|---|---|---|---|
| `titleNode` | `Leave **your details** and we will contact you shortly` | `השאירו פרטים **ונחזור אליכם** בהקדם` | Fett = gold-kursiver `<span className="it">`. Männlicher Plural (§2.2), kein Ausrufezeichen. **Zweite Fundstelle:** `src/app/components/FormStatic/FormStatic.copy.ts:115` (`he.title`) — in Pass B von `השאירו פנייה…` auf denselben Wortlaut gezogen (§11.6). Eine Korrektur hier gilt für beide Dateien. | |

## `src/app/preview-home/sections/Form.copy.ts` — `FORM_COPY.he`

Neu in Fix-Runde 1 (Pass B #1). Vorher lag dieses Dictionary als `DICT` in `Form.tsx` und hatte
**keinen `he`-Zweig**; `DICT[lang] ?? DICT.en` lieferte damit auf jeder `/he/…`-Seite ein komplett
englisches Formular. Die Datei wird von `[lang]/page.tsx`, `[lang]/projects`, `[lang]/blog`,
`preview-contacts`, `preview-case-studies`, `preview-faq` und `preview-landing/ClassicBlocks`
importiert — das ist kein Preview-Code.

Labels sind kurze Nomen, der Button nominal, die Validierungen unpersönlich (`יש להזין …`, §11.2),
und Labels/Validierungen sind wortgleich mit `FormStatic.copy.ts` `he`, Success/Error wortgleich mit
`src/app/components/formFeedbackCopy.ts` `he` (§11.6).

| Key | EN | HE | Anmerkung | Korrektur HE |
|---|---|---|---|---|
| `labelName` | `Your name` | `שם פרטי` | Feld-Label, kurzes Nomen. | |
| `labelSurname` | `Surname` | `שם משפחה` | | |
| `labelPhone` | `Phone` | `טלפון` | Auch `aria-label` des Telefonfelds. | |
| `labelEmail` | `Email` | `אימייל` | Lehnwort, wie überall auf der Site. | |
| `legend` | `What’s the best way to contact you?` | `מה דרך ההתקשרות הנוחה לכם?` | Legende der Radiogruppe. | |
| `optPhone` | `Phone call` | `שיחת טלפון` | Die dritte Option heißt in allen Sprachen `WhatsApp`. | |
| `optEmail` | `Email` | `אימייל` | | |
| `send` | `Send` | `שליחה` | Nominal (§2.1), ein Wort. | |
| `vName` | `Name is required` | `יש להזין שם פרטי` | Unpersönlich, genusfrei (§11.2). | |
| `vSurname` | `Surname is required` | `יש להזין שם משפחה` | | |
| `vPhone` | `Phone is required` | `יש להזין טלפון` | | |
| `vEmailInvalid` | `Invalid email address` | `כתובת אימייל לא תקינה` | | |
| `vEmail` | `Email is required` | `יש להזין אימייל` | | |
| `vContact` | `What’s the best way to contact you?` | `יש לבחור דרך התקשרות מועדפת` | Als Fehlermeldung eine Aufforderung, keine Wiederholung der Frage. | |
| `vConsentReq` | `Consent is required` | `נדרש אישור` | | |
| `vConsentOne` | `Consent required` | `חובה לאשר` | | |
| `success` | `Thank you — your enquiry has reached us. An adviser will be in touch, usually the same day.` | `תודה, הפנייה שלכם הגיעה אלינו. יועץ יחזור אליכם, בדרך כלל עוד באותו יום.` | Wortgleich mit WP1 `formFeedbackCopy.he.success`. Gedankenstrich → Komma (§3). | |
| `error` | `Your enquiry could not be sent. Please try again, or reach us at office@… or +357 …` | `לא הצלחנו לשלוח את הפנייה. אפשר לנסות שוב, או ליצור איתנו קשר באימייל …@… או בטלפון …` | Wortgleich mit WP1 `formFeedbackCopy.he.error`; E-Mail und Telefon laufen durch `ltrIsolate()` (§5 Bidi). | |
| `labelQuestion` | `Your question` | `השאלה שלכם` | Optionales Frage-Textfeld (heute nur auf der FAQ-Seite eingeschaltet); `he` ist seit Commit 4e43738 vollständig belegt, kein englischer Fallback mehr. | |
| `placeholderQuestion` | `What would you like to know?` | `מה תרצו לדעת?` | | |
| `vQuestion` | `Please enter your question` | `יש להזין שאלה` | Unpersönliche Form (§11.2). | |

## Phase-6-CMS-Brief — die sieben hebräischen H2 (verbindlich)

Die Abschnitts-H2 kommen aus dem CMS und existieren noch nicht. Weil das Akzentwort per `indexOf`
**ohne Wortgrenze** gesucht wird, ist jede Umformulierung eine Änderung am Gold-Akzent. Die Redaktion
legt diese Titel deshalb wörtlich so an; wer einen ändert, ändert den Akzent in derselben Datei mit.

| Abschnitt (Datei) | H2 wörtlich | Gold-Akzent | Fallstrick |
|---|---|---|---|
| `About.tsx` | `יש רק קפריסין אחת` | `קפריסין` | einwortig — **kein** Präfix/Artikel davor (`בקפריסין` vergoldete nur den Wortrest) |
| `CaseStudies.tsx` | `סיפורי לקוחות מקפריסין` | `סיפורי לקוחות` | zweiwortig, präfixfest |
| `Cities.tsx` | `נכסים למכירה בקפריסין` | `נכסים למכירה` | `בקפריסין` bleibt bewusst ungold (wie EN) |
| `Description.tsx` | `למה רוכשים מישראל בוחרים בנו` | `בוחרים בנו` | zweiwortig, präfixfest |
| `Faq.tsx` | `שאלות נפוצות על נדל"ן בקפריסין` | `שאלות` | einwortig — **kein** `השאלות` |
| `FeaturedProjects.tsx` | `פרויקטים נבחרים בקפריסין` | `פרויקטים` | einwortig — **kein** `הפרויקטים` |
| `HowWeWork.tsx` | `כך אנחנו עובדים` | `אנחנו` | kollisionsfrei; gilt auch für den `howWeWorkBlock` der Landingpages |

Dazu der **Meta-Title der Startseite**: `מומחי נדל"ן בקפריסין לרוכשים מישראל | Cyprus VIP Estates`
(52 Zeichen, §6) — damit die Cornerstone-Seite `/he/real-estate-cyprus` den nackten Hub-Term behält.
