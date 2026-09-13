# Review-Protokoll `c-landing-a` — Landingpages 1–9 `he` (Phase 5d, Task 6a)

**Stand:** 2026-09-13 · **Status:** Pass A + Pass B (inline) + **Pass B extern (Kritik) und Fix-Runde 1** erledigt, Pass C (muttersprachlicher Lektor) offen · **Quelle:** keine EN-Vorlage — frei auf Hebräisch verfasst aus `docs/i18n/he-keyword-map.md` §4 (Zeilen 1–9) und §2; Faktenbasis `content/he/source/inventory.json`, `content/he/source/developers.en.json`, `content/he/source/reference/*.en.json` und `scripts/faq-translations/en.json`; Blockformen aus `content/he/source/reference/*.en.json`.

> **Fix-Runde 1 (2026-09-13):** Die externe Kritik (`.superpowers/sdd/2026-09-13-hebrew-phase5-content/task-6a-passB.md`, Grade C, 15 Must-fix / 18 Should-fix) ist vollständig eingearbeitet. Die Abschnitte §4, §5, §6 und §7 unten sind entsprechend korrigiert; §9 protokolliert die Runde.

Alle neun Dateien tragen `"review": "pending"`, `"translationGroupSlugEn": null` (kein EN-Gegenstück).

---

## 1. Die neun Seiten

