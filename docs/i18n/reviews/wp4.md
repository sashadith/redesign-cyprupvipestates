# Lektorat WP4 — Blog-Chrome, Developers-Seite, Catch-all-SEO-Fallbacks

**Stand:** 2026-09-13 · **Pass A (Erstübersetzung) fertig** · Marker im Code: `REVIEW(he)`
**Umfang:** 5 Dateien, 6 `he`-Einträge, 33 Einzelstrings.
**Quelle:** immer der englische Eintrag. Die deutschen Zeilen dienten nur als Tonreferenz.
**Glossar-Ergänzungen:** `docs/i18n/reviews/wp4-glossary.md` (28 Begriffe; `he-glossary.md` wurde nicht angefasst).

---

## Wo diese Strings sichtbar sind

| Fläche | Seite / Zustand |
|---|---|
| Blog-Hero (Eyebrow, H1, Artikelzähler) | `/he/blog` — Eyebrow, gold akzentuierte H1, Zeile „N מאמרים באנגלית" |
| Hero-Mockup (Telefonrahmen rechts) | `/he/blog` — Kicker = H1-Text, unten der Featured-CTA |
| Kategorien-Tabs + Karten-CTA | `/he/blog` — Tab „הכול", Karten-Fußzeile „לקריאה" |
| Pager | `/he/blog?page=2` und tiefer — `aria-label`s (nur mit Screenreader hörbar) |
| Leerzustand | `/he/blog` mit gefilterter, leerer Kategorie |
| Content-/SEO-Block | Fuß von `/he/blog`, nur auf Seite 1 und nur wenn das CMS-Dokument Inhalt hat |
| Artikelseite | `/he/blog/<slug>` — Kicker-Back-Link, Lesedauer, Inhaltsverzeichnis links, Autorenkarte, Related-Überschrift |
| Fallback-Projektblock im Artikel | `/he/blog/<slug>` — nur bei Artikeln **ohne** eigenen Projekte-Block; Überschrift mit oder ohne Stadt |
| Blog-Slider-Karten | Projektkarten in Artikel-Slidern (`BlogSlide`) — Preiszeile |
| Alter Blog-Renderer | `BlogPostsRenderer` (Kategorien-Tab + Ladeknopf) — Legacy-Pfad, gleiche Prüfung |
| Developers-Index | `/he/developers` — `<title>`, Meta-Description, H1 (letztes Wort gold), Untertitel, zwei Intro-Absätze, Zähler „12 פרויקטים" pro Karte |
| Paginierte Landingpages | `/he/<slug>?page=2` — Title-Suffix und, wenn das CMS weder Meta-Description noch Excerpt hat, die Fallback-Description |

**Wichtig:** `/he/blog` und `/he/blog/<slug>` zeigen die **englischen** Artikel (Produktentscheidung:
Artikel werden nicht übersetzt) und tragen `noindex`. Nur das Chrome ist hebräisch. Bitte beim
Lesen prüfen, ob die Seite diesen Bruch ehrlich und ruhig kommuniziert — siehe offene Frage 1.

## Wie zu lektorieren ist

1. Kurzcheckliste `docs/i18n/he-styleguide.md` §10 Punkt für Punkt:
   kein englischer Restsatz · Genus nach §2 (Nominal/Infinitiv, sonst männlicher Plural,
   keine Schrägstriche) · Preise/Zahlen nach §5, Bidi isoliert · Ortsnamen nach Glossar,
   Eigennamen lateinisch · Meta-Title ≤ 60, Description ≤ 155 · keine Zeile aus §7 ·
   jede Zahl hat eine Quelle.
2. Zusätzlich §11: kein `—`, keine Wurzelwiederholung im selben String, duplizierte
   Strings wortgleich, zweiter Durchgang über das rendernde JSX (siehe Kasten unten).
3. Länge mitdenken: CTAs ≤ 3 Wörter, Tabs und Zählzeilen ungefähr auf EN-Länge.
4. **Korrekturen in die Spalte `Korrektur HE` eintragen** — die vorhandene HE-Spalte
   bitte unverändert lassen, damit der Diff nachvollziehbar bleibt. Zeile ohne Korrektur
   leer lassen (= freigegeben).
5. Zurück an den Controller; er übernimmt die Korrekturen und entfernt `REVIEW(he)`.

