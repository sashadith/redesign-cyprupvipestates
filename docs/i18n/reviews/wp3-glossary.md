# WP3 — Neue Begriffe (Homepage + Landing-Block-Copy)

**Stand:** 2026-09-13 · **Pass A (Übersetzung) + Pass B (Kritik) eingearbeitet** · Ergänzung zu `docs/i18n/he-glossary.md`
(dort **nicht** eingetragen — WP1 besitzt diese Datei; nach Pass C wandern die bestätigten
Zeilen in §2/§4/§5 des Hauptglossars).

> **Konsolidiert am 2026-09-13 in `docs/i18n/he-glossary.md` §1–§5.** Die dort eingetragenen Formen sind verbindlich; Pass-C-Vorbehalte stehen in §6, die Auflösung der cross-WP-Divergenzen in §7. Diese Datei bleibt unverändert als Audit-Trail (Begründungen, Pass-A/Pass-B-Verlauf) erhalten und ist **keine** Quelle mehr.

Nur Begriffe, die WP3 gebraucht hat und die in `he-glossary.md` §1–5 (inkl. §6.1 aus WP1)
fehlen oder dort in einer anderen Wortform stehen.

| EN | HE | Kontext | Begründung |
|---|---|---|---|
| Cyprus Property Experts | מומחי נדל"ן בקפריסין | Hero-H1 (`HOME_STRINGS.heroLine1/heroAccent/heroLine2`) | Trägt den Hub-Term `נדל"ן בקפריסין` (320/Mon., `he-keyword-map.md` #1) wörtlich und bleibt kurz genug für den Hero. Akzent liegt auf `נדל"ן`. |
| Frequently asked questions (Abschnittsüberschrift) | שאלות נפוצות | `FAQ_TITLE` (Landing-Fallback), Faq-H2 | §4 führt `FAQ` = `שאלות ותשובות` als **Navigationslabel**. Als Überschrift über einem Akkordeon sagen israelische Sites durchgängig `שאלות נפוצות`; `שאלות ותשובות` bleibt das Menü-Label. |
| review / testimonial (Kundenstimme) | המלצה / Plural המלצות | `SliderReviewsFull`, Kundenstimmen-Slider | **Pass B, geändert** (war `חוות דעת`). Drei getrennte Register: `חוות דעת` = professionelles Fachgutachten (משפטית/רפואית), `ביקורות` = Sterne-/Portalbewertungen (neutral, vgl. `ביקורות גוגל`), `המלצות` = Kundenstimmen. Der Slider zeigt Kundenstimmen. |
| Read full review | לקריאת ההמלצה המלאה | Slider-CTA | **Pass B, geändert** (war `לקריאת חוות הדעת המלאה`, 4 Wörter). Nominalstil §2.1, 3 Wörter nach §11.7. |
| case study (Einzelfall) | סיפור לקוח | `readCaseStudy`, Kategorie-Chips | §4 hat nur den Plural `סיפורי לקוחות` (Nav). Singular für den Karten-CTA. |
| Contact (Button auf einer Personenkarte) | ליצירת קשר | `TeamBlockComponent.contact` | §4 gibt `צור קשר` für das **Menü**. Auf der Karte eines Beraters ist der Infinitiv (§2.1) richtig und genusfrei. |
| View project | לצפייה בפרויקט | `ProjectsSectionSlider.viewProject` | Nominal/Infinitiv statt `צפה בפרויקט`. |
| Show all projects | לכל הפרויקטים | `showAllProjects` | **Pass B, geändert** (war `הצגת כל הפרויקטים`). §4 `Show more` = `הצגת עוד` ist ein Pagination-Control; hier steht der Link im Listenkopf neben einem Pfeil, deshalb dasselbe Muster wie `exploreAllCases` (2 Wörter). |
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
| member of the European Union | מדינה חברה באיחוד האירופי | Landing-Bullet | **Pass B, geändert** (war `חברה באיחוד האירופי`). Als alleinstehender Bullet liest sich `חברה` zuerst als „eine Firma"; der Bezug (`קפריסין`) steht nicht in der Zeile, deshalb das explizite `מדינה`. §3 hat nur `אזרחות אירופית`. |
| featured (Auswahl, Plural) | נבחרים | `FeaturedProjects.tsx`, H2 `פרויקטים נבחרים בקפריסין` | **Pass B, neu.** Grenzt gegen §4 `מובחר` ab: `מובחר` taugt nur als Badge an einem einzelnen Objekt, für „featured projects" ist `נבחרים` richtig. Bei der Übernahme ins Hauptglossar wird §4 `Featured = מובחר` entsprechend auf „Badge" eingeschränkt. |
| properties for sale | נכסים למכירה | `Cities.tsx`-Akzent und H2 | **Pass B, neu.** Siehe offene Frage 1 unten (beantwortet). |
| Why … choose us | בוחרים בנו | `Description.tsx`-Akzent, H2 `למה רוכשים מישראל בוחרים בנו` | **Pass B, neu.** Verb + gebundenes Pronomen als **eine** Einheit; `בנו` allein ist in Goldkursiv ein Wortfragment. |
| Leave your details (Formular-Headline) | השאירו פרטים | `preview-home/sections/Form.tsx` `titleNode("he")`, `FormStatic.copy.ts` `he.title` | **Pass B, neu — ersetzt `השאירו פנייה` aus §6.1** (`enquiry / request (Lead)`). `השאירו פרטים` ist die stehende israelische Lead-Formel; `השאירו פנייה` ist eine Kalkierung von «Оставьте заявку». Bei der Übernahme ins Hauptglossar wird §6.1 entsprechend korrigiert. Beide Fundstellen sind angeglichen (§11.6). |
| sunny days a year | ימי שמש בשנה | Landing-Bullet, `citiesLead` | |
| ceremonial handover (Schlüsselübergabe) | מסירה בטקס חגיגי | Landing-Step 6 | §2 hat `מסירה`; „ceremoniously" braucht den Zusatz. |

