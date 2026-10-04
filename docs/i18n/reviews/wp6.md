# Lektorat WP6 — Case Studies (Index, Detailseite, Intro-Block)

**Stand:** 2026-09-13 · **Pass A + Pass B (Kritik) + Fix-Runde 1 eingearbeitet** · Marker im Code: `REVIEW(he)`
**Umfang:** 3 Copy-Dateien, 3 `he`-Einträge, **43 Einzelstrings** (40 + 2 + 1, inkl. der Funktion
`heroMetaMany`; Pass A schrieb 42 — die Funktion war nicht mitgezählt, s. Pass B S7). Dazu in
Fix-Runde 1 vier Code-Dateien: die beiden `page.tsx` (Objekttyp-Label, Bidi, Zählzeile) und
`src/app/rtl.css` (eine paketübergreifende `:lang(he)`-Regel).
**Quelle:** immer der englische Eintrag. Die deutschen Zeilen dienten nur als Tonreferenz.
**Glossar-Ergänzungen:** `docs/i18n/reviews/wp6-glossary.md` (20 Begriffe nach Fix-Runde 1;
`he-glossary.md` wurde nicht angefasst).
**Fix-Runde 1:** alle 9 „Must fix" und 9 „Should fix" aus `task-9-passB.md` sind angewendet;
die betroffenen Zeilen tragen unten `Korrektur HE`. Details: `task-9-fix1-report.md`.

---

## Wo diese Strings sichtbar sind

Beide Seiten liegen technisch unter `src/app/preview-case-studies/[lang]/…`, sind aber über
`src/middleware.ts` (`CASE_STUDIES_RE`) auf die echten URLs gemappt — die sichtbare Adresse
ist immer `/he/case-studies…`. Die Route ist erst erreichbar, wenn `he` in
`NEXT_PUBLIC_LIVE_LOCALES` steht (heute nur Staging, `LAUNCH_GATED_LOCALES`).

