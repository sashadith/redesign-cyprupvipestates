# c-landing-b — Landingpages 10–17 (Phase 5, Task 6b)

**Stand:** 2026-09-13 · **Pass A + Fix-Runde 1** · Review-Status aller acht Dateien: `"review": "pending"` (Pass C offen, Entscheidung des Controllers vom 2026-09-13).

Pass B ist **nicht** Teil dieser Datei. Er liegt als eigenes Protokoll unter `.superpowers/sdd/2026-09-13-hebrew-phase5-content/task-6b-passB.md` (22 Must-fix, 23 Should-fix, Note C−, eigener Prompt, read-only). Dieses Dokument hält Pass A fest und dokumentiert darunter, was Fix-Runde 1 daraus angewandt hat und was offen bleibt. Die zwölf in Pass B aufgelisteten Fehler des ursprünglichen Faktenaudits (A1–A12) sind unten in den Tabellen korrigiert, nicht nur kommentiert.

Alle acht Seiten sind **frisch auf Hebräisch verfasst** — es gibt keine EN-Quelle unter `content/he/source/singlepages/`, `mirrorCheck` entfällt entsprechend (der Gate meldet das als Notiz). Blockstruktur, Feldnamen und Portable-Text-Form sind ein exaktes Abbild der sechs EN-Referenzseiten (`content/he/source/reference/*.en.json`) und der neun 6a-Dateien: `landingIntroBlock` → `landingTextStart` → `landingProjectsBlock` → `landingTextFirst` → `landingFaqBlock` → `landingTextSecond`.

Der CTA nach `/he/contacts` ist wie in 6a der `buttonLabel` des `landingIntroBlock` — `LandingBody.tsx:162` rendert ihn als `<a href="{lang}/contacts">`. Seit Fix-Runde 1 tragen **alle acht** Seiten dasselbe ehrliche Label `לקבל שיחה מיועץ` (Pass B S9); `לצפייה בזמינות ובמחירים` versprach Verfügbarkeit und Preise, führte aber ins Kontaktformular.

`previewImage`/Intro-Bild sind von einer Referenzseite gleichen Typs übernommen: `image-2ec5103e…` (Villen/Häuser/allgemein) für die Seiten 10–16, `image-1e438cc9…` (Wohnungen) für Seite 17. **Alt-Texte seit Fix-Runde 1 (M19):** ein Alt pro Asset, das Bild beschreibend (`וילה חדשה עם בריכה פרטית וגינה במחוז פאפוס` bzw. `סלון בדירה חדשה בפרויקט בלימסול`), nie eine Kopie der H1. `contentBlocks[0].image.alt` steht bewusst leer, weil `LandingBody.tsx:152` das Hero-Bild hartcodiert als `alt=""` in einem `aria-hidden`-Container rendert — der Wert erreicht nie einen Leser oder Crawler. Nur `previewImage.alt` (Karten/OG) wird ausgeliefert.

## Die acht Seiten

| # | Slug | H1 (HE) | Primär-KW (Vol.) | Vorkommen (alle Felder) | Meta T/D |
|---|---|---|---|---:|---|
| 10 | `villas-cyprus` | וילות למכירה בקפריסין, בתים פרטיים עם בריכה במחוז פאפוס | וילות בקפריסין (320) | 4 | 42 / 124 |
| 11 | `seafront-villas-cyprus` | וילות למכירה על הים בקפריסין | וילה בקפריסין על הים (110/20) | 2 | 49 / 135 |
| 12 | `houses-for-sale-cyprus` | בתים למכירה בקפריסין היוונית | בתים למכירה בקפריסין (70) | 4 | 49 / 136 |
| 13 | `buying-property-in-cyprus` | איך קונים דירה בקפריסין, המדריך לרוכשים מישראל | קניית דירה בקפריסין (40) | 3 | 40 / 141 |
| 14 | `relocation-cyprus` | רילוקיישן לקפריסין לישראלים ודירות למגורים | רילוקיישן לקפריסין (170) | 4 | 39 / 121 |
| 15 | `permanent-residency-cyprus` | תושבות קבע בקפריסין דרך רכישת נכס | תושבות בקפריסין (30) | 3 | 40 / 127 |
| 16 | `property-tax-cyprus` | מיסים על נדל"ן בקפריסין לרוכשים מישראל | מיסוי נדל"ן בקפריסין (20) | 3 | 60 / 121 |
| 17 | `limassol/investment-apartments` | דירה להשקעה בלימסול, מה קובע את התשואה | דירה להשקעה בלימסול (30) | 4 | 40 / 127 |