| # | Pack-Slug / Datei | H1 (`he`) | Primär-KW (gezählt) | Wörter Intro / gesamt | FAQ |
|---|---|---|---|---:|---:|
| 1 | `real-estate-cyprus` | נדל"ן בקפריסין לרוכשים מישראל, פרויקטים חדשים בלימסול ובפאפוס | `נדל"ן בקפריסין` (320) | 121 / 610 | 6 |
| 2 | `apartments-for-sale-cyprus` | דירות למכירה בקפריסין בפרויקטים חדשים | `דירות למכירה בקפריסין` (140) | 128 / 504 | 5 |
| 3 | `property-investment-cyprus` | השקעות נדל"ן בקפריסין ודירות להשקעה | `השקעות נדל"ן בקפריסין` (140) | 133 / 555 | 5 |
| 4 | `property-prices-cyprus` | מחירי דירות בקפריסין וכמה עולה דירה לפי אזור | `מחירי דירות בקפריסין` (50, siehe §4) | 133 / 525 | 5 |
| 5 | `limassol` | דירות בלימסול, מהמרינה ועד הפרברים | `דירות בלימסול` (110) | 126 / 504 | 5 |
| 6 | `limassol/new-projects` | פרויקטים חדשים בלימסול ודירות להשקעה | `פרויקטים בלימסול` (30) | 119 / 500 | 5 |
| 7 | `paphos` | נדל"ן בפאפוס, וילות ודירות בפרויקטים חדשים | `נדל"ן בפאפוס` (70) | 130 / 509 | 5 |
| 8 | `paphos/apartments` | דירות למכירה בפאפוס | `דירות למכירה בפאפוס` (50, siehe §4) | 129 / 482 | 5 |
| 9 | `paphos/villas` | וילות למכירה בפאפוס | `וילות בפאפוס` (170) | 124 / 547 | 5 |

„Intro" = `landingTextStart` (Vorgabe 120–180 Wörter). „gesamt" = Hero-Lead + alle Textblöcke + FAQ.

Jede Datei: `landingIntroBlock` → `landingTextStart` → `landingProjectsBlock` → `landingTextFirst` (3 × H2) → `landingFaqBlock` → `landingTextSecond` (2 × H2) — exakt die Blockfolge und Feldform der sechs EN-Referenzseiten, frische 12-stellige `_key`s, `markDefs: []` durchgehend (auch die EN-Vorlagen setzen keine Inline-Links).

---

## 2. Linkgraph

| Seite | `parentSlug` | `relatedLandingPages` (nach Fix-Runde 1) | eingehend |
|---|---|---|---:|
| 1 `real-estate-cyprus` | — | 2, 3, 4, 5, 7, 9, 10 | 8 |
| 2 `apartments-for-sale-cyprus` | — | 1, 4, 5, 8 | 2 |
| 3 `property-investment-cyprus` | — | 6, 5, 7, 16, 1 | 2 |
| 4 `property-prices-cyprus` | — | 1, 5, 7 | **5** |
| 5 `limassol` | — | 6, 4, 1 | 5 |
| 6 `limassol/new-projects` | `limassol` | 5, 1, 3 | 2 |
| 7 `paphos` | — | 8, 9, 4, 1 | 4 |
| 8 `paphos/apartments` | `paphos` | 7, 9, 4, 1, 2 | 2 |
| 9 `paphos/villas` | `paphos` | 7, 1, 10 | **3** |

Änderungen der Fix-Runde 1 (M16, M17, S5, S6):
- `limassol/investment-apartments` (17) ist aus 3 und 5 **entfernt**. Keyword-Map §4 Zeile 17 stellt die Seite ausdrücklich zurück („nur bauen, wenn Seite 6 nach 3 Monaten nicht dafür rankt"); auf eine bewusst zurückgestellte Seite zu verlinken ist auf Basis der Map falsch.
- `villas-cyprus` (10) und `property-tax-cyprus` (16) existieren inzwischen aus Task 6b und sind committet — der Seeder-Refuse aus `seed.mjs:648-651` ist damit aufgelöst.
- Der Preis-Cluster (4) hatte **einen** eingehenden Link und hat jetzt fünf (aus 1, 2, 5, 7, 8); `paphos/villas` (9) hatte einen und hat jetzt drei (aus 1, 7, 8).
- Seite 2 verwies in einer FAQ-Antwort auf „דף המחירים", verlinkte sie aber nirgends (M17) — behoben.
- Seite 3 ist ein Investment-Hub und zeigt jetzt auf beide Stadt-Hubs (S5).

Weiterhin bewusst: Seite 3 bekommt zusätzlich `real-estate-cyprus` (ein Hub ohne Rücklink auf den Cornerstone wäre ein Loch im Graphen); die Spokes 2, 6, 8, 9 bekommen neben Hub + Cornerstone thematisch passende Querlinks.

**CTA:** kein `buttonBlock`. `isLandingPage()` (`src/app/preview-landing/LandingBody.tsx:66`) verlangt, dass **jeder** Block der Landing-Familie angehört; ein `buttonBlock` würde die Seite auf den Classic-Renderer werfen und dort alle Landing-Blöcke stumm verlieren. Der CTA nach `/he/contacts` läuft deshalb über `landingIntroBlock.buttonLabel`, das `LandingBody` (Zeile 161–164) genau auf `${localizedHref(lang)}/contacts` verlinkt. CTA-Texte aus Glossar §5 / §4 (`לקבל שיחה מיועץ`, `לצפייה בזמינות ובמחירים`, `לקבלת ייעוץ השקעות`, `לקבל מחירון עדכני`).

---

## 3. `landingProjectsBlock` — Filter je Seite

| Seite | `filterCity` | `filterPropertyType` | `priceMax` |
|---|---|---|---:|
| 1 | — | Apartment | — (Fix-Runde 1: 600000 gestrichen) |
| 2 | — | Apartment | — |
| 3 | — | Apartment | — (Fix-Runde 1: 400000 gestrichen) |
| 4 | — | Apartment | — |
| 5 | Limassol | — | — |
| 6 | Limassol | Apartment | — |
| 7 | Paphos | — | — |
| 8 | Paphos | Apartment | — |
| 9 | Paphos | Villa | — |

**Warum die drei zypernweiten Seiten (1, 3, 4) einen Typfilter tragen:** `resolveBlocks` (`src/sanity/sanity.utils.ts:614`) startet die Live-Abfrage nur, wenn `filterCity`, `filterPropertyType`, `maxBeachMinutes` oder `filterStage` gesetzt ist. Ein Block ganz ohne Filter rendert die Leerzeile `projectsStrings.empty`. Eine manuelle `projects`-Liste scheidet aus: die EN-Referenzen referenzieren `project-<slug>.en`-Zeilen, für `he` gäbe es kein Pendant. `filterStage: "off-plan"` wurde verworfen — die Admin-Auswahl kennt nur `Available / Under Construction / Key-Ready / Sold`, ein Treffer hinge allein an Feed-Werten und könnte die Liste leeren. Damit bleibt der Typfilter die einzige belastbare zypernweite Abfrage.

**`priceMax` ist in Fix-Runde 1 auf 1 und 3 gestrichen** (M13). Die Zahl stand nur im Query-Feld und deckelte das Grid unsichtbar bei €600.000 bzw. €400.000 — auf dem Cornerstone, der für `נדל"ן בקפריסין` (alle Objekttypen) ranken soll, war das eine unsichtbare redaktionelle Grenze, die dem eigenen Text widersprach.