## Offene Fragen — in Pass B beantwortet

1. **`נכסים למכירה` vs. `דירות למכירה`** im Cities-H2 → **`נכסים למכירה` bleibt.**
   Nicht wegen des Volumens, sondern wegen der Seitenarchitektur: `דירות למכירה בקפריסין`
   (140) ist in `he-keyword-map.md` §4 das Primär-KW der Spoke-Seite #2
   (`/he/apartments-for-sale-cyprus`); den Term von der Startseite aus zu belegen,
   kannibalisiert die Seite, bevor sie gebaut ist. Die Ausweichvariante
   `דירות ווילות למכירה בקפריסין` löst das nicht — das eingeschobene `ווילות` zerstört
   die Exact-Match-Phrase und macht den Akzent zu `למכירה`, einem inhaltsleeren Goldwort.
   Dazu die Wahrheitsfrage: der Abschnitt zeigt Wohnungen **und** Villen, `נכסים` ist das
   ehrliche Wort. Akzent bleibt `נכסים למכירה`.
2. **`חוות דעת` vs. `המלצות`** für Kundenstimmen → **`המלצות`.** Israelische Sites trennen
   drei Register: `חוות דעת` = professionelles Gutachten, `ביקורות` = Sterne-/Portalbewertungen
   (neutral, siehe `ביקורות גוגל`; die Gleichsetzung mit „Verriss" gilt nur für den
   Kunst-Singular `ביקורת`), `המלצות` = Kundenstimmen. Der Slider zeigt Kundenstimmen.
   Umgesetzt in `SliderReviewsFull.copy.ts`.
3. **`רילוקיישן`** im Kategorie-Chip → **bestätigt.** Glossar §3 führt es verbindlich,
   `he-keyword-map.md` weist 170/Mon. aus, `העתקת מגורים` hat kein Volumen und ist für einen
   Chip zu lang.

## Für die Übernahme ins Hauptglossar (nach Pass C)

Zwei bestehende Zeilen in `he-glossary.md` werden von WP3 korrigiert, nicht nur ergänzt:

- **§4 `Featured = מובחר`** → auf „Badge an einem einzelnen Objekt" einschränken und
  `featured (Auswahl, Plural) = נבחרים` daneben aufnehmen.
- **§6.1 `enquiry / request (Lead) … השאירו פנייה`** → Formular-Headline auf
  `השאירו פרטים` umstellen.

Die Datei `he-glossary.md` gehört WP1 und wird von WP3 **nicht** angefasst.
