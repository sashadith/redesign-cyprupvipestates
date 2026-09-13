# Review-Protokoll `c-legal` — Rechtstexte `he` (Phase 5b, Task 2)

**Stand:** 2026-09-13 · **Status:** Pass A + Pass B (inline) erledigt, Pass C (muttersprachlicher Lektor) offen · **Marker:** `REVIEW(he)` an beiden Tabellen

## Dateien und Seiten

| Datei | Seite (`he`) | Sektionen EN → HE | Blöcke |
|---|---|---|---|
| `src/app/preview-legal/[lang]/[doc]/privacy.he.ts` (`PRIVACY_HE`) | `/he/privacy-policy` | 10 → 10, IDs identisch | 1:1 gespiegelt, inkl. 2 `definitions`-Blöcke (9 bzw. 3 Einträge), 3 `list`-Blöcke (4/3/6/7 Items), 2 `callout` |
| `src/app/preview-legal/[lang]/[doc]/terms.he.ts` (`TERMS_HE`) | `/he/terms-and-conditions` | 13 → 13, IDs identisch | 1:1 gespiegelt, 4 `list`-Blöcke (3/4/3/3 Items), 1 `callout` |

Registriert in `registry.ts`; die beiden `TODO(he)`-Aliasse auf die englischen Tabellen sind ersetzt. Ein Skript-Vergleich EN↔HE (Sektionszahl, IDs, Blockreihenfolge, Blockart, Item-Zahl) läuft fehlerfrei.

## Hinweis auf die maßgebliche Sprachfassung

`LegalDoc` hat ein neues optionales Feld `bindingNote?: string`. Die Seite rendert es als kleinen Absatz direkt unter der H1 (`.lgl__binding`, neu in `legal.css`), **nur wenn gesetzt**. `en/de/pl/ru` lassen es undefiniert, ihr Output ist damit byte-identisch — `copy-snapshot --check` bestätigt das (3377 Leaves unverändert; die Legal-Registry ist ohnehin kein registriertes Copy-Modul).

