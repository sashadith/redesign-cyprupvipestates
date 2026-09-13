# c-landing-b — Landingpages 10–17 (Phase 5, Task 6b)

**Stand:** 2026-09-13 · **Pass A + Pass B (inline)** · Review-Status aller acht Dateien: `"review": "pending"` (Pass C offen, Entscheidung des Controllers vom 2026-09-13).

Alle acht Seiten sind **frisch auf Hebräisch verfasst** — es gibt keine EN-Quelle unter `content/he/source/singlepages/`, `mirrorCheck` entfällt entsprechend (der Gate meldet das als Notiz). Blockstruktur, Feldnamen und Portable-Text-Form sind ein exaktes Abbild der sechs EN-Referenzseiten (`content/he/source/reference/*.en.json`) und der neun 6a-Dateien: `landingIntroBlock` → `landingTextStart` → `landingProjectsBlock` → `landingTextFirst` → `landingFaqBlock` → `landingTextSecond`, alle `_key`s frisch (12 Zeichen).

Der CTA nach `/he/contacts` ist wie in 6a der `buttonLabel` des `landingIntroBlock` — `LandingBody.tsx:161` rendert ihn als `<a href="{lang}/contacts">`. Einen separaten `buttonBlock` benutzt keine Landingpage.

`previewImage`/Intro-Bild sind von einer Referenzseite gleichen Typs übernommen: `image-2ec5103e…` (Villen/Häuser/allgemein — `beach-villas-for-sale-cyprus`, `homes-for-sale-in-limassol`, `new-homes-in-cyprus-for-sale`) für die Seiten 10–16, `image-1e438cc9…` (Wohnungen — `2-bedroom-apartments-for-sale-limassol`) für Seite 17.

## Die acht Seiten

| # | Slug | H1 (HE) | Primär-KW (Vol.) | Vorkommen | Wörter (Prosa) | Intro-Wörter | Meta T/D |
|---|---|---|---|---:|---:|---:|---|
| 10 | `villas-cyprus` | וילות למכירה בקפריסין | וילות בקפריסין (320) | 4 | 613 | 142 | 42 / 120 |
| 11 | `seafront-villas-cyprus` | וילות למכירה על הים בקפריסין | וילה בקפריסין על הים (110/20) | 3 | 611 | 153 | 49 / 137 |
| 12 | `houses-for-sale-cyprus` | בתים למכירה בקפריסין היוונית | בתים למכירה בקפריסין (70) | 3 | 584 | 139 | 49 / 135 |
| 13 | `buying-property-in-cyprus` | איך קונים דירה בקפריסין, המדריך לרוכשים מישראל | קניית דירה בקפריסין (40) | 3 | 758 | 162 | 40 / 141 |
| 14 | `relocation-cyprus` | רילוקיישן לקפריסין לישראלים ודירות למגורים | רילוקיישן לקפריסין (170) | 4 | 600 | 148 | 39 / 121 |
| 15 | `permanent-residency-cyprus` | תושבות קבע בקפריסין דרך רכישת נכס | תושבות בקפריסין (30) / תושבות קבע בקפריסין (20) | 3 | 603 | 144 | 40 / 127 |
| 16 | `property-tax-cyprus` | מיסים על נדל"ן בקפריסין לרוכשים מישראל | מיסוי נדל"ן בקפריסין (20) | 2 | 730 | 139 | 44 / 121 |
| 17 | `limassol/investment-apartments` | דירה להשקעה בלימסול | דירה להשקעה בלימסול (30) | 4 | 603 | 136 | 40 / 127 |

„Vorkommen" = Treffer des Primär-KW im **Prosa-Umfang** (H1, Excerpt, Meta-Paar, Intro-Text, alle Fließtextblöcke, Projektblock-Überschrift, FAQ). Alt-Texte und die Intro-Wiederholung der H1 sind Struktur, nicht Prosa, und werden nicht mitgezählt; würde man sie mitzählen, läge die Zahl allein durch die Bild-Refs 2–3 höher. Zielkorridor 2–4 → alle acht Seiten innerhalb. Zum Vergleich: die neun 6a-Seiten liegen bei jeweils genau 4.

