# WP5 — Neue Begriffe (Über uns, Kontakt, FAQ-Chrome)

**Stand:** 2026-09-13 · **Pass A (Übersetzung)** · Ergänzung zu `docs/i18n/he-glossary.md`
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
| All (Filter-Chip neben einer Zahl) | הכול | `finderAll` (Kontakt), `allChipLabel` (FAQ) | `הכול` statt `הכל` (Ktiv male, §4). In beiden Dateien wortgleich. |
| Expand all / Collapse all | פתיחת הכול / סגירת הכול | FAQ-Toolbar | Nominalstil (§2.1) analog zu §4 `Show more` = `הצגת עוד`. |
| Support (Rubrik-Eyebrow) | תמיכה | FAQ-Hero | |
| Direct lines (Rubrik-Eyebrow) | קווים ישירים | Kontakt | Wörtlich, funktioniert im Hebräischen als Bild für „direkte Durchwahl". |
| Core values | ערכי הליבה | About | `ערכי יסוד` wäre auch möglich; `ליבה` ist der geläufigere Unternehmenssprech ohne Pathos. |
| Integrity | יושרה | About | §3 hat nur `השקעה בטוחה`; `יושרה` ist die Charaktereigenschaft, `כנות` nur „Offenheit". |
| Sustainability | קיימות | About | Etablierter Terminus der Akademie. |
| AI / AI-assisted | בינה מלאכותית / בעזרת בינה מלאכותית | About (`work[2]`, `values[5]`) | Ausgeschrieben statt `AI`; die Abkürzung `בינ"מ` ist ungebräuchlich. |
| full-service (Agentur) | בשירות מלא | About (`stats[1]`) | |
| full-service support (Leistung) | ליווי מלא | About (`receive[1]`) | Bewusst anders als die Agenturbeschreibung: `ליווי` ist im israelischen Immobilienkontext das Wort für die Begleitung des Käufers. |
| after-sales support | תמיכה אחרי הרכישה | About (`receive[2]`) | `שירות לאחר מכירה` ist Handelsjargon für Geräte, nicht für Immobilien. |
| viewing (Besichtigung) | סיור בנכס | About (`receive[1]`) | Im Glossar fehlt der Begriff. `צפייה בנכס` wäre das Anschauen von Fotos. |
| signing at the lawyer's (statt „notary appointment") | חתימה אצל עורך הדין | About (`receive[1]`) | §7: Zypern hat keinen Notar deutscher Prägung. Glossar §2 führt `עורך דין (עו"ד)`. |
| point of contact | איש קשר | About (`receive[1]`), `finderEyebrow` (Kontakt) | |
| handover of the keys | מסירת המפתחות | About (`stats[2]`) | §2 hat `מסירה`; hier die vollständige Wendung. |
| island of sunshine | אי השמש | About (`heroLead`) | Bild aus dem EN-Original übernommen. Offene Frage 3 in `wp5.md`. |
| Scroll (Hinweis im Hero) | גלילה | About | Nominal (§2.1). |
| office (eigenes Büro) | המשרד שלנו | Kontakt (`officeTitle`, `metaDescription`) | §6.1 führt `משרד` nur als **Objekttyp** im Qualifier-Dropdown; hier ist der eigene Standort gemeint. |
| Open in Google Maps | לפתיחה ב-Google Maps | Kontakt (`officeDirections`) | Produktname bleibt lateinisch (§4), Präposition mit Bindestrich (§5). |
| daily 9:00 to 18:00 | מדי יום, 9:00 עד 18:00 | Kontakt | Kein Bis-Strich in einer Zeitangabe (§3); `עד` ausgeschrieben. Muster für alle künftigen Öffnungszeiten. |

## Offene Fragen an den Lektor (Pass C)

Siehe `docs/i18n/reviews/wp5.md`, Abschnitt „Offene Fragen" — insbesondere `שפות` als
Kartenlabel (1), `פרויקט של` für eine Firmenbeziehung (2) und `אי השמש` (3).
