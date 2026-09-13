# Hebräischer Styleguide — Cyprus VIP Estates (`he`)

**Stand:** 2026-09-13 · **Gilt für:** alle client-facing Texte der Locale `he` (Website-Chrome, Landingpages, Projektbeschreibungen, Formulare, E-Mails, Booking- und Präsentationsseiten). Admin bleibt Englisch.
**Zusammen lesen mit:** `he-glossary.md` (verbindliche Begriffe), `he-keyword-map.md` (Ziel-Keywords je Seite), Spec §3.5 (Qualitäts-Gate).

Dieser Guide ist der Prompt-Kontext für jede Erstübersetzung und den Kritik-Pass und die Checkliste für den muttersprachlichen Lektor. Wer eine Regel bricht, dokumentiert warum.

---

## 1. Zielgruppe und Ton

**Wer liest:** Israelische Privatkäufer und Kleininvestoren, 35–65, meist mit Kaufabsicht oder konkreter Recherche (Zweitwohnung, Anlage, Umzug, Aufenthaltsrecht). Viele kennen Zypern von Kurzreisen, viele lesen zusätzlich Englisch oder Russisch. Sie sind preisbewusst, misstrauisch gegenüber Marketing-Getöse und gewohnt an einen direkten, sachlichen israelischen Ton.

**Register:** professionell-warm, direkt, konkret. Wie ein guter Berater am Telefon spricht: klare Sätze, Zahlen statt Adjektive, ein Gesprächsangebot statt Druck. Kein „Luxus"-Vokabular auf Vorrat.

**Nicht:** Werbe-Hebräisch aus Wohnungsanzeigen (מציאה!, לא לפספס!), kein Pathos, keine Ausrufezeichen in Fließtext.

## 2. Genus und Anrede (Entscheidung D)

Hebräisch zwingt zur Genuswahl. Verbindlich:

1. **Bevorzugt: Nominal- und Infinitivstil**, der keine Anrede braucht. `לקבל ייעוץ` statt `קבל ייעוץ`/`קבלי ייעוץ`. `מידע נוסף`, `צפייה בזמינות`, `שיחה עם יועץ`.
2. **Wenn eine Anrede unvermeidbar ist: männlicher Plural** (`אתם`, `תוכלו`, `שלכם`) — Branchenstandard, wirkt neutral und richtet sich an „Sie als Haushalt/Paar", was für Immobilienkäufer passt.
3. **Nie** Schrägstrich-Formen (`את/ה`, `מעוניין/ת`) im Fließtext. Ausnahme: ein einzelnes Formularfeld-Label, wenn kein Nominalstil möglich ist — bitte vermeiden.
4. In E-Mails an eine konkrete Person (CRM, Auto-Reply) gilt das Genus aus `Lead.salutation`; unbekannt → Plural.

## 3. Satzbau und Länge

- **Kürzer als das Deutsche.** Ein Gedanke pro Satz. Keine Schachtelsätze, keine Nebensatzketten mit `ש…ש…`.
- **Aktiv statt Passiv.** Englische Passiv-Konstruktionen (`is offered`, `can be found`) werden zu Aktiv oder Nominal: `ניתן למצוא` → besser `תמצאו` (Plural) oder `יש`.
- **Keine Doppelpunkt-Überschriften** (`השקעה בקפריסין: המדריך המלא`). Überschriften sind Aussagen oder Nominalphrasen.
- **Keine Aufzählungs-Dreiklänge** als Stilmittel (`מודרני, מרווח ומעוצב`). Wenn drei Eigenschaften, dann weil es genau drei sind.
- **Kein Gedankenstrich** `—` als Satzzeichen; Hebräisch nutzt Komma, Punkt oder einen neuen Satz. Der Bindestrich `-` bleibt in Komposita und vor Zahlen/Fremdwörtern (`מ-€450,000`, `ב-Cap St Georges`).

## 4. Rechtschreibung und Zeichen

- **Ktiv male** (Vollschreibung ohne Vokalzeichen), Standard der Akademie: `דירה`, `וילה`, `פרויקט`, `אינטרנט`.
- **Anführungszeichen:** gerade doppelte `"…"` (technisch robust in HTML/JSON).
- **Abkürzungen** mit Gershayim: `נדל"ן`. Das ist Standard und SEO-relevant — nie `נדלן` schreiben.
- **Fremdnamen in Lateinschrift bleiben lateinisch:** Cyprus VIP Estates, Projektnamen (`Cap St Georges`, `Cypress Park`), Bauträger (`Korantina Homes`), Gesetzesbezeichnungen, Resortnamen. Hebräische Umschrift **nur** für Städte, Regionen und Landmarken (siehe Glossar).
- **Ziffern westlich** (`450,000`), niemals hebräische Zahlzeichen.

## 5. Zahlen, Währung, Datum, Maße

| Was | Konvention | Beispiel |
|---|---|---|
| Preis | `€` **vor** der Zahl, Tausender mit Komma, keine Dezimalen | `€450,000` · `החל מ-€450,000` |
| Preisspanne | Bis-Strich zwischen zwei vollständigen Beträgen | `€320,000–€580,000` |
| Fläche | `מ"ר` nach der Zahl | `120 מ"ר` |
| Zimmer | Zypern zählt **Schlafzimmer**, Israel zählt Räume — immer explizit | `3 חדרי שינה` (nie `4 חדרים`) |
| Datum | Tag Monat Jahr, Monat ausgeschrieben; `he-IL`-Intl | `15 במאי 2026` |
| Fertigstellung | Quartal + Jahr | `רבעון 3 2027` |
| Prozent | `%` nach der Zahl ohne Leerzeichen | `5.2%` |
| Telefon | international, LTR-isoliert | `+357 …` |

