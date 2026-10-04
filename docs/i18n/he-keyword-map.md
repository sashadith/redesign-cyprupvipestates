# Hebräische Keyword-Map (`he`) — Phase 0 Keyword-Recherche

**Datum:** 2026-09-13 · **Markt:** Google Israel (location_code 2376), Sprache Hebräisch · **Datenquelle:** DataForSEO (Google Ads Keyword Planner + DataForSEO Labs + Live-SERP) · **Gesamtkosten API:** **$0,728** (42 Calls, Budget-Cap $8 nicht annähernd erreicht) · **Datensatz:** `docs/i18n/he-keywords.csv`

Bezug: Spec `docs/superpowers/specs/2026-09-13-hebrew-localization-design.md`, Abschnitt 4.2 (Kandidaten-Cluster) und Entscheidung G (15–25 kommerzielle Landingpages).

---

## 1. Methode

1. **Expansion (3 Quellen):**
   - `keywords_data/google_ads/keywords_for_keywords/live` mit den 15 Spec-Seeds (ohne `language_code`, Israel) → 19 Treffer (Keyword Planner liefert für Hebräisch nur Close-Variants zurück, kaum echte Expansion).
   - `dataforseo_labs/google/keyword_suggestions/live` (`language_code: he`) für 17 Seeds (Spec-Seeds + immobilienspezifische Zweitseeds wie דירות בקפריסין, וילה בקפריסין, דירות בפאפוס, נדל"ן בחו"ל, מעבר לקפריסין).
   - `dataforseo_labs/google/related_keywords/live` (depth 2–3) für 8 Seeds → liefert zusätzlich Googles „Ähnliche Suchanfragen"-Strings.
   - Plus ~110 manuell formulierte Kandidaten für Cluster, die die Seeds nicht abdecken (Steuern, Aufenthalt, Kaufprozess, Off-Plan, Typ-Seiten, Nordzypern, Larnaka als Kontrollgruppe).
2. **Dedupe** auf normalisierte Schreibweise (Gershayim/Anführungszeichen/Leerzeichen) → **1.132 Kandidaten**.
3. **Volumen:** `keywords_data/google_ads/search_volume/live`, 2 Batches à ≤700 → 1.132 Zeilen, davon 798 mit Volumen ≥ 20. Davon sind ~550 Tourismus-Rauschen aus den Stadt-Seeds (Flüge, Hotels, Einkaufszentren, Chabad-Häuser) und israelische Inlands-Immobilienmarken (מרכז הנדלן, גלובס נדלן, IBI בית השקעות) — herausgefiltert. **Übrig: 144 zypern-/auslandsrelevante Keywords mit Volumen ≥ 20** (Tabelle in Abschnitt 2).
4. **SERP-Check:** `serp/google/organic/live/regular` (Israel, he, Desktop, Top 20) für 14 Head-Terms. cyprusvipestates.com erscheint in **keiner** der 14 SERPs (erwartet — es gibt noch keine HE-Seiten; auch keine EN-Seite rankt für hebräische Queries).
5. **Intent:** DataForSEO-Labs-Intent als Ausgangspunkt, dann per SERP-Beobachtung korrigiert (z. B. „וילות בקפריסין": Labs sagt informational, SERP zeigt 8/10 Ferienvermietung → „mixed (Urlaub/Kauf)").

**Wichtige Lese-Hinweise zu den Zahlen**
- Google Ads fasst Close-Variants zusammen: נדל"ן / נדלן / נדל ן בקפריסין liefern identische 320 — das ist **ein** Bucket, nicht 3×320. Als „(Variante)" markierte Zeilen nicht addieren.
- Volumina sind 12-Monats-Durchschnitte; der gesamte kaufbare hebräische Zypern-Immobilienmarkt liegt bei **≈ 2.500–3.000 Suchen/Monat** (ohne Vermietung, Larnaka, Griechenland, Marken). Das ist ein **Lead-Wert-Markt, kein Traffic-Markt**: CPCs von $4–11 (Spitze: פרויקטים בלימסול $10,89, משכנתא בקפריסין $13,46, השקעות נדלן בחול $19,55).

---

## 2. Alle Keywords mit Volumen ≥ 20 (zypern-/auslandsrelevant)

Cluster-Legende: `hub-cyprus` Cornerstone · `investment` · `prices` · `limassol-*` · `paphos-*` · `villas-cyprus` · `houses-cyprus` · `buying-process` · `relocation` · `residency` · `tax` · `financing` · `new-projects` · `brand/portal-navigational` · `overseas-generic (Blog)` · `greece (out of scope)` · `(NICHT bauen)` = Larnaka, Vermietung, Limassol-Villen, Typ-Seiten.

