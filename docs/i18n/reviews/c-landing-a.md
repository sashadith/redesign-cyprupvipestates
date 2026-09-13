# Review-Protokoll `c-landing-a` — Landingpages 1–9 `he` (Phase 5d, Task 6a)

**Stand:** 2026-09-13 · **Status:** Pass A + Pass B (inline) erledigt, Pass C (muttersprachlicher Lektor) offen · **Quelle:** keine EN-Vorlage — frei auf Hebräisch verfasst aus `docs/i18n/he-keyword-map.md` §4 (Zeilen 1–9) und §2; Faktenbasis `content/he/source/inventory.json` und `content/he/source/developers.en.json`; Blockformen aus `content/he/source/reference/*.en.json`.

Alle neun Dateien tragen `"review": "pending"`, `"translationGroupSlugEn": null` (kein EN-Gegenstück).

---

## 1. Die neun Seiten

| # | Pack-Slug / Datei | H1 (`he`) | Primär-KW (gezählt) | Wörter Intro / gesamt | FAQ |
|---|---|---|---|---:|---:|
| 1 | `real-estate-cyprus` | נדל"ן בקפריסין לרוכשים מישראל, פרויקטים חדשים בלימסול ובפאפוס | `נדל"ן בקפריסין` (320) | 121 / 610 | 6 |
| 2 | `apartments-for-sale-cyprus` | דירות למכירה בקפריסין בפרויקטים חדשים | `דירות למכירה בקפריסין` (140) | 128 / 504 | 5 |
| 3 | `property-investment-cyprus` | השקעות נדל"ן בקפריסין ודירות להשקעה | `השקעות נדל"ן בקפריסין` (140) | 133 / 555 | 5 |
| 4 | `property-prices-cyprus` | מחירי דירות בקפריסין וכמה עולה דירה לפי אזור | `מחירי דירות בקפריסין` (50, siehe §4) | 133 / 525 | 5 |
| 5 | `limassol` | דירות בלימסול ופרויקטים חדשים למכירה | `דירות בלימסול` (110) | 126 / 504 | 5 |
| 6 | `limassol/new-projects` | פרויקטים חדשים בלימסול ודירות להשקעה | `פרויקטים בלימסול` (30) | 119 / 500 | 5 |
| 7 | `paphos` | נדל"ן בפאפוס, וילות ודירות בפרויקטים חדשים | `נדל"ן בפאפוס` (70) | 130 / 509 | 5 |
| 8 | `paphos/apartments` | דירות למכירה בפאפוס | `דירות למכירה בפאפוס` (50, siehe §4) | 129 / 482 | 5 |
| 9 | `paphos/villas` | וילות למכירה בפאפוס | `וילות בפאפוס` (170) | 124 / 547 | 6 |

„Intro" = `landingTextStart` (Vorgabe 120–180 Wörter). „gesamt" = Hero-Lead + alle Textblöcke + FAQ.

Jede Datei: `landingIntroBlock` → `landingTextStart` → `landingProjectsBlock` → `landingTextFirst` (3 × H2) → `landingFaqBlock` → `landingTextSecond` (2 × H2) — exakt die Blockfolge und Feldform der sechs EN-Referenzseiten, frische 12-stellige `_key`s, `markDefs: []` durchgehend (auch die EN-Vorlagen setzen keine Inline-Links).

---

## 2. Linkgraph

| Seite | `parentSlug` | `relatedLandingPages` |
|---|---|---|
| 1 `real-estate-cyprus` | — | 2, 3, 4, 5, 7, **10** |
| 2 `apartments-for-sale-cyprus` | — | 1, 5, 8 |
| 3 `property-investment-cyprus` | — | 6, **17**, **16**, 1 |
| 4 `property-prices-cyprus` | — | 1, 5, 7 |
| 5 `limassol` | — | 6, **17**, 1 |
| 6 `limassol/new-projects` | `limassol` | 5, 1, 3 |
| 7 `paphos` | — | 8, 9, 1 |
| 8 `paphos/apartments` | `paphos` | 7, 1, 2 |
| 9 `paphos/villas` | `paphos` | 7, 1, **10** |

**Fett = Task-6b-Seiten**, die es im Repo noch nicht gibt: `villas-cyprus` (10), `property-tax-cyprus` (16), `limassol/investment-apartments` (17). Der Gate meldet sie **nicht** (er prüft nur `href`/`url`-Felder; `relatedLandingPages` sind reine Pack-Slug-Strings), der **Seeder** würde sie als unauflösbar hart abbrechen. Sie müssen also in 6b entstehen, bevor geseedet wird.

Abweichungen von der Aufgabenvorgabe, beide bewusst:
- Seite 3 bekommt zusätzlich `real-estate-cyprus` — ein Hub ohne Rücklink auf den Cornerstone wäre ein Loch im Graphen.
- Die Spokes 2, 6, 8, 9 bekommen neben Hub + Cornerstone je einen dritten, thematisch passenden Link (2→`paphos/apartments`, 6→`property-investment-cyprus`, 8→`apartments-for-sale-cyprus`, 9→`villas-cyprus`).

**CTA:** kein `buttonBlock`. `isLandingPage()` (`src/app/preview-landing/LandingBody.tsx:66`) verlangt, dass **jeder** Block der Landing-Familie angehört; ein `buttonBlock` würde die Seite auf den Classic-Renderer werfen und dort alle Landing-Blöcke stumm verlieren. Der CTA nach `/he/contacts` läuft deshalb über `landingIntroBlock.buttonLabel`, das `LandingBody` (Zeile 161–164) genau auf `${localizedHref(lang)}/contacts` verlinkt. CTA-Texte aus Glossar §5 / §4 (`לקבל שיחה מיועץ`, `לצפייה בזמינות ובמחירים`, `לקבלת ייעוץ השקעות`, `לקבל מחירון עדכני`).

---

## 3. `landingProjectsBlock` — Filter je Seite

| Seite | `filterCity` | `filterPropertyType` | `priceMax` |
|---|---|---|---:|
| 1 | — | Apartment | 600000 |
| 2 | — | Apartment | — |
| 3 | — | Apartment | 400000 |
| 4 | — | Apartment | — |
| 5 | Limassol | — | — |
| 6 | Limassol | Apartment | — |
| 7 | Paphos | — | — |
| 8 | Paphos | Apartment | — |
| 9 | Paphos | Villa | — |

**Warum die drei zypernweiten Seiten (1, 3, 4) einen Typfilter tragen:** `resolveBlocks` (`src/sanity/sanity.utils.ts:614`) startet die Live-Abfrage nur, wenn `filterCity`, `filterPropertyType`, `maxBeachMinutes` oder `filterStage` gesetzt ist. Ein Block ganz ohne Filter rendert die Leerzeile `projectsStrings.empty`. Eine manuelle `projects`-Liste scheidet aus: die EN-Referenzen referenzieren `project-<slug>.en`-Zeilen, für `he` gäbe es kein Pendant. `filterStage: "off-plan"` wurde verworfen — die Admin-Auswahl kennt nur `Available / Under Construction / Key-Ready / Sold`, ein Treffer hinge allein an Feed-Werten und könnte die Liste leeren. Damit bleibt der Typfilter die einzige belastbare zypernweite Abfrage.

`priceMax` auf 1 und 3 ist redaktionelle Kuratierung (Einstiegs- bzw. Investitionsband) und dient zugleich der Abgrenzung gegen Seite 2 und 4; die Zahl steht **nur** im Query-Feld, in keinem Textstring. **Offen (§6):** Seite 2 und Seite 4 teilen sich dieselbe Abfrage (Apartment, zypernweit, ungedeckelt).

---

## 4. Primär-Keywords und Zählung

Zählskript: exakte Substring-Treffer über `title`, `excerpt`, `seo.metaTitle`, `seo.metaDescription`, Hero-Kicker/-Lead, alle Blocktitel, alle Portable-Text-Spans und alle FAQ-Q&A. `contentBlocks[0].title` ist ausgenommen, weil es wortgleich `title` ist (dieselbe H1, nicht zwei Nennungen).

Ergebnis: **4 Treffer auf jeder der neun Seiten** — H1, `excerpt`, `metaTitle` und eine Nennung im Fließtext. `metaDescription` und Body arbeiten mit Flexionen statt mit der Exaktform.

Drei Primär-Keywords der Map sind als Suchstring nicht satzfähig und wurden auf die nächstliegende, in der Map ebenfalls belegte Form gezogen:

| Map-Primär-KW | gezählt als | Grund |
|---|---|---|
| `דירות בקפריסין מחירים` (110) | `מחירי דירות בקפריסין` (50) | Wortfolge der Map ist Query-Hebräisch, kein Satz; die gewählte Form ist die Kopfform desselben Preis-Clusters |
| `דירות למכירה בקפריסין פאפוס` (70) | `דירות למכירה בפאפוס` (50) | dito; `קפריסין` sitzt stattdessen im `metaTitle` |
| `וילות בפאפוס` (170) | unverändert | H1 trägt bewusst `למכירה` (Map §6.2: sonst Konkurrenz zu Booking/Airbnb); die Exaktform steht in `excerpt`, `metaDescription`, Intro und Schlussblock |

Alle H1 sind kolonfrei (§3): die Doppelpunkt-Vorschläge der Map (Zeilen 1, 3, 5, 6, 7) wurden zu Appositionen oder Und-Verbindungen umgebaut. Die Jahreszahl aus dem H1-Vorschlag zu Zeile 4 („2026") ist gestrichen — sie altert und ist keine Aussage.

---

## 5. Verwendete Fakten und ihre Quelle

| Aussage | Quelle |
|---|---|
| Zwei Märkte, Limassol und Paphos; Larnaka wird nicht beworben | `inventory.json` (Limassol 51, Paphos 138 published Developments; Larnaka 3), Styleguide §8 |
| Paphos trägt den größeren Teil des Bestands | `inventory.json` |
| Paphos-Einstiegspreise niedriger als Limassol, oberes Ende in Limassol höher | `inventory.json` (`priceFromMin` 160.000 vs. 187.000; `priceFromMax` 33,8 Mio. vs. 41,0 Mio.) — **im Text nur als Verhältnis, ohne Ziffern** |
| Villen konzentrieren sich in Peyia, Coral Bay, Chlorakas, Sea Caves, Polis | `inventory.json` (Peyia 11 „Luxury Villas", Coral Bay, Chlorakas, Polis), Glossar §1 |
| Limassol: Türme, Gated Complexes, Vorstadthäuser; Villen dort eine kleine Minderheit | `inventory.json` (Typenliste Limassol), Keyword-Map §4.1 („Inventar 6 Villen") |
| Bauträgernamen Limassol: `Cybarco`, `Imperio Properties`, `Pafilia` | `developers.en.json` (alle drei nennen Limassol) |
| Bauträgernamen Paphos: `Aristo Developers`, `Leptos Estates`, `Pafilia`, `Korantina Homes` | `developers.en.json` |
| Kein Aufpreis für den Käufer | EN-Referenzseiten („no additional buyer's fee"), Glossar §2 `בלי תוספת מחיר לרוכש` |
| Kaufdauer: einfache Transaktion Wochen, mit Hypothek/Off-Plan länger | `src/app/preview-faq/faqData.ts` |
| Off-Plan mit bauabschnittsgebundenem Zahlungsplan | `faqData.ts` |
| Unterschrift beim Anwalt, Eintragung beim `רשם המקרקעין`, `שטר בעלות (Title Deed)` | Glossar §2, Styleguide §7 (kein Notar) |
| Genehmigung der `מועצת השרים` in bestimmten Fällen für Nicht-EU-Käufer | Glossar §3 |
| Finanzierung auch für Nicht-Ansässige, Konditionen individuell | Glossar §3 (Kreditvergabe an Nicht-Ansässige) — qualitativ, ohne Quoten |
| Doppelbesteuerungsabkommen Israel–Zypern besteht | Glossar §3 `אמנת מס` — ohne Artikel, ohne Sätze |
| ROI-Rechner mit Szenarien שמרני / ריאלי / אופטימי | Glossar §3.1 |
| Israelische Community in Limassol | Keyword-Map §4 Zeile 14 |
| `כ-45 דקות טיסה מתל אביב` | Glossar §5 (Boilerplate) — nur auf Seite 1 und 3, dort unterschiedlich formuliert |
| `המחירים עשויים להשתנות. הזמינות מתעדכנת מול היזם.` | Glossar §5 (Preisvorbehalt), wortgleich auf 1, 2, 4, 8 |
| `המידע אינו מהווה ייעוץ משפטי או מס. בכפוף לבדיקה פרטנית.` | Glossar §5 (Rechtsvorbehalt), auf 1 und 3 |

**Nicht verwendet:** Renditen, Steuersätze, Mehrwertsteuersatz (nur „ermäßigter Satz" ohne Zahl), Objektzahlen, Fertigstellungsfristen, Auszeichnungen, Preisziffern jeder Art. Entscheidung E (Beratungssprache Englisch/Russisch) steht bewusst **nicht** auf diesen Seiten — sie gehört auf Kontaktflächen.

---

## 6. Pass B (inline) — was geändert wurde

1. **Doppelte Passage zwischen Seite 1 und 3** („סיפורי הכישלון … יזם שאיש לא בדק ורוכש שוויתר על עורך דין עצמאי") — auf Seite 3 durch ein eigenes Argument ersetzt (Vertrauen als Marktmerkmal), damit keine zwei Seiten denselben Absatz tragen.
2. **Doppelte FAQ zwischen Hub 7 und Spoke 9** (`יש בפאפוס וילות עם בריכה פרטית?`) — auf Seite 7 durch eine Stadt-vs-Norden-Frage ersetzt. Sonst hätten zwei URLs identische `FAQPage`-Einträge emittiert.
3. **Doppelter Einstiegssatz** in Hero-Lead und Intro von Seite 5 (`העיר העסקית` / `מרכז העסקים`) — Intro umgeschrieben (§11.5).
4. **Identischer Hero-Lead** auf 1 und 3 (`קפריסין היא מדינה חברה באיחוד האירופי…`) — Seite 3 auf eine investorenspezifische Formulierung umgestellt.
5. **Wurzelwiederholung** bereinigt: `בית שני … מהבית` → `מישראל` (1), `אופי משלו ורמת מחירים משלו` → einmal `משלו` (7), `המשמעות המעשית` neben `השאלה המעשית` (1), `רובם … ובחלקם` → `וחלקם` (1).
6. **Anrede-Fehler** in der FAQ von Seite 1: `אנחנו משלמים לכם עמלה?` (das „wir" wechselte die Person mitten in der Seite) → nominal `האם הרוכש משלם עמלה לסוכנות?`.
7. **Fragen ohne `האם`/Verb** in Fragestellung ergänzt (3: `האם רכישה על הנייר מסוכנת יותר?`, `עדיף לרכוש דרך חברה או באופן פרטי?`, `מה סכום ההשקעה המינימלי?`; 9: `עדיף בית חדש או בית יד שנייה?`).
8. **Unnatürliche Wortfolge** im `metaTitle` von Seite 5 (`דירות בלימסול למכירה`) → `דירות בלימסול, פרויקטים חדשים`.
9. **Logikfehler** in Seite 1 Intro (zwei Dinge „gehen nicht über einen Zwischenhändler", aber der zweite Punkt war die Einheitentabelle) → neutral als „zwei Auswirkungen" formuliert.
10. **Redundanz** in Seite 6 (der „gleiche Datenfelder"-Gedanke stand zweimal) — auf einen Absatz konzentriert.
11. **Keyword-Dichte** auf 2, 8 und 9 von 5–6 auf 4 gesenkt (Projekt-Blocktitel und eine H2 auf Varianten umgestellt).
12. **Meta-Descriptions** von 111–120 auf 129–147 Graphem verlängert (Styleguide §6 verlangt 120–155).
13. Erfundene Behauptungen gestrichen: „die meisten Käufer mit mittlerem Budget beginnen dort", „wir vermitteln an Anwälte", „Verkaufsevents enthalten eine Marketingschicht" (auf eine allgemeine Marktbeobachtung abgeschwächt), Stockwerkszahlen bei den Paphos-Anlagen.

Formales: keine `—`/`–`/`!`, keine typografischen Anführungszeichen, keine Schrägstrich-Genusformen, `הכל` statt `הכול`, `נדל"ן` durchgehend mit Gershayim, westliche Ziffern, kein `נוטריון`, kein `חברות בנייה`, keine §7-Floskel. Lateinische Bauträgernamen auf 5 und 7 stehen in FSI/PDI-Isolaten (§11.4).

