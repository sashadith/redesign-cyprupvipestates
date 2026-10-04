# WP6 — Neue Begriffe (Case Studies: Index, Detailseite, Intro-Block)

**Stand:** 2026-09-13 · **Pass A + Fix-Runde 1 nach Pass B** · Ergänzung zu `docs/i18n/he-glossary.md`
(dort **nicht** eingetragen — WP1 besitzt diese Datei; nach Pass C wandern die bestätigten
Zeilen in §2/§4/§5 des Hauptglossars).

> **Konsolidiert am 2026-09-13 in `docs/i18n/he-glossary.md` §1–§5.** Die dort eingetragenen Formen sind verbindlich; Pass-C-Vorbehalte stehen in §6, die Auflösung der cross-WP-Divergenzen in §7. Diese Datei bleibt unverändert als Audit-Trail (Begründungen, Pass-A/Pass-B-Verlauf) erhalten und ist **keine** Quelle mehr.

Nur Begriffe, die WP6 gebraucht hat und die in `he-glossary.md` §1–5 (inkl. §6.1 aus WP1)
sowie in `wp3-glossary.md` / `wp4-glossary.md` fehlen. **Übernommen ohne Änderung** aus den
bestehenden Dokumenten: `Case studies` = `סיפורי לקוחות` (§4), `case study (Einzelfall)` =
`סיפור לקוח` (WP3), `Sold badge` = `נמכר` (§4), `Budget` = `תקציב` (§4), `timeline` =
`לוח זמנים` (WP1 §6.1), `רילוקיישן` (§3), `The Guide (Eyebrow)` = `המדריך`
(**`wp4-glossary.md`**, identischer Kontext: SEO-/Content-Block unter der Liste — Pass A
führte das fälschlich als Neuzugang, s. Pass B S8), `Beratungssprache (Entscheidung E)` =
`הייעוץ מתקיים באנגלית או ברוסית; פנייה בעברית מתקבלת בברכה.` (§5, wörtlich übernommen),
sowie die Objekttypen `וילה / דירה / פנטהאוז / בית טורי / מגרש` (§2).

**20 Begriffe** in der Tabelle unten. (Pass A schrieb „22"; die Tabelle hatte 21 Datenzeilen
— Pass B S7 —, und nach S8 wandert `The Guide` in die Übernahmeliste, es bleiben 20.)