Intro (Intro-Beschreibung + `landingTextStart`) 136–162 Wörter, Zielkorridor 120–180 → alle acht innerhalb. Meta-Titel 39–49 Graphem (≤ 60), Meta-Description 120–141 (Styleguide §6: 120–155).

## Projektblock-Filter

| Seite | `filterCity` | `filterPropertyType` |
|---|---|---|
| 10 `villas-cyprus` | — (inselweit) | `Villa` |
| 11 `seafront-villas-cyprus` | `Paphos` | `Villa` |
| 12 `houses-for-sale-cyprus` | — (Süden = unser gesamtes Inventar) | `Villa` |
| 13 `buying-property-in-cyprus` | — | `Apartment` |
| 14 `relocation-cyprus` | `Limassol` | — |
| 15 `permanent-residency-cyprus` | — | `Apartment` |
| 16 `property-tax-cyprus` | — | `Apartment` |
| 17 `limassol/investment-apartments` | `Limassol` | `Apartment` |

Grundlage `content/he/source/inventory.json`: Villen-Neubau liegt fast vollständig im Bezirk Paphos (`Luxury Villas` in Peyia, Coral Bay, Chlorakas, Sea Caves; `Villas`/`Houses` in der Stadt Paphos), Limassol-Neubau ist überwiegend Apartment. Larnaka (3 Developments) und Nordzypern kommen in keinem Filter und in keinem Satz vor, außer zur Abgrenzung (Seite 10 FAQ, Seite 12 Intro, Seite 14 FAQ).

## Link-Graph

| Seite | `relatedLandingPages` | Inline-Links (markDef) |
|---|---|---|
| 10 | `paphos/villas`, `seafront-villas-cyprus`, `houses-for-sale-cyprus`, `real-estate-cyprus` | — |
| 11 | `villas-cyprus`, `paphos/villas` | — |
| 12 | `villas-cyprus`, `real-estate-cyprus` | — |
| 13 | `real-estate-cyprus`, `permanent-residency-cyprus`, `property-tax-cyprus` | `/he/faq`, `/he/property-tax-cyprus`, `/he/contacts` |
| 14 | `buying-property-in-cyprus`, `permanent-residency-cyprus`, `limassol` | — |
| 15 | `buying-property-in-cyprus`, `property-tax-cyprus`, `property-investment-cyprus` | — |
| 16 | `buying-property-in-cyprus`, `permanent-residency-cyprus`, `property-investment-cyprus` | — |
| 17 | `limassol`, `limassol/new-projects`, `property-investment-cyprus` | `/he/property-tax-cyprus` |

`/he/faq` und `/he/contacts` sind Code-Routen, keine Pack-Slugs; sie können daher nur als Inline-Link im Portable Text stehen, nicht in `relatedLandingPages` (der Seeder löst dort ausschließlich `he`-Singlepage-Zeilen auf). `linkCheck` lässt beide über die `CODE_ROUTES`-Liste zu.

Die Gegenrichtung liegt bereits in 6a: `real-estate-cyprus` → `villas-cyprus`, `paphos/villas` → `villas-cyprus`, `limassol` → `limassol/investment-apartments`, `property-investment-cyprus` → `limassol/investment-apartments` + `property-tax-cyprus`. Es fehlt keine Rückverlinkung. `limassol/investment-apartments` trägt `parentSlug: "limassol"`, alle übrigen sieben sind Top-Level (`parentSlug: null`).

## Faktenaudit — Seiten 13–16

Jede Sachaussage auf den vier informational-commercial Seiten mit ihrer Quelle. `faq:<id>` = Item-`id` in `scripts/faq-translations/he.json` (Formulierung möglichst wortnah übernommen, gekürzt); `gloss §n` = `docs/i18n/he-glossary.md`; `km` = `docs/i18n/he-keyword-map.md`.

### 13 `buying-property-in-cyprus`