| Seite | Was dort steht |
|---|---|
| `/he/case-studies` | `<title>` + Meta-Description · Eyebrow (`מהשטח`) · H1 (`סיפורי ` + gold `לקוחות`) · Hero-Lead · Zählzeile (0 → `אין עדיין סיפורי לקוחות`, 1 → `סיפור לקוח אחד`, ab 2 → „N סיפורי לקוחות") · Telefon-Mockup rechts (Kicker, Headline, Lese-Link) · pro Story vier Stat-Labels (תקציב / מיקום / סוג הנכס / לוח זמנים) und der Karten-CTA · Formularblock am Fuß (Titel + Untertitel) · SEO-Block „המדריך" (nur wenn das CMS-Dokument Inhalt hat — s. „Offene Punkte") |
| `/he/case-studies/<slug>` | Kicker-Back-Link `סיפורי לקוחות` · Stat-Band unter dem Hero (dieselben vier Labels) + Datenschutzhinweis · Sticky-Inhaltsverzeichnis links (`שלבי התהליך`) mit den fünf Abschnittstiteln · Related-Überschrift (`עוד ` + gold `נכסים`) · Badge `נמכר` auf verkauften Projektkarten · Formularblock am Fuß |
| Legacy-Route (nicht erreichbar) | Die Legacy-Route ist unerreichbar; `CaseStudyIntro` und `page.copy.ts` sind übersetzt, `CaseStudyOverview.tsx` (gleiche Seite) hat kein `he` und fiele auf Englisch zurück. Rollback-Sicherheit ist damit nicht gegeben und auch nicht Ziel dieses Pakets. (Korrigiert in Fix-Runde 1, Pass B S6: `CaseStudyOverview.tsx:11–67` kennt nur `en/de/pl/ru` und fällt über `\|\| labels.en` auf „Property Type / Location / Budget / Purchase Timeline", „Villa/Apartment/…" und „Book a Call" zurück.) |

**Slugs:** die Slugs kommen pro Sprache aus Sanity (`cs.slug[lang].current`, lateinisch nach
Entscheidung A) — im Code steht kein fester Slug. Die Detailseite ruft
`getCaseStudyByLang("he", slug)` und läuft in `notFound()`, solange es keine hebräische
Case-Study-Zeile gibt. Zum Lektorieren reicht die Indexseite plus eine beliebige
Detailseite in einer anderen Sprache (das Chrome ist identisch).

**Story-Inhalt ist nicht Teil dieses Pakets.** Titel, Excerpt, die fünf Erzählabschnitte und
die Overview-Werte (Budget, Ort, Objekttyp, Zeitrahmen) liegen übersetzt in der Datenbank.
Hier steht nur das Chrome drumherum.

## Wie zu lektorieren ist

1. Kurzcheckliste `docs/i18n/he-styleguide.md` §10 Punkt für Punkt:
   kein englischer Restsatz · Genus nach §2 (Nominal/Infinitiv, sonst männlicher Plural,
   keine Schrägstriche) · Preise/Zahlen nach §5, Bidi isoliert · Ortsnamen nach Glossar,
   Eigennamen lateinisch · Meta-Title ≤ 60, Description ≤ 155 · keine Zeile aus §7 ·
   jede Zahl hat eine Quelle.
2. Zusätzlich §11: kein `—`, keine Wurzelwiederholung im selben String, duplizierte
   Strings wortgleich, zweiter Durchgang über das rendernde JSX (siehe Kasten unten).
3. Länge mitdenken: CTAs ≤ 3 Wörter, Stat-Labels und Zählzeile ungefähr auf EN-Länge.
4. **Korrekturen in die Spalte `Korrektur HE` eintragen** — die vorhandene HE-Spalte
   bitte unverändert lassen, damit der Diff nachvollziehbar bleibt. Zeile ohne Korrektur
   leer lassen (= freigegeben).
5. Zurück an den Controller; er übernimmt die Korrekturen und entfernt `REVIEW(he)`.

**Nicht ändern:** Keys, der `${n}`-Platzhalter in `heroMetaMany`, Funktionssignaturen,
`href`-Werte, Slugs, CSS-Klassen, Markenname `Cyprus VIP Estates`.

### Zweiter Durchgang über das rendernde JSX (§11.3) — was Pass A hier geprüft hat

| Stelle | Verarbeitung | Konsequenz für die Übersetzung |
|---|---|---|
| `page.tsx` H1 (Index) | `{heroTitlePlain}<span class="it">{heroTitleItalic}</span>` | `סיפורי ` (mit Leerzeichen am Ende) + gold `לקוחות` — das Substantiv trägt den Akzent |
| `page.tsx` Zählzeile | **Fix-Runde 1 (M5):** für `he` verzweigt bei `total <= 1` — 0 → `אין עדיין סיפורי לקוחות`, 1 → `heroMetaOne` **ohne** vorangestellte Ziffer; ab 2 dieselbe `{n} {Plural}`-Form wie LTR | `heroMetaOne` trägt für `he` das Zahlwort selbst (`סיפור לקוח אחד`), weil kein Israeli die Ziffer 1 vor ein Substantiv im Singular schreibt. Der Nullfall ist heute der Regelfall: `getTotalCaseStudiesByLang`/`…WithDetails` filtern hart auf `language: "he"` ohne Fallback, es gibt noch keine hebräische Zeile. Gleiche Lösung wie `BlogInsights.tsx:146` (WP4). LTR byte-identisch |
| `page.tsx` Formulartitel | trug hartcodiert das englische ` move?` hinter dem Kursivteil (steht **nicht** in der Copy-Tabelle, de/pl/ru rendern es ebenfalls mit) | Für `he` ist dieser Anhang im JSX abgezweigt; die hebräische Frage steht vollständig in `formIndexTitleItalic` (`מהלך דומה?`). LTR-Ausgabe unverändert — siehe offene Frage 1 |
| `CaseStudiesSeo.tsx` Guide-Titel | splittet `guideTitle` an Leerzeichen, **letztes Wort gold** | `איך לקרוא סיפורי לקוחות` endet auf dem sinntragenden `לקוחות` |
| `[slug]/page.tsx` Related-Titel | `{relatedTitlePlain}<span class="it">{relatedTitleItalic}</span>` | **Fix-Runde 1 (S5):** `עוד ` + gold `נכסים` — Akzent auf dem Substantiv wie in WP4, und ohne die von den Daten nicht gedeckte Ähnlichkeitsbehauptung (die Karten sind redaktionell verknüpfte `cs.relatedProjects`) |
| `[slug]/page.tsx` Kicker | Back-Link `/` Kategorie, Trenner ist ein hartes `/` | neutrales Zeichen zwischen zwei RTL-Läufen, kein Bidi-Eingriff nötig |
| `[slug]/page.tsx` Sticky-TOC | `InsightsReader` bekommt die fünf `stage*`-Titel als Linktexte | deshalb alle fünf kurz (zwei Wörter) gehalten |
| `[slug]/page.tsx` + `page.tsx` Stat-Band | Label + DB-Wert untereinander, keine Konkatenation — **aber der Wert selbst war ungeprüft** (Pass B, Punkt 3) | Labels frei wählbar, aber vier nebeneinander → Länge zählt. **Fix-Runde 1:** (M3) die Indexseite rendert `overview.propertyType` nicht mehr roh — für `he` läuft der Enum-Key jetzt durch dieselbe `PROPERTY_TYPE_LABELS`-Map wie auf der Detailseite, sonst stünde dort lateinisch `villa` (und `rtl.css` neutralisiert `text-transform`, `capitalize` greift also nicht). (M4) `budget` steht in `<Bdi ltr>`, `location` und `purchaseTimeline` in `<Bdi>` — beides nur für `he`, LTR-DOM unverändert |
| Kategorie-Chips | kommen aus `CASE_CATEGORY_LABELS.he` (WP3, `preview-home/sections/homeI18n.ts`) | nicht Teil dieses Protokolls, aber auf derselben Seite sichtbar |
| Einheiten / Preise / Datum | Es gibt keine `m²`-, `fmtPrice()`- oder `Intl.DateTimeFormat`-Aufrufe — **das war aber die falsche Prüffrage** (Formatter statt Inhalt, Pass B Punkt 1): `clientOverview.budget` ist ein Freitext-**Preis**, in der Praxis eine Spanne wie `€250,000 – €350,000` | Eine Preisspanne in einem bloßen `<dd>` unter `dir="rtl"` vertauscht die beiden Beträge visuell (die Zahlläufe sind LTR, der Trenner dazwischen ist neutral und erbt RTL). **Fix-Runde 1 (M4):** `<Bdi ltr>` um `budget`, `<Bdi>` um `location` und `purchaseTimeline` (§11.4: `Limassol` ist ein lateinischer Name), auf **beiden** Seiten, `he`-gated |
| `bidiIsolate()` | In einen hebräischen **Satz** wird kein lateinischer Name interpoliert; Projekt- und Story-Titel stehen als eigenes Element (`<h3>`, `<h1>`) | Im Fließtext kein Isolator nötig — die Stat-**Werte** dagegen schon, siehe Zeile darüber. Die Zählzeile ab 2 (`{n} סיפורי לקוחות`) bleibt ohne Isolator: sie enthält genau einen Zahlenlauf am logischen Satzanfang, es gibt nichts, womit er die Plätze tauschen könnte |
| `.it`-Goldakzent (CSS) | `tokens.css:96` setzt `.it { font-style: italic }` — betrifft `heroTitleItalic`, `relatedTitleItalic`, beide Formular-Titel und den `guideTitle`-Akzent | Hebräisch kennt keine Kursive; Frank Ruhl Libre und Rubik haben keine Italic-Schnitte, der Browser synthetisiert eine Schrägstellung, die ein israelischer Leser als kaputtes Rendering liest. **Fix-Runde 1 (M9):** eine Zeile in `src/app/rtl.css` — `:lang(he) .it { font-style: normal; }` — neben den dort schon vorhandenen `letter-spacing`/`text-transform`-Neutralisierungen. Gilt **paketübergreifend** (WP3-Home-Akzente, WP4-Blog) |

---

## Tabelle 1 — `src/app/preview-case-studies/[lang]/copy.ts` (`CASE_STUDIES_COPY.he`, 40 Strings)

| Key | EN | HE | Anmerkung | Korrektur HE |
|---|---|---|---|---|
| `metaTitle` | Cyprus Property Success Stories | סיפורי לקוחות שרכשו נדל"ן בקפריסין \| Cyprus VIP Estates | 55 Zeichen. ~~Für „case studies" gibt es keine hebräische Suchnachfrage in der Keyword-Map.~~ **Falsch (S1):** `he-keyword-map.md` §5 führt `קניתי דירה בקפריסין` (20/Mon.) und weist es ausdrücklich den Case Studies zu. Der alte Title trug stattdessen den Hub-Head-Term `נדל"ן בקפריסין` (320), der nach §6 der Cornerstone-Seite gehört und von WP3 in der Home-H1 belegt ist; die Suchformulierung der Zielgruppe ist ק.נ.ה, nicht ר.כ.ש. | **S1:** סיפורי לקוחות שקנו נכס בקפריסין \| Cyprus VIP Estates (52 Graphem) |
| `metaDescription` | Real Cyprus property purchases — relocation, investment and lifestyle buyers, and how we helped them find the right home. | סיפורים אמיתיים של רוכשי נדל"ן בקפריסין. רילוקיישן, השקעה ובית שני, ואיך ליווינו כל אחד מהם עד למציאת הנכס שהתאים בדיוק לצרכים שלו. | 131 Zeichen. EN-`—` durch Punkt ersetzt (§3). „lifestyle buyers" → `בית שני`. **S2:** endete in einer Absichtserklärung statt in einem Handlungsangebot (§6), `בדיוק` war Füllwort (§7), `כל אחד מהם … שלו` umständlich — der überprüfbare Nutzen (Stat-Band: Budget, Ort, Objekttyp, Zeitrahmen) blieb ungenutzt. | **S2:** סיפורים אמיתיים של רוכשי נדל"ן בקפריסין: רילוקיישן, השקעה ובית שני. בכל סיפור מופיעים התקציב, המיקום, סוג הנכס ולוח הזמנים של העסקה. (132 Graphem) |
| `eyebrow` | Success Stories | סיפורי הצלחה | **M8:** löst das Problem nicht — `סיפורי` steht damit in zwei aufeinanderfolgenden Zeilen (Eyebrow + H1 `סיפורי לקוחות`), im Hebräischen ein sichtbares Stottern (Geist von §11.5). | **M8:** מהשטח (5 Graphem) |
| `heroTitlePlain` | „Case " | „סיפורי " | Leerzeichen am Ende bleibt. | |
| `heroTitleItalic` | Studies | לקוחות | Goldakzent auf dem Substantiv. | |
| `heroLead` | Real Cyprus property purchases, from first consultation to keys in hand — how relocation, investment and lifestyle buyers found the right home with us. | עסקאות נדל"ן אמיתיות בקפריסין, מהייעוץ הראשון ועד קבלת המפתחות. כך מצאו איתנו רוכשים שעברו לגור, משקיעים ומחפשי בית שני את הנכס שהתאים להם. | `עסקאות` statt `רכישות` bleibt richtig (§11.5). **M7:** `עברו לגור` ist ohne Ortsangabe unvollständig — die Wendung verlangt ein Ziel (`עברו לגור בקפריסין`), das hier fehlt, weil `בקפריסין` schon im ersten Satz steht; das erste von drei Listengliedern liest sich abgebrochen. Glossar/Keyword-Map führen für genau diesen Fall `רילוקיישן` (170/Mon.), WP3 nutzt es im Kategorie-Chip. | **M7:** … כך מצאו איתנו רוכשים שעשו רילוקיישן, משקיעים ומחפשי בית שני את הנכס שהתאים להם. (143 Graphem) |
| `heroMetaOne` | client success story | סיפור לקוח | **M5:** gerendert ergab das „1 סיפור לקוח" — kein Israeli schreibt die Ziffer 1 vor ein Substantiv im Singular; bei 0 stand „0 סיפורי לקוחות" über einer leeren Seite (§8). WP4 hatte dieselbe `.ins__hero-meta`-Zeile zwei Tage vorher gelöst. | **M5:** סיפור לקוח אחד — plus Zählzweig im JSX (0 → `אין עדיין סיפורי לקוחות`, inline wie in `BlogInsights.tsx`) |
| `heroMetaMany` | `${n} client success stories` | `${n} סיפורי לקוחות` | Platzhalter unverändert; westliche Ziffern (§5). | |
| `deviceKickerFallback` | Case Study | סיפור לקוח | Nur sichtbar, wenn keine Story existiert; sonst steht hier das Kategorie-Label. | |
| `deviceHeadlineFallback` | A Cyprus property success story | סיפור הצלחה של רוכשים בקפריסין | Ebenfalls nur Fallback. | |
| `deviceRead` | Read the story | לקריאת הסיפור | Nominal (§2.1). | |
| `statBudget` | Budget | תקציב | Glossar §4. | |
| `statLocation` | Location | מיקום | | |
| `statProperty` | Property | נכס | **M2:** `נכס` über dem Wert `וילה` liest sich, als käme dort der Objektname; die Längenbegründung war falsch gerechnet (`סוג הנכס` = 8 Graphem = EN `Property`), und WP2 belegt `נכס` als **Wert**. | **M2:** סוג הנכס |
| `statTimeline` | Timeline | לוח זמנים | WP1 §6.1. | |
| `ctaReadFull` | Read the full story | לסיפור המלא | Nominal, drei Wörter. | |
| `formIndexTitlePlain` | „Considering " | „שוקלים " | | |
| `formIndexTitleItalic` | your own | מהלך דומה? | Enthält das Fragezeichen, weil das englische ` move?` für `he` nicht mitgerendert wird (siehe JSX-Kasten). | |
| `formIndexSubtitle` | Leave your details and our team will get in touch to understand your needs, answer your questions, and help you find the right way forward. | השאירו פרטים והצוות שלנו יחזור אליכם כדי להבין מה אתם מחפשים, לענות על השאלות ולעזור לכם להתקדם בכיוון הנכון. | Männlicher Plural (§2.2) bleibt. **M6:** Lead-Formular mit Rückrufversprechen → §8/Entscheidung E fehlte; der Satz steht wortgleich schon in `preview-contacts`, `preview-about` und `lib/crm/compose/greeting.ts`, ist also nicht erfunden. **S3:** `להתקדם בכיוון הנכון` ist eine Wort-für-Wort-Kalkierung von „the right way forward" (§7). | **M6+S3:** השאירו פרטים והצוות שלנו יחזור אליכם כדי להבין מה אתם מחפשים, לענות על השאלות ולעזור לכם לבחור נכון. הייעוץ מתקיים באנגלית או ברוסית; פנייה בעברית מתקבלת בברכה. |
| `backLink` | Case Studies | סיפורי לקוחות | Glossar §4. | |
| `privacyNote` | Client privacy comes first — sensitive business information and identifying details are not disclosed in this case study. | פרטיות הלקוחות קודמת לכל, ולכן מידע עסקי רגיש ופרטים מזהים אינם נחשפים בסיפור זה. | **Wortgleich** mit `CASE_STUDY_INTRO_COPY.he.disclaimer` (§11.6) — beide Zeilen zusammen korrigiert. EN-`—` → `ולכן`. **M1:** `פרטיות` und `פרטים` sind dieselbe Wurzel פ.ר.ט, fünf Wörter auseinander, im auffälligsten Satz des Pakets (§11.5). `אינם נחשפים` (Passiv) bleibt: Rechtshinweis, keine Marketingprosa. | **M1:** פרטיות הלקוחות קודמת לכל, ולכן מידע עסקי רגיש ונתונים מזהים אינם נחשפים בסיפור זה. (auch in Tabelle 2) |
| `stageClientSituation` | Client Situation | רקע הלקוח | Auch Linktext in der Sticky-TOC. | |
| `stageClientRequirements` | Client Requirements | דרישות הלקוח | | |
| `stageOurSolution` | Our Solution | הפתרון שלנו | | |
| `stageSelectedProperty` | Selected Property | הנכס שנבחר | | |
| `stageResult` | Result | התוצאה | | |
| `journeyLabel` | The Journey | שלבי התהליך | Überschrift des Inhaltsverzeichnisses, nicht Fließtext. | |
| `relatedTitlePlain` | „Related " | „נכסים " | Leerzeichen am Ende bleibt. **S5**, s. `relatedTitleItalic`. | **S5:** „עוד " |
| `relatedTitleItalic` | Properties | דומים | **S5:** (a) WP4 hat für dieselbe Konstruktion festgelegt, dass das **Substantiv** den Goldakzent trägt — beide Regeln können nicht gleichzeitig gelten. (b) Die Karten kommen aus `cs.relatedProjects` (redaktionell verknüpft), nicht aus einer Ähnlichkeitsberechnung; `דומים` behauptet eine Beziehung, die die Daten nicht hergeben (§8). | **S5:** נכסים (mit `relatedTitlePlain` = „עוד "; Tabelle 3 wortgleich) |
| `soldBadge` | Sold | נמכר | Glossar §4 (Kurzform). | |
| `formDetailTitlePlain` | „Ready to write " | „מוכנים לכתוב " | | |
| `formDetailTitleItalic` | your own | סיפור משלכם? | EN/DE lassen den Satz offen; auf Hebräisch fehlt dann das Bezugswort. | |
| `formDetailSubtitle` | Leave your details and our team will get in touch to discuss your goals, answer your questions, and help turn your plans into the next success story. | השאירו פרטים והצוות שלנו יחזור אליכם כדי לדבר על המטרות שלכם, לענות על השאלות ולהפוך את התוכניות לסיפור ההצלחה הבא. | Teilt bewusst den Satzanfang mit `formIndexSubtitle`. **M6:** Entscheidung E fehlte (wie oben). **S4:** bloßes `התוכניות` ohne Bezug; EN hat `your plans`, `התוכניות שלכם` würde `שלכם` im selben Satz verdoppeln (§11.5) → Rückverweis-Pronomen auf `המטרות`. | **M6+S4:** השאירו פרטים והצוות שלנו יחזור אליכם כדי לדבר על המטרות שלכם, לענות על השאלות ולהפוך אותן לסיפור ההצלחה הבא. הייעוץ מתקיים באנגלית או ברוסית; פנייה בעברית מתקבלת בברכה. |
| `propertyTypeVilla` | Villa | וילה | Glossar §2. | |
| `propertyTypeApartment` | Apartment | דירה | Glossar §2. | |
| `propertyTypePenthouse` | Penthouse | פנטהאוז | Glossar §2. | |
| `propertyTypeTownhouse` | Townhouse | בית טורי | Glossar §2 („nicht קוטג'"). | |
| `propertyTypePlot` | Plot | מגרש | Glossar §2 (`מגרש / קרקע`; hier das bebaubare Grundstück). | |
| `guideEyebrow` | The Guide | המדריך | Inhaltlich bestätigt; **S8**: kein Neuzugang, steht schon in `wp4-glossary.md` (dort im selben Kontext) — Bookkeeping im Glossar korrigiert. **S9:** rendert nur, wenn das `caseStudiesPage`-CMS-Dokument auf `he` Inhalt hat; heute nicht angelegt → String derzeit nicht sichtbar. | |
| `guideTitle` | Understanding Case Studies | איך לקרוא סיפורי לקוחות | Letztes Wort wird automatisch vergoldet → `לקוחות` (Pass B: korrekt geprüft). **S9:** wie `guideEyebrow` heute nicht renderbar. | |

## Tabelle 2 — `src/app/components/CaseStudyIntro/CaseStudyIntro.copy.ts` (`CASE_STUDY_INTRO_COPY.he`, 2 Strings)

| Key | EN | HE | Anmerkung | Korrektur HE |
|---|---|---|---|---|
| `requestOffer` | Request Personal Offer | לקבלת הצעה אישית | Nominal (§2.1), parallel zu `לקבלת ייעוץ` (§6.1). | |
| `disclaimer` | Client privacy comes first, which is why sensitive business information and identifying details are not disclosed in this case study. | פרטיות הלקוחות קודמת לכל, ולכן מידע עסקי רגיש ופרטים מזהים אינם נחשפים בסיפור זה. | **Wortgleich** mit `CASE_STUDIES_COPY.he.privacyNote` (§11.6). Die beiden englischen Quellen unterscheiden sich nur in der Interpunktion. **M1** trifft beide Fundstellen. | **M1:** פרטיות הלקוחות קודמת לכל, ולכן מידע עסקי רגיש ונתונים מזהים אינם נחשפים בסיפור זה. |

## Tabelle 3 — `src/app/[lang]/case-studies/[slug]/page.copy.ts` (`CASE_STUDY_PAGE_COPY.he`, 1 String)

| Key | EN | HE | Anmerkung | Korrektur HE |
|---|---|---|---|---|
| `relatedProperties` | Related Properties | נכסים דומים | **Wortgleich** mit `relatedTitlePlain` + `relatedTitleItalic` aus Tabelle 1 (§11.6). Legacy-Route, heute nicht sichtbar. **S5** trifft beide Fundstellen. | **S5:** עוד נכסים |

---

## Offene Punkte (nach Fix-Runde 1)

Die fünf „offenen Fragen" aus Pass A sind durch Pass B und Fix-Runde 1 entschieden (2 → `סוג הנכס`,
3 → `עוד ` + `נכסים`, 4 → Entscheidung E angehängt, 5 → Eyebrow `מהשטח`; Details im Glossar). Offen
bleibt:

1. **LTR-Ticket: roher `propertyType` auf `/en|de|pl|ru/case-studies`.** Die Indexseite rendert den
   Enum-Key (`villa`, `apartment`, …) weiterhin roh und verlässt sich auf `.csstory__cap`
   (`text-transform: capitalize`), während die Detailseite ihn über `PROPERTY_TYPE_LABELS` mappt —
   in de/pl/ru steht auf dem Index also „Villa" statt „Wohnung"/„Willa"/„Вилла". Fix-Runde 1 hat das
   bewusst **nur** für `he` behoben (M3-Ruling des Controllers), damit die LTR-Ausgabe byte-identisch
   bleibt. Eigenes Ticket, kein `he`-Thema.
2. **LTR-Ticket: hartcodiertes ` move?` im Formulartitel der Indexseite** (unverändert aus Pass A).
   Trifft de/pl/ru („Rozważasz swój własny move?"); für `he` ist es im JSX abgezweigt.
3. **Datenlage `he` (Pass B S9 / Systemic 4).** `getCaseStudiesByLangWithDetails` und
   `getTotalCaseStudiesByLang` filtern hart auf `language: "he"` ohne Fallback: bis der Content-Import
   läuft, rendert `/he/case-studies` eine korrekt übersetzte Hülle um nichts. Der Nullzustand ist seit
   Fix-Runde 1 übersetzt (`אין עדיין סיפורי לקוחות`), aber die Seite trägt keine Story.
   Ebenso ist das `caseStudiesPage`-Dokument auf `he` nicht angelegt → `guideEyebrow`/`guideTitle` und
   damit die einzige Textfläche für Sekundär-Keywords rendern nicht. Vor Freigabe klären, wer das anlegt.
4. **M9 wirkt paketübergreifend.** `:lang(he) .it { font-style: normal; }` in `src/app/rtl.css` betrifft
   auch WP3 (Home-Akzente) und WP4 (Blog) — dort beim jeweiligen Abschluss gegenprüfen, nicht erneut patchen.