| EN | HE | Kontext | Begründung |
|---|---|---|---|
| Success Stories (Eyebrow über der H1) | מהשטח | `eyebrow` | **Fix-Runde 1 (M8).** Pass A hatte `סיפורי הצלחה` — das wiederholt `סיפורי` aus der H1 `סיפורי לקוחות` unmittelbar darunter, im Hebräischen ein sichtbares Stottern (Geist von §11.5). Die in Pass A erwogene Alternative `לקוחות שלנו` scheidet aus (Wurzel ל.ק.ח wie in der H1, ohne Artikel ungrammatisch). `מהשטח` ist der israelische Standard-Eyebrow für „echte Fälle": 5 Graphem, keine Wort- oder Wurzelkollision mit H1 und Lead. |
| Read the story (Mockup-CTA) | לקריאת הסיפור | `deviceRead` | Nominalstil §2.1. Bewusst anders als `ctaReadFull`, wie im Englischen („Read the story" vs. „Read the full story"). |
| Read the full story (Karten-CTA) | לסיפור המלא | `ctaReadFull` | Nominalstil, drei Wörter, ohne Wurzelwiederholung zu `לקריאת הסיפור`. |
| Location (Stat-Label) | מיקום | `statLocation` | §1 hat nur Ortsnamen, §4 nur `מרחק מ…`. `מיקום` ist das Standard-Label; `מיקום` statt `אזור`, weil der DB-Wert eine Stadt sein kann. |
| Property (Stat-Label, Wert = Objekttyp) | סוג הנכס | `statProperty` | **Fix-Runde 1 (M2).** Der Wert darunter ist der **Typ** (`וילה`/`דירה`), nicht der Objektname. Die Längenbegründung aus Pass A war falsch nachgerechnet: `סוג הנכס` = 8 Graphem = EN `Property` (8 Zeichen), die Nachbarlabels sind mit `תקציב` (5), `מיקום` (5), `לוח זמנים` (9) kürzer bzw. gleich lang. Dazu die Kollision mit WP2, wo `נכס` als **Wert** belegt ist (`TYPE_LABEL.generic` in `developmentSeo.ts`). |
| Client Situation (Abschnitt/TOC) | רקע הלקוח | `stageClientSituation` | Smichut, zwei Wörter, passt in die Sticky-TOC. `המצב של הלקוח` klingt nach Fallakte. |
| Client Requirements | דרישות הלקוח | `stageClientRequirements` | |
| Our Solution | הפתרון שלנו | `stageOurSolution` | |
| Selected Property | הנכס שנבחר | `stageSelectedProperty` | Passiv-Partizip ist hier natürlicher als `הנכס הנבחר` (= „der auserwählte"). |
| Result | התוצאה | `stageResult` | Mit Artikel, weil es die Überschrift des letzten Abschnitts ist. |
| The Journey (Label über der Sticky-TOC) | שלבי התהליך | `journeyLabel` | Wörtlich `המסע` ist im Hebräischen Reise-Vokabular und würde neben „Zypern" als Urlaub gelesen. Ein Inhaltsverzeichnis über fünf Phasen heißt auf Israelisch `שלבי התהליך`. |
| Related Properties | עוד נכסים | `relatedTitlePlain` (`עוד `) + `relatedTitleItalic` (`נכסים`), `CASE_STUDY_PAGE_COPY.relatedProperties` | **Fix-Runde 1 (S5).** Wortgleich an beiden Fundstellen (§11.6). Zwei Gründe gegen `נכסים דומים`: (a) die Karten kommen aus `cs.relatedProjects`, also redaktionell verknüpften Projekten, nicht aus einer Ähnlichkeitsberechnung — `דומים` behauptet eine Beziehung, die die Daten nicht hergeben (§8); WP2 nutzt `פרויקטים דומים` genau dort, wo Ähnlichkeit gerechnet wird. (b) Der Goldakzent gehört wie in WP4 (`עוד ` + `מאמרים`) auf das **Substantiv**. |
| Considering your own move? | שוקלים מהלך דומה? | `formIndexTitlePlain` + `…Italic` | „move" ist hier der Umzug/Kaufschritt, nicht der Ortswechsel allein. `מהלך` deckt beides ab. |
| Ready to write your own …? | מוכנים לכתוב סיפור משלכם? | `formDetailTitlePlain` + `…Italic` | EN/DE brechen den Satz ab („Ready to write your own"); auf Hebräisch wird der Satz zu Ende gebracht, sonst fehlt das Bezugswort. |
| Request Personal Offer | לקבלת הצעה אישית | `CASE_STUDY_INTRO_COPY.requestOffer` | Nominalstil §2.1, parallel zum §6.1-Header-CTA `לקבלת ייעוץ`. |
| Client privacy comes first … | פרטיות הלקוחות קודמת לכל, ולכן מידע עסקי רגיש ונתונים מזהים אינם נחשפים בסיפור זה. | `privacyNote`, `CASE_STUDY_INTRO_COPY.disclaimer` | **Fix-Runde 1 (M1):** `פרטים מזהים` → `נתונים מזהים`, weil `פרטיות` und `פרטים` dieselbe Wurzel פ.ר.ט sind und nur fünf Wörter auseinanderstehen (§11.5); `נתונים מזהים` ist im israelischen Datenschutzsprachgebrauch gleichwertig etabliert. Neue §5-Boilerplate. Steht an zwei Stellen und ist bewusst **wortgleich** (§11.6), obwohl die beiden englischen Quellen sich in der Interpunktion unterscheiden. `בסיפור זה` (Schriftregister) statt `בסיפור הזה` (gesprochen), analog zur WP1-Entscheidung bei `עוד בנושא זה`. |
| Understanding Case Studies | איך לקרוא סיפורי לקוחות | `guideTitle` | `להבין` wäre die Wörtlichkeit; ein israelischer Erklärblock heißt `איך לקרוא…`. Letztes Wort wird vergoldet → endet auf `לקוחות` (§11.3). |
| A Cyprus property success story (Fallback) | סיפור הצלחה של רוכשים בקפריסין | `deviceHeadlineFallback` | Nur sichtbar, wenn keine Case Study veröffentlicht ist. |
| deal / transaction (Immobilienkauf) | עסקה | `heroLead` (`עסקאות נדל"ן אמיתיות`) | Vermeidet die Wurzelwiederholung `רכישות … רוכשים` im selben String (§11.5). Glossar §2 kennt nur `חוזה מכר`. |
| second home | בית שני | `heroLead`, `metaDescription` | §2 hat „resale" = `יד שנייה`, aber keinen Zweitwohnsitz. `בית שני` ist der gängige israelische Begriff (nicht `דירת נופש`, das nach Ferienvermietung klingt). |

## Offene Fragen an den Lektor (Pass C)

Die vier Fragen aus Pass A sind durch Pass B und Fix-Runde 1 entschieden — hier zur
Nachvollziehbarkeit mit dem Ergebnis, nicht mehr als Frage:

1. **Eyebrow neben der H1** → entschieden: `מהשטח` statt `סיפורי הצלחה` (M8).
2. **`נכס` vs. `סוג הנכס`** als Stat-Label → entschieden: `סוג הנכס` (M2); die
   Längenbefürchtung war falsch gerechnet.
3. **`נכסים דומים` vs. `עוד נכסים`** → entschieden: `עוד ` + gold `נכסים`, an beiden
   Fundstellen (S5); damit gilt die WP4-Regel „Akzent auf dem Substantiv" paketübergreifend.
4. **Beratungssprache (Entscheidung E)** in den Formular-Untertiteln → entschieden: ja,
   angehängt statt als eigener Key (M6). Der Satz steht wörtlich wie in `he-glossary.md` §5
   und wie in `preview-contacts`, `preview-about` und `lib/crm/compose/greeting.ts`.

**Neu offen nach Fix-Runde 1:** keine Begriffsfrage. Offen bleibt nur die Datenlage
(`caseStudiesPage`-Dokument auf `he`, S9) — siehe `wp6.md`, „Offene Punkte".
