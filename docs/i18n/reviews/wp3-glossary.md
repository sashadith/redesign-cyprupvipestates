# WP3 — Neue Begriffe (Homepage + Landing-Block-Copy)

**Stand:** 2026-09-13 · **Pass A (Übersetzung)** · Ergänzung zu `docs/i18n/he-glossary.md`
(dort **nicht** eingetragen — WP1 besitzt diese Datei; nach Pass C wandern die bestätigten
Zeilen in §2/§4/§5 des Hauptglossars).

Nur Begriffe, die WP3 gebraucht hat und die in `he-glossary.md` §1–5 (inkl. §6.1 aus WP1)
fehlen oder dort in einer anderen Wortform stehen.

| EN | HE | Kontext | Begründung |
|---|---|---|---|
| Cyprus Property Experts | מומחי נדל"ן בקפריסין | Hero-H1 (`HOME_STRINGS.heroLine1/heroAccent/heroLine2`) | Trägt den Hub-Term `נדל"ן בקפריסין` (320/Mon., `he-keyword-map.md` #1) wörtlich und bleibt kurz genug für den Hero. Akzent liegt auf `נדל"ן`. |
| Frequently asked questions (Abschnittsüberschrift) | שאלות נפוצות | `FAQ_TITLE` (Landing-Fallback), Faq-H2 | §4 führt `FAQ` = `שאלות ותשובות` als **Navigationslabel**. Als Überschrift über einem Akkordeon sagen israelische Sites durchgängig `שאלות נפוצות`; `שאלות ותשובות` bleibt das Menü-Label. |
| review / testimonial (Kundenstimme) | חוות דעת | `SliderReviewsFull.readFullReview` | Im Glossar fehlt der Begriff. `ביקורת` ist im Hebräischen die Kritik (Rezension/Verriss), `חוות דעת` die Kundenmeinung — bei Kundenstimmen die richtige Wahl. |
| Read full review | לקריאת חוות הדעת המלאה | Slider-CTA | Nominalstil §2.1. |
| case study (Einzelfall) | סיפור לקוח | `readCaseStudy`, Kategorie-Chips | §4 hat nur den Plural `סיפורי לקוחות` (Nav). Singular für den Karten-CTA. |
| Contact (Button auf einer Personenkarte) | ליצירת קשר | `TeamBlockComponent.contact` | §4 gibt `צור קשר` für das **Menü**. Auf der Karte eines Beraters ist der Infinitiv (§2.1) richtig und genusfrei. |
| View project | לצפייה בפרויקט | `ProjectsSectionSlider.viewProject` | Nominal/Infinitiv statt `צפה בפרויקט`. |
| Show all projects | הצגת כל הפרויקטים | `showAllProjects` | Analog zu §4 `Show more` = `הצגת עוד`. |
| View all projects | לצפייה בכל הפרויקטים | `viewAllProjects` (Hero-Button) | Der Hero-Button steht neben dem CTA `לקבלת ייעוץ`; zwei Infinitive lesen sich dort besser als eine Nominalphrase. Bewusst anders als `showAllProjects` (Link im Listenkopf). |
| On request (kurze Preiszelle) | לפי פנייה | `onRequest` | §2 hat nur die Langform `מחיר לפי פנייה` (= `priceOnRequest`). Die Karte hat nur eine Zeile Platz. |
| Latest developments | פרויקטים חדשים | `newLead2` + `newAccent` | §2 `new development` = `פרויקט חדש`; hier der Plural als Abschnittstitel. „Latest" wird nicht als `אחרונים` übersetzt — im Hebräischen heißt die Kategorie schlicht `פרויקטים חדשים` (vgl. Keyword-Map §6.5: „off-plan" existiert nicht, die Nachfrage heißt `פרויקטים ב…`). |
| Your guide to … | המדריך שלכם ל… | `contentTitle` | |
| buyers (Käufer, generisch) | רוכשים | `faqLead`, Description-H2 | `קונים` klingt nach Einzelhandel; `רוכשים` ist der Immobilien-Standard. |
| international clients / buyers from abroad | רוכשים מחו"ל | `contentLead` | |
| luxury villa purchase | רכישת וילת יוקרה | Case-Kategorie | §2 hat `וילה`; `וילת יוקרה` ist die übliche Smichut-Form. |
| investment property (Kategorie-Chip) | נכס להשקעה | Case-Kategorie | §3 hat `השקעה`, §2 `נכס`. |
| quality of life | איכות חיים | Landing-Bullet | |
| standard of education | רמת חינוך | Landing-Bullet | |
| healthcare system (allgemein) | מערכת בריאות | Landing-Bullet | §3 nennt nur `מערכת הבריאות (GESY)` (das zyprische System namentlich). |
| tax system | מערכת מס | Landing-Bullet | §3 hat Steuerarten, nicht das System. |
| member of the European Union | חברה באיחוד האירופי | Landing-Bullet | §3 hat nur `אזרחות אירופית`. |
| sunny days a year | ימי שמש בשנה | Landing-Bullet, `citiesLead` | |
| ceremonial handover (Schlüsselübergabe) | מסירה בטקס חגיגי | Landing-Step 6 | §2 hat `מסירה`; „ceremoniously" braucht den Zusatz. |

## Offene Fragen an den Lektor (Pass C)

1. **`נכסים למכירה` vs. `דירות למכירה`** im Cities-H2. Die Keyword-Map hat
   `דירות למכירה בקפריסין` (140) mit Volumen, `נכסים למכירה` nur 20. Gewählt wurde
   `נכסים למכירה`, weil der Abschnitt Wohnungen **und** Villen zeigt; falls der Lektor
   das Suchvolumen höher gewichtet, wird der H2 zu `דירות ווילות למכירה בקפריסין`
   (und der Akzent zu `למכירה`).
2. **`חוות דעת` vs. `המלצות`** für Kundenstimmen — `המלצות` (Empfehlungen) ist die
   zweite gängige israelische Bezeichnung.
3. **`רילוקיישן`** (§3 bereits verbindlich) im Kategorie-Chip: bewusst das Lehnwort,
   nicht `העתקת מגורים` — kurz genug für einen Chip und der Suchbegriff (170/Mon.).