„Vorkommen" zählt seit Fix-Runde 1 **jedes** Feld der Datei, Alt-Texte und H1 eingeschlossen (Pass B A5: die alte Zählung ließ Struktur-Felder weg und meldete deshalb zu niedrige Zahlen). Zielkorridor 2–4 → alle acht innerhalb, nachgewiesen mit Skript (1) im Fix-Report. Meta-Titel 39–60 Graphem (≤ 60), Meta-Description 121–141 (Styleguide §6: 120–155). Seite 16 trägt seit S5 `אמנת המס עם ישראל` im Titel und schöpft die 60 Graphem aus.

H1 10 und 17 waren das rohe Keyword (§6, Pass B S7) und tragen jetzt die Suchintention.

## Projektblock-Filter

| Seite | `filterCity` | `filterPropertyType` | weitere | H2 des Blocks |
|---|---|---|---|---|
| 10 `villas-cyprus` | — | `Villa` | — | וילות בקפריסין בפרויקטים חדשים |
| 11 `seafront-villas-cyprus` | `Paphos` | `Villa` | `maxBeachMinutes: 10` | בתים פרטיים במרחק דקות מהים במחוז פאפוס |
| 12 `houses-for-sale-cyprus` | — | `Villa` | — | בתים בפרויקטים חדשים בדרום קפריסין |
| 13 `buying-property-in-cyprus` | — | `Apartment` | — | דירות חדשות שהתהליך הזה חל עליהן |
| 14 `relocation-cyprus` | `Limassol` | — | — | דירות למגורים בלימסול |
| 15 `permanent-residency-cyprus` | — | `Apartment` | — | דירות שנבחנות לעיתים בהקשר של מסלולי תושבות |
| 16 `property-tax-cyprus` | — | `Apartment` | — | דירות בפרויקטים חדשים שהמע"מ רלוונטי להן |
| 17 `limassol/investment-apartments` | `Limassol` | `Apartment` | `filterStage: "off-plan"` | דירות בלימסול שנמכרות בשלב הבנייה |

Grundlage `content/he/source/inventory.json`: Villen-Neubau liegt fast vollständig im Bezirk Paphos (`Luxury Villas` in Peyia, `Villas`/`Houses` in der Stadt Paphos, je ein Development in Coral Bay und Chlorakas), Limassol-Neubau ist überwiegend Apartment, führt daneben aber `Suburban houses` und `Mansions overlooking the sea`. **Larnaka steht mit 3 publizierten Developments in der Datei** (Pass B A11) — die Seiten behaupten deshalb nicht mehr „wir arbeiten dort nicht", sondern sagen, worauf sich das Angebot konzentriert (Paphos, Limassol) und dass Larnaka auf Anfrage zeigbar ist. Nordzypern bleibt ausgeschlossen.

**M20/Cannibalization:** die drei früher byte-identischen Projektblock-H2 sind aufgelöst; jede der 17 URLs trägt jetzt eine eigene (Skript (6)). Zwei echte Query-Überschneidungen bleiben und sind Controller-Sache, weil sie 6a-Dateien berühren: `Villa` ohne Stadt auf 10 und 12 (nach dem `middleware.ts`-Präzedenzfall zulässig, weil `בתים` und `וילות` getrennte Suchvokabulare sind) und `Limassol`+`Apartment` auf 17 gegen `limassol/new-projects`. Letztere ist auf 17er Seite durch `filterStage: "off-plan"` und eine eigene H2 entzerrt; die H2 `דירה להשקעה בלימסול` auf `limassol/new-projects` (6a) zielt weiterhin auf das Primär-KW von 17 und muss dort entfernt werden.

## Link-Graph

