# Lektorat WP4 — Blog-Chrome, Developers-Seite, Catch-all-SEO-Fallbacks

**Stand:** 2026-09-13 · **Pass A + Fix-Runde 1 nach Pass B eingearbeitet** · Marker im Code: `REVIEW(he)`
**Umfang:** 5 Dateien, 6 `he`-Einträge, 33 Einzelstrings.
**Quelle:** immer der englische Eintrag. Die deutschen Zeilen dienten nur als Tonreferenz.
**Glossar-Ergänzungen:** `docs/i18n/reviews/wp4-glossary.md` (31 Begriffe nach Fix-Runde 1, eine Zeile gestrichen; `he-glossary.md` wurde nicht angefasst).

---

## Wo diese Strings sichtbar sind

| Fläche | Seite / Zustand |
|---|---|
| Blog-Hero (Eyebrow, H1, Artikelzähler) | `/he/blog` — Eyebrow, gold akzentuierte H1, Zählzeile: 0 → „אין עדיין מאמרים", 1 → „מאמר אחד באנגלית", ab 2 → „N מאמרים באנגלית" |
| Hero-Mockup (Telefonrahmen rechts) | `/he/blog` — Kicker = H1-Text, unten der Featured-CTA |
| Kategorien-Tabs + Karten-CTA | `/he/blog` — Tab „הכל", Karten-Fußzeile „לקריאה" |
| Pager | `/he/blog?page=2` und tiefer — `aria-label`s (nur mit Screenreader hörbar) |
| Leerzustand | `/he/blog`, **nur** wenn die Locale insgesamt null Artikel hat (`InsightsList.tsx:272`: `!allCards.length && !featured`). Der Kategoriefilter hat **keinen** Leerzustand |
| Content-/SEO-Block | Fuß von `/he/blog`, nur auf Seite 1 und nur wenn das CMS-Dokument Inhalt hat |
| Artikelseite | `/he/blog/<slug>` — Kicker-Back-Link, Lesedauer, Inhaltsverzeichnis links, Autorenkarte, Related-Überschrift |
| Fallback-Projektblock im Artikel | `/he/blog/<slug>` — nur bei Artikeln **ohne** eigenen Projekte-Block; Überschrift mit oder ohne Stadt |
| Blog-Slider-Karten | Projektkarten in Artikel-Slidern (`BlogSlide`) — Preiszeile |
| Alter Blog-Renderer | `BlogPostsRenderer` (Kategorien-Tab + Ladeknopf) — Legacy-Pfad, gleiche Prüfung |
| Developers-Index | `/he/developers` — `<title>`, Meta-Description, H1 (letztes Wort gold), Untertitel, zwei Intro-Absätze, Zähler „12 פרויקטים" pro Karte |
| Paginierte Landingpages | `/he/<slug>?page=2` — Title-Suffix und, wenn das CMS weder Meta-Description noch Excerpt hat, die Fallback-Description |