| Aussage | Quelle |
|---|---|
| Sechs Schritte: Auswahl → Reservierungsvereinbarung → Due Diligence → Vertrag + Unterschrift → Hinterlegung des Vertrags → Zahlungen und Übertragung | `faq:how-does-the-property-buying-process-work-in-cyprus` |
| Ablauf unterscheidet sich zwischen Resale und Neubau | dieselbe |
| Dauer: einfache Transaktion Wochen, mit Hypothek/Off-Plan/Genehmigungen länger | `faq:how-long-does-buying-property-in-cyprus-take` |
| Unabhängige anwaltliche Vertretung ist eine der wichtigsten Absicherungen | `faq:do-i-need-a-lawyer-when-buying-property-in-cyprus` |
| Anwalt prüft Eigentümerstellung, Belastungen, Baugenehmigungen, Planungszustimmungen, Vertrag, Registrierung | `faq:what-does-a-lawyer-check-during-the-purchase-process` |
| Unterschrift des Kaufvertrags erfolgt beim Anwalt (kein Notar) | gloss §2 „signing at the lawyer's", Styleguide §7 |
| Dokumentenliste (Pass, Adressnachweis, Mittelherkunft, Reservierungsvereinbarung, Kaufvertrag, Finanzunterlagen) | `faq:what-documents-are-required-to-buy-property-in-cyprus` |
| Nicht-EU-Bürger und aufenthaltsbezogene Käufe können weitere Dokumente brauchen | dieselbe |
| Nebenkosten: Anwaltshonorar, Stempelsteuer nach Objektwert, MwSt. auf Teil der Neubauten, Übertragungsgebühren in bestimmten Fällen, Objektversicherung, Bank-/Umtauschkosten | `faq:what-additional-costs-should-i-expect-besides-the-property-p` |
| Typische Fehler ausländischer Käufer (nur Preis, Nebenkosten unterschätzt, nur Marketingmaterial, keine Rechtsprüfung, garantiert geglaubte Rendite) | `faq:what-mistakes-do-foreign-buyers-make-when-purchasing-propert` |
| Reservierungsvereinbarung: Zweck, Betrag, Dauer, Bedingungen, Rückzahlungsregeln; Bedingungen variieren stark | `faq:what-is-a-reservation-agreement` |
| Rückzahlbarkeit der Reservierungsgebühr hängt allein vom Vertrag ab | `faq:is-a-reservation-deposit-refundable` |
| Fernkauf über Vertretung und Vollmacht, Videobesichtigung, Vertragsprüfung per E-Mail, Etappenzahlungen; Rechtsprüfung bleibt nötig | `faq:can-i-buy-property-in-cyprus-remotely` |
| Besuch nicht zwingend; Investoren kaufen oft fern, Eigennutzer sehen es meist vorher an | `faq:is-visiting-cyprus-necessary-before-purchase` |
| Nach der Unterschrift: Registrierung, Zahlungspläne, Übertragung, Hypothek, endgültige Eigentumsregistrierung | `faq:what-happens-after-signing-the-contract` |
| Ausländer können eine Hypothek erhalten; Bedingungen nach Staatsangehörigkeit, Aufenthaltsstatus, Einkommen, Bankanforderungen; Kreditpolitik ändert sich | `faq:can-foreigners-get-a-mortgage-in-cyprus` |
| Hypothek setzt nicht zwingend Aufenthalt voraus, Kriterien für Nichtansässige weichen ab | `faq:can-buyers-obtain-mortgages-without-cyprus-residency` |
| Rechtsvorbehalt-Satz | gloss §5 |

### 14 `relocation-cyprus`

