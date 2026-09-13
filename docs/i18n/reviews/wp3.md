# Lektorat WP3 — Startseite und Landingpage-Blöcke (`he`)

**Stand:** 2026-09-13 · **Pass A abgeschlossen, wartet auf Pass C (Muttersprachler)**
**Work Package:** WP3 (Homepage `/he` + Landing-Block-Copy)
**Marker im Code:** jede Zeile trägt `// REVIEW(he)`; nach Freigabe wird der Marker entfernt (Phase 8).

## Seiten zum Anschauen

| Seite | URL | Was dort sichtbar ist |
|---|---|---|
| Startseite | `/he` | Hero-H1, alle Abschnitts-H2 mit Gold-Akzent, Städte-Absatz, Projektkarten, FAQ, Formular |
| Case-Studies-Übersicht | `/he/case-studies` | die sechs Kategorie-Labels |
| Landingpage-Template | jede lokalisierte Singlepage unter `/he/…`, die den `bulletsBlock`, den `howWeWorkBlock` oder einen FAQ-Block ohne eigenen Titel führt | die sechs Zypern-Fakten, die sechs Ablaufschritte, die FAQ-Überschrift |

> **Hinweis:** Die HE-Startseite existiert erst, wenn Phase 6 die CMS-Inhalte anlegt. Bis dahin
> lässt sich WP3 gegen `/en` bzw. `/de` mit umgeschaltetem `lang` prüfen; die hier gelisteten
> Strings sind vollständig, die **Abschnitts-H2 dagegen kommen aus dem CMS** (siehe nächster Abschnitt).

## Worauf besonders zu achten ist

- **Hero-H1** — trägt bewusst den Suchbegriff `נדל"ן בקפריסין`. Klingt er als Überschrift natürlich oder nach Keyword?
- **Akzentwörter in den H2** — jeder Abschnitt hebt genau ein Wort/eine Wortgruppe gold-kursiv hervor. Die Hervorhebung funktioniert nur, wenn das Wort **wörtlich** im CMS-Titel steht. Der jeweils vorgesehene hebräische H2 steht als Kommentar direkt neben dem Akzent im Code und in der Tabelle unten. Wenn der Lektor einen H2 umformuliert, **muss** das Akzentwort mitgeändert werden.
- **Städte-Absatz** — Larnaka wurde gegenüber dem Englischen bewusst gestrichen (Styleguide §8: kein Inventar, wird nicht beworben). Bitte bestätigen.
- **Ablaufschritte (How we work)** — Wechsel zwischen `אתם` und `אנחנו`; liest sich das als Dialog oder als Belehrung?
- **Kundenstimmen-Slider / Team-Block** — keine erfundenen Aussagen, nur der CTA-Text.
- **FAQ-Überschrift** — `שאלות נפוצות` statt des Nav-Labels `שאלות ותשובות` (siehe `wp3-glossary.md`).
- **Bauträger-Logoleiste** — `יזמים` (Glossar §2), nicht `מפתחים`.
- **Formular-Überschrift** — der gold-kursive Teil ist `ונחזור אליכם`.
- **Preiszelle** — `החל מ-` steht in einem eigenen `<span>` mit `margin-inline-end: 0.45em` vor dem Preis; es entsteht optisch `החל מ- €450,000`. Wenn der Lektor die Lücke stört, ist das eine CSS-Aufgabe (RTL-Sonderregel), keine Textänderung.

## Checkliste Styleguide §10