**Wichtig — korrigierte Faktenlage (Pass B, M2):** Die Blog-Artikel werden **nicht übersetzt**
(Produktentscheidung), nur das Chrome ist hebräisch. Ein `noindex` gibt es **nicht**: weder
`blog/page.tsx` noch `blog/page/[n]/page.tsx`, `blog/[slug]/page.tsx` oder `lib/seo.ts` setzen ein
`robots`-Feld, und `app/robots.ts` sperrt nur `/admin`, `/api`, `/c/`, `/_assets`, `/_static`.
`he` ist lediglich über `LAUNCH_GATED_LOCALES` aus `PUBLIC_LOCALES` (Sitemap, hreflang)
ausgeschlossen — das ist kein `noindex`. Zweitens holt `/he/blog` heute Zeilen mit
`language: "he"`, nicht die englischen Artikel; solange keine `he`-Zeilen existieren, ist die
Liste leer. Beides ist **Route-Logik und gehört in Phase 6**, nicht in diesen Copy-Pass — die
hebräischen Strings sind deshalb so gebaut, dass sie in **beiden** Zuständen stimmen (Zählzeile
mit 0-/1-/Mehrzahlform, siehe Abschnitt 1 und „Offene Punkte").

## Wie zu lektorieren ist

1. Kurzcheckliste `docs/i18n/he-styleguide.md` §10 Punkt für Punkt:
   kein englischer Restsatz · Genus nach §2 (Nominal/Infinitiv, sonst männlicher Plural,
   keine Schrägstriche) · Preise/Zahlen nach §5, Bidi isoliert · Ortsnamen nach Glossar,
   Eigennamen lateinisch · Meta-Title ≤ 60, Description ≤ 155 · keine Zeile aus §7 ·
   jede Zahl hat eine Quelle.
2. Zusätzlich §11: kein `—`, keine Wurzelwiederholung im selben String, duplizierte
   Strings wortgleich, zweiter Durchgang über das rendernde JSX (siehe Kasten unten).
3. Länge mitdenken: CTAs ≤ 3 Wörter, Tabs und Zählzeilen ungefähr auf EN-Länge.
0. Die HE-Spalte zeigt den Stand **nach Fix-Runde 1** (Pass-B-Korrekturen eingearbeitet);
   die geänderten Zeilen sind mit „Fix 1:" markiert.
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
| `BlogInsights.tsx` H1 | splittet `heroTitle` an Leerzeichen, **letztes Wort gold** | `תובנות מקפריסין` — **bewusste Abweichung:** en/de/pl/ru akzentuieren das Substantiv („Insights"), `he` die Ortsangabe `מקפריסין`, weil Hebräisch das Nomen der Smichut voranstellt. Akzeptiert; Alternative wäre ein 1-Wort-Titel `תובנות` (Akzent = ganzer Titel) |
| `page.tsx` (Artikel) Related-Titel | `{relatedLead} <span class="it">{relatedAccent}</span>` | `עוד` + gold `מאמרים` — das Substantiv trägt den Akzent wie in EN/DE/RU |
| `developers/page.tsx` `withAccent()` | `lastIndexOf(" ")`, **letztes Wort gold** | `יזמי נדל"ן בקפריסין` endet auf `בקפריסין`, genau wie „Zypern"/„Кипре" in den anderen Locales |
| `BlogSlide.tsx` Preiszeile | `priceFrom` + `&nbsp;` + `<Bdi ltr>{Preis}</Bdi>` | deshalb `מחיר התחלתי` statt Glossar-`החל מ-` (dessen Bindestrich muss am Betrag kleben). **Offen:** `מחיר התחלתי` liest sich zuerst als Auktions-Eröffnungspreis — Lektorentscheid, siehe offene Frage 5 |
| `blog/[slug]/page.tsx` Fallback-Überschrift | `.replace("{city}", cityHit)` mit **lateinischem** Städtenamen | `ב-⟦FSI⟧{city}⟦PDI⟧` |
| `[...slug]/page.tsx` Meta | `description + pageSuffix` — auf Seite 2+ folgt Hebräisch **nach** der Marke | Marke mit `bidiIsolate()` umschlossen |
| Artikelzähler `BlogInsights.tsx:140` | LTR: `{total} {total === 1 ? articleOne : articleMany}` | `he` bekommt dort einen **eigenen Zweig** (LTR byte-identisch): 0 → `אין עדיין מאמרים`, 1 → `מאמר אחד באנגלית` (ohne Ziffer), ab 2 → `{n} מאמרים באנגלית` |
| Lesedauer `blog/[slug]/page.tsx:358` | `minutes = Math.max(1, …)`, dann `{minutes} {minRead}` | `1 דקות קריאה` wäre falsch → `he`-Zweig am Render-Ort: 1 → `דקת קריאה אחת`, ab 2 → `{n} דקות קריאה` |
| Projektzähler `developers/page.tsx` | `<b>{n}</b> {projects}` | `1 פרויקטים` wäre falsch → `he`-Zweig: 1 → `פרויקט אחד` (eine Phrase, ohne `<b>`), ab 2 unverändert |
| `developers/page.tsx` `generateMetadata` | `title: t.metaTitle ?? t.title` | nur `he` setzt `metaTitle` (H1 bleibt `title`, Goldakzent unangetastet) |

---

## 1. `src/app/[lang]/blog/blogI18n.ts` — `BLOG_STRINGS.he` (Blogliste + Artikelseite)

| Key | EN | HE | Anmerkung | Korrektur HE |
|---|---|---|---|---|
| heroTitle | Cyprus Insights | תובנות מקפריסין | H1 auf `/he/blog` **und** Back-Link im Artikel-Kicker; letztes Wort wird gold | |
| eyebrow | The Journal | הבלוג | Eyebrow über der H1 | |
| articleOne | article | מאמר אחד באנגלית | **Fix 1 (M1):** wird ohne Ziffer gerendert (`מאמר אחד באנגלית`, nicht „1 מאמר"); der 0-Fall steht im `he`-Zweig in `BlogInsights.tsx` (`אין עדיין מאמרים`) | |
| articleMany | articles | מאמרים באנגלית | „12 מאמרים באנגלית" — trägt die Produktentscheidung; siehe offene Frage 1 | |
| filterAll | All | הכל | Kategorien-Tab | |
| read | Read | לקריאה | Karten-CTA, ein Wort | |
| readArticle | Read article | לקריאת המאמר | Featured-CTA im Hero-Mockup | |
| categoriesAria | Categories | קטגוריות | nur `aria-label` | |
| pagerAria | Blog pagination | ניווט בין עמודי הבלוג | nur `aria-label` | |
| firstPage | First page | מעבר לעמוד הראשון | **Fix 1 (S4):** `aria-label` an einem `<a>` — Handlungsform statt Substantiv, konsistent mit `pagerAria` | |
| lastPage | Last page | מעבר לעמוד האחרון | **Fix 1 (S4):** wie oben | |
| pageWord | Page | עמוד | ergibt `עמוד 3`; wortgleich mit dem Catch-all-Suffix (Abschnitt 5) | |
| empty | No articles yet. | אין עדיין מאמרים. | Leerzustand | |
| guideEyebrow | The Guide | המדריך | Eyebrow des SEO-Blocks | |
| guideTitle | Inside the Journal | נדל"ן בקפריסין, בקצרה | **Fix 1 (S2):** der Block rendert `blogPage.content`, also SEO-Fließtext über zypriotische Immobilien — nicht Meta-Text über den Blog; `על הבלוג` versprach eine „Über uns"-Sektion. **Vom Lektor am tatsächlichen `he`-`blogPage.content` gegenzuprüfen** (heute existiert kein `he`-`blogPage`-Dokument, siehe Offene Punkte) | |
| dateLocale | en-GB | he-IL | **kein Text** — Intl-Tag für `toLocaleDateString`; Datum wird dadurch automatisch hebräisch formatiert, keine Monatsnamen hartcodiert | |
| minRead | min read | דקות קריאה | „7 דקות קריאה". **Fix 1 (M6, Numerus):** die Kurzform `דק'` wurde **nicht** übernommen (Controller-Entscheid) — stattdessen trägt der Render-Ort den `he`-Zweig: 1 → `דקת קריאה אחת` | |
| tocLabel | On this page | תוכן העניינים | **Fix 1 (S16):** `בעמוד הזה` war eine Kalkierung von „On this page"; israelische Sticky-TOCs schreiben `תוכן העניינים` | |
| writtenBy | Written by | מאת | **Fix 1 (S1):** ein Wort, genusfrei, Aktiv-Register — die Form über jeder israelischen Autorenkarte | |
| relatedLead | Related | עוד | erster, nicht akzentuierter Teil der Related-Überschrift | |
| relatedAccent | reading | מאמרים | gold akzentuiert; ergibt zusammen „עוד מאמרים" | |
| fallbackProperties | Recommended properties | נכסים מומלצים | Überschrift des Fallback-Projektblocks | |
| fallbackPropertiesInCity | Recommended properties in {city} | נכסים מומלצים ב-⟦FSI⟧{city}⟦PDI⟧ | `{city}` kommt **lateinisch** aus der Route; siehe offene Frage 2. **Abhängigkeit (S13):** sobald `src/lib/hePlaces.ts` (WP2-Fix-Runde) den Wert auf `פאפוס`/`לימסול`/`לרנקה` umstellt, muss dieser String auf `נכסים מומלצים ב{city}` (ohne Bindestrich, ohne Isolation) — heutige Form bewusst belassen | |

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
| loadMore | Load {n} more posts | הצגת עוד {n} מאמרים | **Fix 1 (S3):** WP3 Pass B hat für Pagination-Controls die Nominalform entschieden (Infinitiv nur für Links/CTAs); `{n}` ist immer 9 | |
| filterAll | All | הכל | Kategorien-Tab; wortgleich mit `blogI18n.filterAll` | |

## 4. `src/app/[lang]/developers/page.copy.ts` — `DEVELOPERS_PAGE_COPY.he` (`/he/developers`)

Neues Modul; die Kette in `developers/page.tsx` wurde nach dem Repo-Muster (`*.copy.ts`,
`Record<Locale, …>`, `isLocale`-Resolver) ausgelagert, en/de/pl/ru byte-identisch.

**Nachfragelage (korrigiert, Pass B M8):** Für `/he/developers` weist die Keyword-Map **kein
Volumen** aus — `he-keyword-map.md` und `he-keywords.csv` (152 Zeilen) enthalten null Treffer für
`יזם`/`יזמים`/`חברות בנייה`/`קבלן`. Die früher hier behauptete Nebenform `חברות בנייה בקפריסין`
existiert **nicht**; die Zeile ist aus `wp4-glossary.md` entfernt. Die Seite trägt den Hub-Term
`נדל"ן בקפריסין` und Markenintent, keinen eigenen Cluster.

| Key | EN | HE | Anmerkung | Korrektur HE |
|---|---|---|---|---|
| title | Developers in Cyprus | יזמי נדל"ן בקפריסין | `<title>`-Grundform **und** H1; 19 Zeichen; letztes Wort gold; trägt den Hub-Begriff `נדל"ן בקפריסין` | |
| metaTitle *(neu)* | — (nur `he`) | יזמי נדל"ן בקפריסין \| Cyprus VIP Estates | **Fix 1 (S6):** 40 Graphemen (Limit 60). `title` ist zugleich die H1, eine angehängte Marke würde den Goldakzent kapern — deshalb ein **meta-only** Key, den `generateMetadata` mit `t.metaTitle ?? t.title` zieht. Hebräische SERPs sind markenarm; ein markenloser 19-Zeichen-Title gewinnt dort nichts. Beantwortet offene Frage 3 | |
| sub | We work with the best property developers in Cyprus. | עובדים ישירות מול היזמים המובילים בקפריסין. | **Fix 1 (M10):** Partizip Plural (genusfrei, §11.2) statt des vierten `אנחנו עובדים` auf derselben Seite | |
| metaDescription | Every developer Cyprus VIP Estates partners with directly — … | יזמי נדל"ן בקפריסין שאנחנו עובדים איתם ישירות, בלימסול ובפאפוס. לכל יזם עמוד עם פרויקטים, מחירים ותנאי רכישה מעודכנים, בלי תוספת מחיר לרוכש. | **Fix 1 (S7):** 140 Graphemen (Limit 155). Hub-Term als Exact-Match-Phrase vorn statt auseinandergerissen, ein konkreter Nutzen (`בלי תוספת מחיר לרוכש`) und ein Angebot (`לכל יזם עמוד עם…`) statt zwei Aufzählungen; `חברות בנייה` raus (M4) | |
| intro.0 | We work directly with Cyprus's leading property developers — … vetted: clean legal title …, a real delivery track record, and an active current portfolio. | אנחנו עובדים ישירות עם היזמים המובילים בקפריסין, מחברות בינלאומיות גדולות ועד סטודיו בוטיק שמתמחים בבתי יוקרה בלימסול ובפאפוס. כל יזם שמופיע כאן עבר אצלנו בדיקה: בעלות משפטית נקייה על הקרקע ועל הפרויקט, היסטוריית מסירות מוכחת וצבר פרויקטים פעיל. | **Fix 1 (M3/M4/M5/S8):** durchgehend `יזם` (Glossar §2) statt eines Begriffswechsels auf die Bauunternehmer-Ebene; die Title-Deed-Kaufformel raus, weil bei Off-Plan der Title Deed regelmäßig noch nicht ausgestellt ist → Aussage über saubere Rechtslage; `מסירות` im Plural + `מוכחת` statt des Beteuerungsworts; `צבר פרויקטים פעיל` statt `תיק נכסים` (= Anlageportfolio eines Eigentümers, falscher Referent); Behörden-`גופים` und Füller-`ברמה גבוהה` ersetzt | |
| intro.1 | Below is the full list of developers we partner with directly, at no markup to the buyer. Each has its own page with current projects, prices, and buying terms. | בהמשך העמוד הרשימה המלאה של היזמים שעובדים איתנו ישירות, בלי תוספת מחיר לרוכש. לכל יזם עמוד ייעודי עם הפרויקטים העדכניים, המחירים ותנאי הרכישה. | **Fix 1 (S9/M10):** `למטה` (gesprochenes Register) → `בהמשך העמוד`; referenzloses `לכל אחד` → `לכל יזם`; `הזמינים` behauptete Verfügbarkeit, EN sagt „current" → `העדכניים`. „no markup" bleibt Tatsache, kein Werbeversprechen | |
| projects | projects | פרויקטים | Zähler auf der Karte: „**12** פרויקטים"; bei genau einem Projekt rendert `he` stattdessen `פרויקט אחד` (§11.3-Kasten) | |

## 5. `src/app/[lang]/[...slug]/page.tsx` — `PAGE_TITLE_SUFFIX.he` und `FALLBACK_DESC.he`

Beide Tabellen sind von `Record<string, …>` auf `Record<Locale, …>` gehärtet; en/de/pl/ru unverändert.

| Key | EN | HE | Anmerkung | Korrektur HE |
|---|---|---|---|---|
| PAGE_TITLE_SUFFIX | ` — Page {n}` | `, עמוד ⟦LRI⟧{n}⟦PDI⟧` | **Fix 1 (M7):** kein `—` (§3) und **keine Pipe**: ein styleguide-konformer hebräischer CMS-Title endet auf `… \| Cyprus VIP Estates`, eine zweite Pipe hätte die Marke mitten in den Title gestellt. Die Ziffer ist mit `ltrIsolate()` isoliert, damit sie am Übergang von einem lateinischen Lauf nicht umsortiert wird. `עמוד` bleibt wortgleich mit `blogI18n.pageWord` | |
| FALLBACK_DESC | Explore luxury properties, new developments and investment homes for sale across Cyprus with Cyprus VIP Estates. | נדל"ן בקפריסין לרוכשים מישראל. פרויקטים חדשים, דירות ווילות למכירה ונכסים להשקעה. ליווי אישי מהחיפוש ועד המסירה עם ⟦FSI⟧Cyprus VIP Estates⟦PDI⟧. | **Fix 1 (S11):** 134 sichtbare Zeichen (Limit 155). Dies ist der **generische** Fallback für *jede* Landingpage ohne Meta-Description — „בלימסול ובפאפוס" hätte einer Steuer- oder Relocation-Seite einen Ort untergeschoben (EN bleibt aus demselben Grund bei „across Cyprus"); dafür jetzt Nutzen + Angebot (`ליווי אישי מהחיפוש ועד המסירה`) statt eines vierten Immobilien-Synonyms | |

---

## Offene Fragen an den Lektor

1. **„Artikel sind auf Englisch" — richtige Stelle?** Der Hinweis hängt am Artikelzähler
   („12 מאמרים באנגלית"), weil er dort ganz oben, direkt an der Zahl und ohne
   Entschuldigungston steht. Nach Pass B (M1) ist die Zählzeile zusätzlich für 0 und 1
   ausformuliert, damit der Satz nie neben „es gibt gar keine" steht. Reicht die Zählzeile,
   oder soll ein eigener Lead-Satz her (neuer Key + Eingriff in `BlogInsights.tsx`)?
2. **Städtename in der Fallback-Überschrift.** Die Route setzt `{city}` mit dem lateinischen
   Namen ein (`Paphos`), das Glossar §1 verlangt aber `פאפוס`. Pass A hat isoliert und die
   Bindestrich-Präposition gesetzt (`ב-⟦FSI⟧Paphos⟦PDI⟧`), weil der Wert aus Code kommt,
   der nicht zu WP4 gehört. Wenn das für einen israelischen Leser stört: Ticket für eine
   Locale-Tabelle der drei Städtenamen in `blog/[slug]/page.tsx`.
3. **Marke im Developers-Title — erledigt (S6).** Getrennte Felder sind jetzt umgesetzt:
   `title` bleibt H1 (Goldakzent unangetastet), `metaTitle` (nur `he`) trägt die Marke im
   `<title>`. Nur noch bestätigen, dass die Marke im hebräischen SERP-Title erwünscht ist.
4. **`תובנות מקפריסין` vs. Transliteration.** Pass B empfiehlt Beibehalten (ein israelischer
   Leser erwartet auf einer hebräischen Seite eine hebräische Rubrik; `הבלוג של Cyprus VIP
   Estates` stünde doppelt zur Marke im Geräte-Mockup daneben). Bitte nur noch bestätigen —
   und dabei mitentscheiden, ob die im §11.3-Kasten benannte Akzent-Abweichung (gold liegt
   auf `מקפריסין`, in en/de/pl/ru auf dem Substantiv) so bleibt oder ein 1-Wort-Titel
   `תובנות` daraus wird.
5. **`מחיר התחלתי` — Entscheid nötig, bewusst nicht stillschweigend geändert (S12).**
   Pass B weist nach, dass `מחיר התחלתי` im Israelischen zuerst der **Eröffnungspreis einer
   Auktion/Ausschreibung** ist (`מחיר התחלתי במכרז`) — vor einem Neubaupreis also ein falscher
   Freund. Drei Optionen: (a) Komponentenänderung in `BlogSlide.tsx` (`&nbsp;` raus) und
   Glossarform `החל מ-` direkt am Betrag — sauberste Lösung, aber ein Eingriff außerhalb der
   Copy-Tabelle; (b) ohne Komponentenänderung `מחירים מ-` — vermeidet die Auktionslesart,
   lässt den Bindestrich aber frei stehen; (c) bewusst belassen. Bitte a/b/c wählen.

---

## Offene Punkte (außerhalb dieses Copy-Passes)

1. **Phase-6-Abhängigkeit `/he/blog` (Route-Logik, nicht Copy).** Vor der Freigabe der
   hebräischen Blogseiten muss Phase 6 drei Dinge entscheiden und umsetzen: ob `/he/blog` für
   `he` die **englischen** Artikel abfragt (heute `getBlogPostsByLangWithPagination("he", …)` →
   `language: "he"`, also leer, solange keine `he`-Zeilen existieren), ob die drei Blog-Routen
   für `lang === "he"` ein `robots: { index: false }` bekommen, solange die Artikel englisch
   sind (heute gibt es **kein** `noindex`, nur den Sitemap-/hreflang-Ausschluss über
   `LAUNCH_GATED_LOCALES`), und ob der Zähler-Mismatch behoben wird — `getTotalBlogPostsByLang`
   zählt **ohne** `status`-Filter, die Liste rendert nur `PUBLISHED`, der Hero kann also eine
   höhere Zahl nennen, als das Grid zeigt. Die Copy ist für beide Zustände gebaut; die Zahl
   selbst kann sie nicht richtig machen.
2. **Hebräischer Font-Subset auf den Blog-Routen (Phase 2b, hier nichts geändert).** Keine der
   drei auf `/he/blog` geladenen Familien (Fraunces, Mulish, Playfair Display) hat einen
   `hebrew`-Subset, die Seite rendert also im System-Fallback; zusätzlich erzwingt die
   Goldakzent-Klasse `.it` ein `font-style: italic`, was auf Hebräisch eine synthetische
   Schrägstellung ergibt (typografisch unzulässig). Betrifft H1, Related-Titel und jeden
   `.it`-Akzent, also auch WP3 und `/he/developers`. Gehört in `docs/i18n/rtl-qa-checklist.md`.
3. **`hePlaces.ts`-Abhängigkeit (S13).** `fallbackPropertiesInCity` steht heute richtig für den
   **lateinischen** Städtenamen. Sobald die WP2-Fix-Runde `src/lib/hePlaces.ts` einführt und der
   Wert `פאפוס`/`לימסול`/`לרנקה` wird, muss der String auf `נכסים מומלצים ב{city}` umgestellt
   werden: vor einem hebräischen Ortsnamen steht `ב` gebunden und ohne Bindestrich, und die
   FSI/PDI-Isolation ist dann sinnlos bis schädlich. Der Umstellungszeitpunkt ist der Bruch.
4. **Seiten-Suffix hängt auch an der Description.** `pageSuffix` wird an Title **und**
   Description angehängt. Auf Seite 2+ ergibt das in `he` `… Cyprus VIP Estates., עמוד 2`, also
   Punkt + Komma direkt hintereinander (die LTR-Locales haben mit `. — Page 2` dieselbe
   Kollision in mild). Sauber wäre ein getrenntes Title-/Description-Suffix — Ticket, kein
   Copy-Fix.
5. **`FALLBACK_DESC` und `PAGE_TITLE_SUFFIX` liegen außerhalb der Copy-QA.** Beide stehen in
   einer Route-Datei; `scripts/qa/copy-snapshot.mjs` und `scripts/qa/he-meta-length.mjs` sehen
   nur die in `copy-modules.json` registrierten `*.copy.ts`-Module und prüfen diese Strings
   daher nicht (Länge, Snapshot, Platzhalter). Entweder in ein `page.copy.ts` heben oder die
   QA-Skripte um eine Allowlist von Route-Dateien erweitern.
6. **§11.3 braucht eine Numerus-Klausel (Vorschlag §11.8).** Zwei der drei Zähler in WP4 brachen
   bei `n = 1` (`1 דקות קריאה`, `1 פרויקטים`) und sind durch den bestehenden §11.3-Durchgang
   gerutscht, weil der auf Konkatenation, Splits und Hervorhebung zielt, nicht auf Numerus.
   Rückwirkend auch in WP2 prüfen (`נותרו רק {n} יחידות`).
7. **Keyword-Behauptungen im Protokoll brauchen einen Zeilenverweis.** M8 war der zweite Fall
   einer nicht belegten Keyword-Begründung in Phase 4. Künftig nur mit Fundstelle
   (`he-keywords.csv:47`) oder gar nicht; ein `grep` gegen `he-keywords.csv` gehört in den
   Copy-QA-Lauf, sobald ein Protokoll „Keyword-Map" schreibt. Für Systemseiten ohne messbare
   Nachfrage (wie `/he/developers`) gilt: Hub-Term + Marke, keine erfundenen Nebenformen.
