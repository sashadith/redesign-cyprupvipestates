# WP5 — Neue Begriffe (Über uns, Kontakt, FAQ-Chrome)

**Stand:** 2026-09-13 · **Pass A (Übersetzung) + Fix-Runde 1 nach Pass B** · Ergänzung zu `docs/i18n/he-glossary.md`
(dort **nicht** eingetragen — WP1 besitzt diese Datei; nach Pass C wandern die bestätigten
Zeilen in §2/§4/§5 des Hauptglossars).

Nur Begriffe, die WP5 gebraucht hat und die in `he-glossary.md` §1–5 (inkl. §6.1 aus WP1)
fehlen oder dort in einer anderen Wortform stehen. Begriffe, die WP2/WP3 schon eingeführt
haben (`שאלות נפוצות` als Überschrift, `ליצירת קשר`, `רוכשים מחו"ל`, `סיפורי לקוחות`),
sind hier nicht wiederholt — sie wurden übernommen.

| EN | HE | Kontext | Begründung |
|---|---|---|---|
| consultant (Berater der Agentur) | יועץ | `finderTitle`, `finderCountOne/Many`, `formLead` (Kontakt) | §5 hat nur den CTA `לקבל שיחה מיועץ`, keinen Tabelleneintrag. `יועץ` (Pl. `יועצים`) ist der Standard; `נציג` wäre Callcenter. |
| Working hours | שעות פעילות | `hoursLabel` (Kontakt) | `שעות עבודה` beschreibt die Arbeitszeit der Mitarbeiter, `שעות פעילות` die Erreichbarkeit — das ist hier gemeint. |
| Open now / Closed right now / Opens at | פתוח עכשיו / סגור כרגע / נפתח ב- | Live-Badge im Kontakt-Hero | Zustandsangaben eines Geschäfts, kein Genusproblem (das Subjekt ist das Büro). |
| Cyprus time (Zeitzone) | שעון קפריסין | `hoursTimezone`, `heroLead` (Kontakt) | Israelischer Standard für Zeitzonen ist `שעון <Ort>` (vgl. `שעון ישראל`). |
| Speaks (Label über einer Sprachliste) | שפות | `teamSpeaks` (About), `speaks` (Kontakt) | Ein Verb (`מדבר`/`מדברת`) würde jeder Personenkarte ein Geschlecht aufzwingen (§2, §11.2); `דוברים` (Partizip Plural) klingt auf einer Einzelkarte falsch. Das Nomen ist die einzige saubere genusfreie Form. |
| language names (Filter-Chips) | אנגלית · גרמנית · רוסית · פולנית · ספרדית · צרפתית · הולנדית · יוונית · קזחית · אוזבקית | `languages.ts` → `LABELS.he` | Standardformen. `הולנדית` (nicht `נדרלנדית`), `קזחית`, `אוזבקית` bitte vom Lektor bestätigen (Offene Frage 6 in `wp5.md`). |
| All (Filter-Chip neben einer Zahl) | הכל | `finderAll` (Kontakt), `allChipLabel` (FAQ), `receive[1]` (About) | **Fix-Runde 1:** `הכל`, nicht `הכול`. Pass B hatte für `הכול` plädiert (Ktiv male, §4) und WP2s `הכל` zum Ausreißer erklärt; der Controller hat cross-WP zugunsten von `הכל` entschieden — damit sind WP2/WP4/WP5 wortgleich (§11.6). In allen drei Fundstellen gleich. |
| Expand all / Collapse all | פתיחת הכל / סגירת הכל | FAQ-Toolbar | Nominalstil (§2.1) analog zu §4 `Show more` = `הצגת עוד`. Zweiter Bestandteil folgt der `הכל`-Entscheidung eine Zeile höher. |
| Support (Rubrik-Eyebrow) | תמיכה | FAQ-Hero | |
| Direct lines (Rubrik-Eyebrow) | קווים ישירים | Kontakt | Wörtlich, funktioniert im Hebräischen als Bild für „direkte Durchwahl". **Pass-B-Vorbehalt (offen für Pass C):** `קו ישיר` ist die Telefon-Durchwahl, die Rubrik enthält aber auch WhatsApp und E-Mail; Vorschlag `ישירות אלינו`. In Fix-Runde 1 **nicht** geändert (Vorbehalt, keine Fehlermeldung). |
| Core values | ערכי הליבה | About | `ערכי יסוד` wäre auch möglich; `ליבה` ist der geläufigere Unternehmenssprech ohne Pathos. |
| Integrity | יושרה | About | §3 hat nur `השקעה בטוחה`; `יושרה` ist die Charaktereigenschaft, `כנות` nur „Offenheit". |
| Sustainability | קיימות | About | Etablierter Terminus der Akademie. |
| AI / AI-assisted | בינה מלאכותית / בעזרת בינה מלאכותית | About (`work[2]`, `values[5]`) | Ausgeschrieben statt `AI`; die Abkürzung `בינ"מ` ist ungebräuchlich. |
| full-service (Agentur) | בשירות מלא | About (`stats[1]`) | **Pass-B-Vorbehalt (offen für Pass C):** im israelischen Agentur-Sprech nicht etabliert; Vorschlag `כסוכנות שיווק נדל"ן עם מעטפת מלאה`. In Fix-Runde 1 **nicht** geändert (Vorbehalt, keine Fehlermeldung). |
| full-service support (Leistung) | ליווי מלא | About (`receive[1]`) | Bewusst anders als die Agenturbeschreibung: `ליווי` ist im israelischen Immobilienkontext das Wort für die Begleitung des Käufers. |
| after-sales support | תמיכה אחרי הרכישה | About (`receive[2]`) | `שירות לאחר מכירה` ist Handelsjargon für Geräte, nicht für Immobilien. Pass-B-Randbemerkung: neben `ליווי מלא` stehen `תמיכה` und `ליווי` im selben Register — `ליווי אחרי הרכישה` wäre konsistenter; nicht geändert, weil sonst beide Karten gleich anfangen. |
| moving-in service | ליווי במעבר | About (`receive[2]`) | **Fix-Runde 1** (Pass B, Should #21): `שירותי כניסה לדירה` klang nach Zutrittsdiensten und verengte auf Wohnungen; `ליווי במעבר` ist die israelische Wendung und gilt auch für Villen. |
| viewing (Besichtigung) | סיור בנכס | About (`receive[1]`) | Im Glossar fehlt der Begriff. `צפייה בנכס` wäre das Anschauen von Fotos. |
| signing at the lawyer's (statt „notary appointment") | חתימה אצל עורך הדין | About (`receive[1]`) | §7: Zypern hat keinen Notar deutscher Prägung. Glossar §2 führt `עורך דין (עו"ד)`. |
| point of contact | איש קשר | About (`receive[1]`) im Fließtext; `finderEyebrow` (Kontakt) im Plural `אנשי הקשר שלכם` | **Fix-Runde 1** (Pass B, Should #27): als Fließtext-Begriff bleibt der Singular; als Eyebrow über einem Grid aus zehn Personen beiderlei Geschlechts steht der Plural — der ist zugleich faktisch richtig (§2). |
| handover of the keys | מסירת המפתחות | About (`stats[2]`) | §2 hat `מסירה`; hier die vollständige Wendung. |
| ~~island of sunshine~~ | ~~אי השמש~~ → gestrichen | About (`heroLead`) | **Fix-Runde 1: verworfen** (Pass B, Must #7). Keine etablierte hebräische Wendung — Israelis nennen Zypern nicht so, die Zeile liest sich als Übersetzung (§7, kalkierte Idiome). Der `heroLead` sagt jetzt schlicht `בקפריסין`. Offene Frage 3 damit beantwortet. |
| Scroll (Hinweis im Hero) | גלילה | About | Nominal (§2.1). **Derzeit nicht gerendert** (`preview-about/[lang]/page.tsx` verwendet `heroScroll` nirgends) — mitübersetzt als Regressionsschutz. |
| office (eigenes Büro) | המשרד שלנו | Kontakt (`officeTitle`, `metaDescription`) | §6.1 führt `משרד` nur als **Objekttyp** im Qualifier-Dropdown; hier ist der eigene Standort gemeint. |
| Open in Google Maps | פתיחה ב-⟦ISO⟧Google Maps⟦/⟧ | Kontakt (`officeDirections`) | **Fix-Runde 1** (Pass B, Should #29): WP2 (`wp2-glossary.md` Z. 27) hat für dieselbe EN-Quelle die Nominalform `פתיחה ב-`; sie folgt dem Glossar-Muster §4 (`Show more = הצגת עוד`) und gewinnt (§11.6). Die Bidi-Isolation des Produktnamens ist umgekehrt WP5s richtige Zutat und muss in WP2 nachgezogen werden. Produktname bleibt lateinisch (§4), Präposition mit Bindestrich (§5). |
| daily 9:00 to 18:00 | מדי יום, 9:00 עד 18:00 | Kontakt (`hoursValue`, `heroLead`, `metaDescription`) | Kein Bis-Strich in einer Zeitangabe (§3); `עד` ausgeschrieben. Muster für alle künftigen Öffnungszeiten. **Fix-Runde 1** (Pass B, Must #8): Pass A hatte das Muster im `heroLead` selbst gebrochen (`בין 9:00 ל-18:00`); alle drei Fundstellen stehen jetzt wortgleich (§11.6). |

## Nach Pass B beantwortet (Fix-Runde 1)

| Frage | Antwort |
|---|---|
| 1 · `שפות` als Kartenlabel | **Bleibt.** Als Nomen über einer Liste ist es korrekt und genusfrei; `דוברים` scheitert auf der Einzelkarte, und das CSS (`display:block`, eigene Zeile — `about.css:224`, `contacts.css:243`) trägt die Nominalform. |
| 2 · `פרויקט של` für eine Firmenbeziehung | **Verworfen** → `מותג של`. Glossar §2 legt `פרויקט` verbindlich als Bauprojekt fest; auf einer Immobilienseite liest `פרויקט של SecretBrand` als deren Bauvorhaben. |
| 3 · `אי השמש` | **Gestrichen** (siehe Tabelle). |
| 5 · `לקריאת כל סיפורי הלקוחות` vs. WP3s `לכל סיפורי הלקוחות` | **WP3 gewinnt** (`wp3-glossary.md` Z. 19: Link im Listenkopf neben einem Pfeil, zwei Wörter). About sagt jetzt `לכל סיפורי הלקוחות`. |
| 6 · Sprachnamen der Chips | **Bestätigt** — `הולנדית`, `קזחית`, `אוזבקית` sind die Akademie-Standardformen. `languages.ts` unverändert. |

Frage 4 (`המעבר` bestimmt vs. unbestimmt) ist gegenstandslos geworden: die Stance-H1 lautet
nach Should #17 `המעבר לקפריסין הוא הרבה יותר מרכישת נכס` — der bestimmte Artikel bleibt,
der Gold-Akzent liegt jetzt aber auf `הרבה יותר` statt auf der Negation (§11.3).

## Offen für Pass C

`קווים ישירים` (Vorschlag `ישירות אלינו`) und `בשירות מלא` (Vorschlag `מעטפת מלאה`) — beide
Pass-B-Vorbehalte, keine Fehler; siehe die Begründungsspalte oben.