---

## 7. Gates

| Gate | Ergebnis |
|---|---|
| `node scripts/qa/he-content-check.mjs --only content/he/singlepages/<datei>` (9 ×) | OK, je Datei „no EN source — skipping mirrorCheck" |
| `node scripts/qa/he-content-check.mjs --only content/he/singlepages` | `he-content: OK (11 files, 794 strings)` (die 2 zusätzlichen Dateien gehören zu Task 5) |
| `grep -c "—\|–\|!"` je Datei | 0 / 0 / 0 / 0 / 0 / 0 / 0 / 0 / 0 |
| Primär-Keyword-Zählung | 4 auf jeder Seite (§4) |
| `seo.metaTitle` Grapheme | 33–50 (Limit 60) |
| `seo.metaDescription` Grapheme | 129–147 (Limit 155, Zielband 120–155) |
| `npm test` | 297 pass / 0 fail |
| `node scripts/he-content/seed.mjs --dry-run --only singlepages` | druckt den `CVP_ALLOW_DB_READ`-Hinweis, Exit 0 (kein DB-Zugriff) |

---

## 8. Offene Punkte für Pass C und den Controller

1. **Seiten 2 und 4 teilen dieselbe Projekt-Abfrage** (Apartment, zypernweit, ohne Preisdeckel). Inhaltlich sind es völlig verschiedene Seiten, aber die `middleware.ts`-Historie zeigt, dass identische Live-Queries in der Vergangenheit zu Merge-Kandidaten wurden. Wenn Larnaka-Bestand dazukommt oder `filterStage` verlässlich befüllt ist, sollte eine der beiden umgestellt werden.
2. **Cross-Half-Links** auf `villas-cyprus`, `property-tax-cyprus`, `limassol/investment-apartments` sind gesetzt, die Zielseiten entstehen erst in Task 6b. Vor dem Seeden prüfen.
3. **Bauträgernamen** (`Cybarco`, `Imperio Properties`, `Pafilia`, `Aristo Developers`, `Leptos Estates`, `Korantina Homes`) stammen aus den EN-Profilen in `developers.en.json`, die die jeweilige Stadt erwähnen. Falls einer von ihnen dort aktuell nichts baut, gehört die Nennung gestrichen — der Controller kann das gegen den Feed prüfen.
4. **`allowIntroBlock: true`** folgt der Task-Vorgabe des Plans; die EN-Referenzseiten stehen auf `false`. Für die Landing-Familie ist das Feld folgenlos (`LandingBody` liest es nicht), es würde erst zählen, wenn eine Seite je auf den Fallback-Renderer fiele.
5. **Zwei Bild-Assets** für neun Seiten (`image-2ec5103e…` allgemein/Villen, `image-1e438cc9…` Wohnungen), beide aus den EN-Referenzseiten übernommen. Eigene Motive pro Stadt wären besser, sobald welche vorliegen.
6. **Sprachliche Endabnahme** durch die muttersprachliche Lektorin steht aus (Pass C, Entscheidung F). Besonderes Augenmerk: die Register-Mischung in den FAQ-Antworten (`מה שאפשר לתת זה נתונים` ist bewusst gesprochenes Israelisch) und die Ortsnamen-Umschriften `כלורקה`, `קיסונרגה`, `סי קייבס`, `גרוסקיפו`.