**Abweichung vom Controller-Ruling, bewusst und begründet:** Das Ruling verlangt für Seite 1 „kein Typfilter, kein Preisdeckel". Der Preisdeckel ist gestrichen; `filterPropertyType: "Apartment"` **bleibt**, weil `resolveBlocks` (`src/sanity/sanity.utils.ts:614`) die Live-Abfrage nur startet, wenn `filterCity || filterPropertyType || maxBeachMinutes != null || filterStage` gesetzt ist. Ein Block ganz ohne Filter rendert `projectsStrings.empty` — ein leeres Grid auf dem Cornerstone wäre schlechter als ein Teil-Inventar. Der Rewrite-Text aus M13 setzt genau diese Lösung voraus („die Liste auf dieser Seite zeigt die Wohnungen, die Häuser stehen auf der Villenseite") und die Cannibalization-Analyse lässt sie ausdrücklich zu („den Typfilter loswerden oder ihn im Text zugeben"). Der Absatz über dem Grid gibt ihn jetzt zu und verweist auf `paphos/villas`.

**Offen (§8):** Seite 2 und Seite 4 teilen sich weiterhin dieselbe Abfrage (Apartment, zypernweit, ungedeckelt).

---

## 4. Primär-Keywords und Zählung

**Korrektur der Fix-Runde 1 (Pass-B-Punkt 1):** Die frühere Zählung („4 Treffer auf jeder der neun Seiten") war zu niedrig. Sie nahm `previewImage.alt`, `contentBlocks[0].image.alt` und `contentBlocks[0].title` aus. `contentBlocks[0].title` **ist** die H1 (`LandingBody.tsx:161`), und die beiden Alts sind indexierbarer Text. Ehrlich gezählt lag der Pack vor der Fix-Runde bei **7** auf 1, 2, 3, 4, 7 und 8, bei 5 auf Seite 5 und bei 4 auf 6 und 9.

Zählskript jetzt: exakte Substring-Treffer über **alle** Strings der Datei (inkl. `title`, `excerpt`, beide `alt`-Felder, `seo.*`, alle Blocktitel, alle Portable-Text-Spans und alle FAQ-Q&A).

Ergebnis nach der Fix-Runde (Zielband 2–4):

| # | Seite | Primär-KW | vorher | jetzt |
|---|---|---|---:|---:|
| 1 | `real-estate-cyprus` | `נדל"ן בקפריסין` | 7 | **4** |
| 2 | `apartments-for-sale-cyprus` | `דירות למכירה בקפריסין` | 7 | **4** |
| 3 | `property-investment-cyprus` | `השקעות נדל"ן בקפריסין` | 7 | **4** |
| 4 | `property-prices-cyprus` | `מחירי דירות בקפריסין` | 7 | **4** |
| 5 | `limassol` | `דירות בלימסול` | 5 | **4** |
| 6 | `limassol/new-projects` | `פרויקטים בלימסול` | 4 | **4** |
| 7 | `paphos` | `נדל"ן בפאפוס` | 7 | **4** |
| 8 | `paphos/apartments` | `דירות למכירה בפאפוס` | 7 | **4** |
| 9 | `paphos/villas` | `וילות בפאפוס` | 4 | **3** |

Gesenkt wurde über drei Hebel (S1 und Keyword-Dichte): die **Alt-Texte tragen das Primär-KW nicht mehr** und beschreiben das Bild statt die H1, `previewImage.alt` und `contentBlocks[0].image.alt` sind auf allen neun Seiten **verschieden** (WCAG und §11.5), und je Seite ist eine Body- oder `excerpt`-Nennung auf eine Flexion umgestellt.

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
| Villen konzentrieren sich in **Peyia** und Umgebung; Coral Bay, Chlorakas und Polis als Standorte, nicht als Villen-Zentren | `inventory.json` — **korrigiert in Fix-Runde 1 (Pass-B-Punkt 4).** Belegt ist als Villencluster nur Peyia (11 Developments, `types` „Luxury Villas"); Coral Bay und Chlorakas haben je 1 Development. **Sea Caves und Kissonerga stehen in `inventory.json` überhaupt nicht** und sind auf allen Seiten gestrichen (M15). Das Glossar §1 ist eine Umschrift-Tabelle und **keine** Faktenquelle — genau an dieser Grenze sind die vier erfundenen Bestandsorte entstanden |
| Limassol: Türme, Gated Complexes, Vorstadthäuser; Villen dort eine kleine Minderheit | `inventory.json` (Typenliste Limassol), Keyword-Map §4.1 („Inventar 6 Villen") |
| Bauträgernamen Limassol: `Cybarco`, `Imperio Properties`, `Pafilia` | `developers.en.json` (alle drei nennen Limassol) |
| Bauträgernamen Paphos: `Aristo Developers`, `Leptos Estates`, `Pafilia`, `Korantina Homes` | `developers.en.json` |
| Kein Aufpreis für den Käufer | EN-Referenzseiten („no additional buyer's fee"), Glossar §2 `בלי תוספת מחיר לרוכש` |
| Kaufdauer: einfache Transaktion Wochen, mit Hypothek/Off-Plan länger | `src/app/preview-faq/faqData.ts` |
| Off-Plan mit bauabschnittsgebundenem Zahlungsplan | `scripts/faq-translations/en.json` („staged payment structures linked to construction progress") |
| Off-Plan-Preis **nicht zwangsläufig niedriger** als beim fertigen Objekt | `scripts/faq-translations/en.json` („Not necessarily … premium developments may already be positioned at higher price levels"). Der Pack hatte daraus dreimal eine Regel gemacht — korrigiert in Fix-Runde 1 (M1, M2, M3) |
| Bauträger-Zusagen **variieren zwischen Projekten** und stehen im Vertrag | `scripts/faq-translations/en.json` („Guarantees differ between projects and developers … The scope of protection varies and should be understood before purchase rather than assumed afterward"). Der Pack hatte daraus viermal ein Produktmerkmal gemacht — korrigiert in Fix-Runde 1 (M4, M5) |
| Transfer fees **nur in bestimmten Fällen** | `scripts/faq-translations/en.json` („This may apply in specific cases") — die Kostenliste auf Seite 4 stellte sie unbedingt, korrigiert (S16) |
| Unterschrift beim Anwalt, Eintragung beim `רשם המקרקעין`, `שטר בעלות (Title Deed)` | Glossar §2, Styleguide §7 (kein Notar) |
| Genehmigung der `מועצת השרים` in bestimmten Fällen für Nicht-EU-Käufer | Glossar §3 |
| Finanzierung auch für Nicht-Ansässige, Konditionen individuell | Glossar §3 (Kreditvergabe an Nicht-Ansässige) — qualitativ, ohne Quoten |
| Doppelbesteuerungsabkommen Israel–Zypern besteht | Glossar §3 `אמנת מס` — ohne Artikel, ohne Sätze |
| ROI-Rechner mit Szenarien שמרני / ריאלי / אופטימי — **auf der Projektseite**, nicht auf der Landingpage | Glossar §3.1 für die Terminologie; `ModalRoiCalculator` existiert nur in `src/app/[lang]/projects/[slug]/page.tsx:371`. `LandingBody` kennt sieben Blocktypen und keinen Rechner. Seite 3 hatte ihn mit `כאן` angekündigt — korrigiert in Fix-Runde 1 (M12) |
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

**Zwei Korrekturen an diesem Abschnitt (Pass-B-Punkte 2 und 3):**

- **Punkt 13 war unvollständig.** Nicht erfasst waren: `קיסונרגה`/`סי קייבס` als Bestandsorte (8 Nennungen auf 7, 8, 9), die beiden Marina-Aussagen auf 5 (Lage am Westende der Promenade, Preisniveau der Umgebung), die Pool-inklusive-Aussage und die Umbau-Zusage auf 9, die Mietnachfrage-Aussage auf 6, die Preisgradient- und Verkaufsgeschwindigkeits-Aussage auf 5 sowie die „Verkaufsevents"-Formulierung auf 6, die in ihrer abgeschwächten Form immer noch eine unbelegte Preisaussage über namentlich identifizierbare Wettbewerber war. Alle sind in Fix-Runde 1 gestrichen oder auf das reduziert, was die Quelle hergibt.
- **Punkt 2 hatte die richtige Diagnose, aber eine zu enge Suche.** Die Doubletten-Prüfung lief paarweise entlang Hub/Spoke statt über alle FAQ-Items des Packs. Zwischen 1/2/4, 1/5/7, 1/2 und 8/9 standen vier weitere Doubletten mit 0,70–1,00 Ähnlichkeit. Fix-Runde 1 prüft **alle 88 Fragen der 17 Pack-Seiten** normalisiert gegeneinander (Skript in §7); Ergebnis: 0 Duplikate.

Formales: keine `—`/`–`/`!`, keine typografischen Anführungszeichen, keine Schrägstrich-Genusformen, `הכל` statt `הכול`, `נדל"ן` durchgehend mit Gershayim, westliche Ziffern, kein `נוטריון`, kein `חברות בנייה`, keine §7-Floskel. Lateinische Bauträgernamen auf 5 und 7 stehen in FSI/PDI-Isolaten (§11.4).

---

## 7. Gates

Stand nach Fix-Runde 1:

| Gate | Ergebnis |
|---|---|
| `node scripts/qa/he-content-check.mjs --only content/he/singlepages` | `he-content: OK (19 files, 1269 strings)` (die 10 zusätzlichen Dateien gehören zu Task 5 und 6b) |
| `grep -c "—\|–\|!"` je Datei | 0 / 0 / 0 / 0 / 0 / 0 / 0 / 0 / 0 |
| Primär-Keyword-Zählung (alle Strings inkl. H1 und Alts) | 4 / 4 / 4 / 4 / 4 / 4 / 4 / 4 / 3 — alle im Zielband 2–4 (§4) |
| FAQ-Fragen, normalisiert über alle 17 Pack-Seiten (88 Items) | **0 Duplikate** |
| Ortsnamen gegen `inventory.json` (Glossar-§1-Umschriften als Mapping) | **0 unbekannte Orte**; `קיסונרגה` und `סי קייבס` kommen nicht mehr vor |
| `seo.metaTitle` Grapheme | 33–49 (Limit 60) |
| `seo.metaDescription` Grapheme | 129–147 (Limit 155, Zielband 120–155) |
| Blockfolge / Feldnamen / `_key`-Unikate je Datei | unverändert gültig, 45–48 Keys je Datei, 0 Duplikate |
| `npm test` | 298 pass / 0 fail |

**Zur Ortsnamen-Prüfung:** Basis sind die `town`- und `district`-Werte aus `inventory.json` (Paphos-Distrikt: Agios Theodoros, Ayia Marinouda, Chlorakas, Coral Bay, Geroskipou/Yeroskipou, Konia, Paphos, Peyia, Polis, Kouklia; dazu Limassol, Larnaca, Troodos). Drei Tokens stehen dort nicht als eigene Zeile und bleiben trotzdem stehen, weil sie Ortsteile bzw. Vororte belegter Orte sind und die Pass-B-Rewrites sie selbst tragen: `קאטו פאפוס` (Ortsteil von Paphos, M15-Rewrite), `גרמסוגיה` und `אגיוס טיכונאס` (Vororte von Limassol, M9-Rewrite). Sie sind im Prüfskript als solche deklariert, nicht stillschweigend übersprungen.

---

## 8. Offene Punkte für Pass C und den Controller

1. **Seiten 2 und 4 teilen dieselbe Projekt-Abfrage** (Apartment, zypernweit, ohne Preisdeckel). Inhaltlich sind es völlig verschiedene Seiten, aber die `middleware.ts`-Historie zeigt, dass identische Live-Queries in der Vergangenheit zu Merge-Kandidaten wurden. Wenn Larnaka-Bestand dazukommt oder `filterStage` verlässlich befüllt ist, sollte eine der beiden umgestellt werden.
2. **Cross-Half-Links** — erledigt. `villas-cyprus` und `property-tax-cyprus` existieren aus Task 6b und sind committet, `limassol/investment-apartments` ist aus 3 und 5 entfernt (Map §4 Zeile 17). Vor dem Seeden trotzdem einmal gegenprüfen, weil `he-content-check` `relatedLandingPages` nicht validiert und `seed.mjs:648-651` hart abbricht.
3. **Bauträgernamen** (`Cybarco`, `Imperio Properties`, `Pafilia`, `Aristo Developers`, `Leptos Estates`, `Korantina Homes`) stammen aus den EN-Profilen in `developers.en.json`, die die jeweilige Stadt erwähnen. Falls einer von ihnen dort aktuell nichts baut, gehört die Nennung gestrichen — der Controller kann das gegen den Feed prüfen.
4. **`allowIntroBlock`** steht auf den neun 6a-Seiten seit Fix-Runde 1 auf `false` — wie in den sechs EN-Referenzseiten. Für die Landing-Familie ist das Feld folgenlos (`LandingBody` liest es nicht); es zählt erst, wenn eine Seite je auf den Fallback-Renderer fiele, und dort würde `true` `PropertyIntro` plus Breadcrumbs doppelt zeigen. **Für 6b offen:** die acht Seiten aus Task 6b stehen noch auf `true`; das sollte angeglichen werden.
5. **Zwei Bild-Assets** für neun Seiten (`image-2ec5103e…` allgemein/Villen, `image-1e438cc9…` Wohnungen), beide aus den EN-Referenzseiten übernommen. Eigene Motive pro Stadt wären besser, sobald welche vorliegen.
6. **Sprachliche Endabnahme** durch die muttersprachliche Lektorin steht aus (Pass C, Entscheidung F). Besonderes Augenmerk: die Ortsnamen-Umschriften `כלורקה`, `גרוסקיפו`, `פייה`, `קאטו פאפוס`, die Formulierungen zu den Bauträger-Zusagen (`התחייבויות חוזיות של היזם לגבי העבודות שביצע`, bewusst nah an der Quelle und dadurch etwas juristisch) und der Satz `זו גם היקרה מבין שני המחוזות שאנחנו מלווים` auf Seite 5.
7. **Eine Frage steht noch zweimal im Pack, außerhalb dieser neun Dateien:** `האם ישראלים יכולים לקנות נכס בקפריסין?` stand auf 1 und auf `villas-cyprus` (6b). Da die Regel „eine Query, eine URL" auch über die Pack-Hälften gilt und 6b nicht in dieser Aufgabe editiert werden darf, hat **Seite 1 die Frage abgegeben** und trägt jetzt `מה נדרש מרוכש ישראלי כדי לקנות נכס בקפריסין?` mit derselben Antwort (Ministerrat, Anwalt, Grundbuch). Inhaltlich wäre der Cornerstone der bessere Ort für die Exaktform — wenn 6b die Frage dort streicht, sollte Seite 1 sie zurückbekommen.

---

## 9. Fix-Runde 1 — was aus der externen Kritik eingearbeitet wurde

Quelle: `.superpowers/sdd/2026-09-13-hebrew-phase5-content/task-6a-passB.md` (Grade C). **Alle 17 Must-fix- und alle 18 Should-fix-Zeilen sind angewendet**, dazu die Facts-Audit-Korrekturen, die SEO- und Cannibalization-Verdikte, die Rendering-Notiz zu `allowIntroBlock` und die vier Protokoll-Korrekturen (oben in §4, §5, §6, §7 eingearbeitet).

**Die drei strukturellen Defekte:**

1. **Quellenwidrige Aussagen (M1–M5).** `scripts/faq-translations/en.json` sagt zu Off-Plan-Preisen ausdrücklich „Not necessarily" und zu Bauträger-Zusagen „Guarantees differ … varies". Der Pack hatte daraus je eine Regel gemacht — dreimal beim Preis (4, 6 ×2, davon eine in `FAQPage`-JSON-LD) und viermal bei den Zusagen (2 ×2, 8, 9). Alle sieben Stellen tragen jetzt das Hedging der Quelle (`לא כלל`, `משתנה בין פרויקטים`, `במקרים שבהם`).
2. **FAQ-Doubletten (M6, M7, M8, S18).** `כמה עולה דירה בקפריסין?` stand wörtlich auf 1, 2 und 4 — Seite 4 behält sie, 1 und 2 haben eigene Fragen bekommen. `מה ההבדל בין לימסול לפאפוס?` stand auf 1 und 5, mit 0,87 Antwort-Ähnlichkeit und einer dritten Variante auf 7 — Seite 1 behält sie, 5 und 7 haben eigene bekommen. Die Provisionsfrage stand mit 0,98 Ähnlichkeit auf 1 und 2, die Vermietungs- und die Ministerratsfrage je zweimal. Ergebnis: 88 Fragen über 17 Seiten, 0 Duplikate.
3. **Kannibalisierung 5 gegen 6 (M14).** Seite 5 trug `פרויקטים חדשים` in H1, `metaTitle` **und** als Projekt-H2 — dreimal stärker platziert als auf Seite 6, die dafür gebaut ist. Seite 5 heißt jetzt `דירות בלימסול, מהמרינה ועד הפרברים`, `metaTitle` `דירות בלימסול | Cyprus VIP Estates`, Projekt-H2 `דירות בלימסול שזמינות עכשיו`. Die Trennung ist damit sauber: 5 = Stadt, Nachbarschaften, Wohnen; 6 = Projektvergleich und Investition.

**Weitere Gruppen:**

- **Erfundene Orte (M15).** `קיסונרגה` (6 ×) und `סי קייבס` (2 ×) auf 7, 8 und 9 gestrichen. Beide stehen nur im Glossar §1, das eine Umschrift-Tabelle ist. Belegter Villencluster ist Peyia.
- **Erfundene Produkt- und Marktaussagen (M10, S10, S11, S12, S13, S14).** Marina-Lage und -Preisniveau, Preisgradient und Verkaufsgeschwindigkeit in Limassol, „Pool ist im Preis inbegriffen und Standard", die Umbau-Zusage („vom zusätzlichen Bad bis zur Poolgröße"), die Mietnachfrage nach kleinen Wohnungen und die Preisaussage über Verkaufsevents von Wettbewerbern — alle ersetzt oder auf das reduziert, was Quelle bzw. Selbstaussage hergeben.
- **Leeres UI-Versprechen (M12).** Seite 3 kündigte den Renditerechner mit `כאן` an. Er existiert nur auf `projects/[slug]`; `LandingBody` kennt sieben Blocktypen und keinen Rechner. Der Text verweist jetzt auf die Projektseiten.
- **Superlativ gegen die Faktenbasis (S15).** „Limassol ist die teuerste Stadt Zyperns, am unteren wie am oberen Ende" stimmt am oberen Ende (`priceFromMax` 41,0 Mio. gegen 33,8 Mio.), am unteren nicht (Limassol `priceFromMin` 187.000 gegen Kouklia 430.000 und Polis 805.200). Auf 1, 4 und 5 auf den belegbaren Vergleich Limassol gegen Paphos zurückgenommen.
- **Wiederverwendete Bausteine (S1, S2, S3).** Der `איך מתחילים`-Schlussabsatz stand mit 0,73–0,87 Ähnlichkeit auf sechs Seiten — jede Seite hat jetzt einen eigenen Schluss mit eigener H2, aus dem, was diese Seite kann. Die Formel „Paphos günstiger als Limassol" stand ~15 × im Pack; auf 2, 5 und 8 ist sie auf je eine Nennung reduziert, Seite 4 behält alle. Die 18 Alt-Felder tragen keine H1-Umformulierung mehr.
- **Sprache (M9, M11, S7, S8, S9).** Selbstduplikat auf 5, Anakoluth auf 4, Kalke aus „translates into" auf 2, die gesprochene `מה ש… זה`-Konstruktion auf 3 und 4, „מוצר" für ein Haus auf 9, Kongruenzfehler `האחריות … הם` auf 8.
- **Hub-H2 (S4).** Die beiden H2 von Seite 7 waren die Exakt-Keywords der eigenen Spokes 8 und 9; sie heißen jetzt `למה מחפשים בית פרטי דווקא בפאפוס` und `הצד של הדירות במחוז`, und beide Hub-Absätze sind auf zwei Sätze plus Verweis auf den Spoke gekürzt.
- **Linkgraph (M16, M17, S5, S6)** und **Grid-Filter (M13)** — siehe §2 und §3.

**Bewusst nicht wörtlich umgesetzt:** ein Punkt, dokumentiert in §3 — der Typfilter auf Seite 1 bleibt, weil ein Block ohne jeden Filter ein leeres Grid rendert; der Preisdeckel ist gestrichen und der Text gibt die Beschränkung jetzt zu.

**Prüfskripte der Runde** (Keyword-Dichte, FAQ-Doubletten über alle 17 Seiten, Ortsnamen gegen `inventory.json`): Ergebnisse in §7.
