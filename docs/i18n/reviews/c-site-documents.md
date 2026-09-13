# Review-Protokoll — `content/he/site-documents/*.he.json` (Phase 5, Task 3)

**Stand:** 2026-09-13 · **Pass A + Pass B (inline)** · Review-Status: `"review": "pending"` in jeder Datei
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
- **Wortgleiche Dubletten (§11.6):** 404 (`textEnd`/`description`/`buttonText`) = `NotFoundPageComponent` `FALLBACK.he`; Formular-Erfolg/Fehler = `formFeedbackCopy.ts`/`Form.copy.ts` (ohne `ltrIsolate()`, JSON kennt keine Helper); Feldlabels und Validierungen = `FormStatic.copy.ts`; Navigationslabels nach Glossar §4; `caseStudiesPage`-Meta wortgleich mit `preview-case-studies/[lang]/copy.ts` `he` (dieselbe Seite, zwei Quellen).
- **WP3-Bestandstexte übernommen:** `aboutBlock.bullets` = `BULLETS_TEXT.he`, `howWeWorkBlock.steps` = `STEPS_TEXT.he` (jeweils wörtlich).
- **Entscheidung E** steht auf der Startseite dort, wo der Text von Sprachen spricht: `sliderMain[3]` („We speak English") lautet jetzt `מדברים אנגלית ורוסית` + `… הייעוץ מתקיים באנגלית או ברוסית; פנייה בעברית מתקבלת בברכה.` Footer und 404 sprechen nicht über Sprachen und tragen den Satz deshalb nicht.
- **Stil:** 0 × `—`/`–`/`!` in allen acht Dateien; gerade Anführungszeichen; westliche Ziffern; `נדל"ן` mit Gershayim; keine Schrägstrich-Genusformen. `styleCheck` meldet 0 Verstöße.

## Entscheidungen je Dokument

### homepage
- **Larnaka** ist dort gestrichen, wo die Struktur es zulässt (Städteliste in `aboutBlock.description`, `featuredProjectsBlock.description`, `descriptionFields[1]`) — Styleguide §8, wie WP3 es für `citiesLead` entschieden hat. Wo Larnaka in einem eigenen Portable-Text-Span mit Link steht (`citiesBlock.cities[2]`, FAQ 4, `contentBlocks[6]`), kann es nicht entfernt werden, ohne die Spiegelstruktur zu brechen: dort bleibt eine **sachliche** Erwähnung ohne Werbung, der Link zeigt auf `/he/projects` statt auf eine Larnaka-Seite.
- **FAQ-Fragen** sind so formuliert, wie Israelis suchen (`האם רוכשים מישראל יכולים לקנות נכס בקפריסין?`, `כמה כסף צריך מעבר למחיר הנכס?`). Antwort 6 (Aufenthalt) endet mit dem Rechtsvorbehalt aus Glossar §5 (`המידע אינו מהווה ייעוץ משפטי או מס. בכפוף לבדיקה פרטנית.`) — bewusster Zusatz gegenüber dem EN, Styleguide §8.
- **Kundenstimmen** sind übersetzt, nicht erfunden; Personennamen bleiben lateinisch, das Land wird hebräisch (`Anna & Markus Vollmer, גרמניה`).
- **Zahlen** stammen alle aus der EN-Quelle (`340 ימי שמש`, `תשואה שנתית החל מ-6%`); nichts hinzugefügt.
- `הכול` → `הכל` (Glossar §4.1) und die Wortstämme `העלות הכוללת`/`העלויות הכוללות` umformuliert, weil die Gate-Regel `hakol-spelling` sie als Teilstring trifft.

### header
Labels nach Glossar §4: `פרויקטים`, `בלוג`, `עלינו`, `שאלות ותשובות`, `סיפורי לקוחות`, `צור קשר`. `Become a Partner` → `הצטרפות כשותפים` (nominal), Ziel `/he/partners` (existiert als Code-Route in `middleware.ts`, steht nur nicht auf der `linkCheck`-Liste — dort wird das Feld `link` ohnehin nicht geprüft). `Private Collection` → `האוסף הפרטי`, Link bleibt die externe Subdomain (kein `he`-Pendant).

### footer
- **Link-Umhängung:** die Spalte „Properties by Location" zeigt auf `/he/paphos`, `/he/limassol`, `/he/paphos/apartments`, `/he/paphos/villas`, `/he/limassol/new-projects`, `/he/projects`; „Property Types" auf `/he/villas-cyprus`, `/he/apartments-for-sale-cyprus`, `/he/property-investment-cyprus`, `/he/houses-for-sale-cyprus`, `/he/seafront-villas-cyprus`, `/he/real-estate-cyprus`. Die drei **Larnaka**-Einträge und `Top 100 Properties` haben kein `he`-Pendant und wurden inhaltlich neu belegt (Label + Ziel passen zueinander).
- Die Spalte „Living in Cyprus" behält die **englischen Blog-Artikel** (Entscheidung C); nur die Labels sind hebräisch.
- Spaltentitel `Cyprus VIP Estates` → `על Cyprus VIP Estates` (Marke lateinisch, Zeile trotzdem hebräisch lesbar).
- Lateinisch bleiben: E-Mail, Telefonnummern, `SecretBrand Solutions LTD`, die Straßenzeile `Palaion Patron Germanou 11`; die Ortszeile ist hebräisch (`8011 פאפוס, קפריסין`). Social-Labels sind die israelisch üblichen Umschriften (`אינסטגרם`, `יוטיוב`, `פייסבוק`, `טיקטוק`, `וואטסאפ`).
- Policy-Labels definit (`מדיניות הפרטיות`, `תנאי השימוש`) nach Glossar §3.2.

### notFoundPage
Wortgleich mit `NotFoundPageComponent` `FALLBACK.he`; der Goldakzent fällt damit auf `הדף`. Meta: `הדף לא נמצא` / `אין תוכן בכתובת זו.`

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
- Die sechs Kategorie-Bullets zeigen auf `/he/villas-cyprus`, `/he/apartments-for-sale-cyprus`, `/he/property-investment-cyprus`, `/he/relocation-cyprus`, `/he/projects`, `/he/real-estate-cyprus`.

### formStandardDocument
Labels, Validierungen und Statusmeldungen wortgleich mit WP1/WP3 (`FormStatic.copy.ts`, `Form.copy.ts`, `formFeedbackCopy.ts`); Consent nominal: `אישור` + `תנאי השימוש` + `וכן` + `מדיניות הפרטיות` (die Komponente setzt die Leerzeichen). `וכן` statt `ו-`, weil `FormStandard.tsx` den Verbinder mit Leerzeichen auf beiden Seiten rendert und ein gebundenes `ו` dort falsch stünde. Consent-Links auf `/he/terms-and-conditions` bzw. `/he/privacy-policy`.

---

## Gate-Ergebnis und offene Punkte

`node scripts/qa/he-content-check.mjs --only content/he/site-documents` meldet **266 Verstöße** — davon **0 inhaltliche**: `styleCheck` ist sauber, alle Meta-Längen liegen im Rahmen, Struktur/`_key`s/Array-Längen spiegeln fehlerfrei (keine einzige „missing key"/„length mismatch"-Zeile). Die Meldungen fallen in sieben Klassen; sechs davon sind Grenzfälle des Gates aus Task 1, die bei Site-Dokumenten zum ersten Mal auftreten:

| # | Klasse | Anzahl | Ursache |
|---|---|---:|---|
| A | `he value is empty` | 113 | Die Portable-Text-Leerabsätze der EN-Quelle (`text: ""`). `mirrorCheck` verlangt einen nicht-leeren HE-String **auch dann, wenn der EN-String leer ist**. |
| B | `must be identical (en="/x", he="/he/x")` | 43 | `IDENTICAL_KEYS` enthält `url`/`href`, `linkCheck` verlangt gleichzeitig `/he/…`. Die beiden Prüfungen widersprechen sich für jeden gespiegelten Link. |
| C | `must be identical` auf `brochureBlock.list[].listItem` | 6 | Namenskollision: `listItem` ist in `IDENTICAL_KEYS` als Portable-Text-Bullet-Marker gemeint, ist hier aber ein Prosafeld. |
| D | `no Hebrew script` auf `/he/…`-Strings | 21 | Felder `link`, `linkDestination`, `agreementLink*Destination` sind Links, werden aber als Prosa geprüft. |
| E | `no Hebrew script` auf Enum-/Layoutwerten | 57 | `type`, `paddingTop/Bottom`, `marginTop/Bottom`, `textAlign`, `variant` („text", „small", „left", „accent" …). |
| F | `no Hebrew script` auf bewusst lateinischen Werten | 19 | E-Mail, Firmenname, Straße, `Homepage HE`/`Header HE`/`Double Text Block 1` (CMS-interne Labels — Projektkonvention: Admin bleibt Englisch). |
| G | `link not on the he allow-list` | 7 | Ziele `/he/villas-cyprus`, `/he/houses-for-sale-cyprus`, `/he/seafront-villas-cyprus`, `/he/relocation-cyprus` — Landingpages aus Keyword-Map §4 (Welle 2/3), die Task 6b/6c erst noch anlegt. Löst sich von selbst, sobald die Dateien existieren. |

**Konsequenz:** Task 3 kann das Gate nicht grün bekommen, ohne `scripts/he-content/lib.mjs` zu ändern — und das ist Task-1-Gebiet (und liegt außerhalb des Commit-Pathspecs dieser Aufgabe). Vorschlag für den Fix (A–D, klein und rückwärtskompatibel):

1. `mirrorCheck`, String-Zweig: `if (!enValue.trim()) { if (heValue !== enValue) violations.push(…) ; return violations; }` → leerer EN-String verlangt leeren HE-String (behebt A).
2. Link-Felder als eigene Kategorie behandeln statt als Prosa/Identität: `url`, `href`, `slug` **aus** `IDENTICAL_KEYS` nehmen und zusammen mit `link`, `linkDestination`, `agreementLinkDestination`, `agreementLink2Destination` von der „muss Hebräisch enthalten"-Regel ausnehmen; `linkCheck` (das schon existiert und in `he-content-check.mjs` läuft) bleibt die einzige Autorität für Links (behebt B und D). `collectLinks()` sollte dabei auf dieselbe Feldliste erweitert werden, damit auch `link`/`linkDestination` geprüft werden.
3. Enum-/Layoutfelder (`type`, `padding*`, `margin*`, `textAlign`, `variant`) und `listItem`, wenn der Wert kein Portable-Text-Marker ist, von der Hebräisch-Pflicht ausnehmen (behebt C und E); alternativ die Regel „EN hat Buchstaben ⇒ HE braucht hebräische Schrift" nur auf Strings mit Leerzeichen **oder** mehr als einem Wort anwenden — sauberer ist die Feldliste.
4. Für F genügt eine Ausnahmeliste im Gate oder das Akzeptieren identischer EN/HE-Werte, wenn der EN-Wert keine übersetzbare Prosa ist (E-Mail, Firmenname, Adresse). Die CMS-internen `title`-Felder bleiben nach Projektkonvention englisch.

## Fragen an Pass C / den Lektor

1. **Larnaka:** Die drei Stellen, an denen Larnaka strukturbedingt stehen bleibt (Städtekachel, FAQ 4, `contentBlocks[6]`), sind neutral formuliert und verlinken auf `/he/projects`. Reicht das, oder soll die Kachel eine andere Stadt zeigen (Struktur erlaubt nur einen Textwechsel, keine Entfernung)?
2. **`sliderMain[3]`:** Titel `מדברים אנגלית ורוסית` weicht bewusst vom EN („We speak English") ab, weil Entscheidung E ohnehin beide Sprachen nennt. Bestätigen?
3. **Footer-Umbelegungen:** Larnaka-Links und „Top 100 Properties" wurden auf `/he/paphos/apartments`, `/he/paphos/villas`, `/he/projects` bzw. `/he/property-prices-cyprus` gelegt. Passt die Auswahl redaktionell?
4. **`הצטרפות כשותפים`** (Become a Partner) und **`האוסף הפרטי`** (Private Collection) sind Neuprägungen — bitte gegenlesen; beide gehören sonst in Glossar §4.
5. **`benefitsBlock.benefits[0].title` = `פרויקטים`** (EN: „Real Estate Projects"): Über der Zahl steht sonst nur ein Wort. Genügt das, oder `פרויקטים בקפריסין`?
6. **`caseStudiesPage.title`** ist die H1 der Seite und lautet wie die Startseiten-H2 (`סיפורי לקוחות מקפריסין`). Wenn der Lektor sie unterscheiden will, ändert das nur diese Datei (kein Akzentwort betroffen).