| Aussage | Quelle |
|---|---|
| Ca. 45 Flugminuten von Tel Aviv, mehrere Flüge täglich | gloss §5 „Nähe zu Israel" |
| Zypern ist EU-Mitgliedstaat | gloss §3 |
| Aufenthaltswege variieren nach Staatsangehörigkeit, geplanter Aufenthaltsdauer und persönlichen Umständen; Wege und Anforderungen ändern sich | `faq:what-residency-options-exist-for-foreigners-moving-to-cyprus` |
| Häufige Umzugsgründe (Ruhestand, Remote-Arbeit, Familie, Investment, Lebensstil, Unternehmen) | dieselbe |
| Familien prüfen Schulen, Sicherheit, Gesundheitsversorgung, Infrastruktur, Gemeinschaft, Lebenshaltungskosten | `faq:can-families-relocate-permanently-to-cyprus` |
| Ruheständler: Klima, ruhigerer Lebensrhythmus, Küstenumfeld, internationale Gemeinschaften; teils wartungsarme Wohnungen, teils Häuser | `faq:can-retirees-relocate-permanently-to-cyprus`, `faq:is-cyprus-a-good-place-for-retirement` |
| Es gibt keine „beste Stadt", die Wahl folgt den eigenen Prioritäten | `faq:which-city-in-cyprus-is-best-for-buying-property` |
| In Limassol konzentriert sich die israelische Gemeinschaft; höchstes Preisniveau der Insel | `km` §4 Zeile 14 („Limassol-Schwerpunkt") + wortgleich `content/he/singlepages/real-estate-cyprus.he.json` (6a) |
| Paphos ist ruhiger, niedrigere Einstiegspreise, dort das meiste Neubauangebot an Einfamilienhäusern | 6a (`real-estate-cyprus`, `paphos`), `content/he/source/inventory.json` |
| Beratungssprache Englisch/Russisch | gloss §5 (Entscheidung E), wörtlich |
| Rechtsvorbehalt-Satz | gloss §5 |

### 15 `permanent-residency-cyprus`

| Aussage | Quelle |
|---|---|
| Immobilienkauf verleiht **nicht** automatisch Daueraufenthalt | `faq:does-buying-property-automatically-grant-permanent-residency` |
| Eigentum kann bestimmte Aufenthaltswege stützen, es gelten aber getrennte Bedingungen | dieselbe |
| Getrennt geprüft werden Einkommen, Dokumente, finanzielle Mittel, Hintergrundprüfungen, Rechtsstatus | dieselbe |
| Eigentum-allein-genügt ist eine unrealistische Erwartung | dieselbe |
| Eignung hängt meist von Investitionswert, Einkommen und Dokumenten ab; Regeln ändern sich | `faq:can-buying-property-help-obtain-residency-in-cyprus` |
| Zu prüfen: Investitionsschwelle, Familienangehörige, Bearbeitungsdauer, Zugang zum Gesundheitssystem, Steuerfolgen, langfristige Umzugsziele | dieselbe |
| Vor einer aufenthaltsmotivierten Kaufentscheidung Anwalt und Migrationsexperten konsultieren | dieselbe |
| Aufenthaltswege variieren nach Staatsangehörigkeit und Umständen | `faq:what-residency-options-exist-for-foreigners-moving-to-cyprus` |
| Aufenthaltsbezogene Käufe können zusätzliche Dokumente erfordern | `faq:what-documents-are-required-to-buy-property-in-cyprus` |
| Zypern vergibt keine Staatsbürgerschaft gegen Investment; Aufenthalt ≠ Staatsbürgerschaft | gloss §3 „EU citizenship" |
| Rückzahlbarkeit der Reservierungsgebühr allein nach Vertrag | `faq:is-a-reservation-deposit-refundable` |
| Rechtsvorbehalt-Satz | gloss §5 |

**Keine Schwelle genannt.** Die Seite sagt ausdrücklich, dass wir keine Investitionsschwelle veröffentlichen — die EN-FAQ nennt keine, und `km` §2 nennt nur Suchvolumen.

### 16 `property-tax-cyprus`

| Aussage | Quelle |
|---|---|
| Steuern variieren nach Transaktionsart und danach, ob Neubau oder Resale | `faq:what-taxes-do-property-buyers-pay-in-cyprus` |
| Mögliche Posten: MwSt., Stempelsteuer, Gebühren rund um die Eigentumsübertragung, Kapitalertragsteuer beim Verkauf, kommunale Abgaben | dieselbe |
| Steuerpflichten ändern sich mit der Zeit und nach den Umständen des Käufers | dieselbe |
| „Viele ausländische Käufer konsultieren vor dem Kauf einen rechtlichen oder finanziellen Berater" (wörtlich übernommen) | dieselbe |
| MwSt.-Behandlung hängt vor allem an Neubau vs. Resale; Neubau meist MwSt.-pflichtig, Resale ggf. befreit | `faq:is-vat-included-when-buying-property-in-cyprus` |
| Ermäßigte MwSt. unter Umständen, wenn das Objekt Hauptwohnsitz ist | `faq:can-reduced-vat-apply-when-buying-property` |
| Voraussetzungen betreffen geplante Nutzung, Fläche, Aufenthaltsstatus, Regulierung; sie ändern sich | dieselbe, `faq:what-vat-rates-apply-to-property-purchases-in-cyprus` |
| Stempelsteuer ist eine staatliche Gebühr nach Objektwert | `faq:what-additional-costs-should-i-expect-besides-the-property-p` |
| Übertragungsgebühren = Kosten der Eigentumsübertragung; ob und wie sie anfallen hängt u. a. an der früheren MwSt.-Behandlung und der geltenden Regulierung | `faq:what-are-transfer-fees-when-buying-property` |
| `דמי העברה` (Übertragungsgebühr) ≠ `עמלות ההעברה` (Banküberweisungs-/Umtauschkosten) | gloss §2, beide Zeilen |
| Kapitalertragsteuer ist Verkaufs-, nicht Kaufsache | `faq:what-taxes-do-property-buyers-pay-in-cyprus` |
| Nationale Grundsteuer vor einigen Jahren abgeschafft; kommunale Abgaben möglich; laufende Kosten (Instandhaltung, Versicherung, Gemeinschaftskosten) | `faq:are-annual-property-taxes-payable-in-cyprus` |
| Resale und Neubau werden unterschiedlich besteuert; wirkt auf Anfangskosten, Übertragungsgebühren, Investitionsrechnung | `faq:are-resale-properties-taxed-differently-from-new-development` |
| Nebenkostenliste im FAQ-Block | `faq:what-additional-costs-should-i-expect-besides-the-property-p` |
| Nur der Kaufpreis betrachtet → unrealistische Rentabilitätserwartung | `faq:how-much-extra-money-should-buyers-budget-beyond-the-propert` |
| Falsche MwSt.-Annahmen können das gesamte Kaufbudget verschieben | `faq:is-vat-included-when-buying-property-in-cyprus` |
| Es **existiert** ein Doppelbesteuerungsabkommen Israel–Zypern (nur als Thema genannt, kein Inhalt, keine Artikel, keine Sätze) | gloss §3 „double taxation treaty", `km` §2 (`אמנת מס קפריסין ישראל`, 40/Mon.) |
| Rechtsvorbehalt-Satz | gloss §5 |

**Keine Sätze, keine Schwellen, keine Fristen.** Auf der Steuerseite steht ausdrücklich, dass wir keine Sätze veröffentlichen und kein Rechenbeispiel zeigen.

### Ergänzend: Fakten auf 10, 11, 12, 17

| Seite | Aussage | Quelle |
|---|---|---|
| 10, 17 | Mietrendite variiert stark nach Objekttyp, Stadt, Saison und Vermietungsstrategie; Tourismusobjekte saisonal höher bei schwankender Auslastung; Langzeit stabiler; realistische Auslastungsannahmen | `faq:what-rental-yields-can-investors-expect-in-cyprus` |
| 17 | Kurzzeit vs. Langzeit: höhere Saisonerträge gegen Saisonschwankung, Verwaltungsaufwand, Marketing, Reinigung, Regulierung; Langzeit planbarer | `faq:is-short-term-rental-more-profitable-than-long-term-rental`, `faq:is-long-term-rental-safer-for-investors` |
| 17 | Rendite nie isoliert betrachten (Ausgaben, Steuern, Instandhaltung, Leerstand, Verwaltung) | `faq:what-is-considered-a-good-rental-yield` |
| 10 | Genehmigung des Ministerrats in bestimmten Fällen für Nicht-EU-Käufer; der Anwalt erledigt das im Verfahren | `faq:can-non-eu-citizens-buy-property-in-cyprus`, wortgleich mit der 6a-Antwort in `real-estate-cyprus.he.json` |
| 10 | Anwalt prüft Eigentumslage, Belastungen, Planungs- und Baugenehmigungen, Hinterlegung beim Grundbuch | `faq:what-does-a-lawyer-check-…`, gloss §2 |
| 12, 17 | Fernkauf möglich, Rechtsprüfung bleibt nötig | `faq:can-i-buy-property-in-cyprus-remotely` |
| 12 | Dokumentenliste | `faq:what-documents-are-required-to-buy-property-in-cyprus` |
| 12 | Der Süden ist die Republik Zypern und EU-Mitgliedstaat | gloss §1, §3 |
| 10–12 | Ortsnamen und Lagebeschreibungen (Peyia, Coral Bay, Chlorakas, Kissonerga, Sea Caves, Polis, Geroskipou, Germasogeia) | gloss §1, `content/he/source/inventory.json` |
| 10, 12, 17 | Preisvorbehalt `המחירים עשויים להשתנות. הזמינות מתעדכנת מול היזם.` | gloss §5 |

**Es steht keine einzige Zahl auf den acht Seiten** — keine Preise, keine Preisspannen, keine Renditen, keine Steuersätze, keine Fristen, keine Bestandszahlen. Bewusste Entscheidung nach den Global Constraints; die Alternative (Bestandszahlen aus `km` §4, z. B. „95 Villen Paphos") wäre zwar quellengedeckt, veraltet aber ohne Pflegeprozess und weicht vom 6a-Stand ab, der ebenfalls ziffernfrei ist.

## Terminologie

Aus `he-glossary.md` übernommen: `נדל"ן`, `נכס/נכסים`, `דירה`, `וילה`, `וילת יוקרה`, `בית פרטי`, `בית טורי`, `יזם/יזמים` (nie `קבלן`/`חברות בנייה`), `פרויקט חדש`, `על הנייר`, `יד שנייה`, `מגרש`, `שטח בנוי`, `חדרי שינה` (nie `חדרים`), `בריכה פרטית`, `קו ראשון לים`, `נוף לים`, `דמי ניהול`, `חברת ניהול`, `סיור בנכס`, `סיור וירטואלי`, `חוזה מכר`, `הסכם שמירת נכס`, `דמי רצינות`, `עורך דין`, `רשם המקרקעין`, `מועצת השרים`, `בעלות משפטית נקייה על הקרקע ועל הפרויקט`, `היסטוריית מסירות`, `עבר בדיקה`, `בלי תוספת מחיר לרוכש`, `מס בולים`, `מע"מ`, `דמי העברה`, `עמלות ההעברה`, `מס רווחי הון`, `תשואה משכירות`, `השכרה לטווח קצר`, `משכנתא`, `תוכנית תשלומים`, `מועד מסירה`, `תושבות קבע`, `רילוקיישן`, `אמנת מס`, `יוקר המחיה`, `בית ספר בינלאומי`, `הקהילה הישראלית`, `רוכשים` (nie `קונים`), `רוכשים שאינם אזרחי האיחוד האירופי`, `רוכשים מחו"ל`, `חברות בינלאומיות גדולות`, `מדינה חברה באיחוד האירופי`, `הרפובליקה של קפריסין`, `הכל` (nie `הכול`).

Doppelt vorkommende Strings sind wortgleich gehalten (Styleguide §11.6): die FAQ-Antwort zu `האם ישראלים יכולים לקנות נכס בקפריסין?` auf Seite 10 ist byte-identisch mit der in `real-estate-cyprus.he.json` (6a); der Preisvorbehalt und die beiden Boilerplate-Sätze aus Glossar §5 stehen überall im Wortlaut der Vorlage.

## Pass-B-Korrekturen (inline angewandt)

| # | Seite | Befund | Korrektur |
|---|---|---|---|
| 1 | 16 | `התוצאה הכוללת` enthält die Zeichenfolge `הכול` und schlägt im Gate an (`hakol-spelling`) — Falsch-Positiv der Regel, aber der Gate gewinnt | → `החישוב הסופי` |
| 2 | 11 | `נוף` viermal im selben Absatz (§11.5), zusätzlich `לבדוק`/`בדיקה` als Wurzelwiederholung | Absatz umgeschrieben (`המראה מהסלון`, `בית מול הים`, `וכדאי לבקש זאת מראש`) |
| 3 | 16 | Die fünfteilige Steuerliste stand zweimal auf derselben Seite (Intro-Absatz und FAQ 1) | Intro-Absatz auf die Systematik umgestellt (Kauf / Verkauf / laufend), Aufzählung bleibt nur im FAQ |
| 4 | 12 | „der Vertrag **wird registriert** beim Grundbuch" — die FAQ sagt „hinterlegt" | → `חוזה המכר מופקד אצל רשם המקרקעין` |
| 5 | 15, 16 | Projektblock hieß `פרויקטים חדשים…`, filtert aber `Apartment` | → `דירות בפרויקטים חדשים בלימסול ובפאפוס` |
| 6 | 14, 17 | Primär-KW 5× bzw. 6× (über dem 2–4-Korridor) | Excerpt bzw. FAQ-Überschrift umformuliert → 4 / 4 |
| 7 | alle | Meta-Descriptions lagen bei 98–119 Graphem, Styleguide §6 verlangt 120–155 | auf 120–141 verlängert |
| 8 | 10 | Primär-KW nur 2× | Projektblock-Überschrift und Meta-Description tragen es jetzt → 4 |
| 9 | 10 | Die FAQ-Antwort zu `האם ישראלים יכולים לקנות נכס בקפריסין?` wich um `לנכס מגורים` von der 6a-Fassung ab (§11.6) | an `real-estate-cyprus.he.json` angeglichen, jetzt byte-identisch |

## Offene Fragen für Pass C / den Controller

1. **H1 Zeile 16 weicht von der Keyword-Map ab.** Die Map schlägt `מיסים על נדל"ן בקפריסין לישראלים: אמנת המס, מס רכישה ומס שבח` vor. Drei Probleme: Doppelpunkt-Überschrift (Styleguide §3), Dreiklang (§3), und vor allem sind `מס רכישה` und `מס שבח` **israelische** Steuernamen ohne zyprisches Gegenstück — Glossar §2 kennt `דמי העברה` (keine Steuer) und `מס רווחי הון`. Gewählt: `מיסים על נדל"ן בקפריסין לרוכשים מישראל`. Bitte bestätigen.
2. **H1 Zeilen 13 und 14** trugen einen Doppelpunkt bzw. ein `+`. Umgesetzt als `איך קונים דירה בקפריסין, המדריך לרוכשים מישראל` und `רילוקיישן לקפריסין לישראלים ודירות למגורים`.
3. **Seite 12, Projektblock-Filter.** Die H1 verspricht `בתים` (auch Reihenhäuser), der Filter ist `Villa`. `Townhouse` wäre wörtlicher, aber `page.tsx` fällt unter 6 Live-Treffern auf die (leere) manuelle Liste zurück und der Block bliebe leer. Sobald genug `Townhouse`-Zeilen im Feed sind, umstellen.
4. **Seite 17 ist laut Map „nur bauen, wenn Seite 6 nach 3 Monaten nicht dafür rankt".** Sie ist hier trotzdem angelegt, weil 6a (`limassol.he.json`, `property-investment-cyprus.he.json`) bereits auf `limassol/investment-apartments` verlinkt — ohne die Datei hätte der Seeder zwei tote Referenzen. Falls die Seite nicht live gehen soll, müssen jene zwei `relatedLandingPages`-Einträge mit entfernt werden.
5. **Ziffernfreiheit.** Siehe oben — bewusst keine Bestandszahlen („166 פרויקטים בפאפוס"), obwohl `km` §6 Punkt 8 sie als SERP-Vorteil nennt. Das wäre ein eigener, gepflegter Mechanismus (Inventar-Counter im Title), keine handgeschriebene Zahl.
6. **`מיסוי נדל"ן בקפריסין` steht in der Map ohne Gershayim** (`מיסוי נדלן בקפריסין`, 20/Mon.). Die Style-Regel `nadlan-gershayim` erzwingt `נדל"ן`; die Close-Variante ohne Gershayim ist damit auf keiner Seite exakt getroffen. Google Ads fasst die Varianten ohnehin zu einem Bucket zusammen (`km` §1), aber ein Muttersprachler sollte bestätigen, dass das für Google Israel auch organisch gilt.
7. **Pass C offen** für alle acht Dateien (`"review": "pending"`).

## Gates

- `node scripts/qa/he-content-check.mjs --only content/he/singlepages` → `he-content: OK (19 files, 1266 strings)`; alle acht Dateien mit der Notiz „no EN source — skipping mirrorCheck" (erwartet, frisch verfasst).
- `grep -c -- "—\|–\|!"` je Datei → 0 (8/8).
- `npm test` → 298 pass, 0 fail.
- `node scripts/he-content/seed.mjs --dry-run --only singlepages` → gibt den `CVP_ALLOW_DB_READ`-Hinweis aus und endet mit Exit 0 (kein DB-Zugriff von hier aus).
- Meta: Titel 39–49, Description 120–141 Graphem (Grenzen 60 / 155).
