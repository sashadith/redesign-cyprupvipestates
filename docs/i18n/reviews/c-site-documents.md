# Review-Protokoll — `content/he/site-documents/*.he.json` (Phase 5, Task 3)

**Stand:** 2026-09-13 · **Pass A + Pass B + Fix-Runde 1 (angewandt)** · Review-Status: `"review": "pending"` in jeder Datei
**Quelle:** `content/he/source/site-documents/*.en.json` (EN-Snapshot, Task 1) · **Regeln:** `he-styleguide.md`, `he-glossary.md`, `he-keyword-map.md` §4, `reviews/wp3.md` (Phase-6-CMS-Brief)

Alle acht Dateien sind aus dem EN-Snapshot **generiert** (Deep-Clone + Ersetzung der Prosa-Blätter an bekannten Pfaden), damit Keys, `_key`s, Array-Längen, `marks`/`markDefs`-Struktur und Bild-Refs byte-genau spiegeln. Übersetzt wurde ausschließlich menschenlesbarer Text; Link-Ziele wurden nach `/he/…` umgehängt (Ausnahmen unten).

| Datei | rendert auf | Strings (davon hebräisch) |
|---|---|---:|
| `homepage.he.json` | `/he` (alle Sektionen von `preview-home`) | 536 (240) |
| `header.he.json` | Kopfnavigation aller `/he/**`-Seiten | 21 (8) |
| `footer.he.json` | Fußzeile aller `/he/**`-Seiten | 61 (44) |
| `notFoundPage.he.json` | `/he` 404 (`NotFoundPageComponent`) | 8 (5) |
| `projectsPage.he.json` | `/he/projects` (nur `seo`, Titel ist CMS-intern) | 4 (2) |
| `blogPage.he.json` | `/he/blog` (Hero-Lead = `metaDescription`, SEO-Block unter der Liste) | 133 (40) |
| `caseStudiesPage.he.json` | `/he/case-studies` (H1 = `title`, Fließtext unter der Liste) | 151 (42) |
| `formStandardDocument.he.json` | Formular-Chrome in Modals und statischen Formularen | 35 (30) |
| **Summe** | | **949 (411)** |

---

## Verbindliche Vorgaben — erfüllt