Wortlaut (`he`, beide Dokumente wortgleich, neu als Boilerplate-Zeile in `he-glossary.md` §5 „English binding (Rechtstexte)"):

> הנוסח האנגלי של מסמך זה הוא הנוסח המחייב; התרגום לעברית נועד לנוחות בלבד.

Die bereits vorhandene Kurzform `הנוסח האנגלי הוא המחייב.` bleibt für Fließtext und Fußzeilen bestehen; die Langform ist der Seitenhinweis.

## Pass B (inline, Selbstkritik) — was korrigiert wurde

1. **Wurzelwiederholung** (Styleguide §11.5): `פנייה … לפנות` in §1 Datenschutz → `יש להשתמש בפרטי הקשר`; dreifaches `מועד` im Termin-Eintrag; vierfaches `ייעוץ` in AGB §2 → zweiter Satz auf `עצה מקצועית כזו`; `לקבל … ולקבל` im Auskunftsrecht → `לברר … ולקבל`; `הדמיות … להמחשה` in AGB §4 → `תמונות, הדמיות ותצוגות תלת ממד`.
2. **Anglizismen**: `אינדיקציה` → `נמסר לו האם ניתנה הסכמה`; `פרסום חוזר` (Lehnübersetzung von „remarketing") → `שיווק מחדש`; `הקלטת סשן` vermieden zugunsten von `הקלטת גלישה`.
3. **Rechtsregister**: `בתוקף להמשך` → `עם תוקף לעתיד` (Art. 7 (3)); Kommasetzung in der AGB-Einleitung vor `ולא פחות חשוב מכך`.
4. **§7-Verbotsliste**: kein `בין אם … ובין אם` (Erstfassung von Datenschutz §1 hatte es), keine Adjektivstapel, keine Doppelpunkt-Überschriften, keine Ausrufezeichen. Gedankenstriche der englischen Vorlage sind zu Kommas oder eigenen Sätzen aufgelöst (`grep -c "—\|–\|!"` = 0 in beiden Dateien).
5. **Genus**: durchgehend unpersönlich/nominal (`יש ל…`, `אפשר ל…`) bzw. 1. Person Plural für das Unternehmen (`אנחנו`/`איננו`, genusfrei); Anrede wo nötig als männlicher Plural (`שלכם`, `זכויותיכם`). Keine Schrägstrichformen.

## Bidi und Schreibung

- `bidiIsolate()`: `Cyprus VIP Estates`, `SecretBrand Solutions LTD`, alle Anbieternamen (`Google Tag Manager`, `Google Analytics 4`, `Google Ads`, `Google Ireland Limited`, `Meta Pixel`, `Meta Platforms Ireland Limited`, `LinkedIn Insight Tag`, `LinkedIn Ireland Unlimited Company`, `Microsoft Clarity`, `Microsoft Ireland Operations Limited`), `IP`, `TLS`, `GDPR` sowie jede Artikelzitation.
- `ltrIsolate()`: `office@cyprusvipestates.com`, `+357 99 278 285`, `Palaion Patron Germanou 11, 8011`, `commissioner@dataprotection.gov.cy`, `Iasonos 1, 1082`, `https://`.
- Gerade Anführungszeichen, westliche Ziffern, Ktiv male, `נדל"ן` mit Gershayim. Datum (`2026-08-21`) und alle Aufbewahrungsformulierungen unverändert aus dem Englischen.
- Meta (Graphem-Zählung inkl. Isolat-Steuerzeichen): Datenschutz Title 37 / Description 127, AGB Title 33 / Description 121 — beide innerhalb 60 / 155.

## Abweichungen von der englischen Vorlage

1. **AGB §12 „Sprachfassungen"** nennt zusätzlich Hebräisch (`באנגלית, בגרמנית, בפולנית, ברוסית ובעברית`). Das Englische zählt nur vier Fassungen auf, weil es vor dieser Datei geschrieben wurde; die Aufzählung beschreibt eine Tatsache über die veröffentlichten Fassungen, keine neue Rechtsaussage. **Folgeaufgabe für den Controller:** dieselbe Aufzählung sollte in `terms.en.ts` (und de/pl/ru) ergänzt werden, sobald `he` live geht, sonst widersprechen sich die Fassungen.
2. **Artikelzitate bleiben lateinisch** (`Art. 6 (1) (f) GDPR`, `Art. 28 GDPR`, `Art. 46 (2) (c) GDPR`, `Art. 15`–`Art. 22`). Styleguide §4 (Gesetzesbezeichnungen lateinisch); ein hebräischer Buchstabe für den Unterabsatz wäre gegen die Verordnung nicht auflösbar.
3. **`EU-US Data Privacy Framework`** mit Bindestrich statt des offiziellen Halbgeviertstrichs, weil `–` in `he`-Dateien per Gate verboten ist.
4. **Em-Dash-Einschübe** des Englischen (Datenschutz §1/§2/§3, AGB §2/§4/§5) sind zu Kommas, Doppelpunkten oder eigenen Sätzen aufgelöst. Absatzzahl unverändert.

## Offene Fragen für Pass C

1. **Cookie-Kategorien.** Die Policy nennt `הכרחיות / אנליטיקה / שיווק` — so wie der Banner-Beschreibungstext (`CustomCookieConsent.copy.ts`: „עוגיות הכרחיות … עוגיות אנליטיקה ושיווק"). Der Ablehnen-Button desselben Banners heißt aber `רק הנחוצות` (Glossar §4.3). Entweder Button auf `רק ההכרחיות` ziehen oder die Policy auf `נחוצות` — der Lektor entscheidet, dann beide Fundstellen zusammen ändern (Styleguide §11.6).
2. **`ערך גיבוב`** für „hash" — korrekt, aber trocken. Alternative wäre die Umschrift `האש`. Für ein Rechtsdokument wurde die Fachform gewählt.
3. **`בעלי שליטה נפרדים בנתונים`** für „separate controllers": Es gibt keine etablierte hebräische GDPR-Terminologie für *controller*. Falls der Lektor eine Kanzleiformulierung kennt, sollte sie in Glossar §3 aufgenommen und in beiden Dokumenten vereinheitlicht werden.
4. **`משרד נציב הגנת הנתונים האישיים`** (Office of the Commissioner for Personal Data Protection, Zypern): Eigenübersetzung, kein amtlicher hebräischer Name. Adresse und E-Mail sind LTR-isoliert und unverändert.
5. **Anwaltsprüfung bleibt offen** — wie in allen anderen Locales dieses Dokuments. Die hebräische Fassung trifft keine Aussage, die die englische nicht trifft; sie erbt deren Prüfbedarf.