**Bidi-Regel:** Preise, Telefonnummern, E-Mail-Adressen, URLs und lateinische Namen werden im HTML in `<bdi>` gesetzt oder mit `unicode-bidi: isolate` isoliert (Phase 2). Die hebräische Präposition steht mit Bindestrich davor: `החל מ-€450,000`.

## 6. SEO-Regeln für hebräische Texte

- **Meta-Title ≤ 60 Zeichen**, Ziel-Keyword vorne, Marke hinten mit `|`: `דירות למכירה בלימסול | Cyprus VIP Estates`.
- **Meta-Description 120–155 Zeichen**, ein konkreter Nutzen + ein Handlungsangebot, kein Keyword-Stuffing.
- **H1 = Suchintention in natürlicher Sprache**, nicht das rohe Keyword: aus `נדל"ן בקפריסין` wird `נדל"ן בקפריסין לרוכשים מישראל`.
- Ein Keyword-Cluster pro Seite. Sekundär-Keywords in H2 und im ersten Absatz, nie erzwungen.
- **Slugs lateinisch** (Entscheidung A), englisch beschreibend: `/he/apartments-limassol`.
- FAQ-Blöcke als echte Fragen, wie Israelis googeln: `כמה עולה דירה בקפריסין?`, `האם ישראלים יכולים לקנות נכס בקפריסין?`
- JSON-LD `inLanguage: "he"`, `og:locale: he_IL`.

## 7. Verbotsliste (typische KI-Muster)

| Muster | Beispiel | Ersatz |
|---|---|---|
| Wörtlich übersetzte Marketing-Verben | `גלו`, `שחררו את הפוטנציאל`, `העלו לרמה הבאה` | konkreter Nutzen: `כך תבחרו דירה…` |
| Adjektiv-Stapel | `ייחודי, מושלם, חלומי, יוקרתי` | eine Tatsache: `200 מטר מהחוף` |
| Kalkierte Idiome | `בסופו של יום`, `לקחת את הצעד הבא` | streichen |
| `בין אם … ובין אם …` in jedem zweiten Absatz | | Aufzählung oder zwei Sätze |
| Englische Wortfolge | `אנו מספקים שירות מקצועי לכל לקוח` | `כל לקוח מקבל יועץ אישי` |
| Höfliche Überflüssigkeiten | `אל תהססו לפנות אלינו` | `אפשר לפנות אלינו בוואטסאפ או בטלפון` |
| Doppelpunkt-Titel, Dreiklänge, `—` | siehe §3 | |
| Deutsche Realität 1:1 (Notar, Grundbuchamt) | `נוטריון` | zyprische Realität: Anwalt (`עו"ד`), `רשם המקרקעין` |

## 8. Inhaltliche Wahrheiten, die jeder Text respektiert

- **Keine erfundenen Zahlen** — Preise, Renditen, Fristen nur aus der Datenbank oder aus benannten Quellen; sonst weglassen.
- **Team spricht kein Hebräisch** (Entscheidung E): Kontakt- und Formularseiten sagen ehrlich `הייעוץ מתקיים באנגלית או ברוסית; פנייה בעברית מתקבלת בברכה`.
- **Larnaka wird nicht beworben** (kein Inventar). Limassol und Paphos sind die Märkte.
- **Rechtstexte:** hebräische Fassung trägt den Hinweis `הנוסח האנגלי הוא המחייב` (Entscheidung B).
- **Keine Zusicherungen** zu Aufenthaltsrecht oder Steuern; immer `בכפוף לבדיקה משפטית פרטנית`.

## 9. Prozess pro Text (Spec §3.5)

1. **Quelle ist Englisch.** Nie aus dem Deutschen übersetzen.
2. **Pass A — Erstübersetzung** mit diesem Guide + Glossar im Kontext. Ausgabe: Hebräisch + Liste der bewusst frei übertragenen Stellen.
3. **Pass B — Kritik** mit eigenem Prompt: „Lies als israelischer Lektor. Markiere Anglizismen, Kalkierungen, Genusfehler, unnatürliche Wortfolge, Marketing-Floskeln, Verstöße gegen §7. Schreibe jede markierte Stelle so um, als wäre sie original hebräisch entstanden. Ändere keine Fakten." Ausgabe: Diff + Begründungen.
4. **Pass C — Muttersprachler-Review** (Entscheidung F): Änderungsprotokoll nach `docs/i18n/reviews/<datei>.md`; wiederkehrende Korrekturen wandern ins Glossar oder in §7.
5. **Freigabe** = Protokoll vorhanden. Ohne Protokoll kein `PUBLISHED`.

## 10. Kurzcheck vor Freigabe

- [ ] Kein `TODO(he)`, kein englischer Restsatz
- [ ] Genus gemäß §2, keine Schrägstriche
- [ ] Preise/Nummern nach §5, Bidi isoliert
- [ ] Ortsnamen nach Glossar, Eigennamen lateinisch
- [ ] Meta-Title ≤ 60, Description ≤ 155
- [ ] Keine Zeile aus §7
- [ ] Faktencheck: jede Zahl hat eine Quelle
- [ ] Review-Protokoll abgelegt