- [ ] Kein `TODO(he)`, kein englischer Restsatz
- [ ] Genus gemäß §2 (Nominal-/Infinitivstil, sonst männlicher Plural), keine Schrägstriche
- [ ] Preise/Nummern nach §5, Bidi isoliert (Preise laufen bereits durch `<Bdi ltr>`)
- [ ] Ortsnamen nach Glossar (`לימסול`, `פאפוס`), Eigennamen lateinisch
- [ ] Meta-Title ≤ 60, Description ≤ 155 (WP3 enthält keine Meta-Strings — n/a)
- [ ] Keine Zeile aus §7 (keine `גלו`, keine Adjektivstapel, kein `—`, keine Doppelpunkt-Titel)
- [ ] Faktencheck: jede Zahl hat eine Quelle (WP3: nur „340 ימי שמש", aus der EN-Quelle übernommen)
- [ ] Akzentwort steht wörtlich im zugehörigen H2

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
| `citiesLead` | `From lively marinas to quiet old towns, … Limassol, … Paphos, or … Larnaca — … 340 days of sunshine each year.` | `מהמרינה ההומה ועד לרחובות העיר העתיקה, לכל עיר בקפריסין יש דרך משלה לחיות מול הים. באנרגיה הקוסמופוליטית של לימסול או בקסם ההיסטורי של פאפוס, קפריסין מציעה תשתיות ברמה גבוהה, מסגרת משפטית יציבה ויותר מ-340 ימי שמש בשנה.` | **Larnaka gestrichen** (§8). Gedankenstrich der Quelle in zwei Sätze aufgelöst (§3). | |
| `newLead2` | `Latest ` | `פרויקטים ` | H2 „Latest Developments", Teil 1. | |
| `newAccent` | `Developments` | `חדשים` | gold-kursiv. Ganze H2: `פרויקטים חדשים`. | |
| `showAllProjects` | `Show all projects` | `הצגת כל הפרויקטים` | Link im Listenkopf. | |
| `priceFrom` | `from` | `החל מ-` | Glossar §2. Steht direkt vor dem `<Bdi>`-Preis. | |
| `priceOnRequest` | `Price on request` | `מחיר לפי פנייה` | Glossar §2. | |
| `onRequest` | `On request` | `לפי פנייה` | Kurzform in der Karte. | |
| `sold` | `Sold` | `נמכר` | Badge, Glossar §4. | |
| `contentTitle` | `Your Guide to Property in Cyprus` | `המדריך שלכם לנדל"ן בקפריסין` | Das **letzte** Wort wird automatisch gold-kursiv, hier also `בקפריסין`. | |
| `contentLead` | `What to know before you buy — the regions, the property types, the process for international clients, and where the long-term value lies.` | `מה כדאי לדעת לפני הרכישה: האזורים, סוגי הנכסים, התהליך לרוכשים מחו"ל ואיפה נמצא הערך לטווח הארוך.` | Gedankenstrich → Doppelpunkt (erlaubt im Fließtext, verboten nur in Überschriften §3). | |
| `faqLead` | `Everything buyers ask us about property in Cyprus, in one place.` | `כל מה שרוכשים שואלים אותנו על נדל"ן בקפריסין, במקום אחד.` | | |
| `readCaseStudy` | `Read case study` | `לקריאת סיפור הלקוח` | | |
| `exploreAllCases` | `Explore all cases` | `לכל סיפורי הלקוחות` | Glossar §4: `סיפורי לקוחות`. | |

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

Der Titel kommt aus dem CMS; das Akzentwort muss **wörtlich** darin vorkommen
(Substring-Suche, Präposition-Präfixe zählen mit: `בקפריסין` ≠ `קפריסין`).
Die Spalte „HE (Akzent)" ist der Code-Wert, „vorgesehener H2" die Vorgabe für die CMS-Redaktion in Phase 6.

| Key (Datei) | EN (heutiger CMS-Titel) | HE (Akzent) | Anmerkung: vorgesehener H2 | Korrektur HE |
|---|---|---|---|---|
| `About.tsx` | `There is Only One Cyprus` | `קפריסין` | `יש רק קפריסין אחת` — wie DE/PL/RU wird der Ländername hervorgehoben, nicht „only one". | |
| `CaseStudies.tsx` | `… Success Stories …` | `סיפורי לקוחות` | `סיפורי לקוחות מקפריסין` — zwei Wörter als **eine** Akzentphrase (ein zusammenhängender Gold-Span). | |
| `Cities.tsx` | `Properties for Sale in Cyprus` | `נכסים למכירה` | `נכסים למכירה בקפריסין` — `בקפריסין` bleibt bewusst ungold (wie EN). Alternative siehe `wp3-glossary.md`, offene Frage 1. | |
| `Description.tsx` | `Why … We …` | `בנו` | `למה רוכשים מישראל בוחרים בנו` — Hebräisch hat hier kein isoliertes „wir"; das gebundene Pronomen `בנו` („uns") trägt die Betonung, analog zum polnischen Verb-Akzent. **Urteilssache — bitte prüfen.** | |
| `Faq.tsx` | `… Questions … Cyprus` | `שאלות` | `שאלות נפוצות על נדל"ן בקפריסין` — `שאלות` passt auch, falls die Redaktion `שאלות ותשובות` schreibt. | |
| `FeaturedProjects.tsx` | `Featured Real Estate Projects` | `פרויקטים` | `פרויקטים נבחרים בקפריסין` | |
| `HowWeWork.tsx` | `How We Work` | `אנחנו` | `כך אנחנו עובדים` — Pronomen wie DE/RU. | |