| Seite | `relatedLandingPages` | Inline-Links (markDef, alle live) |
|---|---|---|
| 10 | `paphos/villas`, `seafront-villas-cyprus`, `houses-for-sale-cyprus`, `real-estate-cyprus` | `/he/property-investment-cyprus`, `/he/property-prices-cyprus`, `/he/paphos/villas`, `/he/seafront-villas-cyprus`, `/he/real-estate-cyprus` |
| 11 | `villas-cyprus`, `paphos/villas`, `houses-for-sale-cyprus` | `/he/property-prices-cyprus` |
| 12 | `villas-cyprus`, `real-estate-cyprus`, `seafront-villas-cyprus`, `buying-property-in-cyprus` | `/he/property-prices-cyprus`, 2× `/he/buying-property-in-cyprus` |
| 13 | `real-estate-cyprus`, `permanent-residency-cyprus`, `property-tax-cyprus`, `relocation-cyprus` | `/he/faq`, `/he/property-tax-cyprus`, `/he/contacts` |
| 14 | `buying-property-in-cyprus`, `permanent-residency-cyprus`, `limassol`, `property-tax-cyprus`, `houses-for-sale-cyprus` | `/he/permanent-residency-cyprus` |
| 15 | `buying-property-in-cyprus`, `property-tax-cyprus`, `property-investment-cyprus`, `relocation-cyprus` | `/he/relocation-cyprus`, `/he/buying-property-in-cyprus` |
| 16 | `buying-property-in-cyprus`, `permanent-residency-cyprus`, `property-investment-cyprus` | `/he/buying-property-in-cyprus` |
| 17 | `limassol`, `limassol/new-projects`, `property-investment-cyprus` | `/he/property-prices-cyprus`, `/he/buying-property-in-cyprus`, `/he/property-tax-cyprus` |

**Pass B A8 korrigiert:** die vier Inline-Links des Ausgangsstands waren entgegen Pass B **nicht** tot — in Commit `167dcd4` referenziert jeder markDef bereits einen Span (`git show 167dcd4:…` nachgeprüft, Beleg im Fix-Report). Der Befund M1–M4 ist damit gegenstandslos; das Gate prüft die Eigenschaft seit `ac14236` (`orphanMarkDefs`) ohnehin maschinell und meldet für alle 19 Links im Pack null Waisen.

`/he/faq` und `/he/contacts` sind Code-Routen, keine Pack-Slugs; sie können nur als Inline-Link im Portable Text stehen. `linkCheck` lässt beide über `CODE_ROUTES` zu.

Gegenrichtung: `relocation-cyprus` war im 17-Seiten-Korpus verwaist (Pass B S1) und bekommt jetzt eingehende Links aus 13 und 15; 11 und 12 haben je ≥ 2 eingehende Links (10 plus einander, 12 zusätzlich aus 14). **Offen für einen 6a-Lauf** (Dateien außerhalb dieses Auftrags): `real-estate-cyprus` und `property-investment-cyprus` → `buying-property-in-cyprus` (S3), `paphos/villas` → `seafront-villas-cyprus` und `real-estate-cyprus` → `houses-for-sale-cyprus` (S2).

## Faktenaudit

