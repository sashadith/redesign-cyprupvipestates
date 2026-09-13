# Review-Protokoll `c-legal` — Rechtstexte `he` (Phase 5b, Task 2)

**Stand:** 2026-09-13 · **Status:** Pass A erledigt; Selbstkorrekturen des Übersetzers dokumentiert; **Pass B erledigt** (eigener Kritiklauf, `task-2-passB.md`, Grade C), Fix-Runde 1 eingearbeitet; **Pass C (muttersprachlicher Lektor) offen** · **Marker:** `REVIEW(he)` an beiden Tabellen

## Dateien und Seiten

| Datei | Seite (`he`) | Sektionen EN → HE | Blöcke |
|---|---|---|---|
| `src/app/preview-legal/[lang]/[doc]/privacy.he.ts` (`PRIVACY_HE`) | `/he/privacy-policy` | 10 → 10, IDs identisch | 1:1 gespiegelt, inkl. 2 `definitions`-Blöcke (9 bzw. 3 Einträge), **4** `list`-Blöcke (`controller` 4, `recipients` 3, `retention` 6, `rights` 7 Items), 2 `callout` |
| `src/app/preview-legal/[lang]/[doc]/terms.he.ts` (`TERMS_HE`) | `/he/terms-and-conditions` | 13 → 13, IDs identisch | 1:1 gespiegelt, 4 `list`-Blöcke (3/4/3/3 Items), 1 `callout` |

Registriert in `registry.ts`; die beiden `TODO(he)`-Aliasse auf die englischen Tabellen sind ersetzt. Ein Skript-Vergleich EN↔HE (Sektionszahl, IDs, Blockreihenfolge, Blockart, Item-Zahl) läuft fehlerfrei.

> Korrektur gegenüber dem Stand vor Fix-Runde 1: die Zeile nannte „3 `list`-Blöcke (4/3/6/7 Items)". Die Item-Zahlen stimmten, die Blockzahl nicht — es sind vier. Wer die Zeile als Prüfsumme benutzt, bekam ein falsches Ergebnis (Pass B, Protokoll-Punkt 1).

## Hinweis auf die maßgebliche Sprachfassung

`LegalDoc` hat ein neues optionales Feld `bindingNote?: string`. Die Seite rendert es als kleinen Absatz direkt unter der H1 (`.lgl__binding`, neu in `legal.css`), **nur wenn gesetzt**. `en/de/pl/ru` lassen es undefiniert, ihr Output ist damit byte-identisch — `copy-snapshot --check` bestätigt das (die Legal-Registry ist ohnehin kein registriertes Copy-Modul).