## `src/app/preview-landing/blockCopy.ts` — `BULLETS_TEXT.he`

Die LTR-Locales schreiben diese Bullets teils in Versalien; Hebräisch kennt keine Groß-/Kleinschreibung, daher normale Schreibung.

| Key | EN | HE | Anmerkung | Korrektur HE |
|---|---|---|---|---|
| `[0]` | `340 SUNNY DAYS A YEAR` | `340 ימי שמש בשנה` | Westliche Ziffern (§5). | |
| `[1]` | `MEMBER OF THE EUROPEAN UNION` | `חברה באיחוד האירופי` | Bezug ist das Land (feminin). | |
| `[2]` | `ONE OF THE BEST TAX SYSTEMS` | `אחת ממערכות המס הטובות ביותר` | Keine Zahl, keine Zusicherung. | |
| `[3]` | `excellent quality of life` | `איכות חיים גבוהה` | | |
| `[4]` | `VERY HIGH STANDARD OF EDUCATION` | `רמת חינוך גבוהה מאוד` | | |
| `[5]` | `MODERN healthcare system` | `מערכת בריאות מודרנית` | GESY wird hier nicht genannt (Quelle nennt es auch nicht). | |

## `src/app/preview-landing/blockCopy.ts` — `STEPS_TEXT.he`

| Key | EN | HE | Anmerkung | Korrektur HE |
|---|---|---|---|---|
| `[0]` | `You contact us via the form on our website` | `אתם פונים אלינו דרך הטופס באתר` | Männlicher Plural (§2.2). | |
| `[1]` | `We will contact you and discuss your requirements` | `אנחנו חוזרים אליכם ועוברים יחד על הדרישות שלכם` | Präsens statt Futur — im Hebräischen der natürliche Ablauf-Ton. | |
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
| `readFullReview` | `Read full review` | `לקריאת חוות הדעת המלאה` | `חוות דעת` statt `ביקורת` — siehe `wp3-glossary.md`, offene Frage 2. | |

## `src/app/components/TeamBlockComponent/TeamBlockComponent.copy.ts`

| Key | EN | HE | Anmerkung | Korrektur HE |
|---|---|---|---|---|
| `contact` | `Contact` | `ליצירת קשר` | Button auf der Beraterkarte. Erinnerung §8: das Team spricht kein Hebräisch — die Sprachnotiz steht auf der Kontaktseite (WP1), nicht hier. | |

## `src/app/preview-home/sections/Form.tsx` — `titleNode("he")`

| Key | EN | HE | Anmerkung | Korrektur HE |
|---|---|---|---|---|
| `titleNode` | `Leave **your details** and we will contact you shortly` | `השאירו פרטים **ונחזור אליכם** בהקדם` | Fett = gold-kursiver `<span className="it">`. Männlicher Plural (§2.2), kein Ausrufezeichen. | |