`faq:<id>` = Item-`id` in `scripts/faq-translations/he.json`/`en.json`; `inventory` = `content/he/source/inventory.json`. **Regel seit Fix-Runde 1 (Pass B A1–A3, Systemik #3):** Sachverhalte tragen ausschließlich `faq:<id>` oder `inventory` als Quelle. `gloss §n` ist eine Formulierungs-, keine Tatsachenquelle und steht deshalb in keiner Zeile mehr allein.

### 13 `buying-property-in-cyprus`

| Aussage | Quelle |
|---|---|
| Sechs Schritte (Auswahl → Reservierung → Due Diligence → Vertrag → Hinterlegung → Zahlungen/Übertragung), als nummerierte Liste | `faq:how-does-the-property-buying-process-work-in-cyprus` |
| „**אפשר** לחתום על הסכם שמירת נכס" / „החוזה מופקד **בדרך כלל** אצל רשם המקרקעין" | dieselbe — beide Hedges der Quelle („may be signed", „typically lodged") sind seit M9 wiederhergestellt |
| Ablauf unterscheidet sich Resale ↔ Neubau; Dauer variiert | `faq:how-long-does-buying-property-in-cyprus-take` |
| Unabhängige anwaltliche Vertretung; Prüfliste des Anwalts | `faq:do-i-need-a-lawyer-when-buying-property-in-cyprus`, `faq:what-does-a-lawyer-check-during-the-purchase-process` |
| ~~Unterschrift erfolgt beim Anwalt~~ | **gestrichen** (Pass B A2/M10): keine erlaubte Quelle sagt, wo unterschrieben wird |
| Dokumentenliste, als Bullet-Liste | `faq:what-documents-are-required-to-buy-property-in-cyprus` |
| Nebenkosten, als Bullet-Liste, jeder Posten mit dem Hedge der Quelle | `faq:what-additional-costs-should-i-expect-besides-the-property-p` |
| Typische Fehler ausländischer Käufer | `faq:what-mistakes-do-foreign-buyers-make-when-purchasing-propert` |
| Reservierungsvereinbarung, Rückzahlbarkeit | `faq:what-is-a-reservation-agreement`, `faq:is-a-reservation-deposit-refundable` |
| Fernkauf, Besuch nicht zwingend | `faq:can-i-buy-property-in-cyprus-remotely`, `faq:is-visiting-cyprus-necessary-before-purchase` |
| Nach der Unterschrift „אפשר להפקיד את החוזה אצל רשם המקרקעין" | `faq:what-happens-after-signing-the-contract`; Wortlaut seit S22 pack-weit vereinheitlicht |
| Hypothek für Ausländer | `faq:can-foreigners-get-a-mortgage-in-cyprus`, `faq:can-buyers-obtain-mortgages-without-cyprus-residency` |
| Rechtsvorbehalt in der Glossar-Fassung `המידע אינו מהווה…` (M18) | Glossar §5, Formulierung |

### 14 `relocation-cyprus`

| Aussage | Quelle |
|---|---|
| „כ-45 דקות טיסה מתל אביב" — die **einzige Zahl** im ganzen Pack (Pass B A4 korrigiert die frühere Behauptung „keine einzige Zahl") | Glossar §5, Standardformulierung |
| Aufenthaltswege variieren und ändern sich; Umzugsgründe | `faq:what-residency-options-exist-for-foreigners-moving-to-cyprus` |
| Familien-/Ruheständler-Prüfpunkte | `faq:can-families-relocate-permanently-to-cyprus`, `faq:can-retirees-relocate-permanently-to-cyprus` |
| Keine „beste Stadt" | `faq:which-city-in-cyprus-is-best-for-buying-property` |
| Israelische Gemeinschaft und höchstes Preisniveau in Limassol | abgeleitet aus 6a (`real-estate-cyprus`, `limassol`), konsistent gehalten |
| ~~„שירותים באנגלית וברוסית" in Limassol~~ | **gestrichen** (S20): keine Quelle |
| Paphos ruhiger, niedrigere Einstiegspreise, meistes Neubauangebot an Häusern | `inventory` (Paphos 138 vs. Limassol 51) |
| ~~„בלרנקה … איננו עובדים"~~ | **ersetzt** (M6): `המבחר שלנו מתמקד בלימסול ובפאפוס. בצפון האי איננו עובדים.` |
| Beratungssprache Englisch/Russisch | Entscheidung E, Glossar §5, wörtlich |

### 15 `permanent-residency-cyprus`

Alle Sachaussagen quellengedeckt mit erhaltenen Hedges (`יכולה לפעמים לתמוך`, `בדרך כלל חלים תנאים נפרדים`, `ייתכן שהמבקשים יידרשו`, `הכללים משתנים עם הזמן`) aus `faq:does-buying-property-automatically-grant-permanent-residency`, `faq:can-buying-property-help-obtain-residency-in-cyprus`, `faq:what-residency-options-exist-…`, `faq:what-documents-are-required-…`. Keine Schwelle, kein Programmname, keine Frist.

Fix-Runde 1 (M14): Die FAQ war eine Zweitfassung des Fließtexts. `items[0]` ist auf einen Satz gekürzt, `items[1]` durch die auf der Seite unbeantwortete Frage `כמה זמן לוקח הטיפול בבקשה?` mit der ehrlichen Antwort „איננו יודעים לומר, וזה משתנה" ersetzt, `items[2]` heißt jetzt `מה סף ההשקעה לצורכי תושבות?` (vorher gegen `property-investment-cyprus` verwechselbar), `items[4]` verweist auf die Dokumentenliste von 13 statt sie zu wiederholen. Der Rechtsvorbehalt steht nicht mehr im Hero-Lead, sondern am Textende (S10).

Die Zeile „Zypern vergibt keine Staatsbürgerschaft gegen Investment" stützt sich weiterhin allein auf Glossar §3 — es ist die einzige Sachaussage des Packs ohne `faq:`/`inventory`-Beleg. Sie bleibt, weil sie ausschließlich etwas **ausschließt**, und ist hier als solche markiert.

### 16 `property-tax-cyprus`