Wortlaut (`he`, beide Dokumente wortgleich, Boilerplate-Zeile in `he-glossary.md` §5 „English binding (Rechtstexte)"):

> הנוסח האנגלי של מסמך זה הוא הנוסח המחייב; התרגום לעברית נועד לנוחות בלבד.

Die Kurzform `הנוסח האנגלי הוא המחייב.` bleibt für Fließtext und Fußzeilen. **Ein Wort für „binding":** AGB §12 sagte `הקובע`, acht Zeilen unter einem `bindingNote`, der `המחייב` sagt — zwei Wörter für dieselbe Rechtsfolge in einem Dokument über Verbindlichkeit. §12 sagt jetzt ebenfalls `המחייב` (Pass B M3). `privacy.he.ts` §10 `הגרסה הנוכחית היא הקובעת` bleibt: das ist die *aktuelle Fassung*, nicht die *Sprachfassung*.

## Pass A / Selbstkorrekturen des Übersetzers (vor Pass B)

1. **Wurzelwiederholung** (Styleguide §11.5): `פנייה … לפנות` in §1 Datenschutz → `יש להשתמש בפרטי הקשר`; dreifaches `מועד` im Termin-Eintrag; vierfaches `ייעוץ` in AGB §2; `לקבל … ולקבל` im Auskunftsrecht.
2. **Anglizismen**: `פרסום חוזר` (Lehnübersetzung von „remarketing") → `שיווק מחדש`; `הקלטת סשן` vermieden zugunsten von `הקלטת גלישה`. **Nicht** erfasst und erst durch Pass B gefunden: `פרופיילינג` in §9 (Pass B M8) — und der Ersatz für `אינדיקציה` (`נמסר לו האם ניתנה הסכמה`) war selbst kein hebräischer Satzbau (S7). Die frühere Formulierung „Anglizismen bereinigt" war überzogen.
3. **Rechtsregister**: `בתוקף להמשך` → `עם תוקף לעתיד` (Art. 7 (3)); Kommasetzung in der AGB-Einleitung vor `ולא פחות חשוב מכך`.
4. **§7-Verbotsliste**: kein `בין אם … ובין אם`, keine Adjektivstapel, keine Doppelpunkt-Überschriften, keine Ausrufezeichen. Gedankenstriche der englischen Vorlage sind zu Kommas oder eigenen Sätzen aufgelöst (`grep -c "—\|–\|!"` = 0 in beiden Dateien).
5. **Genus**: 1. Person Plural für das Unternehmen (`אנחנו`/`איננו`, genusfrei); Anrede als männlicher Plural (`שלכם`, `זכויותיכם`). Keine Schrägstrichformen. **Einschränkung aus Pass B:** agensloses Passiv (`נאספים`, `יוסר`) ist in UI-Copy ein zulässiges genusfreies Register, in einem Dokument, das Pflichten zuweist, löscht es den Schuldner. In beiden Dateien jetzt durchgehend `אנחנו`/`איננו` statt Passiv (S2, S23).

## Pass B (eigener Kritiklauf) und Fix-Runde 1

Kritik: `.superpowers/sdd/2026-09-13-hebrew-phase5-content/task-2-passB.md` (12 Must-fix, 25 Should-fix, Grade C). Alle Zeilen sind in Fix-Runde 1 umgesetzt; die vier Ausnahmen stehen unter „Offene Punkte". Die vier Substanzfehler waren:

1. **Lizenzrichtung invertiert** (AGB §6): `בעלי הרישיון שלנו` heißt Lizenz*nehmer*, EN „our licensors" sind die, von denen wir lizenzieren — die hebräische Fassung behauptete das Gegenteil der englischen Eigentumslage. Jetzt `מי שהעניק לנו רישיון להשתמש בו` (M1).
2. **Drei Formen für *controller*** in einem Dokument, das die Rolle rechtlich zuweist. Verbindlich ist `בעל השליטה בנתונים`, bei Erstnennung mit `(controller)` glossiert; `הגורם האחראי` ist in §1 verschwunden, der Schlusssatz sagt `הבקשה תגיע לגורם שאחראי לטפל בה` (M2).
3. **Betroffenenrechte abgeschwächt bzw. umgedreht** (Art. 15/16/17/20/21): `לברר` statt Anspruch auf Bestätigung; `לתקן`/`למחוק`/`להעביר` legten die Handlung dem Betroffenen in die Hand, obwohl sich die Artikel gegen den Verantwortlichen richten. Jetzt `לקבל מאיתנו אישור`, `לדרוש שנתקן`, `לדרוש שנמחק`, `לבקש שנעביר … ישירות`, `ללא סייג` statt `ובאופן מוחלט` (M6, M7, S14).
4. **`הקובע` statt `המחייב`** in AGB §12 (M3, siehe oben).

Weiter umgesetzt: `מצטלב` → `איננו מצליבים` (aus einer Zustandsbeschreibung wieder eine Zusage, M11); `תמיד` bei „a person always decides" ergänzt und `פרופיילינג` → `יצירת פרופיל` (M8); die Negation im wichtigsten Satz der AGB nach vorn gezogen (`לפי הדין הקפריסאי איננו סוכנות תיווך נדל"ן מורשית`, M12); `אחריותנו` statt `אחריות` und der Listenbruch in AGB §5 (M5); Register `האלה` → `אלה` (S8, S9); `דואר אלקטרוני` → `אימייל` (S11); `מוסמך` → `רשום במסגרת זו` (S12); Bindestriche in `טרום-חוזיות`, `חד-כיווני`, `תלת-ממד` (S3, S5, S21); `גשר מקשר` entmetaphorisiert (S22); `חותמים על` → `כורתים` (S19); Personenwechsel in AGB §13 behoben (S24); `נשמח` in beiden `contactText` (S17, S25).

**`שלנו` beim berechtigten Interesse** ist an allen vier Fundstellen ergänzt (`privacy.he.ts` Server-Logs, cookieless, Clarity, Art. 21) — die EN sagt überall „our legitimate interest".

## Release-Gate: Sprachfassungen (AGB §12)

**Gate, kein Hinweis.** `terms.he.ts` §12 zählte fünf Fassungen auf, die bindende `terms.en.ts` §12 vier. Solange `he` allein ausgeliefert wird, sagt die maßgebliche Fassung etwas anderes als die ihr untergeordnete Übersetzung. Prozessregel: eine Übersetzung ist nie der erste Ort, an dem sich ein Fakt über das Produkt ändert.

- **Jetzt:** `terms.he.ts` §12 spiegelt die EN-Liste exakt — `באנגלית, בגרמנית, בפולנית וברוסית`, ohne Hebräisch (Controller-Entscheidung, M4).
- **Gate für den `he`-Launch (Adressat: Controller):** im **selben** Release, in dem `he` öffentlich geht, nennen `terms.en.ts`, `terms.de.ts`, `terms.pl.ts`, `terms.ru.ts` **und** `terms.he.ts` §12 alle fünf Fassungen. Fünf Dateien, ein Commit — kein Teil-Rollout.

## Dokumentnamen (Titel vs. Link-Label)

`page.tsx` rendert `sibling.title` als Fußlink, also stehen Dokumenttitel und Link-Label auf **derselben** Seite. Ausgeliefert wird definit: `consentCopy.ts:57,58`, `FormStatic.copy.ts:128`, `FormFull.copy.ts:64` und `terms.he.ts` §10 sagen `מדיניות הפרטיות` bzw. `תנאי השימוש`; die Titel sagten indefinit. Beide Titel und `metaTitle` sind jetzt definit (M10); nachgemessen 38/125 und 34/121 Grapheme, weiter unter 60/155.

**Offene Fundstelle außerhalb dieses Tasks:** `src/app/[lang]/c/[token]/copy.ts:269` hält eine dritte, indefinite Variante. Sie liegt außerhalb `preview-legal/**` und ist in dieser Fix-Runde bewusst nicht angefasst — als eigene Zeile in der Launch-Checkliste nachziehen. Systemvorschlag von Pass B: beide Dokumentnamen als Konstanten neben `HE_LANGUAGE_NOTE` in `src/lib/locale.ts` legen und alle sechs Fundstellen darauf ziehen.

## Cookie-Kategorien (entschieden, nicht offen)

Nicht 50:50: **zwei von drei** ausgelieferten `he`-Fundstellen sagen bereits `הכרחיות` (Policy `privacy.he.ts` §6, Banner-Beschreibung `CustomCookieConsent.copy.ts:46`), nur der Ablehnen-Button sagt `רק הנחוצות` — der Banner widerspricht sich selbst. Die Policy bleibt bei `הכרחיות` und ist damit die Referenz.

**Offene Fundstelle außerhalb dieses Tasks:** `CustomCookieConsent.copy.ts:48` `rejectAll` auf `רק ההכרחיות` ziehen und Glossar §4.3 „Cookie consent" auf `אישור הכל / רק ההכרחיות / הגדרות` — beide zusammen (§11.6). Beide Dateien liegen außerhalb `preview-legal/**` und der freigegebenen Glossar-Sektion, deshalb hier nur notiert. Solange die Taxonomie an vier Orten ohne Gate lebt (Policy, Banner-Text, Banner-Button, Glossar), wiederholt sich der Fehler bei jeder Banner-Änderung.

## Sprachhinweis (Entscheidung E) auf den Rechtsseiten

`privacy.he.ts` `contactText` lädt selbst zum Anruf ein, und im Team spricht niemand Hebräisch. Der Absatz trägt jetzt `HE_LANGUAGE_NOTE` aus `src/lib/locale.ts` (importiert, nicht kopiert — §11.6). Das ist eine bewusste Abweichung von der EN-Vorlage zugunsten der Locale-Wahrheit (S17). `terms.he.ts` `contactText` bekommt ihn **nicht**: dieser Absatz bietet nur die schriftliche E-Mail an, keinen Anruf, und Pass B hat für ihn ausdrücklich einen Wortlaut ohne Hinweis vorgegeben (S25). Pass C bestätigt oder kippt die Asymmetrie.

## Terminologie

Eine hebräische Form je Rechtsbegriff, verbindlich festgeschrieben in `he-glossary.md` **§3.2** („Rechtstexte: GDPR, Vertrag, Gerichtsstand"): *controller, processor, personal data, processing, consent, legitimate interest, data subject, profiling, cookies, third parties, binding, governing law, jurisdiction, licensor, conclude*, dazu die drei „have X done"-Muster für Art. 15/16/20 und die beiden Dokumentnamen. Die frühere „offene Frage" zu `בעלי שליטה נפרדים בנתונים` verschwieg, dass die Datei denselben Begriff an drei Stellen verschieden wiedergab; eine offene Terminologiefrage ist zulässig, eine uneinheitliche Datei nicht.

## Bidi und Schreibung

- `bidiIsolate()`: `Cyprus VIP Estates`, `SecretBrand Solutions LTD`, alle Anbieternamen (`Google Tag Manager`, `Google Analytics 4`, `Google Ads`, `Google Ireland Limited`, `Meta Pixel`, `Meta Platforms Ireland Limited`, `LinkedIn Insight Tag`, `LinkedIn Ireland Unlimited Company`, `Microsoft Clarity`, `Microsoft Ireland Operations Limited`), `IP`, `URL`, `TLS`, `GDPR`, das Glossenwort `controller` sowie jede Artikelzitation.
- `ltrIsolate()`: `office@cyprusvipestates.com`, `+357 99 278 285`, `Palaion Patron Germanou 11, 8011`, `commissioner@dataprotection.gov.cy`, `Iasonos 1, 1082`, `https://`.
- Gerade Anführungszeichen, westliche Ziffern, Ktiv male, `נדל"ן` mit Gershayim. Datum (`2026-08-21`) und alle Aufbewahrungsformulierungen unverändert aus dem Englischen.
- Meta (Graphem-Zählung inkl. Isolat-Steuerzeichen, `Intl.Segmenter("he")`) nach Fix-Runde 1: Datenschutz Title 38 / Description 125, AGB Title 34 / Description 121 — beide innerhalb 60 / 155. Pass B hatte 39/127 bzw. 35/121 prognostiziert; die Differenz stammt aus der Zählung, nicht aus dem Text.

## Abweichungen von der englischen Vorlage

1. **Artikelzitate bleiben lateinisch** (`Art. 6 (1) (f) GDPR`, `Art. 28 GDPR`, `Art. 46 (2) (c) GDPR`, `Art. 15`–`Art. 22`). Styleguide §4 (Gesetzesbezeichnungen lateinisch); ein hebräischer Buchstabe für den Unterabsatz wäre gegen die Verordnung nicht auflösbar.
2. **`EU-US Data Privacy Framework`** mit Bindestrich statt des offiziellen Halbgeviertstrichs, weil `–` in `he`-Dateien per Gate verboten ist.
3. **Em-Dash-Einschübe** des Englischen (Datenschutz §1/§2/§3, AGB §2/§4/§5) sind zu Kommas, Doppelpunkten oder eigenen Sätzen aufgelöst. Absatzzahl unverändert.
4. **Sprachhinweis** in `privacy.he.ts` `contactText` (siehe oben) — die einzige inhaltliche Ergänzung gegenüber der EN.
5. **`controller` als Glosse** in Klammern bei der Erstnennung — die EN braucht sie nicht, das Hebräische hat keine etablierte GDPR-Terminologie.

Die frühere Abweichung #1 („AGB §12 nennt zusätzlich Hebräisch") ist mit M4 zurückgenommen.

## Offene Fragen für Pass C

1. **`ערך גיבוב`** für „hash" — korrekt, aber trocken. Alternative wäre die Umschrift `האש`. Für ein Rechtsdokument wurde die Fachform gewählt.
2. **`בעל השליטה בנתונים`** für *controller* ist eine gebildete, keine amtliche Form; es gibt keine etablierte hebräische GDPR-Terminologie. Sie ist jetzt einheitlich und in Glossar §3.2 verbindlich. Kennt der Lektor eine Kanzleiformulierung, ändert sie beide Dateien und die Glossarzeile zusammen.
3. **`משרד נציב הגנת הנתונים האישיים`** (Office of the Commissioner for Personal Data Protection, Zypern): Eigenübersetzung, kein amtlicher hebräischer Name. Adresse und E-Mail sind LTR-isoliert und unverändert.
4. **Titelumfang der AGB.** `תנאי השימוש` = „Terms of Use", die EN heißt „Terms and Conditions" und das Dokument regelt auch die Dienstleistungen (§1, §2, §5). `תנאים והגבלות` wäre die vollere Entsprechung — dann müssten `consentCopy.ts:57` und alle Verweise mitziehen. Verbindlich ist vorerst `תנאי השימוש`, weil es dem ausgelieferten Link-Label entspricht.
5. **Sprachhinweis-Asymmetrie** zwischen den beiden `contactText` (siehe oben) bestätigen oder auflösen.
6. **Anwaltsprüfung bleibt offen** — wie in allen anderen Locales dieses Dokuments. Nach Fix-Runde 1 trifft die hebräische Fassung keine Aussage mehr, die die englische nicht trifft (vor M1–M8 tat sie es: Lizenzrichtung, Betroffenenrechte); sie erbt damit nur noch den Prüfbedarf der EN.