- **Die sieben Abschnitts-H2** stehen wörtlich wie im Phase-6-CMS-Brief (`wp3.md`): `יש רק קפריסין אחת` (`aboutBlock.title`), `סיפורי לקוחות מקפריסין` (`featuredCaseStudiesBlock.title`), `נכסים למכירה בקפריסין` (`citiesBlock.title`), `למה רוכשים מישראל בוחרים בנו` (`descriptionBlock.title`), `שאלות נפוצות על נדל"ן בקפריסין` (`faqSection.faqTitle`), `פרויקטים נבחרים בקפריסין` (`featuredProjectsBlock.title`), `כך אנחנו עובדים` (`howWeWorkBlock.title`). Ein Skript prüft jedes `ACCENTS_BY_LANG.he`-Wort als **Wort**-Substring des zugehörigen H2 — 7/7 OK.
- **Startseiten-Meta** = der im CMS-Brief festgelegte Titel `מומחי נדל"ן בקפריסין לרוכשים מישראל | Cyprus VIP Estates` (56 Graphem). Alle Meta-Paare: Titel ≤ 60, Description ≤ 155 (gemessen mit `Intl.Segmenter`).
- **Hero-H1** `נדל"ן בקפריסין לרוכשים מישראל, וילות ודירות חדשות` (49 Graphem) trägt den Cornerstone-Term `נדל"ן בקפריסין` natürlich, ohne Doppelpunkt (§3).
- **`/he/projects`-Cluster:** `projectsPage.seo.metaTitle` führt `פרויקטים חדשים בקפריסין` (Keyword-Map Zeile „S").
- **Wortgleiche Dubletten (§11.6):** 404 (`textEnd`/`description`) = `NotFoundPageComponent` `FALLBACK.he` (`buttonText` weicht seit S23 ab, siehe „Bekannte Bedingungen" 2); Formular-Erfolg/Fehler = `formFeedbackCopy.ts`/`Form.copy.ts` (ohne `ltrIsolate()`, JSON kennt keine Helper); Feldlabels und Validierungen = `FormStatic.copy.ts`; Navigationslabels nach Glossar §4; `caseStudiesPage`-Meta wortgleich mit `preview-case-studies/[lang]/copy.ts` `he` (dieselbe Seite, zwei Quellen).
- **WP3-Bestandstexte übernommen:** `aboutBlock.bullets` = `BULLETS_TEXT.he`, `howWeWorkBlock.steps` = `STEPS_TEXT.he` (jeweils wörtlich).
- **Entscheidung E** steht auf der Startseite dort, wo der Text von Sprachen spricht: `sliderMain[3]` („We speak English") lautet jetzt `מדברים אנגלית ורוסית` + `… הייעוץ מתקיים באנגלית או ברוסית; פנייה בעברית מתקבלת בברכה.` Footer und 404 sprechen nicht über Sprachen und tragen den Satz deshalb nicht. **Seit Fix-Runde 1 (M4)** trägt auch `descriptionBlock…descriptionField[2]` keine Mehrsprachigkeits-Zusage mehr, sondern nennt Englisch und Russisch (`… ואנחנו עובדים עם לקוחות ממדינות שונות באנגלית וברוסית.`) — der Boilerplate-Satz selbst steht weiterhin genau einmal pro Kanal.
- **Stil:** 0 × `—`/`–`/`!` in allen acht Dateien; gerade Anführungszeichen; westliche Ziffern; `נדל"ן` mit Gershayim; keine Schrägstrich-Genusformen. `styleCheck` meldet 0 Verstöße.

## Entscheidungen je Dokument

### homepage
- **Larnaka** ist dort gestrichen, wo die Struktur es zulässt (Städteliste in `aboutBlock.description`, `featuredProjectsBlock.description`, `descriptionFields[1]`) — Styleguide §8, wie WP3 es für `citiesLead` entschieden hat. Wo Larnaka in einem eigenen Portable-Text-Span mit Link steht (`citiesBlock.cities[2]`, FAQ 4, `contentBlocks[6]`), kann es nicht entfernt werden, ohne die Spiegelstruktur zu brechen: dort bleibt eine **sachliche** Erwähnung ohne Werbung, der Link zeigt auf `/he/projects` statt auf eine Larnaka-Seite.
  - **Korrektur (Fix-Runde 1, M3).** Für FAQ 4 galt die Aussage „sachliche Erwähnung" zunächst **nicht**: der Satz war wortgleich aus `contentBlocks[6].content[4]` kopiert und übersetzte damit eine andere EN-Vorlage. Er behauptete `פיתוח תשתיות` und `טווח מחירים מגוון`, während die EN-Quelle desselben Items `airport access, coastal living, and potential long-term growth` sagt. Der Satz spiegelt jetzt sein eigenes `items[3]` (`… הקרבה לשדה התעופה, החיים לחוף הים ופוטנציאל צמיחה לטווח ארוך …`). Verbindliche Regel für alle weiteren FAQ-Arbeiten: **jede Antwort spiegelt ausschließlich ihr eigenes `items[i]`**, auch wenn ein Nachbarabsatz dasselbe Thema hat. Die Larnaka-Erwähnung bleibt, weil das EN-Item sie führt; beworben wird sie nicht, und der Link zeigt weiter auf `/he/projects`.
- **FAQ-Fragen** sind so formuliert, wie Israelis suchen (`האם רוכשים מישראל יכולים לקנות נכס בקפריסין?`, `כמה כסף צריך מעבר למחיר הנכס?`). Antwort 6 (Aufenthalt) endet mit dem Rechtsvorbehalt aus Glossar §5 (`המידע אינו מהווה ייעוץ משפטי או מס. בכפוף לבדיקה פרטנית.`) — bewusster Zusatz gegenüber dem EN, Styleguide §8.
- **Kundenstimmen** sind übersetzt, nicht erfunden; Personennamen bleiben lateinisch, das Land wird hebräisch (`Anna & Markus Vollmer, גרמניה`).
- **Zahlen** stammen alle aus der EN-Quelle (`340 ימי שמש`, `תשואה שנתית החל מ-6%`); nichts hinzugefügt.
- `הכול` → `הכל` (Glossar §4.1) und die Wortstämme `העלות הכוללת`/`העלויות הכוללות` umformuliert, weil die Gate-Regel `hakol-spelling` sie als Teilstring trifft.

### header
Labels nach Glossar §4: `פרויקטים`, `בלוג`, `עלינו`, `שאלות ותשובות`, `סיפורי לקוחות`, `צור קשר`. `Become a Partner` → `הצטרפות כשותפים` (nominal), Ziel **`/partners` (englischer Pfad, kein `/he/`-Präfix)**.

**Korrektur der ersten Fassung (Fix-Runde 1, M2).** Das Protokoll hat das Ziel zunächst mit „`/he/partners` existiert als Code-Route in `middleware.ts`, steht nur nicht auf der `linkCheck`-Liste — dort wird das Feld `link` ohnehin nicht geprüft" begründet. Beide Hälften stimmen nicht:

- `collectLinks()` in `scripts/he-content/lib.mjs` sammelt das Feld `link` sehr wohl; der Gate-Lauf hat `navLinks[2].subLinks[2].link` namentlich als einzigen echten Verstoß gemeldet.
- `PARTNERS_RE` in `middleware.ts:26` matcht `he`, sobald die Locale live ist, und `preview-partners/[lang]/copy.ts:386` liefert für `he` die **englische** Copy. Die Route hätte also englischen Inhalt unter einer hebräischen URL ausgeliefert — genau der Duplicate-Content-Fall, den Entscheidung J ausschließt (Partners wird in Phase 1 nicht lokalisiert; eine EN-Fallback-Seite unter `/he/` darf weder verlinkt noch indexiert werden).

`linkCheck` lässt `/partners` ausdrücklich zu (`lib.mjs:236`). `Private Collection` → `האוסף הפרטי`, Link bleibt die externe Subdomain (kein `he`-Pendant).

### footer
- **Link-Umhängung:** die Spalte „Properties by Location" zeigt auf `/he/paphos`, `/he/limassol`, `/he/paphos/apartments`, `/he/paphos/villas`, `/he/limassol/new-projects`, `/he/projects`; „Property Types" auf `/he/villas-cyprus`, `/he/apartments-for-sale-cyprus`, `/he/property-investment-cyprus`, `/he/houses-for-sale-cyprus`, `/he/seafront-villas-cyprus`, `/he/real-estate-cyprus`. Die drei **Larnaka**-Einträge und `Top 100 Properties` haben kein `he`-Pendant und wurden inhaltlich neu belegt (Label + Ziel passen zueinander).
- Die Spalte „Living in Cyprus" behält die **englischen Blog-Artikel** (Entscheidung C); nur die Labels sind hebräisch. Der Spaltentitel sagt das seit S23/S3 auch: `החיים בקפריסין (באנגלית)` — sechs hebräische Labels über sechs englischen Zielen hatten den Leser sonst ohne Vorwarnung in den EN-Baum geschickt.
- Spaltentitel `Cyprus VIP Estates` → `על Cyprus VIP Estates` (Marke lateinisch, Zeile trotzdem hebräisch lesbar).
- Lateinisch bleiben: E-Mail, Telefonnummern, `SecretBrand Solutions LTD`, die Straßenzeile `Palaion Patron Germanou 11`; die Ortszeile ist hebräisch (`8011 פאפוס, קפריסין`). Social-Labels sind die israelisch üblichen Umschriften (`אינסטגרם`, `יוטיוב`, `פייסבוק`, `טיקטוק`, `וואטסאפ`).
- Policy-Labels definit (`מדיניות הפרטיות`, `תנאי השימוש`) nach Glossar §3.2.

### notFoundPage
`textEnd` und `description` sind wortgleich mit `NotFoundPageComponent` `FALLBACK.he`; der Goldakzent fällt damit auf `הדף`. Meta: `הדף לא נמצא` / `אין תוכן בכתובת זו.` Der CTA lautet seit S23 `לצפייה בכל הפרויקטים` — Glossar §4.1 trennt den Hero-Button (`btn btn--glass`, hier) vom Listenkopf-Link `לכל הפרויקטים`. Der Code-Fallback trägt noch die kurze Form, siehe „Bekannte Bedingungen" 2.

### projectsPage
Nur `seo` wird gerendert (`page.tsx` liest `data.seo`), `title` bleibt ein CMS-internes Label.

### blogPage
- `metaDescription` ist **zugleich der Hero-Lead** (`BlogInsights.tsx` liest `blogPage.metaDescription`), deshalb steht die Aussage zur Artikelsprache ruhig und ohne Entschuldigung dort **und** im ersten Absatz: `המאמרים מתפרסמים באנגלית.` Kein Versprechen hebräischer Artikel (Entscheidung C).
- Blogname im Fließtext = `תובנות מקפריסין` (Glossar §4.4), passend zum H1 aus dem Code.
- Larnaka im Abschnitt „Living in Cyprus" gestrichen (§8).

### caseStudiesPage
- `title` ist die **H1** von `/he/case-studies` (`CaseStudiesAll`): `סיפורי לקוחות מקפריסין` — dieselbe Formulierung wie die Startseiten-H2, damit Hub und Seite zusammenpassen.
- Meta wortgleich mit der WP6-Copy derselben Seite.
- Der Vertraulichkeitsabsatz nimmt die WP6-Linie auf (`פרטיות הלקוחות קודמת לכל …`), ohne den Boilerplate-Satz wörtlich zu doppeln (er gehört dort zur Einzelstory).
- Die sechs Kategorie-Bullets zeigen auf `/he/villas-cyprus`, `/he/apartments-for-sale-cyprus`, `/he/property-investment-cyprus`, `/he/relocation-cyprus`, `/he/projects`, **`/he/projects`** (der letzte seit M11 statt `/he/real-estate-cyprus`: das Label „Off-Market Opportunities" zeigte auf den Cornerstone-Hub und war zudem als off-plan übersetzt).

### formStandardDocument
Labels, Validierungen und Statusmeldungen wortgleich mit WP1/WP3 (`FormStatic.copy.ts`, `Form.copy.ts`, `formFeedbackCopy.ts`); Consent nominal: `אישור` + `תנאי השימוש` + `וכן` + `מדיניות הפרטיות` (die Komponente setzt die Leerzeichen). `וכן` statt `ו-`, weil `FormStandard.tsx` den Verbinder mit Leerzeichen auf beiden Seiten rendert und ein gebundenes `ו` dort falsch stünde. Consent-Links auf `/he/terms-and-conditions` bzw. `/he/privacy-policy`.

---

## Gate-Ergebnis

`node scripts/qa/he-content-check.mjs --only content/he/site-documents` meldet nach Fix-Runde 1:

```
he-content: OK (8 files, 930 strings)
```

**0 Verstöße.** Die frühere Fassung dieses Abschnitts nannte **266 Verstöße** in sieben Klassen A–G und schloss daraus, Task 3 könne das Gate nicht grün bekommen. Das ist überholt:

- Die Klassen **A–F** (leerer EN-String, `IDENTICAL_KEYS` gegen `linkCheck`, `listItem` als Prosafeld, Link-Felder als Prosa geprüft, Enum-/Layoutwerte, bewusst lateinische Werte) waren Grenzfälle des Gates aus Task 1, keine Textfehler. `scripts/he-content/lib.mjs` ist inzwischen genau nach den vier dort vorgeschlagenen Punkten gefixt: leerer EN-String verlangt leeres HE, `isLinkKey()` nimmt Link-Felder aus der Prosaprüfung heraus und überlässt sie `linkCheck`, `listItem` gilt nur noch als Layout-Token, und nicht übersetzbare EN-Werte dürfen identisch bleiben.
- Klasse **G** (`/he/villas-cyprus`, `/he/houses-for-sale-cyprus`, `/he/seafront-villas-cyprus`, `/he/relocation-cyprus`) hat sich aufgelöst, weil Task 6b/6c diese vier Singlepages inzwischen angelegt und committet hat.
- Der einzige echte Linkverstoß war `header.navLinks[2].subLinks[2].link` = `/he/partners`; er ist mit M2 auf `/partners` korrigiert (siehe Abschnitt „header").

Weiter geprüft nach der Fix-Runde: **7/7 Abschnitts-H2** treffen ihr `ACCENTS_BY_LANG.he`-Akzentwort als eigenständiges Wort (`About` `קפריסין`@6 · `CaseStudies` `סיפורי לקוחות`@0 · `Cities` `נכסים למכירה`@0 · `Description` `בוחרים בנו`@18 · `Faq` `שאלות`@0 · `FeaturedProjects` `פרויקטים`@0 · `HowWeWork` `אנחנו`@3). 0 × `—`, `–`, `!` in allen acht Dateien. `npm test` 298/298 grün. Struktur weiterhin byte-gespiegelt (Keys, `_key`s, Array-Längen unverändert; die Dateien wurden per JSON-Round-Trip geschrieben, der für alle acht Dateien byte-identisch ist).

**Meta-Längen nach der Fix-Runde** (Graphem, `Intl.Segmenter`): `homepage` 56 / 142 · `projectsPage` 44 / 137 · `blogPage` 53 / 127 · `caseStudiesPage` 52 / 132 · `notFoundPage` 11 / 19 (404, kein Snippet).

## Fix-Runde 1 — angewandte Pass-B-Zeilen

Alle 14 Must-fix- und 21 der 22 Should-fix-Zeilen aus `task-3-passB.md` sind übernommen (44 Einzeländerungen an 8 Dateien).

| Zeile | Datei | Was geändert wurde |
|---|---|---|
| M1 | `formStandardDocument` | `validationSurnameTooLong` sagt jetzt `עד {max} תווים`. `FormStandard.tsx:213–216` liefert für diesen Key nur `{max}` und `{current}`; `tpl()` hätte ein unbekanntes `{min}` **literal** angezeigt. Die EN-Quelle trägt denselben Fehler („Surname is too long. Minimum {min} …") — die hebräische Fassung folgt hier bewusst der Absicht („zu lang"), nicht dem Wortlaut. Die drei `…TooShort`-Keys behalten `{min}`, weil die Komponente es dort tatsächlich übergibt |
| M2 | `header` | Partners-Sublink auf `/partners` (Entscheidung J), Begründung oben |
| M3 | `homepage` | FAQ 4 spiegelt wieder ihr eigenes EN-Item |
| M4 | `homepage` | „wir arbeiten in mehreren Sprachen" → `… ואנחנו עובדים עם לקוחות ממדינות שונות באנגלית וברוסית.` (Entscheidung E) |
| M5 | `homepage` | Satzfragment `להיכרות מקרוב עם האזור, ` → `להיכרות מקרוב עם האזור אפשר לעיין ב` (Prädikat ergänzt, EN `browse our …`) |
| M6 / M7 / S5 / S6 | `homepage` | Kundenstimmen: Kongruenz `וקרובה`, Vergangenheit `היה ההחלטה`, `הליך` → `התהליך`, elliptisches Satzende ergänzt |
| M8 | `homepage` | H2 `רכישת נכס בקפריסין לרוכשים זרים` statt maskuliner Singular-Anrede |
| M9 | `caseStudiesPage` | `תרחישים שמבוססים על …` statt „echte Szenarien aus den Geschäften" (EN hedged bewusst) |
| M10 | `caseStudiesPage` | `רכישות למעבר מגורים ולאיכות חיים` |
| M11 | `caseStudiesPage` | Off-Market war als off-plan übersetzt. Label jetzt `הזדמנויות בנכסים שאינם מפורסמים`, Ziel `/he/projects` statt `/he/real-estate-cyprus`. Der Term ist neu in Glossar §2 |
| M12 / M13 / M14 | `blogPage` | Wurzelwiederholung `מרכז`/`מרוכזים` aufgelöst · `בעלות של תושבי חוץ` (Numerus + Steuerterminus) · kalkiertes „what makes the difference" → `תנאי להצלחה`, Rendite `תשואה משכירות` |
| S1 / S2 / S3 | `footer` | Disclaimer `בין … לבין` + Register `איננו נותנים` · `Cyprus VIP Estates, מיזם מבית` · Spaltentitel `החיים בקפריסין (באנגלית)` |
| S4 / S7–S12 / S15 / S25 | `homepage` | Smichut `המלצות לקוחות` · `שוקלים` statt `בוחרים` (EN `consider`) · Passiv aufgelöst · `טופס יצירת הקשר באתר` statt Kalkierung „callback form" · Wortfolge in `descriptionField[4]` · `הרוכשים של היום` · Präposition `מאוסטריה, משווייץ` · Meta-Description auf 142 Graphem · Apposition in der Doppeltext-Überschrift |
| S13 / S14 / S17 / S18 / S19 | `blogPage` | Meta-Titel ohne den Cornerstone-Term `נדל"ן בקפריסין` (der gehört `/he/real-estate-cyprus`) · Description auf 127 Graphem · `שנבחרו בקפידה` · „with confidence" bezieht sich auf den Leser · H2 trägt den Blognamen |
| S16 | `projectsPage` | Description auf 137 Graphem, Filterfacetten ergänzt |
| S20 / S21 / S22 | `caseStudiesPage` | Schlusssatz `הליווי נבנה סביב המטרות שלכם.` ergänzt · `בתים למעבר לקפריסין` · CTA ohne `היום`, `בליווי מקצועי` |
| S23 | `notFoundPage` | Hero-Button `לצפייה בכל הפרויקטים` (Glossar §4.1 trennt Hero-Button von Listenkopf-Link) |
| S26 | `homepage` | `Get in contact` an allen sechs Stellen (`sliderMain[0..4].buttonLabel`, `brochureBlock.buttonLabel`): `לקבלת ייעוץ` → `ליצירת קשר` (Glossar §4). `לקבלת ייעוץ` bleibt der Header-CTA für „Get Consultation" und kommt aus `NavWrapper.copy.ts`, nicht aus diesen Dateien |

**Nicht angewandt: S24** (`caseStudiesPage.seo.metaDescription`, der Zusatz `בכל סיפור מופיעים התקציב, המיקום, סוג הנכס ולוח הזמנים של העסקה.`). Die Zeile ist im Pass B ausdrücklich konditional („belassen, wenn Pass C die Vollständigkeit bestätigt"), und der String ist wortgleich mit `src/app/preview-case-studies/[lang]/copy.ts:230`; eine einseitige Änderung bräche §11.6, und `src/` liegt außerhalb des Commit-Pathspecs dieser Aufgabe. Steht als Frage 7 unten.

## Bewusste Abweichungen von EN oder Glossar (§9.2)

| Stelle | Abweichung | Begründung |
|---|---|---|
| `homepage.sliderMain[0..4].buttonLabel`, `brochureBlock.buttonLabel` | EN `Get in contact` → `ליצירת קשר` | Glossar §4. Die vorherige Fassung stand sechsmal auf `לקבלת ייעוץ`, dem Header-CTA für „Get Consultation" — zwei verschiedene EN-Strings hätten dieselbe hebräische Beschriftung getragen (Pass B S26) |
| `homepage.sliderMain[3].title` | EN „We speak English" → `מדברים אנגלית ורוסית` | Entscheidung E nennt ohnehin beide Sprachen; Frage 2 unten |
| `homepage.descriptionBlock…descriptionField[2]` | EN „We are also multilingual" → `… באנגלית וברוסית` (M4) | Entscheidung E. Der volle Boilerplate-Satz aus Glossar §5 (`הייעוץ מתקיים באנגלית או ברוסית; פנייה בעברית מתקבלת בברכה.`) steht bereits wörtlich in `sliderMain[3].description` derselben Seite; ihn ein zweites Mal auf derselben Seite zu setzen wäre eine §11.5-Wiederholung. Der Kanal „Startseite" trägt ihn also genau einmal |
| `homepage.faqSection…items[5]` | Rechtsvorbehalt aus Glossar §5 gegenüber EN ergänzt | Styleguide §8 (keine Zusicherungen zu Aufenthalt/Steuern) |
| `footer.socialLinks[*].label` | `אינסטגרם / יוטיוב / פייסבוק / טיקטוק / וואטסאפ` | Styleguide §4 lässt Umschrift nur für Geografie zu, und das Glossar transliteriert ausdrücklich nur `וואטסאפ`. Die vier übrigen sind die auf israelischen Sites übliche Schreibung. **Entweder** bekommt §4 eine Ausnahme für Plattformnamen, **oder** die vier Labels gehen zurück auf Latein — Frage 8 unten. Bis dahin ist die Abweichung hier dokumentiert, nicht stillschweigend |
| `caseStudiesPage.seo.metaDescription` | Zusatz gegenüber EN (Budget/Ort/Typ/Zeitplan je Story) | durch `preview-case-studies/[lang]/copy.ts` `statBudget`/`statLocation`/`statProperty`/`statTimeline` gedeckt, gilt aber nur, wenn **jede** Case Study alle vier Felder füllt — Frage 7 |
| `footer.companyParagraphs[0]` | `Cyprus VIP Estates, מיזם מבית` statt `הוא מיזם של` | S2: die Marke trug in derselben Fußzeile maskulines `הוא` neben femininem `פועלת`. Die Nominalform vermeidet die Genusfestlegung, bis Pass C sie trifft (Frage 9) |

## Bekannte Bedingungen (keine Fehler, aber vor Phase 6 zu prüfen)

1. **Englische Admin-Blocklabels.** Die zehn `doubleTextBlockTitle`-Werte (`Double Text Block 1`, `Image Left`, `Image Right`) bleiben englisch (Projektkonvention „Admin bleibt Englisch"). Heute rendern sie nur in `admin/BlockEditor.tsx:15`; die `<h2>`-Ausgabe in `DoubleTextBlockComponent.tsx:94–95` ist auskommentiert. Wird sie je aktiviert, stehen zehn englische H2 auf `/he` — dann müssen die Labels mitziehen.
2. **404-Fallback im Code.** `NotFoundPageComponent.tsx:29` `FALLBACK.he.cta` steht weiter auf `לכל הפרויקטים`, das CMS-Dokument seit S23 auf `לצפייה בכל הפרויקטים`. Der Code-Kommentar erklärt die Fallbacks ausdrücklich als „not copy decisions" (sie greifen nur, wenn das CMS-Dokument fehlt), deshalb ist das kein §11.6-Dublettenpaar — die Zeile sollte in einer Code-Aufgabe trotzdem nachgezogen werden, damit beide Wege dasselbe sagen.
3. **Bidi-Isolation ist in JSON nicht abbildbar.** Betroffen: `footer.contacts[1].label` / `[2].label`, `footer.vatNumber`, `formStandardDocument.form.errorMessage` (E-Mail und Telefonnummer mitten im RTL-Satz, im Code laufen genau diese Token durch `ltrIsolate()`), `blogPage.content[20]` (`שטר הבעלות (Title Deed)`) und jede lateinische Marke in einem hebräischen Satz. Entweder tragen die Renderer die Isolation nach (`<bdi>` um `label`/`contacts`/CMS-Fehlermeldungen), oder die JSON-Strings müssen U+2066/U+2069 selbst enthalten. Styleguide §5 und §11.4 verlangen es; es ist keine Task-3-Textfrage.
4. **16 Ausgangslinks aus dem `he`-Cluster in den EN-Baum**, ein einziger nach `/he/blog`: acht im Fließtext der Startseite, sieben in der Fußzeile, einer in `caseStudiesPage`. Entscheidung C erlaubt das, Spec 3.6 („Hubs/Spokes verlinken nur innerhalb `he`") spricht dagegen. S3 setzt jetzt wenigstens einen Sprachhinweis in den Fußzeilen-Spaltentitel; die Spalte sollte auf `/he/blog` plus Artikelliste umgestellt werden, sobald hebräische Artikel existieren (Phase 8).
5. **Zwei Wiederholungsmuster**, von Pass B als „systemisch" markiert und **nicht** in dieser Runde angefasst, weil sie keine Must-/Should-fix-Zeile sind: (a) das Ersatzmuster für „Whether … or …" (vorangestellte Liste, Komma, resumptiver Hauptsatz) steht fünfmal — `homepage.faqSection…items[7].answer[4]`, `homepage.contentBlocks[11]…content[4]`, `homepage.featuredProjectsBlock.description`, `blogPage.content[12]`, `caseStudiesPage.content[52]`; mindestens zwei sollten ein regierendes Satzglied bekommen (`בכל אחת מהמטרות האלה, …`). (b) „von X bis zu den Schlüsseln" steht viermal (`heroBlock.heroDescription`, `homepage.seo.metaDescription`, `benefitsBlock.benefits[2].description` und im Code `preview-case-studies/[lang]/copy.ts` `heroLead`), davon dreimal auf der Startseite — §11.5.
6. **Gemeinsamer Snippet-Anfang.** `homepage.seo.metaDescription` und `projectsPage.seo.metaDescription` beginnen nach S15/S16 weiterhin beide mit `וילות ודירות בפרויקטים חדשים בלימסול ובפאפוס,` (44 Graphem). Die Pass-B-Rewrites haben die Länge repariert, den doppelten Einstieg aber beibehalten — Frage 10.
7. **Zwei inhaltliche Spannungen aus der EN-Quelle**, quellentreu und deshalb nicht geändert: `blogPage.content[52]` spricht von „unseren Rechtsberatern", während `footer.discklaimer` erklärt, alle Rechtsarbeit liege bei unabhängigen Anwälten; und `benefitsBlock.benefits[3].description` nennt Deutschland/Österreich/Schweiz als Herkunft zufriedener Kunden auf einer Seite, deren H2 `למה רוכשים מישראל בוחרים בנו` lautet.


## Fragen an Pass C / den Lektor

1. **Larnaka:** Die drei Stellen, an denen Larnaka strukturbedingt stehen bleibt (Städtekachel, FAQ 4, `contentBlocks[6]`), sind neutral formuliert und verlinken auf `/he/projects`. Reicht das, oder soll die Kachel eine andere Stadt zeigen (Struktur erlaubt nur einen Textwechsel, keine Entfernung)?
2. **`sliderMain[3]`:** Titel `מדברים אנגלית ורוסית` weicht bewusst vom EN („We speak English") ab, weil Entscheidung E ohnehin beide Sprachen nennt. Bestätigen?
3. **Footer-Umbelegungen:** Larnaka-Links und „Top 100 Properties" wurden auf `/he/paphos/apartments`, `/he/paphos/villas`, `/he/projects` bzw. `/he/property-prices-cyprus` gelegt. Passt die Auswahl redaktionell?
4. **`הצטרפות כשותפים`** (Become a Partner) und **`האוסף הפרטי`** (Private Collection) sind Neuprägungen — bitte gegenlesen; beide gehören sonst in Glossar §4.
5. **`benefitsBlock.benefits[0].title` = `פרויקטים`** (EN: „Real Estate Projects"): Über der Zahl steht sonst nur ein Wort. Genügt das, oder `פרויקטים בקפריסין`?
6. **`caseStudiesPage.title`** ist die H1 der Seite und lautet wie die Startseiten-H2 (`סיפורי לקוחות מקפריסין`). Wenn der Lektor sie unterscheiden will, ändert das nur diese Datei (kein Akzentwort betroffen).
7. **`caseStudiesPage.seo.metaDescription`** (Pass B S24): der Satz `בכל סיפור מופיעים התקציב, המיקום, סוג הנכס ולוח הזמנים של העסקה.` verspricht dem Sucher vier Felder in **jeder** Story. Füllt jede Case Study `statBudget`, `statLocation`, `statProperty` und `statTimeline`? Wenn nein, muss der Satz auf `ברוב הסיפורים מופיעים התקציב, המיקום, סוג הנכס ולוח הזמנים.` — und dann **gemeinsam** mit `src/app/preview-case-studies/[lang]/copy.ts:230` (§11.6). Der String ist deshalb in dieser Runde bewusst unverändert geblieben.
8. **Social-Labels:** `אינסטגרם / יוטיוב / פייסבוק / טיקטוק` sind Umschriften, die Styleguide §4 nur für Geografie erlaubt; im Glossar steht nur `וואטסאפ`. Bekommt §4 eine Ausnahme für Plattformnamen, oder gehen die vier zurück auf Latein?
9. **Genus der Marke:** `Cyprus VIP Estates` trägt heute `הוא` (`homepage.descriptionBlock…descriptionField[2]`), `פועלת` (`footer.discklaimer`), `מציעה`, `הופכת`, `מציגה`, `תעזור`. Eine Form festlegen; sie gehört dann in Glossar §4.
10. **Snippet-Anfang doppelt:** `homepage` und `projectsPage` beginnen ihre Meta-Description beide mit `וילות ודירות בפרויקטים חדשים בלימסול ובפאפוס,`. Soll eine der beiden einen anderen Einstieg bekommen (die Startseite trägt den Israel-Fokus, `/he/projects` den Filter-/Verfügbarkeitsfokus)?
11. **`הזדמנויות בנכסים שאינם מפורסמים`** (Off-Market, neu in Glossar §2, ersetzt das fälschliche `רכישה על הנייר`): trägt die Wendung im israelischen Immobilien-Sprech, oder gibt es eine kürzere gewachsene Form? Der Bullet zeigt bis auf Weiteres auf `/he/projects`, weil es keine Off-Market-Seite gibt.