**Nicht ändern:** Keys, `${…}`/`{city}`-Platzhalter, `dateLocale` (`"he-IL"`, ein Intl-Tag,
kein Text), `href`-Werte, Slugs, Markenname `Cyprus VIP Estates`.

**Unsichtbare Zeichen:** `⟦FSI⟧…⟦PDI⟧` unten steht für `bidiIsolate()` (U+2068…U+2069) im Code —
damit ein lateinischer Name im hebräischen Absatz nicht verdreht wird. Beim Korrigieren bitte
nicht mit abtippen, nur den Text.

### Zweiter Durchgang über das rendernde JSX (§11.3) — was Pass A hier geprüft hat

| Stelle | Verarbeitung | Konsequenz für die Übersetzung |
|---|---|---|
| `BlogInsights.tsx` H1 | splittet `heroTitle` an Leerzeichen, **letztes Wort gold** | `תובנות מקפריסין` endet mit dem sinntragenden Wort |
| `page.tsx` (Artikel) Related-Titel | `{relatedLead} <span class="it">{relatedAccent}</span>` | `עוד` + gold `מאמרים` — das Substantiv trägt den Akzent wie in EN/DE/RU |
| `developers/page.tsx` `withAccent()` | `lastIndexOf(" ")`, **letztes Wort gold** | `יזמי נדל"ן בקפריסין` endet auf `בקפריסין`, genau wie „Zypern"/„Кипре" in den anderen Locales |
| `BlogSlide.tsx` Preiszeile | `priceFrom` + `&nbsp;` + `<Bdi ltr>{Preis}</Bdi>` | deshalb `מחיר התחלתי` statt Glossar-`החל מ-` (dessen Bindestrich muss am Betrag kleben) |
| `blog/[slug]/page.tsx` Fallback-Überschrift | `.replace("{city}", cityHit)` mit **lateinischem** Städtenamen | `ב-⟦FSI⟧{city}⟦PDI⟧` |
| `[...slug]/page.tsx` Meta | `description + pageSuffix` — auf Seite 2+ folgt Hebräisch **nach** der Marke | Marke mit `bidiIsolate()` umschlossen |
| Artikelzähler | `{total} {total === 1 ? articleOne : articleMany}` | Singular und Plural beide mit `באנגלית`, damit „1 מאמר באנגלית" auch stimmt |

---

## 1. `src/app/[lang]/blog/blogI18n.ts` — `BLOG_STRINGS.he` (Blogliste + Artikelseite)

| Key | EN | HE | Anmerkung | Korrektur HE |
|---|---|---|---|---|
| heroTitle | Cyprus Insights | תובנות מקפריסין | H1 auf `/he/blog` **und** Back-Link im Artikel-Kicker; letztes Wort wird gold | |
| eyebrow | The Journal | הבלוג | Eyebrow über der H1 | |
| articleOne | article | מאמר באנגלית | Singular hinter der Zahl: „1 מאמר באנגלית" | |
| articleMany | articles | מאמרים באנגלית | „12 מאמרים באנגלית" — trägt die Produktentscheidung; siehe offene Frage 1 | |
| filterAll | All | הכול | Kategorien-Tab | |
| read | Read | לקריאה | Karten-CTA, ein Wort | |
| readArticle | Read article | לקריאת המאמר | Featured-CTA im Hero-Mockup | |
| categoriesAria | Categories | קטגוריות | nur `aria-label` | |
| pagerAria | Blog pagination | ניווט בין עמודי הבלוג | nur `aria-label` | |
| firstPage | First page | העמוד הראשון | Pager, a11y | |
| lastPage | Last page | העמוד האחרון | Pager, a11y | |
| pageWord | Page | עמוד | ergibt `עמוד 3`; wortgleich mit dem Catch-all-Suffix (Abschnitt 5) | |
| empty | No articles yet. | אין עדיין מאמרים. | Leerzustand | |
| guideEyebrow | The Guide | המדריך | Eyebrow des SEO-Blocks | |
| guideTitle | Inside the Journal | על הבלוג | Titel des SEO-Blocks, Aussage statt Doppelpunkt-Titel | |
| dateLocale | en-GB | he-IL | **kein Text** — Intl-Tag für `toLocaleDateString`; Datum wird dadurch automatisch hebräisch formatiert, keine Monatsnamen hartcodiert | |
| minRead | min read | דקות קריאה | „7 דקות קריאה" | |
| tocLabel | On this page | בעמוד הזה | Sticky-Inhaltsverzeichnis | |
| writtenBy | Written by | נכתב על ידי | Autorenkarte; Passiv bezieht sich auf den Artikel, kein Genusproblem | |
| relatedLead | Related | עוד | erster, nicht akzentuierter Teil der Related-Überschrift | |
| relatedAccent | reading | מאמרים | gold akzentuiert; ergibt zusammen „עוד מאמרים" | |
| fallbackProperties | Recommended properties | נכסים מומלצים | Überschrift des Fallback-Projektblocks | |
| fallbackPropertiesInCity | Recommended properties in {city} | נכסים מומלצים ב-⟦FSI⟧{city}⟦PDI⟧ | `{city}` kommt **lateinisch** aus der Route; siehe offene Frage 2 | |

