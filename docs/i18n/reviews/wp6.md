# Lektorat WP6 — Case Studies (Index, Detailseite, Intro-Block)

**Stand:** 2026-09-13 · **Pass A (Erstübersetzung) fertig** · Marker im Code: `REVIEW(he)`
**Umfang:** 3 Dateien, 3 `he`-Einträge, 42 Einzelstrings.
**Quelle:** immer der englische Eintrag. Die deutschen Zeilen dienten nur als Tonreferenz.
**Glossar-Ergänzungen:** `docs/i18n/reviews/wp6-glossary.md` (22 Begriffe; `he-glossary.md` wurde nicht angefasst).

---

## Wo diese Strings sichtbar sind

Beide Seiten liegen technisch unter `src/app/preview-case-studies/[lang]/…`, sind aber über
`src/middleware.ts` (`CASE_STUDIES_RE`) auf die echten URLs gemappt — die sichtbare Adresse
ist immer `/he/case-studies…`. Die Route ist erst erreichbar, wenn `he` in
`NEXT_PUBLIC_LIVE_LOCALES` steht (heute nur Staging, `LAUNCH_GATED_LOCALES`).

| Seite | Was dort steht |
|---|---|
| `/he/case-studies` | `<title>` + Meta-Description · Eyebrow · H1 (`סיפורי ` + gold `לקוחות`) · Hero-Lead · Zählzeile („N סיפורי לקוחות") · Telefon-Mockup rechts (Kicker, Headline, Lese-Link) · pro Story vier Stat-Labels (תקציב / מיקום / נכס / לוח זמנים) und der Karten-CTA · Formularblock am Fuß (Titel + Untertitel) · SEO-Block „המדריך" (nur wenn das CMS-Dokument Inhalt hat) |
| `/he/case-studies/<slug>` | Kicker-Back-Link `סיפורי לקוחות` · Stat-Band unter dem Hero (dieselben vier Labels) + Datenschutzhinweis · Sticky-Inhaltsverzeichnis links (`שלבי התהליך`) mit den fünf Abschnittstiteln · Related-Überschrift (`נכסים ` + gold `דומים`) · Badge `נמכר` auf verkauften Projektkarten · Formularblock am Fuß |
| Legacy-Route (nicht erreichbar) | `CaseStudyIntro` und `[lang]/case-studies/[slug]/page.copy.ts` gehören zur **alten** Case-Study-Implementierung, die der Middleware-Rewrite vollständig überschreibt. Sie sind übersetzt, damit der Zähler sauber ist und ein Zurückrollen des Rewrites keine englischen Reste zeigt — auf dem Bildschirm sind sie heute nicht zu sehen. |

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
| `page.tsx` Zählzeile | `total === 1 ? \`${total} ${heroMetaOne}\` : heroMetaMany(total)` — die **1 wird im JSX vorangestellt**, nicht im String | `heroMetaOne` ist deshalb die bloße Nominalphrase `סיפור לקוח` → gerendert „1 סיפור לקוח" |
| `page.tsx` Formulartitel | trug hartcodiert das englische ` move?` hinter dem Kursivteil (steht **nicht** in der Copy-Tabelle, de/pl/ru rendern es ebenfalls mit) | Für `he` ist dieser Anhang im JSX abgezweigt; die hebräische Frage steht vollständig in `formIndexTitleItalic` (`מהלך דומה?`). LTR-Ausgabe unverändert — siehe offene Frage 1 |
| `CaseStudiesSeo.tsx` Guide-Titel | splittet `guideTitle` an Leerzeichen, **letztes Wort gold** | `איך לקרוא סיפורי לקוחות` endet auf dem sinntragenden `לקוחות` |
| `[slug]/page.tsx` Related-Titel | `{relatedTitlePlain}<span class="it">{relatedTitleItalic}</span>` | `נכסים ` + gold `דומים`; im Hebräischen steht das Adjektiv hinten, der Akzent liegt also auf `דומים` (offene Frage 3 im Glossar) |
| `[slug]/page.tsx` Kicker | Back-Link `/` Kategorie, Trenner ist ein hartes `/` | neutrales Zeichen zwischen zwei RTL-Läufen, kein Bidi-Eingriff nötig |
| `[slug]/page.tsx` Sticky-TOC | `InsightsReader` bekommt die fünf `stage*`-Titel als Linktexte | deshalb alle fünf kurz (zwei Wörter) gehalten |
| `[slug]/page.tsx` Stat-Band | Label + DB-Wert untereinander, keine Konkatenation | Labels frei wählbar, aber vier nebeneinander → Länge zählt |
| Kategorie-Chips | kommen aus `CASE_CATEGORY_LABELS.he` (WP3, `preview-home/sections/homeI18n.ts`) | nicht Teil dieses Protokolls, aber auf derselben Seite sichtbar |
| Einheiten / Preise / Datum | in diesem Seitenbaum gibt es **keine** `m²`-, `fmtPrice()`- oder `Intl.DateTimeFormat`-Aufrufe (geprüft) | nichts zu isolieren |
| `bidiIsolate()` | keine lateinischen Namen werden in einen hebräischen Satz interpoliert; Projekt- und Story-Titel stehen als eigenes Element (`<h3>`, `<h1>`) | kein Isolator nötig |

---

## Tabelle 1 — `src/app/preview-case-studies/[lang]/copy.ts` (`CASE_STUDIES_COPY.he`, 40 Strings)

| Key | EN | HE | Anmerkung | Korrektur HE |
|---|---|---|---|---|
| `metaTitle` | Cyprus Property Success Stories | סיפורי לקוחות שרכשו נדל"ן בקפריסין \| Cyprus VIP Estates | 55 Zeichen. Trägt den Hub-Term `נדל"ן בקפריסין` (Keyword-Map #1); Marke hinten mit `\|` nach §6. Für „case studies" gibt es keine hebräische Suchnachfrage in der Keyword-Map. | |
| `metaDescription` | Real Cyprus property purchases — relocation, investment and lifestyle buyers, and how we helped them find the right home. | סיפורים אמיתיים של רוכשי נדל"ן בקפריסין. רילוקיישן, השקעה ובית שני, ואיך ליווינו כל אחד מהם עד למציאת הנכס שהתאים בדיוק לצרכים שלו. | 131 Zeichen. EN-`—` durch Punkt ersetzt (§3). „lifestyle buyers" → `בית שני`, weil „לייפסטייל" im Hebräischen leer klingt. | |
| `eyebrow` | Success Stories | סיפורי הצלחה | Bewusst nicht `סיפורי לקוחות`, das steht direkt darunter als H1. Glossar-Frage 1. | |
| `heroTitlePlain` | „Case " | „סיפורי " | Leerzeichen am Ende bleibt. | |
| `heroTitleItalic` | Studies | לקוחות | Goldakzent auf dem Substantiv. | |
| `heroLead` | Real Cyprus property purchases, from first consultation to keys in hand — how relocation, investment and lifestyle buyers found the right home with us. | עסקאות נדל"ן אמיתיות בקפריסין, מהייעוץ הראשון ועד קבלת המפתחות. כך מצאו איתנו רוכשים שעברו לגור, משקיעים ומחפשי בית שני את הנכס שהתאים להם. | `עסקאות` statt `רכישות`, sonst stünde die Wurzel ר.כ.ש zweimal im selben String (§11.5). EN-`—` → neuer Satz. | |
| `heroMetaOne` | client success story | סיפור לקוח | Wird im JSX als „1 סיפור לקוח" gerendert (Zahl kommt aus dem Code). | |
| `heroMetaMany` | `${n} client success stories` | `${n} סיפורי לקוחות` | Platzhalter unverändert; westliche Ziffern (§5). | |
| `deviceKickerFallback` | Case Study | סיפור לקוח | Nur sichtbar, wenn keine Story existiert; sonst steht hier das Kategorie-Label. | |
| `deviceHeadlineFallback` | A Cyprus property success story | סיפור הצלחה של רוכשים בקפריסין | Ebenfalls nur Fallback. | |
| `deviceRead` | Read the story | לקריאת הסיפור | Nominal (§2.1). | |
| `statBudget` | Budget | תקציב | Glossar §4. | |
| `statLocation` | Location | מיקום | | |
| `statProperty` | Property | נכס | Wert darunter ist der Objekttyp (`וילה` …). Glossar-Frage 2. | |
| `statTimeline` | Timeline | לוח זמנים | WP1 §6.1. | |
| `ctaReadFull` | Read the full story | לסיפור המלא | Nominal, drei Wörter. | |
| `formIndexTitlePlain` | „Considering " | „שוקלים " | | |
| `formIndexTitleItalic` | your own | מהלך דומה? | Enthält das Fragezeichen, weil das englische ` move?` für `he` nicht mitgerendert wird (siehe JSX-Kasten). | |
| `formIndexSubtitle` | Leave your details and our team will get in touch to understand your needs, answer your questions, and help you find the right way forward. | השאירו פרטים והצוות שלנו יחזור אליכם כדי להבין מה אתם מחפשים, לענות על השאלות ולעזור לכם להתקדם בכיוון הנכון. | Männlicher Plural (§2.2), wie `השאירו פנייה` in §6.1. Glossar-Frage 4 (Beratungssprache). | |
| `backLink` | Case Studies | סיפורי לקוחות | Glossar §4. | |
| `privacyNote` | Client privacy comes first — sensitive business information and identifying details are not disclosed in this case study. | פרטיות הלקוחות קודמת לכל, ולכן מידע עסקי רגיש ופרטים מזהים אינם נחשפים בסיפור זה. | **Wortgleich** mit `CASE_STUDY_INTRO_COPY.he.disclaimer` (§11.6) — beide Zeilen zusammen korrigieren. EN-`—` → `ולכן`. | |
| `stageClientSituation` | Client Situation | רקע הלקוח | Auch Linktext in der Sticky-TOC. | |
| `stageClientRequirements` | Client Requirements | דרישות הלקוח | | |
| `stageOurSolution` | Our Solution | הפתרון שלנו | | |
| `stageSelectedProperty` | Selected Property | הנכס שנבחר | | |
| `stageResult` | Result | התוצאה | | |
| `journeyLabel` | The Journey | שלבי התהליך | Überschrift des Inhaltsverzeichnisses, nicht Fließtext. | |
| `relatedTitlePlain` | „Related " | „נכסים " | Leerzeichen am Ende bleibt. | |
| `relatedTitleItalic` | Properties | דומים | Goldakzent. Glossar-Frage 3. | |
| `soldBadge` | Sold | נמכר | Glossar §4 (Kurzform). | |
| `formDetailTitlePlain` | „Ready to write " | „מוכנים לכתוב " | | |
| `formDetailTitleItalic` | your own | סיפור משלכם? | EN/DE lassen den Satz offen; auf Hebräisch fehlt dann das Bezugswort. | |
| `formDetailSubtitle` | Leave your details and our team will get in touch to discuss your goals, answer your questions, and help turn your plans into the next success story. | השאירו פרטים והצוות שלנו יחזור אליכם כדי לדבר על המטרות שלכם, לענות על השאלות ולהפוך את התוכניות לסיפור ההצלחה הבא. | Teilt bewusst den Satzanfang mit `formIndexSubtitle`, genau wie im Englischen. | |
| `propertyTypeVilla` | Villa | וילה | Glossar §2. | |
| `propertyTypeApartment` | Apartment | דירה | Glossar §2. | |
| `propertyTypePenthouse` | Penthouse | פנטהאוז | Glossar §2. | |
| `propertyTypeTownhouse` | Townhouse | בית טורי | Glossar §2 („nicht קוטג'"). | |
| `propertyTypePlot` | Plot | מגרש | Glossar §2 (`מגרש / קרקע`; hier das bebaubare Grundstück). | |
| `guideEyebrow` | The Guide | המדריך | | |
| `guideTitle` | Understanding Case Studies | איך לקרוא סיפורי לקוחות | Letztes Wort wird automatisch vergoldet → `לקוחות`. | |

## Tabelle 2 — `src/app/components/CaseStudyIntro/CaseStudyIntro.copy.ts` (`CASE_STUDY_INTRO_COPY.he`, 2 Strings)

| Key | EN | HE | Anmerkung | Korrektur HE |
|---|---|---|---|---|
| `requestOffer` | Request Personal Offer | לקבלת הצעה אישית | Nominal (§2.1), parallel zu `לקבלת ייעוץ` (§6.1). | |
| `disclaimer` | Client privacy comes first, which is why sensitive business information and identifying details are not disclosed in this case study. | פרטיות הלקוחות קודמת לכל, ולכן מידע עסקי רגיש ופרטים מזהים אינם נחשפים בסיפור זה. | **Wortgleich** mit `CASE_STUDIES_COPY.he.privacyNote` (§11.6). Die beiden englischen Quellen unterscheiden sich nur in der Interpunktion. | |

## Tabelle 3 — `src/app/[lang]/case-studies/[slug]/page.copy.ts` (`CASE_STUDY_PAGE_COPY.he`, 1 String)

| Key | EN | HE | Anmerkung | Korrektur HE |
|---|---|---|---|---|
| `relatedProperties` | Related Properties | נכסים דומים | **Wortgleich** mit `relatedTitlePlain` + `relatedTitleItalic` aus Tabelle 1 (§11.6). Legacy-Route, heute nicht sichtbar. | |

---

## Offene Fragen an den Lektor (Pass C)

1. **Hartcodiertes ` move?` auf der Indexseite.** Der Formulartitel hängt im JSX ein
   englisches „ move?" an — das war schon vor der Lokalisierung so und trifft auch
   Deutsch, Polnisch und Russisch („Rozważasz swój własny move?"). Für Hebräisch ist es
   abgezweigt; die LTR-Ausgabe wurde bewusst **nicht** angefasst, weil dieses Paket keine
   LTR-Strings ändern darf. Die drei anderen Sprachen brauchen einen eigenen Fix.
2. **`נכס` als Stat-Label** (Glossar-Frage 2) — reicht das Wort allein über einem Wert
   wie `וילה`, oder soll `סוג הנכס` stehen?
3. **`דומים` als Goldakzent** in „נכסים דומים" (Glossar-Frage 3).
4. **Beratungssprache in den Formular-Untertiteln** (Glossar-Frage 4).
5. **`סיפורי הצלחה` neben `סיפורי לקוחות`** auf derselben Seite (Glossar-Frage 1).
