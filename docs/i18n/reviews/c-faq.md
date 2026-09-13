# Review-Protokoll `c-faq` — FAQ-Inhalte `he` (Phase 5a, Task 4)

**Stand:** 2026-09-13 · **Status:** Pass A + Pass B (inline) erledigt, Pass C (muttersprachlicher Lektor) offen · **Quelle:** `scripts/faq-translations/en.json`

## Dateien und Seiten

| Datei | Seite (`he`) | Umfang |
|---|---|---|
| `scripts/faq-translations/he.json` | `/he/faq` | 9 Kategorien (Label + Description), 60 Fragen, 205 Antwortabsätze, 382 geprüfte Strings |
| `scripts/seed-faq-translations.mjs` | — | `he` in die Sprachliste aufgenommen, Zwei-Schlüssel-Guard ergänzt |
| `src/app/preview-faq/[lang]/page.tsx` | alle Locales | JSON-LD `inLanguage` ergänzt |

Die 60 Q&A liegen nicht in `copy.ts` (das ist das Seiten-Chrome aus WP5), sondern im `faqPage`-SiteDocument. Damit ist das Ticket „`/he/faq` rendert 404" aus `wp5.md` „Offene Punkte" Nr. 1 inhaltlich abgearbeitet; sichtbar wird es erst nach dem Seed auf Staging.

**Struktur 1:1 gespiegelt:** gleiche Kategorie-Reihenfolge, gleiche `slug`s, gleiche Item-`id`s in gleicher Reihenfolge, gleiche Absatzzahl pro Antwort. Die Datei wird generativ aus `en.json` aufgebaut, sodass eine Drift strukturell ausgeschlossen ist; `buildForLang()` im Seeder prüft dasselbe noch einmal zur Laufzeit.

| Kategorie (`slug`) | Label `he` | Fragen |
|---|---|---|
| `foreigner` | רכישה על ידי זרים | 3 |
| `process` | תהליך הרכישה | 8 |
| `legal` | מסמכים וליווי משפטי | 3 |
| `costs` | עלויות, מסים ומע"מ | 10 |
| `investment` | השקעה ותשואה משכירות | 7 |
| `residency` | תושבות ורילוקיישן | 7 |
| `location` | איפה כדאי לקנות | 3 |
| `financing` | מימון ומשכנתאות | 9 |
| `offplan` | רכישה על הנייר ופרויקטים חדשים | 10 |

## Kein `"review": "pending"` in der Datei

Global Constraint „jede Content-Datei trägt `review`-Metadaten" ist hier **nicht umsetzbar**: `buildForLang()` in `scripts/seed-faq-translations.mjs` baut jede Zeile strikt aus `EN_CATEGORIES` neu auf und übernimmt nur `label`, `description`, `question`, `answer` — ein zusätzliches Feld würde stillschweigend verworfen (und `mirrorCheck` würde es als „extra key" melden). Der Review-Status steht deshalb hier im Protokoll und als Kommentar im Kopf des Seeders. **Pass C offen.**

## Terminologie (Glossar-Bindung)