## 2. `src/app/components/BlogSlide/BlogSlide.copy.ts` — `BLOG_SLIDE_COPY.he` (Projektkarte im Artikel)

| Key | EN | HE | Anmerkung | Korrektur HE |
|---|---|---|---|---|
| priceOnRequest | Price on request | מחיר לפי פנייה | Glossar §2 | |
| priceFrom | Price from | מחיר התחלתי | Label vor dem Betrag; `&nbsp;` trennt beide, deshalb nicht `החל מ-` | |

## 3. `src/app/components/BlogPostsRenderer/BlogPostsRenderer.tsx` — `BLOG_POSTS_COPY.he` (alter Blog-Renderer)

`filterAll` war eine `lang === "de" ? … : …`-Kette im JSX und wurde in dieselbe Tabelle gehoben;
die en/de/pl/ru-Texte sind unverändert übernommen.

| Key | EN | HE | Anmerkung | Korrektur HE |
|---|---|---|---|---|
| loadMore | Load {n} more posts | לטעון עוד {n} מאמרים | Infinitiv statt Imperativ; `{n}` ist immer 9 | |
| filterAll | All | הכול | Kategorien-Tab; wortgleich mit `blogI18n.filterAll` | |

## 4. `src/app/[lang]/developers/page.copy.ts` — `DEVELOPERS_PAGE_COPY.he` (`/he/developers`)

Neues Modul; die Kette in `developers/page.tsx` wurde nach dem Repo-Muster (`*.copy.ts`,
`Record<Locale, …>`, `isLocale`-Resolver) ausgelagert, en/de/pl/ru byte-identisch.

