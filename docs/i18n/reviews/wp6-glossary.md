# WP6 — Neue Begriffe (Case Studies: Index, Detailseite, Intro-Block)

**Stand:** 2026-09-13 · **Pass A (Übersetzung)** · Ergänzung zu `docs/i18n/he-glossary.md`
(dort **nicht** eingetragen — WP1 besitzt diese Datei; nach Pass C wandern die bestätigten
Zeilen in §2/§4/§5 des Hauptglossars).

Nur Begriffe, die WP6 gebraucht hat und die in `he-glossary.md` §1–5 (inkl. §6.1 aus WP1)
sowie in `wp3-glossary.md` fehlen. **Übernommen ohne Änderung** aus den bestehenden
Dokumenten: `Case studies` = `סיפורי לקוחות` (§4), `case study (Einzelfall)` = `סיפור לקוח`
(WP3), `Sold badge` = `נמכר` (§4), `Budget` = `תקציב` (§4), `timeline` = `לוח זמנים` (WP1 §6.1),
`רילוקיישן` (§3), sowie die Objekttypen `וילה / דירה / פנטהאוז / בית טורי / מגרש` (§2).

| EN | HE | Kontext | Begründung |
|---|---|---|---|
| Success Stories (Eyebrow über der H1) | סיפורי הצלחה | `eyebrow` | §4 belegt `סיפורי לקוחות` für „Case studies". Eyebrow und H1 stünden sonst wortgleich übereinander (im Deutschen passiert genau das). `סיפורי הצלחה` ist der etablierte israelische Begriff und hält die beiden Zeilen auseinander. |
| Read the story (Mockup-CTA) | לקריאת הסיפור | `deviceRead` | Nominalstil §2.1. Bewusst anders als `ctaReadFull`, wie im Englischen („Read the story" vs. „Read the full story"). |
| Read the full story (Karten-CTA) | לסיפור המלא | `ctaReadFull` | Nominalstil, drei Wörter, ohne Wurzelwiederholung zu `לקריאת הסיפור`. |
| Location (Stat-Label) | מיקום | `statLocation` | §1 hat nur Ortsnamen, §4 nur `מרחק מ…`. `מיקום` ist das Standard-Label; `מיקום` statt `אזור`, weil der DB-Wert eine Stadt sein kann. |
| Property (Stat-Label, Wert = Objekttyp) | נכס | `statProperty` | §2 hat `נכס` als „property (ein Objekt)". Label auf EN-Länge; `סוג הנכס` wäre präziser, sprengt aber die Stat-Zeile. → offene Frage 2. |
| Client Situation (Abschnitt/TOC) | רקע הלקוח | `stageClientSituation` | Smichut, zwei Wörter, passt in die Sticky-TOC. `המצב של הלקוח` klingt nach Fallakte. |
| Client Requirements | דרישות הלקוח | `stageClientRequirements` | |
| Our Solution | הפתרון שלנו | `stageOurSolution` | |
| Selected Property | הנכס שנבחר | `stageSelectedProperty` | Passiv-Partizip ist hier natürlicher als `הנכס הנבחר` (= „der auserwählte"). |
| Result | התוצאה | `stageResult` | Mit Artikel, weil es die Überschrift des letzten Abschnitts ist. |
| The Journey (Label über der Sticky-TOC) | שלבי התהליך | `journeyLabel` | Wörtlich `המסע` ist im Hebräischen Reise-Vokabular und würde neben „Zypern" als Urlaub gelesen. Ein Inhaltsverzeichnis über fünf Phasen heißt auf Israelisch `שלבי התהליך`. |
| Related Properties | נכסים דומים | `relatedTitlePlain` + `relatedTitleItalic`, `CASE_STUDY_PAGE_COPY.relatedProperties` | Wortgleich an beiden Fundstellen (§11.6). „Related" = `דומים` statt `קשורים`: verbunden sind die Objekte nicht, ähnlich schon. → offene Frage 3. |
| Considering your own move? | שוקלים מהלך דומה? | `formIndexTitlePlain` + `…Italic` | „move" ist hier der Umzug/Kaufschritt, nicht der Ortswechsel allein. `מהלך` deckt beides ab. |
| Ready to write your own …? | מוכנים לכתוב סיפור משלכם? | `formDetailTitlePlain` + `…Italic` | EN/DE brechen den Satz ab („Ready to write your own"); auf Hebräisch wird der Satz zu Ende gebracht, sonst fehlt das Bezugswort. |
| Request Personal Offer | לקבלת הצעה אישית | `CASE_STUDY_INTRO_COPY.requestOffer` | Nominalstil §2.1, parallel zum §6.1-Header-CTA `לקבלת ייעוץ`. |
| Client privacy comes first … | פרטיות הלקוחות קודמת לכל, ולכן מידע עסקי רגיש ופרטים מזהים אינם נחשפים בסיפור זה. | `privacyNote`, `CASE_STUDY_INTRO_COPY.disclaimer` | Neue §5-Boilerplate. Steht an zwei Stellen und ist bewusst **wortgleich** (§11.6), obwohl die beiden englischen Quellen sich in der Interpunktion unterscheiden. `בסיפור זה` (Schriftregister) statt `בסיפור הזה` (gesprochen), analog zur WP1-Entscheidung bei `עוד בנושא זה`. |
| The Guide (Eyebrow SEO-Block) | המדריך | `guideEyebrow` | WP3 hat `Your guide to …` = `המדריך שלכם ל…`; hier steht das Wort allein. |
| Understanding Case Studies | איך לקרוא סיפורי לקוחות | `guideTitle` | `להבין` wäre die Wörtlichkeit; ein israelischer Erklärblock heißt `איך לקרוא…`. Letztes Wort wird vergoldet → endet auf `לקוחות` (§11.3). |
| A Cyprus property success story (Fallback) | סיפור הצלחה של רוכשים בקפריסין | `deviceHeadlineFallback` | Nur sichtbar, wenn keine Case Study veröffentlicht ist. |
| deal / transaction (Immobilienkauf) | עסקה | `heroLead` (`עסקאות נדל"ן אמיתיות`) | Vermeidet die Wurzelwiederholung `רכישות … רוכשים` im selben String (§11.5). Glossar §2 kennt nur `חוזה מכר`. |
| second home | בית שני | `heroLead`, `metaDescription` | §2 hat „resale" = `יד שנייה`, aber keinen Zweitwohnsitz. `בית שני` ist der gängige israelische Begriff (nicht `דירת נופש`, das nach Ferienvermietung klingt). |

## Offene Fragen an den Lektor (Pass C)

1. **`סיפורי הצלחה` (Eyebrow) neben `סיפורי לקוחות` (H1).** Zwei Bezeichnungen für
   dieselbe Rubrik auf derselben Seite. Alternative: Eyebrow `לקוחות שלנו`, H1 bleibt.
2. **`נכס` vs. `סוג הנכס`** als Stat-Label über dem Wert `וילה`/`דירה`. `נכס` ist auf
   EN-Länge, `סוג הנכס` ist präziser. Die Stat-Zeile trägt vier Labels nebeneinander.
3. **`נכסים דומים` vs. `עוד נכסים`** für „Related Properties". WP4 hat beim Blog
   `עוד` + gold `מאמרים` gewählt, damit das Substantiv den Akzent trägt. Auf Hebräisch
   steht das Adjektiv hinten, hier trägt also `דומים` den Goldakzent. Wenn der Lektor
   den Akzent lieber auf dem Substantiv sähe, wird daraus `עוד ` + `נכסים` — dann bitte
   **beide** Fundstellen ändern (Tabelle 1 und Tabelle 3).
4. **Beratungssprache (Entscheidung E).** Die beiden Formular-Untertitel
   (`formIndexSubtitle`, `formDetailSubtitle`) versprechen einen Rückruf, sagen aber
   nicht, dass das Team kein Hebräisch spricht. Der Satz steht heute nicht im
   englischen Original und wurde deshalb nicht erfunden. Soll die §5-Boilerplate
   `הייעוץ מתקיים באנגלית או ברוסית; פנייה בעברית מתקבלת בברכה.` hier ergänzt werden
   (dann als eigener Key, nicht angehängt)?