| EN | HE | Quelle |
|---|---|---|
| lawyer | עורך דין | Glossar §2 |
| Land Registry | רשם המקרקעין | Glossar §2 |
| contract of sale / purchase contract | חוזה מכר | Glossar §2 |
| transfer fees | דמי העברה | Glossar §2 — **nicht** `מס העברה` (das wäre eine Steuer, die Quelle sagt „fees") |
| stamp duty | מס בולים | Glossar §2 |
| VAT | מע"מ | Glossar §2 |
| capital gains | מס רווחי הון / רווח הון | Glossar §2, §3.1 |
| off-plan | על הנייר | Glossar §2 |
| resale | יד שנייה | Glossar §2 |
| new development | פרויקט חדש | Glossar §2 |
| developer | יזם / יזמים | Glossar §2 (nie `חברות בנייה`, nie `קבלן`) |
| rental yield | תשואה משכירות | Glossar §2 |
| permanent residency | תושבות קבע | Glossar §3 |
| relocation | רילוקיישן | Glossar §3 |
| buyers | רוכשים | Glossar §3 |
| expats | תושבים זרים | Glossar §3 |
| cost of living | יוקר המחיה | Glossar §3 |
| visualisation / rendering | הדמיה | Glossar §2 |
| Paphos / Limassol | פאפוס / לימסול | Glossar §1 |

Neu vergeben, weil das Glossar den Term nicht führt (Vorschlag zur Aufnahme, siehe „Offene Fragen"):

| EN | HE | Begründung |
|---|---|---|
| reservation agreement | הסכם שמירת נכס | beschreibt die Funktion. **Bewusst nicht `זיכרון דברים`** — das ist in Israel ein eigenständig bindender Vorvertrag und würde die Rechtslage falsch darstellen |
| reservation deposit | דמי רצינות | Glossar §2 führt `דמי רצינות / פיקדון הרשמה`; hier durchgehend die erste Form |
| due diligence | בדיקת נאותות | israelischer Standardterm; im Prozess-Schritt einmal als Klammerglosse hinter `בדיקות משפטיות` |
| Council of Ministers | מועצת השרים | zyprisches Organ, keine amtliche hebräische Bezeichnung |
| power of attorney | ייפוי כוח | |
| down payment (Hypothek) | הון עצמי | israelischer Standardterm |
| occupancy | תפוסה | |
| immovable property tax (abgeschafft) | מס רכוש ארצי | nur in der Aussage „wurde abgeschafft", nie als laufende Kostenposition |
| municipal charges | אגרות עירוניות | |
| specifications | מפרט טכני | |

## Pass B (inline, Selbstkritik) — was korrigiert wurde

1. **Wurzel- und Floskelwiederholung** (§11.5): `בדרך כלל` stand 3× in einer Antwort (`can-foreigners-buy-property-in-cyprus`) und 2× in `how-does-the-property-buying-process-work-in-cyprus` → auf `בדרך כלל` / `לרוב` / `ברוב המקרים` verteilt; `לרוב` 2× in `which-city-in-cyprus-is-best-for-buying-property` → Schlusssatz auf `עדיף לשאול` umgestellt; `לעיתים` 2× in `why-do-investors-buy-off-plan-properties-in-cyprus` → `לא פעם`; `להניח … הנחות` in `what-guarantees-do-developers-usually-provide` → `לא להסתפק בהשערות בדיעבד`.
2. **`במידה ניכרת`** stand 7× (die Quelle sagt 7× „significantly"/„considerably"). Drei Stellen auf `מקטינים מאוד` / `מגדילה מאוד` / `לשנות מאוד` umgestellt, damit die Formel nicht zur Masche wird.
3. **`את`-Ketten** in Aufzählungsabsätzen (fünf Akkusativpartikel hintereinander lesen sich wie ein Formular): in `are-fixed-rate-mortgages-available`, `should-buyers-pay-in-euros-or-transfer-from-another-currency`, `are-off-plan-properties-cheaper-than-completed-homes` und `can-buying-property-help-obtain-residency-in-cyprus` auf ein einleitendes `את` reduziert; umgekehrt in `what-happens-if-construction-is-delayed` die `מה…`-Kette (`מהו … מהם … מהן …`) zu einer `את`-Reihe geglättet.
4. **Glossar-Nuance `צפייה` vs. `סיור`** (§2): Die Fernbesichtigung heißt jetzt `צפייה מקוונת בנכס או סיור וידאו`. Das Glossar warnt vor `צפייה בנכס` als Ersatz für die Vor-Ort-Besichtigung — hier ist das Anschauen am Bildschirm *genau* gemeint, die Warnung greift also nicht. `סרטוני וידאו` (Pass A) war zu wörtlich.
5. **Fehlendes Subjekt** in `does-buying-property-automatically-grant-permanent-residency` (`ייתכן שיידרשו…` ohne Bezug) → `ייתכן שהמבקשים יידרשו…`.
6. **`הכול`-Gate-Treffer:** Die Regel `hakol-spelling` prüft ohne Wortgrenze und schlägt deshalb auch bei `הכולל`/`הכוללת` an (6 Treffer). Alle sechs Stellen sind sachlich umformuliert (`סך עלות הרכישה`, `תקציב הרכישה כולו`, `סך הערך לטווח ארוך`), nicht nur umgangen — die Kurzformen lesen sich ohnehin besser.
7. **§7-Verbotsliste** geprüft: keine Werbeverben (`גלו`, `שחררו`), keine Adjektivstapel, keine Doppelpunkt-Überschriften, kein `בין אם … ובין אם`, keine `אל תהססו`-Höflichkeit, keine Ausrufezeichen. `grep -c "—\|–\|!"` = 0.
8. **Genus:** durchgehend unpersönlich/nominal (`כדאי ל…`, `יש ל…`, `אפשר ל…`) oder Partizip Plural (`רוכשים בוחנים`, `הבנקים בודקים`). Zweite Person nur als männlicher Plural in zwei Kategorie-Descriptions (`עבורכם`, `שלכם`). Keine Schrägstrichformen.

## Abweichungen von der englischen Vorlage

1. **Aufzählungsabsätze bekommen Kommas.** Die Quelle setzt Listen ohne Trennzeichen in einen Fließabsatz (`Online property viewings or video tours Digital communication with agents and lawyers Contract reviews via email …`); `FaqExplorer.tsx:197` rendert jeden Absatz als ein `<p>`. Im Lateinischen tragen die Großbuchstaben die Gliederung, **Hebräisch hat keine Majuskeln** — die wörtliche Übernahme ergäbe eine unlesbare Wortkette. Alle 30 solchen Absätze sind deshalb mit Komma gegliedert und mit `ו`+Punkt geschlossen. Absatzzahl und Inhalt unverändert. `de.json`/`ru.json` haben die Kette übernommen; das ist dort ein anderer, milderer Fall. **Folgeaufgabe (optional):** der Renderer könnte diese Absätze künftig als `<ul>` ausgeben, dann fällt die Sonderbehandlung weg.
2. **`Step 1: …` → `שלב 1, …`.** Doppelpunkt-Titel sind nach Styleguide §3 unzulässig; die Ziffer bleibt westlich, die Schrittzahl (6) unverändert.
3. **`Which city is best?` / `new is always better`** — die Quelle setzt geschweifte Anführungszeichen, die `he`-Fassung gerade doppelte (§4). Das Fragezeichen innerhalb des Zitats entfällt in `עדיף לשאול לא "איזו עיר הכי טובה" אלא …`, weil der hebräische Satz keine Frage ist.
4. **Notartermin: keine Fundstelle.** Die für WP5 dokumentierte Abweichung („EN spricht vom Notartermin, Zypern kennt keinen") betrifft `preview-about/copy.ts`, **nicht** diese Quelle: `en.json` enthält weder „notary" noch „notarial". Die zyprische Realität ist trotzdem ausdrücklich abgebildet — Unterzeichnung und Prüfung laufen überall über `עורך דין`, die Hinterlegung über `רשם המקרקעין` (`can-foreigners-buy-property-in-cyprus` Abs. 3, `how-does-the-property-buying-process-work-in-cyprus` Abs. 2, gesamte Kategorie `legal`). Die Gate-Regel `notary` (`נוטריון`) schlägt nicht an.
5. **Keine Zahlen ergänzt.** Die Quelle nennt in 60 Antworten keinen einzigen Steuersatz, keine Frist, keinen Schwellenwert und keine Rendite — die hebräische Fassung ebenso wenig. Insbesondere steht **kein** `5%`-Satz beim reduzierten Mehrwertsteuersatz, obwohl Glossar §2 die Formulierung kennt: die Quelle sagt nur „reduced rates may apply". Ebenso keine Aussage zu Mindestinvestitionen bei der Aufenthaltsgenehmigung.
6. **Keine Weichzeichnung von Rechtsaussagen.** Wo die Quelle hart formuliert, tut es die Übersetzung auch: `לא. רכישת נכס אינה מקנה מעמד של תושבות קבע באופן אוטומטי.`, `רכישה בלי בדיקות משפטיות מעלה את הסיכון במידה ניכרת.`, `אין לוותר על בדיקת נאותות.` Umgekehrt sind die Hedges der Quelle („may", „often", „typically") erhalten und nicht zu Zusicherungen verdichtet.
7. **`Cyprus VIP Estates` kommt nicht vor** — die Quelle nennt die Marke in keiner Antwort, es gibt also keine lateinische Interpolation und keinen Bidi-Fall in dieser Datei. Ebenso keine Preise, keine Telefonnummern, keine URLs, keine Links.

## JSON-LD `inLanguage`

`src/app/preview-faq/[lang]/page.tsx` erzeugte bisher `FAQPage` ohne Sprachangabe. Ergänzt: `inLanguage: isLocale(lang) ? BCP47[lang] : BCP47.en`. **Das Feld erscheint jetzt in allen Locales** (`en-GB`, `de-DE`, `pl-PL`, `ru-RU`, `he-IL`) — laut Plan akzeptabel und hiermit dokumentiert. Kein Copy-Modul betroffen, `copy-snapshot` unverändert.

## Seeder

`scripts/seed-faq-translations.mjs`:

- Sprachliste ist jetzt `["en","de","pl","ru","he"]` (Konstante `LANGUAGES`).
- Zwei-Schlüssel-Guard wie `scripts/he-content/seed.mjs`: **Dry Run ist der Default** und konstruiert keinen `PrismaClient`; ein echter Lauf braucht `CVP_CONFIRM_CONTENT_SEED=yes` **und** `--yes`. `--yes` ohne die Umgebungsvariable ist ein Fehler (Exit 1), kein stiller Rückfall auf Dry Run.
- Der Dry Run baut alle fünf Sprachen und ist damit zugleich der Strukturcheck (`buildForLang()` wirft bei fehlender Kategorie/Item und bei Absatz-Drift).

Geprüft (ohne DB-Zugriff): `node scripts/seed-faq-translations.mjs` → 5× `faqPage-<lang>: upsert — 9 categories, 60 questions`, Exit 0; `node scripts/seed-faq-translations.mjs --yes` ohne Env → Exit 1.

## Gates

| Gate | Ergebnis |
|---|---|
| `node scripts/qa/he-content-check.mjs --only scripts/faq-translations/he.json` | **60 Verstöße, alle vom selben Checker-Bug** — siehe unten. Keine echten Findings. |
| Ersatz-Gate (`mirrorCheck` + `styleCheck` mit `id` als Strukturfeld) | `faq he: OK (382 strings, 9 categories, 60 items)` |
| `node -e` Strukturvergleich (Kategorien/Items/Absatzzahlen) | identisch zu `en.json` |
| `npx tsc --noEmit -p tsconfig.json` | sauber |
| `npm test` | 258/258 grün |
| `grep -c "—\|–\|!" scripts/faq-translations/he.json` | 0 |

### Blocker: `mirrorCheck` behandelt `id` als Prosa

`scripts/he-content/lib.mjs` führt `IDENTICAL_KEYS = ["_key","_ref","_type","url","slug","href","marks","style","listItem","level"]` — **`id` fehlt**. Für jedes der 60 FAQ-Items meldet das Gate deshalb:

```
[0].items[0].id: en has letters but he has no Hebrew script (he="can-foreigners-buy-property-in-cyprus")
```

Das ist genau umgekehrt zur Anforderung: die `id` **muss** lateinisch und byte-identisch bleiben, sonst findet der Seeder die Übersetzung nicht. Fix ist eine Zeile — `id` in `IDENTICAL_KEYS` **und** in `NON_TEXT_KEYS` derselben Datei aufnehmen. Task 4 durfte `lib.mjs` nicht anfassen (Task 7 arbeitet parallel an derselben Datei), deshalb liegt die Änderung beim Controller. **Solange sie fehlt, schlägt auch der Gesamtlauf in Task 9 Schritt 3 fehl.** Nach dem Fix bleiben laut Ersatz-Gate 0 Verstöße.

## Offene Fragen für Pass C

1. **`רכישה על ידי זרים` als Kategorie-Label.** Sachlich richtig (aus zyprischer Sicht ist der israelische Käufer Ausländer), aber der Leser bezeichnet sich selbst ungern als „Fremden". Alternative: `רכישה כתושב חוץ` oder `רוכשים מחו"ל`. Die Fragen innerhalb der Kategorie sprechen bereits von `רוכשים מחו"ל`.
2. **`הסכם שמירת נכס`** für „reservation agreement". Es gibt keinen etablierten israelischen Term für die zyprische Reservierung; `זיכרון דברים` ist bewusst ausgeschlossen (bindender Vorvertrag nach israelischem Recht). Falls der Lektor eine Kanzleiformulierung kennt, gehört sie ins Glossar §2 und dann an alle sieben Fundstellen.
3. **`דמי רצינות` vs. `פיקדון הרשמה`.** Glossar §2 lässt beides zu; hier durchgehend `דמי רצינות`. Bestätigen oder vereinheitlichen.
4. **`הון עצמי` für „deposit" und „down payment".** Die Quelle unterscheidet: `how-much-deposit-is-required-when-buying-property` meint alle Vorauszahlungen (deshalb `כמה צריך לשלם מראש`), `what-down-payment-is-typically-required-for-mortgages` nur den Eigenkapitalanteil (deshalb `הון עצמי`). Trennung bestätigen.
5. **`מס רכוש ארצי`** für die abgeschaffte „immovable property tax". Glossar §2 sagt „nicht erwähnen" — die Quelle erwähnt sie aber ausdrücklich als *abgeschafft*, was für den israelischen Leser eine relevante Entwarnung ist. Beibehalten oder streichen?
6. **`גמלאים`** für „retirees" (3 Fundstellen). Alternative `פנסיונרים`. Glossar führt keinen der beiden.
7. **Kommagliederung der Listenabsätze** (Abweichung 1). Falls der Lektor die Absätze lieber als echte Listen sähe, ist das eine Renderer-Änderung und keine Textänderung — bitte im Protokoll vermerken, nicht in der Datei.
8. **Register der Kategorie-Descriptions.** Zwei von neun sprechen den Leser direkt an (`עבורכם`, `שלכם`), sieben sind nominal. Das folgt der Quelle („what a lawyer checks for you", „your goals"). Vereinheitlichen oder so lassen?