| Aussage | Quelle |
|---|---|
| Posten und ihre Abhängigkeit von Transaktionsart/Neubau vs. Resale | `faq:what-taxes-do-property-buyers-pay-in-cyprus` — steht seit M13 **einmal** im Fließtext statt dreimal auf der Seite |
| MwSt. Neubau/Resale, ermäßigte MwSt. für den Hauptwohnsitz, wechselnde Bedingungen | `faq:is-vat-included-when-buying-property-in-cyprus`, `faq:can-reduced-vat-apply-when-buying-property`, `faq:what-vat-rates-apply-to-property-purchases-in-cyprus` |
| Stempelsteuer als staatliche Gebühr nach Objektwert | `faq:what-additional-costs-should-i-expect-besides-the-property-p` |
| Übertragungsgebühren und ihre Abhängigkeit von der früheren MwSt.-Behandlung | `faq:what-are-transfer-fees-when-buying-property` |
| `דמי העברה` ≠ `עמלות ההעברה` | Glossar §2, Terminologie |
| Vokabelbrücke `מס רכישה` → Stempelsteuer + Übertragungsgebühren, `מס שבח` → Kapitalertragsteuer, ausdrücklich **keine** Gleichsetzung der Berechnung (S6) | `faq:what-are-transfer-fees-…` + `faq:what-taxes-do-property-buyers-pay-…`; die israelischen Begriffe sind Suchvokabular, keine Sachaussage |
| Kapitalertragsteuer nur beim Verkauf | `faq:what-taxes-do-property-buyers-pay-in-cyprus` |
| Nationale Grundsteuer abgeschafft, kommunale Abgaben möglich | `faq:are-annual-property-taxes-payable-in-cyprus` — **kollidiert mit Glossar §2** (`immovable property tax → nicht erwähnen`); die Seite folgt der FAQ, die Glossarzeile gehört korrigiert |
| Resale ≠ Neubau in der Besteuerung | `faq:are-resale-properties-taxed-differently-from-new-development` |
| Nur-Kaufpreis-Betrachtung erzeugt unrealistische Erwartung | `faq:how-much-extra-money-should-buyers-budget-beyond-the-propert` |
| Existenz eines Doppelbesteuerungsabkommens Israel–Zypern | **Fix-Runde 2 (Task 6b review, Important):** Pass A behauptete noch die Existenz der Abmachung („קיימת אמנת מס בין ישראל לקפריסין"); das war durch keine FAQ gedeckt (`scripts/faq-translations/en.json` enthält kein Wort „treaty"). Seite nun umformuliert auf **keine Existenzaussage in beide Richtungen**: H2 als Suchfrage (`האם יש אמנת מס בין ישראל לקפריסין?`), Fließtext sagt nur, dass Status und persönliche Auswirkung vor dem Kauf mit einem Steuerberater zu klären sind, unter Wiederverwendung des Beraterhinweises aus `faq:what-taxes-do-property-buyers-pay-in-cyprus` (derselbe Satz, der in dieser Tabelle oben bei „Posten und ihre Abhängigkeit …" bereits als Quelle steht) |
| Keine Sätze, keine Schwellen, keine Rechenbeispiele | ausdrücklich gesagt |

### 10, 11, 12, 17 (Pass B A10 und A12: eigene Zeilen statt Sammeltabelle)

| Seite | Aussage | Befund |
|---|---|---|
| 10 | Villa = eigenes Grundstück, Pool, Garten, keine Gemeinschaftskosten, Instandhaltung beim Eigentümer | Produktbeschreibung, keine Bestandsbehauptung |
| 10 | Neubau-Villen konzentriert in Paphos, „בפייה ובסביבתה", einzelne in Coral Bay, Chlorakas, Stadt Paphos | `inventory` (Peyia 11 `Luxury Villas`, Coral Bay 1, Chlorakas 1, Paphos-Stadt 24 mit `Villas`/`Houses`) |
| 10 | Limassol: überwiegend Apartments, daneben Häuser in den Vororten und Villen mit Meerblick | `inventory` (Limassol 51 inkl. `Suburban houses`, `Mansions overlooking the sea`) — die frühere Wertung „מעטים ויקרים יותר" ist gestrichen |
| 10 | ~~Kissonerga, Sea Caves~~ | **gestrichen** (M8/A1): stehen in keiner Zeile von `inventory` |
| 10 | Mietrendite variiert; realistische Auslastungsannahmen | `faq:what-rental-yields-can-investors-expect-in-cyprus` — seit M15 auf zwei Sätze gekürzt und auf `/he/property-investment-cyprus` verlinkt, statt die Warnung dreimal im Korpus zu führen |
| 10 | Ministerrat-Genehmigung in bestimmten Fällen für Nicht-EU-Käufer | `faq:can-non-eu-citizens-buy-property-in-cyprus`; die FAQ-Frage ist seit M16 villenspezifisch (`נדרש אישור מיוחד לרכישת וילה?`) und **nicht mehr** byte-identisch mit `real-estate-cyprus` |
| 10 | ~~„בלרנקה ובצפון קפריסין איננו עובדים"~~ | **ersetzt** (M5/A11), siehe Filter-Abschnitt |
| 11 | Kategorien erste Reihe / Hanglage / Blick über ein freies Grundstück, Preis hängt an Blick und Abstand | Marktbeschreibung ohne Zahl, keine Zusage |
| 11 | Zoning-Prüfung der Nachbargrundstücke | **umformuliert** (M11): öffentliche Information, um deren Prüfung man den Anwalt **bitten kann** — die Prüfliste in `faq:what-does-a-lawyer-check-…` enthält sie nicht |
| 11 | Salzluft und Materialwahl | **umformuliert** (S19) zur Prüffrage an den Bauträger; die Zusage „בפרויקטים חדשים הדברים האלה כבר מתוכננים" ist gestrichen |
| 11 | ~~Kissonerga, Sea Caves, Polis als Seafront-Villengebiete~~ | **gestrichen** (M8, S23): nicht bzw. nur als `Residential` in `inventory` |
| 11 | „בתים מול הים **לא פעם** נמכרים מוקדם" | **entquantifiziert** (S18) |
| 12 | „קפריסין היוונית" = Süden = Republik Zypern = EU-Mitgliedstaat | Glossar §1/§3, Terminologie; die praktische Folge (Hinterlegung beim Grundbuch) aus `faq:how-does-…` |
| 12 | „**רוב** הפרויקטים … פאפוס ולימסול, ויש גם פרויקטים בקוקליה, בפוליס ובלרנקה" | `inventory` (Kouklia 3+4, Polis 2+3, Larnaca 3) — M7/A11 |
| 12 | ~~Kissonerga, Germasogeia~~ | **gestrichen** (M8/A1) |
| 12 | Townhouse günstiger als freistehendes Haus | **entschärft** (S21): „בדרך כלל בטווח נמוך יותר … את הפער בפרויקט מסוים אפשר לקבל בפנייה", und nur noch an einer Stelle |
| 12 | „בשוק הקפריסאי מדובר באותו סוג נכס" | S12 umgesetzt; der Kalk `מתייחסים ל` ist weg. Der Filter bleibt `Villa`, weil `Townhouse`-Zeilen im Live-Feed nicht von hier aus zählbar sind (siehe offene Fragen) |
| 12, 17 | Fernkauf | `faq:can-i-buy-property-in-cyprus-remotely`; Eigentümer der Antwort ist 13, die beiden anderen Seiten kürzen und verlinken dorthin |
| 17 | ~~„הביקוש לשכירות ארוכת טווח הוא היציב באי"~~ | **gestrichen** (M12/A12): Superlativ ohne Quelle. Ersetzt durch die quellengedeckte Aussage aus `faq:is-short-term-rental-more-profitable-than-long-term-rental` |
| 17 | Limassol: Geschäftszentrum, große internationale Unternehmen, internationale Schulen | Terminologie (Glossar §2/§3) + 6a `limassol.he.json`, konsistent |
| 17 | Kurz- vs. Langzeitvermietung mit allen Nachteilen der Kurzzeit | `faq:is-short-term-rental-more-profitable-…`, `faq:is-long-term-rental-safer-for-investors` |
| 17 | Rendite nie isoliert betrachten; Ausgaben, Steuern, Leerstand, Verwaltung | `faq:what-is-considered-a-good-rental-yield` — die Renditewarnung steht auf 17 jetzt **nur** in `faq.items[0]` (M15) |
| 17 | „**חלק ניכר** מהפרויקטים בלימסול נמכר עוד בשלב הבנייה" | **entquantifiziert** (S18) |
| 17 | Verwaltung nach der Übergabe, Kosten mindern die Rendite; Frage nach der Übertragbarkeit im Bauträgervertrag | als Prüffrage formuliert, keine Zusage; die Kostenwirkung ist arithmetisch |
| 10, 12, 17 | Preisvorbehalt `המחירים עשויים להשתנות. הזמינות מתעדכנת מול היזם.` | Glossar §5, Formulierung |

**Zahlen im Pack:** genau eine (`כ-45 דקות טיסה` auf 14). Keine Preise, Renditen, Steuersätze, Fristen oder Bestandszahlen. **Pass B A12** ist damit adressiert: auch Superlative und Quantoren (`היציב באי`, `רוב הפרויקטים`, `נמוך יותר`) sind geprüft und entweder entquantifiziert oder gestrichen.

## Terminologie

Aus `he-glossary.md` übernommen: `נדל"ן`, `נכס/נכסים`, `דירה`, `וילה`, `וילת יוקרה`, `בית פרטי`, `בית טורי`, `יזם/יזמים` (nie `קבלן`/`חברות בנייה`), `פרויקט חדש`, `על הנייר`, `יד שנייה`, `מגרש`, `שטח בנוי`, `חדרי שינה` (nie `חדרים`), `בריכה פרטית`, `קו ראשון לים`, `נוף לים`, `דמי ניהול`, `חברת ניהול`, `סיור בנכס`, `סיור וירטואלי`, `חוזה מכר`, `הסכם שמירת נכס`, `דמי רצינות`, `עורך דין`, `רשם המקרקעין`, `מועצת השרים`, `בעלות משפטית נקייה על הקרקע ועל הפרויקט`, `היסטוריית מסירות`, `עבר בדיקה`, `בלי תוספת מחיר לרוכש`, `מס בולים`, `מע"מ`, `דמי העברה`, `עמלות ההעברה`, `מס רווחי הון`, `תשואה משכירות`, `השכרה לטווח קצר`, `משכנתא`, `תוכנית תשלומים`, `מועד מסירה`, `תושבות קבע`, `רילוקיישן`, `אמנת מס`, `יוקר המחיה`, `בית ספר בינלאומי`, `הקהילה הישראלית`, `רוכשים` (nie `קונים`), `רוכשים שאינם אזרחי האיחוד האירופי`, `רוכשים מחו"ל`, `חברות בינלאומיות גדולות`, `מדינה חברה באיחוד האירופי`, `הרפובליקה של קפריסין`, `הכל` (nie `הכול`).

Zwei Boilerplate-Sätze aus Glossar §5 (Rechtsvorbehalt, Preisvorbehalt) stehen pack-weit im Wortlaut der Vorlage — das ist der einzige zulässige Wiederholungsfall. **Zurückgenommen:** die frühere Auslegung, §11.6 („duplizierte Strings wortgleich halten") gelte auch für FAQ-Items auf zwei indexierbaren URLs. §11.6 adressiert duplizierte Strings **im Code**; auf zwei URLs ist Wortgleichheit Duplicate Content (Pass B M16, Systemik #2). Skript (2) im Fix-Report weist 87 FAQ-Fragen über 17 URLs ohne eine einzige Dublette nach, Skript (5) null byte-identische Sätze zwischen Fließtext und eigener FAQ.

## Schlussabsätze

`איך מתחילים` schloss 8 von 8 Seiten (korpusweit 16 von 17). Jede Seite trägt jetzt eine eigene Schluss-H2, die den nächsten Schritt **dieser** Seite benennt, und einen neu geschriebenen Absatz darunter (M21): 10 `לבחור בין פאפוס ללימסול` · 11 `לבדוק מרחק מהים לפני מחיר` · 12 `בית פרטי או בית טורי, איך מחליטים` · 13 `לפני שחותמים על הסכם שמירת נכס` · 14 `לבחור עיר לפני שבוחרים נכס` · 15 `לברר את המסלול לפני שבוחרים נכס` · 16 `לחשב את סך העלות לפני ההחלטה` · 17 `לסגור אסטרטגיית השכרה לפני בחירת דירה`. Auf 10, 12, 15 und 16 wurde zusätzlich die vorangehende H2 umbenannt, damit die beiden H2 des Schlussblocks nicht dasselbe sagen.

Der Widerspruch `מחירון עדכני` (unsere Preisliste) neben `אין מחירון אחיד` (Marktpreisspiegel) ist aufgelöst: 13, 14 und 17 sagen jetzt `מחירי היזם המעודכנים` (S17).

## Rendering-Notizen

- `LandingBody.tsx:109` kennt **keine** `MIN_LIVE_RESULTS`-Schwelle (`const projects = manual.length > 0 ? manual : filtered`) — die 6er-Schwelle aus `page.tsx:531` gilt nur für `projectsSectionBlock`. Die frühere Begründung des `Villa`-Filters auf 12 stützte sich auf die falsche Codestelle (Pass B A9). Ein leerer Live-Treffersatz rendert die Leermeldung `pl-grid__empty`, nicht nichts.
- Deshalb sind `maxBeachMinutes: 10` (11) und `filterStage: "off-plan"` (17) **vor dem Seed live gegenzuzählen**: beide Filter schließen Zeilen ohne den jeweiligen Wert aus (`sanity.utils.ts:357 ff.`), Legacy-`Project`-Zeilen haben gar keinen `stage`.
- Der Renderer kann nummerierte und Bullet-Listen (`insightsBlocks.tsx:85-92`); Seite 13 nutzt sie jetzt für die sechs Kaufschritte, die Dokumenten- und die Nebenkostenliste (S8).
- `contentBlocks[0].image.alt` rendert nie (siehe oben).
- `allowIntroBlock` steht seit Fix-Runde 1 auf allen acht Dateien auf `false` und ist damit deckungsgleich mit den neun 6a-Landingpages. Das Feld ist für diese Route ohnehin wirkungslos: `page.tsx:675` routet jede Seite, deren Blöcke die Landing-Familie bilden, in `LandingBody`, und nur der Nicht-Landing-Zweig (`page.tsx:690`) liest `allowIntroBlock`.

## Offene Fragen für Pass C / den Controller

1. **H1 Zeile 16.** Der Map-Vorschlag (`…: אמנת המס, מס רכישה ומס שבח`) scheidet als H1 aus (Doppelpunkt + Dreiklang, §3) und würde eine Äquivalenz behaupten. Gewählt: H1 `מיסים על נדל"ן בקפריסין לרוכשים מישראל`, Titel `מיסוי נדל"ן בקפריסין ואמנת המס עם ישראל` (60 Graphem), Vokabelbrücke im Fließtext (S6). Bitte bestätigen.
2. **Seite 12, Projektblock-Filter.** `Townhouse` wäre wörtlicher als `Villa`, und `inventory` führt für Paphos-Stadt `Apartments, Townhomes`. Ob genug `Townhouse`-Zeilen live sind, ist von hier aus nicht prüfbar (kein DB-Zugriff im Content-Lauf). Bis dahin bleibt `Villa`, und der Townhouse-Teil des Textes ist auf einen Abschnitt gekürzt (S11).
3. **Seite 11 `maxBeachMinutes` und Seite 17 `filterStage`.** Werte hier auf 10 Minuten bzw. `off-plan` gesetzt. Beide brauchen eine Live-Zählung, bevor die Seiten publiziert werden; bleibt 11 danach leer, ist das die Antwort auf die Frage, ob die Seite existieren soll.
4. **Seite 17 gegen `limassol/new-projects`.** Query und H2 sind auf 17er Seite entzerrt, aber `limassol/new-projects` (6a) trägt weiterhin die H2 `דירה להשקעה בלימסול` und damit das Primär-KW von 17. Entweder diese H2 dort entfernen oder 17 zurückstellen (dann müssen `limassol` und `property-investment-cyprus` den `relatedLandingPages`-Eintrag verlieren).
5. **6a-Rückverlinkungen** (S2, S3) stehen aus, weil dieser Auftrag nur die acht 6b-Dateien anfasst.
6. **Glossar §2, Zeile `immovable property tax → nicht erwähnen`** kollidiert mit `faq:are-annual-property-taxes-payable-in-cyprus`. Die Seite folgt der FAQ; die Glossarzeile gehört korrigiert.
7. **Ziffernfreiheit** bleibt bewusst (eine Ausnahme, siehe Faktenaudit 14).
8. **Pass C offen** für alle acht Dateien (`"review": "pending"`).

## Gates (Fix-Runde 1)

- `node scripts/qa/he-content-check.mjs --only content/he/singlepages` → `he-content: OK (19 files, 1356 strings)`, inklusive des neuen `orphanMarkDefs`-Checks.
- `npm test` → 299 pass, 0 fail.
- `grep -c -- "—\|–\|!"` je Datei → 0 (8/8).
- Eigene Prüfskripte (Ausgabe im Fix-Report): Primär-KW 2–4 je Seite (2–4 gemessen), 87 FAQ-Fragen über 17 URLs ohne Dublette, 0 unbekannte Ortsnamen gegen `inventory.json`, 19 Inline-Links mit 0 Waisen, 0 byte-identische Sätze zwischen Fließtext und eigener FAQ, 0 doppelte Schluss- und Projektblock-H2 über alle 17 URLs, 1022 `_key`s korpusweit eindeutig.
- Meta: Titel 39–60, Description 121–141 Graphem (Grenzen 60 / 155).