| Keyword (HE) | Vol. | CPC $ | Comp. | Intent | Cluster |
|---|---:|---:|---|---|---|
| נדל"ן בקפריסין | 320 | 6.70 | MEDIUM | commercial | hub-cyprus |
| נדלן בקפריסין | 320 | 6.70 | MEDIUM | commercial | hub-cyprus (Variante) |
| נדל ן בקפריסין | 320 | 6.70 | MEDIUM | commercial | hub-cyprus (Variante) |
| וילות בקפריסין | 320 | 0.80 | MEDIUM | mixed (Urlaub/Kauf) | villas-cyprus |
| וילה בקפריסין | 320 | 0.80 | MEDIUM | mixed (Urlaub/Kauf) | villas-cyprus |
| דירות בקפריסין יד 2 | 260 | 2.27 | MEDIUM | navigational | brand/portal-navigational |
| דירה בקפריסין | 260 | 3.56 | MEDIUM | commercial | hub-cyprus |
| דירות בקפריסין | 260 | 3.56 | MEDIUM | commercial | hub-cyprus |
| גינדי לימסול | 260 | – | LOW | navigational | brand/portal-navigational |
| השקעות נדלן בחול | 260 | 19.55 | MEDIUM | informational | overseas-generic (Blog) |
| נדלן ביוון | 260 | 3.79 | MEDIUM | commercial | greece (out of scope) |
| וילות ביוון | 260 | 0.83 | MEDIUM | mixed (Urlaub/Kauf) | greece (out of scope) |
| וילות בלימסול | 210 | 1.02 | MEDIUM | mixed (Urlaub/Kauf) | limassol-villas (NICHT bauen) |
| רילוקיישן לקפריסין | 170 | 2.72 | LOW | informational | relocation |
| וילות בפאפוס | 170 | 1.06 | MEDIUM | mixed (Urlaub/Kauf) | paphos-villas |
| וילה בפאפוס | 170 | 1.06 | MEDIUM | mixed (Urlaub/Kauf) | paphos-villas |
| נדל ן בחול | 170 | 19.65 | MEDIUM | informational | overseas-generic (Blog) |
| בתים למכירה ביוון ליד הים | 170 | 1.55 | MEDIUM | commercial | greece (out of scope) |
| דירות למכירה בקפריסין | 140 | 2.69 | MEDIUM | commercial | hub-cyprus |
| השקעות נדל"ן בקפריסין | 140 | 5.69 | MEDIUM | commercial | investment |
| השקעות נדלן בקפריסין | 140 | 5.69 | MEDIUM | commercial | investment (Variante) |
| דירה להשקעה בקפריסין | 140 | 4.00 | HIGH | commercial | investment |
| דירות להשקעה בקפריסין | 140 | 4.00 | HIGH | commercial | investment |
| דירות ביוון | 140 | 2.52 | MEDIUM | commercial | greece (out of scope) |
| דירות למכירה ביוון יד 2 | 140 | 2.55 | MEDIUM | navigational | greece (out of scope) |
| השקעה בקפריסין | 110 | 6.72 | HIGH | commercial | investment |
| השקעות בקפריסין | 110 | 6.72 | HIGH | commercial | investment |
| דירות בלימסול | 110 | 2.66 | HIGH | commercial | limassol-apartments |
| דירה בלימסול | 110 | 2.66 | HIGH | commercial | limassol-apartments |
| דירות בקפריסין מחירים | 110 | 2.74 | MEDIUM | commercial | prices |
| וילה למכירה בקפריסין על הים | 110 | 2.35 | MEDIUM | commercial | villas-cyprus (seafront) |
| וילות בלרנקה | 110 | 0.84 | MEDIUM | mixed (Urlaub/Kauf) | larnaca (NICHT bauen) |
| וילה בקפריסין למכירה | 90 | 1.86 | MEDIUM | commercial | villas-cyprus |
| דירות בפאפוס | 90 | 1.50 | MEDIUM | commercial | paphos-apartments |
| דירה בפאפוס | 90 | 1.50 | MEDIUM | commercial | paphos-apartments |
| דירות בלרנקה | 90 | 2.62 | MEDIUM | commercial | larnaca (NICHT bauen) |
| ישראלים בקפריסין | 90 | – | LOW | informational | relocation |
| מרינה לימסול | 90 | 8.55 | LOW | mixed (Tourismus/Kauf) | limassol-marina (Sektion im Hub) |
| וילות בקפריסין לנופש | 90 | 0.75 | MEDIUM | commercial (rental) | rentals (NICHT bauen) |
| וילה בקפריסין לנופש | 90 | 0.75 | MEDIUM | commercial (rental) | rentals (NICHT bauen) |
| בית בקפריסין | 70 | 2.86 | MEDIUM | commercial | houses-cyprus |
| דירות בקפריסין למכירה | 70 | 3.55 | MEDIUM | commercial | hub-cyprus |
| דירות למכירה בקפריסין פאפוס | 70 | 3.00 | MEDIUM | commercial | paphos-apartments |
| דירות למכירה בפאפוס יד 2 | 70 | 1.57 | MEDIUM | commercial | paphos-apartments (Resale-Intent) |
| בתים למכירה בקפריסין היוונית | 70 | 1.84 | MEDIUM | commercial | houses-cyprus |
| נדלן בפאפוס | 70 | 3.89 | LOW | commercial | paphos-hub |
| בתים למכירה בקפריסין | 70 | 2.58 | HIGH | commercial | houses-cyprus |
| כמה עולה דירה בקפריסין | 70 | 2.15 | LOW | commercial | prices |
| השקעות נדלן בחו"ל | 70 | 8.46 | LOW | informational | overseas-generic (Blog) |
| דירות להשכרה בקפריסין יד 2 | 50 | 0.73 | LOW | commercial (rental) | rentals (NICHT bauen) |
| דירות למכירה בלימסול קפריסין יד 2 | 50 | 1.48 | MEDIUM | commercial | limassol-apartments |
| בתים למכירה בפאפוס קורל ביי | 50 | 2.52 | HIGH | commercial | paphos-villas (Coral Bay) |
| דירות למכירה בלרנקה קפריסין | 50 | 2.55 | MEDIUM | commercial | larnaca (NICHT bauen) |
| מחיר דירות בקפריסין | 50 | 3.35 | MEDIUM | commercial | prices |
| מחירון דירות בקפריסין | 50 | 3.35 | MEDIUM | commercial | prices |
| מחירי דירות בקפריסין | 50 | 3.35 | MEDIUM | commercial | prices |
| דירות בפאפוס למכירה | 50 | 3.19 | HIGH | commercial | paphos-apartments |
| דירות למכירה בפאפוס | 50 | 1.89 | HIGH | commercial | paphos-apartments |
| דירות למכירה בלימסול | 50 | 5.79 | HIGH | commercial | limassol-apartments |
| נדלן קפריסין | 50 | 4.56 | MEDIUM | commercial | hub-cyprus |
| לימסול ישראלים | 50 | – | LOW | informational | relocation |
| וילות להשכרה בקפריסין | 50 | 0.88 | MEDIUM | commercial (rental) | rentals (NICHT bauen) |
| נדל"ן בחו"ל | 50 | 5.31 | LOW | informational | overseas-generic (Blog) |
| איפה כדאי לקנות דירה להשקעה בחול | 50 | 6.35 | MEDIUM | informational | overseas-generic (Blog) |
| האם כדאי לקנות דירה ביוון | 50 | 2.56 | MEDIUM | informational | greece (out of scope) |
| נכס בקפריסין | 40 | 2.46 | MEDIUM | commercial | hub-cyprus |
| נכסים בקפריסין | 40 | 2.46 | MEDIUM | commercial | hub-cyprus |
| דירה בלימסול גינדי | 40 | 3.67 | MEDIUM | navigational | brand/portal-navigational |
| גינדי לימסול מחיר | 40 | 2.76 | MEDIUM | navigational | brand/portal-navigational |
| אמנת מס קפריסין ישראל | 40 | – | LOW | informational | tax |
| וילות למכירה בקפריסין | 40 | 1.52 | MEDIUM | commercial | villas-cyprus |
| קניית דירה בקפריסין | 40 | 4.62 | HIGH | commercial | buying-process |
| לימסול דירות למכירה | 40 | 4.62 | MEDIUM | commercial | limassol-apartments |
| בתים בקפריסין | 40 | 2.49 | MEDIUM | commercial | houses-cyprus |
| מעבר לקפריסין | 40 | 1.51 | LOW | informational | relocation |
| הגירה לקפריסין | 40 | 2.51 | LOW | informational | relocation |
| וילה בפאפוס עם בריכה | 40 | 0.56 | MEDIUM | mixed (Urlaub/Kauf) | paphos-villas |
| לרנקה דירות למכירה | 40 | 2.23 | MEDIUM | commercial | larnaca (NICHT bauen) |
| וילות בקפריסין למשפחות | 40 | 0.47 | MEDIUM | commercial (rental) | rentals (NICHT bauen) |
| דירות להשכרה בקפריסין | 40 | 1.51 | MEDIUM | commercial (rental) | rentals (NICHT bauen) |
| דירות נופש בקפריסין | 40 | 1.35 | MEDIUM | commercial (rental) | rentals (NICHT bauen) |
| השקעות בחו ל | 40 | 8.63 | MEDIUM | informational | overseas-generic (Blog) |
| לגור בקפריסין | 30 | 5.12 | MEDIUM | informational | relocation |
| למה לא להשקיע בקפריסין | 30 | 4.61 | LOW | informational | investment (FAQ) |
| פרויקטים בקפריסין | 30 | 5.19 | HIGH | commercial | new-projects (→ /he/projects) |
| דירה להשקעה בלימסול | 30 | 6.17 | MEDIUM | commercial | limassol-investment |
| פרויקטים בלימסול | 30 | 10.89 | HIGH | commercial | limassol-projects |
| נדלן בלימסול | 30 | 5.01 | HIGH | commercial | limassol-hub |
| וילה בקפריסין עם בריכה | 30 | 0.88 | MEDIUM | mixed (Urlaub/Kauf) | villas-cyprus |
| תושבות בקפריסין | 30 | 1.02 | LOW | informational | residency |
| קניית נכס בקפריסין | 30 | 3.35 | HIGH | commercial | buying-process |
| קניית בית בקפריסין | 30 | 3.46 | MEDIUM | commercial | buying-process |
| חובת דיווח על נכסים בחו"ל | 30 | – | LOW | informational | overseas-generic (Blog) |
| דירות להשכרה בקפריסין לטווח ארוך | 30 | 2.33 | MEDIUM | commercial (rental) | rentals (NICHT bauen) |
| וילה בקפריסין להשכרה | 30 | 1.11 | MEDIUM | commercial (rental) | rentals (NICHT bauen) |
| וילות בקפריסין להשכרה | 30 | 1.11 | MEDIUM | commercial (rental) | rentals (NICHT bauen) |
| דירות להשכרה בפאפוס | 30 | 0.56 | MEDIUM | commercial (rental) | rentals (NICHT bauen) |
| וילות להשכרה בפאפוס | 30 | 0.87 | HIGH | commercial (rental) | rentals (NICHT bauen) |
| וילות להשכרה בלימסול | 30 | 1.28 | MEDIUM | commercial (rental) | rentals (NICHT bauen) |
| דירות להשכרה בלרנקה | 30 | 1.25 | MEDIUM | commercial (rental) | larnaca (NICHT bauen) |
| לימסול נדל"ן | 20 | 3.48 | HIGH | commercial | limassol-hub |
| לימסול נדלן | 20 | 3.48 | HIGH | commercial | limassol-hub (Variante) |
| קניתי דירה בקפריסין | 20 | – | LOW | informational | buying-process |
| רכישת דירה בקפריסין | 20 | 3.79 | MEDIUM | commercial | buying-process |
| נכסים למכירה בקפריסין | 20 | 2.89 | MEDIUM | commercial | hub-cyprus |
| נדלן להשקעה בקפריסין | 20 | 2.23 | HIGH | commercial | investment |
| בית בקפריסין מחיר | 20 | 2.68 | MEDIUM | commercial | prices |
| בית בקפריסין על הים | 20 | 2.73 | MEDIUM | commercial | houses-cyprus (seafront) |
| בתים בקפריסין על הים | 20 | 2.80 | MEDIUM | commercial | houses-cyprus (seafront) |
| בתים בקפריסין למכירה | 20 | 1.36 | MEDIUM | commercial | houses-cyprus |
| וילה בקפריסין על הים למכירה | 20 | 2.12 | MEDIUM | commercial | villas-cyprus (seafront) |
| וילה בקפריסין על הים | 20 | 0.55 | MEDIUM | mixed (Urlaub/Kauf) | villas-cyprus (seafront) |
| דירות למכירה בלימסול קפריסין | 20 | 5.02 | HIGH | commercial | limassol-apartments |
| לימסול מרינה | 20 | 1.65 | LOW | mixed (Tourismus/Kauf) | limassol-marina (Sektion im Hub) |
| דירות למכירה בפאפוס קפריסין | 20 | 2.47 | HIGH | commercial | paphos-apartments |
| פאפוס דירות למכירה | 20 | 2.83 | MEDIUM | commercial | paphos-apartments |
| וילות בקפריסין פאפוס | 20 | 0.48 | HIGH | mixed (Urlaub/Kauf) | paphos-villas |
| וילה בקפריסין פאפוס | 20 | 0.48 | HIGH | mixed (Urlaub/Kauf) | paphos-villas |
| וילה בפאפוס על הים | 20 | 0.62 | MEDIUM | mixed (Urlaub/Kauf) | paphos-villas |
| פאפוס וילות | 20 | 1.05 | MEDIUM | mixed (Urlaub/Kauf) | paphos-villas |
| דירות למכירה בקפריסין יד 2 | 20 | 2.90 | MEDIUM | navigational | brand/portal-navigational |
| תושבות קבע בקפריסין | 20 | 3.37 | LOW | informational | residency |
| מיסוי נדלן בקפריסין | 20 | 7.80 | LOW | informational | tax |
| מס חברות בקפריסין | 20 | 0.06 | LOW | informational | tax |
| משכנתא בקפריסין | 20 | 13.46 | LOW | informational | financing |
| לעבור לגור בקפריסין | 20 | 5.34 | MEDIUM | informational | relocation |
| קהילה ישראלית בקפריסין | 20 | – | LOW | informational | relocation |
| כמה ישראלים בקפריסין | 20 | – | LOW | informational | relocation |
| פורום ישראלים בקפריסין | 20 | – | LOW | informational | relocation |
| חווה למכירה בקפריסין | 20 | 1.18 | LOW | commercial | type-pages (NICHT bauen) |
| בתים כפריים למכירה בקפריסין | 20 | 1.07 | MEDIUM | commercial | type-pages (NICHT bauen) |
| בית כפרי בקפריסין | 20 | 3.93 | LOW | commercial | type-pages (NICHT bauen) |
| וילות למכירה בלרנקה | 20 | 0.80 | MEDIUM | commercial | larnaca (NICHT bauen) |
| דירות למכירה בקפריסין לרנקה | 20 | 4.01 | MEDIUM | commercial | larnaca (NICHT bauen) |
| דירות בלרנקה להשכרה | 20 | 1.17 | MEDIUM | commercial (rental) | larnaca (NICHT bauen) |
| דירות נופש בלרנקה | 20 | 0.55 | MEDIUM | commercial (rental) | larnaca (NICHT bauen) |
| דירות בקפריסין להשכרה | 20 | 0.79 | MEDIUM | commercial (rental) | rentals (NICHT bauen) |
| דירות להשכרה בלימסול קפריסין | 20 | 1.43 | MEDIUM | commercial (rental) | rentals (NICHT bauen) |
| דירות להשכרה בלימסול | 20 | 0.92 | MEDIUM | commercial (rental) | rentals (NICHT bauen) |
| דירות נופש בפאפוס | 20 | 1.56 | MEDIUM | commercial (rental) | rentals (NICHT bauen) |
| דירה להשקעה בחו"ל | 20 | 2.67 | MEDIUM | commercial | overseas-generic (Blog) |
| קניית נכס בחו ל | 20 | – | – | commercial | overseas-generic (Blog) |
| מס על הכנסה מחול | 20 | – | LOW | informational | overseas-generic (Blog) |
| מס על רווחי הון בחו"ל | 20 | 0.10 | LOW | informational | overseas-generic (Blog) |