| Key | EN | HE | Anmerkung | Korrektur HE |
|---|---|---|---|---|
| title | Developers in Cyprus | יזמי נדל"ן בקפריסין | `<title>` **und** H1; 19 Zeichen (Limit 60); letztes Wort gold; trägt den Hub-Begriff `נדל"ן בקפריסין` aus der Keyword-Map. Ohne Marke, wie in allen anderen Locales — siehe offene Frage 3 | |
| sub | We work with the best property developers in Cyprus. | אנחנו עובדים עם היזמים המובילים בקפריסין. | Hero-Zeile unter der H1; „best" → `המובילים` (keine unbelegte Superlativ-Behauptung) | |
| metaDescription | Every developer Cyprus VIP Estates partners with directly — … | כל היזמים שאנחנו עובדים איתם ישירות בקפריסין, מחברות בנייה בינלאומיות ועד סטודיו בוטיק בלימסול ובפאפוס. פרויקטים, מחירים ותנאי רכישה מעודכנים. | 142 Zeichen (Limit 155); `—` durch Komma ersetzt; Marke weggelassen, weil die Description sonst zu lang wird und der Title die Seite ohnehin identifiziert | |
| intro.0 | We work directly with Cyprus's leading property developers — … vetted: clean legal title …, a real delivery track record, and an active current portfolio. | אנחנו עובדים ישירות עם חברות הבנייה המובילות בקפריסין, מגופים בינלאומיים גדולים ועד סטודיו בוטיק שמתמחים בבתים ברמה גבוהה בלימסול ובפאפוס. כל יזם שמופיע כאן עבר אצלנו בדיקה: טאבו נקי לפרויקטים, היסטוריית מסירה אמיתית ותיק נכסים מעודכן. | `חברות הבנייה` im ersten Satz, `יזם` im zweiten — bewusst, um die Wurzelwiederholung nach §11.5 zu vermeiden. Doppelpunkt steht satzintern (§3 verbietet nur Doppelpunkt-**Titel**) | |
| intro.1 | Below is the full list of developers we partner with directly, at no markup to the buyer. Each has its own page with current projects, prices, and buying terms. | למטה הרשימה המלאה של היזמים שאנחנו עובדים איתם ישירות, בלי תוספת מחיר לרוכש. לכל אחד יש עמוד משלו עם הפרויקטים הזמינים, המחירים ותנאי הרכישה. | „no markup" als Tatsache, nicht als Werbeversprechen | |
| projects | projects | פרויקטים | Zähler auf der Karte: „**12** פרויקטים" | |

## 5. `src/app/[lang]/[...slug]/page.tsx` — `PAGE_TITLE_SUFFIX.he` und `FALLBACK_DESC.he`

Beide Tabellen sind von `Record<string, …>` auf `Record<Locale, …>` gehärtet; en/de/pl/ru unverändert.

| Key | EN | HE | Anmerkung | Korrektur HE |
|---|---|---|---|---|
| PAGE_TITLE_SUFFIX | ` — Page {n}` | ` \| עמוד {n}` | Pipe statt `—` (§3 kennt keinen Gedankenstrich); `עמוד` wortgleich mit `blogI18n.pageWord` | |
| FALLBACK_DESC | Explore luxury properties, new developments and investment homes for sale across Cyprus with Cyprus VIP Estates. | נדל"ן בקפריסין לרוכשים מישראל. פרויקטים חדשים, דירות ווילות למכירה ונכסים להשקעה בלימסול ובפאפוס עם ⟦FSI⟧Cyprus VIP Estates⟦PDI⟧. | 121 Zeichen (Limit 155). Greift **nur**, wenn eine Landingpage weder Meta-Description noch Excerpt hat. Hub-Begriff `נדל"ן בקפריסין` vorn, H1-Muster aus Styleguide §6 („לרוכשים מישראל"). Larnaka bewusst nicht genannt (Styleguide §8) | |

---

## Offene Fragen an den Lektor

1. **„Artikel sind auf Englisch" — richtige Stelle?** Pass A hängt den Hinweis an den
   Artikelzähler (`articleOne`/`articleMany`), weil er dort ganz oben, direkt an der Zahl
   und ohne Entschuldigungston steht: „12 מאמרים באנגלית". Alternativen wären der Eyebrow
   (zu eng), der SEO-Block-Titel (zu weit unten) oder ein neuer, eigener Lead-String
   (bräuchte einen neuen Key und einen Eingriff in `BlogInsights.tsx`). Reicht die
   Zählzeile, oder soll ein eigener Satz her?
2. **Städtename in der Fallback-Überschrift.** Die Route setzt `{city}` mit dem lateinischen
   Namen ein (`Paphos`), das Glossar §1 verlangt aber `פאפוס`. Pass A hat isoliert und die
   Bindestrich-Präposition gesetzt (`ב-⟦FSI⟧Paphos⟦PDI⟧`), weil der Wert aus Code kommt,
   der nicht zu WP4 gehört. Wenn das für einen israelischen Leser stört: Ticket für eine
   Locale-Tabelle der drei Städtenamen in `blog/[slug]/page.tsx`.
3. **Marke im Developers-Title.** Styleguide §6 will `… | Cyprus VIP Estates` im Meta-Title.
   Hier ist `title` aber gleichzeitig die H1 (`withAccent()` akzentuiert das letzte Wort) —
   eine angehängte Marke würde in der Überschrift stehen und den Goldakzent kapern. Pass A
   hat deshalb wie en/de/pl/ru auf die Marke verzichtet. Bestätigen oder Ticket für getrennte
   `title`/`metaTitle`-Felder?
4. **`תובנות מקפריסין` vs. Transliteration.** „Cyprus Insights" ist im EN eine quasi-Marke.
   Ist die Übersetzung richtig, oder erwartet ein israelischer Leser hier eher einen
   schlichten `הבלוג של Cyprus VIP Estates`?
5. **`מחיר התחלתי`** — im Israelischen geläufig genug als Label vor einem Betrag, oder
   lieber `מחיר מ-` bzw. eine Umstellung der Komponente, damit `החל מ-€450,000` möglich wird?