**Unter 20 / Null-Volumen, aber für die Spec relevant:** תושבות קפריסין 10 · מיסים קפריסין 10 · פאפוס נדל"ן 0 · נדל"ן בפאפוס 0 · נדל"ן בלימסול 0 (nur die Form לימסול נדל"ן / נדלן בלימסול hat 20–30) · פרויקטים חדשים בקפריסין 0 · קפריסין נדל"ן להשקעה 0 · פנטהאוז בקפריסין 0 · alle Off-Plan-Formulierungen (על הנייר, מקבלן) 0 · Nordzypern (צפון קפריסין נדל"ן, קפריסין הטורקית דירות) 0 · alle „Meerblick Limassol"-Formulierungen < 20.

### Cluster-Summen (nur bau-fähige, kommerzielle Cluster; Close-Variants einmal gezählt)

| Cluster | Keywords ≥20 | Σ Volumen | Ø CPC | Kommentar |
|---|---:|---:|---:|---|
| hub-cyprus (נדל"ן / דירות / נכסים בקפריסין) | 9 | ≈ 1.030 | $3–7 | größter Cluster, reiner Kauf-Intent |
| investment | 8 | ≈ 640 | $4–7 | zweitgrößter, höchste CPCs unter den Kauf-Clustern |
| villas-cyprus (inkl. seafront) | 8 | ≈ 590 | $0.8–2.4 | **nur ~40 % Kauf-Intent** (SERP = Airbnb/Booking) |
| paphos (apartments + villas + hub) | 17 | ≈ 810 | $0.5–3.9 | Villen-Anteil gemischt, Apartments sauber |
| limassol (apartments + hub + projects + investment) | 11 | ≈ 500 | $2.7–10.9 | plus 340 Marken-Volumen (Gindi) |
| prices | 6 | ≈ 350 | $2–3.4 | fehlt in der Spec |
| houses-cyprus | 8 | ≈ 300 | $1.4–2.9 | „בתים" ≠ „וילות" im Hebräischen |
| relocation | 9 | ≈ 480 | $1.5–5.3 | informational, aber Brücken-Cluster |
| buying-process | 5 | ≈ 140 | $3.4–4.6 | klein, hoher Lead-Wert |
| residency | 2 (+1 <20) | ≈ 60 | $1–3.4 | sehr klein |
| tax | 3 (+1 <20) | ≈ 90 | – | sehr klein, informational |

---

## 3. Wettbewerber-Landschaft (Domains in ≥ 2 der 14 Head-Term-SERPs, Top 10)

| Domain | SERPs | Typ / Notiz |
|---|---:|---|
| facebook.com | 10 | Facebook-Gruppen („קפריסין – נדל"ן", „קפריסין רילוקיישן", „לימסול ופאפוס"). Der Markt ist community-getrieben; Gruppen ranken vor Maklern. |
| fourseasonsreg.com (קבוצת ארבע עונות) | 7 | Israelischer Vermarkter/Makler für Zypern-Neubau, eigener Limassol-Turm („Trilogy"). Sichtbarster Wettbewerber; deckt Investment, Preise, Paphos-Villen, Limassol-Projekte ab. |
| cy.green-acres.com | 6 | Internationales Immobilienportal (FR), hebräisch lokalisierte Listing-Hubs mit Bestandszahlen („7.389 נכסים", „3.091 בלימסול"). Zeigt: Google belohnt HE-Listing-Hubs mit Inventar-Countern. |
| booking.com / he.airbnb.com / tripadvisor.co.il / agoda.com | 6 / 4 / 4 / 3 | Reise-Plattformen — verunreinigen alle Villen-Queries (וילות ב…). |
| globes.co.il | 5 | Israelische Wirtschaftszeitung. **Eine Negativ-Story** („Dir wurde eine glänzende Wohnung in Zypern für 150k $ versprochen, dann wurde alles kompliziert") rankt in 5 von 14 SERPs → Vertrauensthema, das die HE-Seiten adressieren müssen (Treuhand, Anwalt, Title Deeds). |
| ocean-cyprus.com | 5 | Israelisch geführte Agentur Zypern: Immobilien + Relocation + Aufenthalt (HE-Site, blockt Bots). |
| onarestates.com (Onar Estates) | 5 | Israelischer Makler/Vermarkter, Fokus Investment Limassol. |
| nadlanmaster.co.il (נדלן מאסטר) | 4 | Israelisches Immobilien-Content-/Lead-Gen-Portal mit „Zypern-Guides 2026". Content-Wettbewerber, kein Inventar. |
| berkos.co.il (ברקוס) | 4 | Israelischer Auslands-Immobilien-Vermarkter, Ratgeber-Format. |
| rd-realestate.co.il | 4 | Israelischer Makler, Fokus Zypern-Wohnungen inkl. Resale/יד 2. |
| geoln.com | 4 | Internationales Off-Plan-Portal (Bauträger direkt), HE-lokalisiert. |
| omroads.com (+ realestate.omroads.com) | 3 (+2) | Israelische Beratung: Zypern-Investment + Aufenthaltsstatus, eigene Listing-Subdomain. |
| k-g.co.il (קאשי גרופ) | 3 | Israelischer Makler (Ayia Napa/Protaras, Limassol-Neubau). |
| investrespect.co.il (Invest Respect Cyprus) | 3 | Israelischer Makler, Investment Limassol. |
| bell-group.co.il (בל גרופ) | 2 | Israelische Investment-Gruppe + „Immobilien-Akademie". |
| grei.co.il (GREI) | 2 | Israelischer Auslands-Investment-Vermarkter, Limassol Neubau + Resale. |
| invest-cyprus.co.il | 2 | Israelisches Zypern-Investment-Portal („Startseite für den israelischen Investor"). |
| thisiscyprus.co.il | 2 | Israelische Info-/Lead-Gen-Site („Projekte ab 130.000 €"). |
| gopaphos.co.il / cyprushotel.net | 2 / 2 | Israelische Paphos-Reiseführer / Hotel-Site (Villen-Queries). |

**Einzeltreffer mit strategischer Bedeutung:** gindi-global.com (Gindi — israelischer Bauträger mit Limassol-Projekt; sein Markenname ist das größte „Limassol"-Immobilien-Keyword) · theringcyprus.com (Bauträger-Projektseite Larnaka in HE) · okifinance.com (israelischer Finanzberater, „Käufergruppe Limassol, 70 % Finanzierung") · israel-cyprus.co.il (Israelisch-Zyprische Handelskammer) · volco.co.il, newkey.co.il (israelische Neubau-Kataloge) · index.cy (zypriotisches Portal mit HE-Seiten) · Relocation/Steuer-Dienstleister für תושבות/רילוקיישן: passportcard.co.il, globus-relocation.co.il, relotax.co.il, y-tax.co.il, greenbergm.co.il, brain-mobility.com, winest-group.com, shin-cyprus.co.il, cyprus.co.il, paphosportal.co.il.

**Fazit Wettbewerb:** Kein Wettbewerber verbindet (a) echtes, gepflegtes Neubau-Inventar Paphos+Limassol mit (b) hebräischer Sprache und (c) Kaufprozess-/Vertrauens-Content. Die israelischen Makler haben Sprache + Vertrauen, aber dünnes oder fremdes Inventar; Green Acres/Geoln haben Inventar, aber maschinelles Hebräisch und keine Beratung. cyprusvipestates.com ist in keiner SERP vertreten.

---

## 4. Priorisierte Seitenliste (Ziel 15–25 → **17 Singlepages + 1 Systemseite**)

Ranking nach Volumen × kommerzieller Intent × Inventar-Fit. Slugs unter `/he/` lateinisch (Spec 3.6). Alle Hubs/Spokes verlinken nur innerhalb `he` (Spec 3.6).

| # | Seite | H1 (HE, Vorschlag) | Primär-KW (Vol.) | Sekundär-KWs | Intent | Inventar | Hub/Spoke | Slug |
|---|---|---|---|---|---|---|---|---|
| 1 | **Cornerstone Zypern-Immobilien** | נדל"ן בקפריסין: פרויקטים חדשים למכירה בלימסול ובפאפוס | נדל"ן בקפריסין (320) | דירות בקפריסין 260, דירה בקפריסין 260, נדלן קפריסין 50, נכס/נכסים בקפריסין 40+40, נכסים למכירה 20 | commercial | general (221 Projekte) | **Hub** | `/he/real-estate-cyprus` |
| 2 | **Wohnungen zum Kauf Zypern** | דירות למכירה בקפריסין | דירות למכירה בקפריסין (140) | דירות בקפריסין למכירה 70, דירות בקפריסין יד 2 260 (Portal-Intent, per Listing-UX abfangen) | commercial | Limassol 49 + Paphos 69 Apartments | Spoke von 1 | `/he/apartments-for-sale-cyprus` |
| 3 | **Investment-Hub** | השקעות נדל"ן בקפריסין: דירות להשקעה עם תשואה | השקעות נדל"ן בקפריסין (140) | דירה להשקעה 140, דירות להשקעה 140, השקעה בקפריסין 110, השקעות בקפריסין 110, נדלן להשקעה 20, FAQ: למה לא להשקיע בקפריסין 30 | commercial | general | **Hub** (Investment) | `/he/property-investment-cyprus` |
| 4 | **Preisseite** | מחירי דירות בקפריסין 2026: כמה עולה דירה לפי אזור | דירות בקפריסין מחירים (110) | כמה עולה דירה 70, מחירי/מחיר/מחירון דירות 50+50+50, בית בקפריסין מחיר 20 | commercial | general (echte Preisspannen aus dem Inventar — Vorteil gegenüber allen Ratgeber-Sites) | Spoke von 1 | `/he/property-prices-cyprus` |
| 5 | **Limassol-Hub** | נדל"ן בלימסול: דירות ופרויקטים חדשים למכירה | דירות בלימסול (110) | דירה בלימסול 110, דירות למכירה בלימסול 50 (+יד 2 50), לימסול דירות למכירה 40, נדלן בלימסול 30, לימסול נדל"ן 20, דירות למכירה בלימסול קפריסין 20; Sektion „מרינה לימסול" 90 | commercial | Limassol 55 / 49 Apartments | **Hub** | `/he/limassol` |
| 6 | **Limassol Neubau & Investment** | פרויקטים חדשים בלימסול: דירות להשקעה | פרויקטים בלימסול (30, CPC $10,89) | דירה להשקעה בלימסול 30, פרויקטים בקפריסין 30; fängt Gindi-Vergleichs-Traffic (גינדי לימסול 260) über „Vergleich der Neubauprojekte" ab | commercial | Limassol | Spoke von 5 | `/he/limassol/new-projects` |
| 7 | **Paphos-Hub** | נדל"ן בפאפוס: וילות ודירות בפרויקטים חדשים | נדלן בפאפוס (70) | דירות בפאפוס 90, דירה בפאפוס 90 | commercial | Paphos 166 | **Hub** | `/he/paphos` |
| 8 | **Paphos Wohnungen** | דירות למכירה בפאפוס | דירות למכירה בקפריסין פאפוס (70) | דירות בפאפוס למכירה 50, דירות למכירה בפאפוס 50, דירות למכירה בפאפוס קפריסין 20, פאפוס דירות למכירה 20, דירות למכירה בפאפוס יד 2 70 (Resale — nur als Abgrenzung erwähnen) | commercial | Paphos 69 Apartments | Spoke von 7 | `/he/paphos/apartments` |
| 9 | **Paphos Villen** | וילות למכירה בפאפוס | וילות בפאפוס (170, mixed) | וילה בפאפוס 170, בתים למכירה בפאפוס קורל ביי 50, וילה בפאפוס עם בריכה 40, וילה בפאפוס על הים 20, וילות בקפריסין פאפוס 20, פאפוס וילות 20 | mixed → „למכירה" im Title/H1 erzwingen | Paphos 95 Villen | Spoke von 7 | `/he/paphos/villas` |
| 10 | **Villen-Hub Zypern** | וילות למכירה בקפריסין | וילות בקפריסין (320, mixed) | וילה בקפריסין 320, וילה בקפריסין למכירה 90, וילות למכירה בקפריסין 40, וילה בקפריסין עם בריכה 30 | mixed (≈40 % Kauf) | Paphos 95 + Limassol 6 Villen | **Hub** (Villen) | `/he/villas-cyprus` |
| 11 | **Villen am Meer** | וילות למכירה על הים בקפריסין | וילה למכירה בקפריסין על הים (110) | וילה בקפריסין על הים למכירה 20, וילה בקפריסין על הים 20, בית/בתים בקפריסין על הים 20+20 | commercial (sauber, weil „למכירה") | Paphos Küste (Coral Bay, Kissonerga, Chloraka) | Spoke von 10 | `/he/seafront-villas-cyprus` |
| 12 | **Häuser zum Kauf** | בתים למכירה בקפריסין היוונית | בתים למכירה בקפריסין (70) | בית בקפריסין 70, בתים למכירה בקפריסין היוונית 70, בתים בקפריסין 40, בתים בקפריסין למכירה 20, קניית בית בקפריסין 30 | commercial | Paphos Villen/Townhouses | Spoke von 10 (Querlink zu 1) | `/he/houses-for-sale-cyprus` |
| 13 | **Kaufprozess-Cornerstone** | איך קונים דירה בקפריסין: המדריך המלא לישראלים | קניית דירה בקפריסין (40) | קניית נכס 30, קניית בית 30, רכישת דירה 20, קניתי דירה בקפריסין 20 (Erfahrungs-Intent), משכנתא בקפריסין 20 | commercial-informational | general | Spoke von 1 (verlinkt aus allen Hubs) | `/he/buying-property-in-cyprus` |
| 14 | **Relocation-Brücke** | רילוקיישן לקפריסין: המדריך לישראלים + דירות למגורים | רילוקיישן לקפריסין (170) | ישראלים בקפריסין 90, לימסול ישראלים 50, מעבר לקפריסין 40, הגירה לקפריסין 40, לגור בקפריסין 30, לעבור לגור 20, קהילה ישראלית 20 | informational → commercial CTA | general (Limassol-Schwerpunkt: dort lebt die israelische Community) | **Hub** (Relocation) | `/he/relocation-cyprus` |
| 15 | **Aufenthaltsstatus** | תושבות קבע בקפריסין דרך רכישת נכס | תושבות בקפריסין (30) | תושבות קבע בקפריסין 20, תושבות קפריסין 10 | informational (hoher Lead-Wert) | general | Spoke von 14 | `/he/permanent-residency-cyprus` |
| 16 | **Steuern** | מיסים על נדל"ן בקפריסין לישראלים: אמנת המס, מס רכישה ומס שבח | אמנת מס קפריסין ישראל (40) | מיסוי נדלן בקפריסין 20, מס חברות בקפריסין 20, מיסים קפריסין 10; Non-Dom nur als Abschnitt (0 Volumen) | informational | general | Spoke von 3 und 14 | `/he/property-tax-cyprus` |
| 17 | **Limassol Investment-Wohnung** (optional, Welle 2) | דירה להשקעה בלימסול | דירה להשקעה בלימסול (30, CPC $6,17) | — | commercial | Limassol | Spoke von 5/3 | `/he/limassol/investment-apartments` — **nur bauen, wenn Seite 6 nach 3 Monaten nicht dafür rankt** |
| S | **Systemseite Projektliste** | פרויקטים חדשים בקפריסין | פרויקטים בקפריסין (30) | פרויקטים חדשים בקפריסין 0, דירות חדשות 0 | commercial | alle | System (`/he/projects`) | kein separates Singlepage — die lokalisierte Projektliste (Spec 4.1) trägt diesen Cluster |

**Empfohlene Reihenfolge für Phase 5:** Welle 1 = #1, #3, #5, #7, #2, #4 (≈ 75 % des kaufbaren Volumens). Welle 2 = #8–#13. Welle 3 = #14–#16 (Brücken-Cluster, informational). #17 nur bei Bedarf.

### 4.1 Explizit NICHT bauen (trotz messbarem Volumen)

| Cluster | Σ Volumen ≥20 | Grund |
|---|---:|---|
| **Larnaka** (וילות בלרנקה 110, דירות בלרנקה 90, דירות למכירה בלרנקה 50+40+20, Vermietung 30+20+20) | ≈ 380 | Nur 1 Projekt im Inventar. Bemerkenswert: Larnaka-Nachfrage ≈ Limassol-Apartment-Nachfrage. Falls später Larnaka-Inventar kommt (z. B. via Feed), ist das ein fertiger Cluster. |
| **Vermietung / Ferienvermietung** (להשכרה, נופש, לטווח ארוך) | ≈ 560 | Nicht im Geschäftsmodell. Auf Seite #3 (Investment) nur als „Vermietungsrendite" thematisieren. |
| **Limassol-Villen** (וילות בלימסול 210) | 210 | SERP 10/10 Ferienvermietung (Agoda, Airbnb, Booking, Tripadvisor); Inventar 6 Villen. Als Absatz im Limassol-Hub, keine Seite. |
| **Typ-Seiten** (Penthouse 0, Stadthaus 0, בית כפרי 20, חווה 20, בתים כפריים 20) | 60 | Spec-Bedingung „nur wenn Volumen nachweisbar" nicht erfüllt; ländliche Häuser/Farmen nicht im Inventar. |
| **Nordzypern** | 0 | Kein messbares Hebräisch-Volumen, ohnehin ausgeschlossen. |
| **Griechenland-Vergleich** (נדלן ביוון 260, וילות ביוון 260, דירות ביוון 140, בתים למכירה ביוון 170) | ≈ 830 | Außerhalb des Angebots. Der Vergleich „קפריסין או יוון" ist aber ein natürliches Blog-Thema (Abschnitt 5). |
| **Marken-Navigational** (גינדי לימסול 260+40+40, יד 2-Varianten 260+70+50+20) | ≈ 740 | Fremde Marken. Gindi-Traffic nur indirekt über #6 (Projektvergleich Limassol) adressieren; יד 2-Intent nur über Listing-UX (Filter, Preise, Karten) auf #2/#5/#8 — keine „יד 2"-Seiten. |
| **Off-Plan/„על הנייר"** | 0 | Null Volumen im Hebräischen; Off-Plan ist im Hebräisch-Markt kein eigener Suchbegriff, sondern „פרויקטים חדשים". |

---

## 5. Informational-Nachfrage, die bewusst in den EN-Blog geht

Der Blog bleibt laut Spec (4.4, Entscheidung C) englisch; der `/he/blog`-Index zeigt Cross-Locale-Karten. Folgende hebräische Informational-Queries bekommen **keine** HE-Landingpage; stattdessen wird das passende EN-Blog-Thema aus dem `/he/blog`-Index und aus den Hub-FAQs verlinkt. Realistische Erwartung: hebräische Suchende klicken selten auf englische Artikel — diese Liste ist also primär ein **Backlog für eine spätere HE-Blog-Entscheidung**, nicht kurzfristiger Traffic.

| Query (HE) | Vol. | EN-Blog-Thema (bestehend oder neu) |
|---|---:|---|
| השקעות נדלן בחול / נדל ן בחול / השקעות בחו ל / נדל"ן בחו"ל | 260 / 170 / 40 / 50 | „Where Israelis invest abroad: Cyprus vs. Greece vs. Portugal" (neu) — CPC $19,55 zeigt Wert, aber generisch |
| איפה כדאי לקנות דירה להשקעה בחול | 50 | dito |
| נדלן ביוון / האם כדאי לקנות דירה ביוון | 260 / 50 | „Cyprus or Greece for property investment?" (neu) |
| למה לא להשקיע בקפריסין | 30 | „Risks of buying property in Cyprus" — zusätzlich als FAQ-Block auf Seite #3 (kritische Vertrauensfrage, siehe Globes-Story) |
| חובת דיווח על נכסים בחו"ל / מס על הכנסה מחול / מס על רווחי הון בחו"ל | 30 / 20 / 20 | israelisches Steuerrecht — nicht unser Fachgebiet; nur Hinweis + Link auf #16 |
| כמה ישראלים בקפריסין / פורום ישראלים בקפריסין | 20 / 20 | „The Israeli community in Limassol" — Abschnitt in #14, kein eigener Beitrag |
| קניתי דירה בקפריסין | 20 | Erfahrungsbericht/Case Study (Spec 4.1: 3 Case Studies werden lokalisiert → dort verlinken) |
| מס חברות בקפריסין | 20 | Firmenbesteuerung — nur Absatz in #16 |
| משכנתא בקפריסין | 20 (CPC $13,46) | „Financing a Cyprus property as a non-resident" (EN-Blog, neu) + Abschnitt in #13 |
| מרינה לימסול / לימסול מרינה | 90 / 20 | Tourismus-dominiert; Abschnitt „Limassol Marina" im Limassol-Hub reicht |

---

## 6. Überraschungen gegenüber den Annahmen der Spec

1. **Der Markt ist winzig.** Head-Term 320/Monat; der gesamte kaufbare Zypern-Immobilien-Bedarf auf Hebräisch liegt bei ≈ 2.500–3.000 Suchen/Monat (Close-Variants einmal gezählt). Zum Vergleich: allein Flüge nach Paphos haben 9.900. Die HE-Lokalisierung rechtfertigt sich über Lead-Wert (CPC $4–11, Käufer mit 150–500k €), nicht über Traffic. Die 15–25 Seiten aus Entscheidung G sind erreichbar (17 + 1), aber die Hälfte davon zielt auf 20–70 Suchen/Monat.
2. **Villen-Keywords sind Ferienvermietungs-Keywords.** וילות בקפריסין (320), וילות בפאפוס (170), וילות בלימסול (210): SERP zu 70–100 % Airbnb/Booking/Tripadvisor/Agoda, CPC nur $0,5–1,0. Spec-Cluster 3 („Villen Paphos, Luxusvillen") ist realistisch nur über die „למכירה"-Varianten (90 + 110 + 40 + 20) sauber adressierbar. Title/H1 der Villen-Seiten müssen „למכירה" tragen, sonst konkurrieren wir mit Booking.
3. **Preise fehlen in der Spec, sind aber der drittstärkste Kauf-Cluster** (≈ 350/Monat: מחירים, כמה עולה, מחירון). Alle Wettbewerber bedienen ihn mit statischen Ratgebern — wir können ihn mit echten Inventar-Preisspannen bedienen.
4. **Aufenthalt & Steuern (Spec-Cluster 5) haben fast kein Volumen**: תושבות 30+20+10, מס 40+20+20, Non-Dom 0, „תהליך רכישת נכס" 0 (die echte Formulierung ist קניית דירה בקפריסין 40). Statt mehrerer Seiten: **eine** Kaufprozess-Seite (#13), **eine** Aufenthalts-Seite (#15), **eine** Steuer-Seite (#16). Der Lead-Wert bleibt hoch — die SERPs sind voller Steuerberater und Relocation-Firmen, kein Makler mit Inventar.
5. **Off-Plan existiert im Hebräischen nicht als Suchbegriff** (על הנייר 0, מקבלן 0, פרויקטים חדשים 0). Die Nachfrage heißt „פרויקטים ב…" (30 + 30, CPC bis $10,89). Kein separater Off-Plan-Spoke; die Projektliste `/he/projects` trägt das.
6. **Larnaka-Nachfrage ≈ Limassol-Apartment-Nachfrage** (≈ 380 vs. ≈ 500). Die Spec schließt Larnaka korrekt aus (1 Projekt), aber es ist die größte unbediente Lücke; ein Larnaka-Feed würde einen fertigen Cluster erschließen.
7. **Ein israelischer Bauträger ist das größte Limassol-Keyword.** גינדי לימסול 260 (+ 40 + 40) — mehr als דירות בלימסול (110). Israelische Bauträger vermarkten Limassol direkt in Israel; Seite #6 muss ein „Neubauprojekte Limassol im Vergleich" sein, nicht nur ein Listing.
8. **„יד 2" (Yad2) steckt in ≈ 400 Suchen/Monat**, aber Yad2 selbst rankt nirgends. Israelis erwarten ein Kleinanzeigen-Portal-Erlebnis (Filter, Preise, viele Einträge). Green Acres gewinnt genau damit (HE-Hub + Inventar-Counter). Unsere Listing-Seiten sollten Inventar-Zahlen im Title/H1 tragen („166 פרויקטים בפאפוס").
9. **Facebook-Gruppen ranken in 10 von 14 SERPs** vor den meisten Maklern; die Globes-Negativ-Story rankt in 5 SERPs. Vertrauen (Anwalt, Treuhand, Title Deeds, „warum Israelis in Zypern scheitern") gehört prominent auf #1, #3 und #13 — und eine Präsenz in den relevanten Gruppen ist ein Off-Page-Thema für Phase 9.
10. **Griechenland-Vergleich ist so groß wie der Zypern-Head-Term** (נדלן ביוון 260, וילות ביוון 260). Israelis vergleichen die beiden Länder aktiv — ein Blog-Thema, keine Landingpage.
11. **Limassol „Meerblick/Beachfront" (Spec-Cluster 2) hat kein messbares Hebräisch-Volumen** (< 20 für alle Formulierungen). Nur „וילה למכירה בקפריסין על הים" 110 (zypernweit, faktisch Paphos-Küste) trägt einen Seafront-Spoke (#11).
12. **Google Ads Keyword-Planner ist für Hebräisch fast blind**: `keywords_for_keywords` lieferte nur Close-Variants der Seeds (19 Zeilen). Die eigentliche Expansion kam aus DataForSEO Labs (related_keywords → „Ähnliche Suchanfragen") und manueller Kandidaten-Formulierung. Für künftige HE-Recherchen direkt mit Labs + manuellen Listen arbeiten.

---

## 7. Rohdaten & Reproduktion

- Scripts und Roh-JSON (nicht im Repo): Scratchpad `he-kw/` — `lib.mjs` (Auth + Kosten-Log + $8-Cap), `expand.mjs`, `expand2.mjs`, `merge-and-volume.mjs`, `serp.mjs`, `classify.mjs`; Roh-Antworten `kfk-ads.json`, `sugg-*.json`, `rel-*.json`, `vol-0/1.json`, `serp-results.json`, `domains.json`, `cost.json`.
- Kosten pro Call: keywords_for_keywords $0,09 · Labs suggestions $0,012–0,036 · Labs related $0,014–0,021 · search_volume $0,09/Batch · SERP regular ≈ $0,002/Call. Gesamt **$0,728**.
- Der bereinigte Datensatz (144 Zeilen ≥ 20 + 8 Null-/Kleinvolumen-Referenzen) liegt in `docs/i18n/he-keywords.csv`.
