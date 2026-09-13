# Glossar-Ergänzungen aus WP7 — Präsentationsseite, Booking, CRM-Nachrichten, E-Mails, ROI

**Stand:** 2026-09-13 · Begleitdokument zu `docs/i18n/reviews/wp7.md`.

> **⚠ Konsolidiert am 2026-09-13 (Task 11, Teil 2) — diese Datei ist ab jetzt Audit-Trail,
> nicht mehr die Quelle.** Alle Zeilen mit Pass-B-Verdikt „bestätigt" oder „geändert" stehen
> jetzt in `docs/i18n/he-glossary.md` (§2, §3.1, §4, §4.7, §4.8, §5); die verbindliche Form
> und die Konfliktentscheidungen sind dort nachzulesen, das Änderungsprotokoll in §7. Die
> Tabellen unten bleiben unverändert erhalten, weil sie die vollständigen Begründungen und
> den Pass-B-Verlauf tragen. Wo sie vom Glossar abweichen, gilt das Glossar. Abweichungen
> nach der Konsolidierung: **+VAT** = `+ מע"מ` (nicht `בתוספת מע"מ`, §2), **Contact us**
> bleibt kontextgetrennt (`צור קשר` im Menü, `ליצירת קשר` als CTA — WP7s Empfehlung steht
> als Frage in §6), **`חד׳ שינה`** gilt nur als Spaltenkopf-Ausnahme.

Begriffe, die WP7 gebraucht hat und die in `docs/i18n/he-glossary.md` §1–5 (und in §6.1
aus WP1) fehlten. **`he-glossary.md` wurde bei der Abgabe bewusst nicht angefasst** — nach
dem Lektorat (Pass C) wandern die bestätigten Zeilen dort in §2/§4/§5. *(Überholt: die
Einarbeitung ist am 2026-09-13 vorgezogen worden, siehe Kopfnotiz.)*

> **Stand Fix-Runde 1 (Pass B).** 84 Begriffe bestätigt, 6 geändert, 2 cross-WP-Konflikte
> entschieden, 1 falsch dargestellte Quelle korrigiert. Die geänderten Zeilen tragen den
> Vermerk unten; die Entscheidungen zu den Konflikten stehen im neuen Abschnitt 5.

## 1. Präsentationsseite `/c/[token]`

| EN | HE | Kontext | Begründung |
|---|---|---|---|
| YOUR PERSONAL SELECTION (Eyebrow) | המבחר האישי שלכם | Hero-Eyebrow über der Begrüßung | `מבחר` ist das neutrale Wort für eine kuratierte Auswahl; `בחירה` wäre der Akt des Wählens |
| Your preferences | ההעדפות שלכם | Überschrift über den Kriterien-Chips | nominal, genusfrei |
| up to (Budget-Chip) | עד | `עד €500,000` | steht mit Leerzeichen vor dem Betrag, deshalb keine `החל מ-`-Konstruktion |
| from (Preis-Präfix, **Karte**) | מחיר התחלתי | nur noch die Preiszeile der Objektkarte („from €450,000") | Die Komponente setzt `${präfix} ${betrag}` mit **Leerzeichen** — das Glossar-`החל מ-` braucht aber den Bindestrich direkt am Betrag, taugt also nur inline vor einem Preis, nicht als freistehende Bildunterschrift. **Korrektur Fix-Runde 1:** die frühere Begründung „gleiche Entscheidung wie in WP4" war **sachlich falsch** — WP4 hat die Frage offengelassen (WP4 Pass B belegt den falschen Freund „Eröffnungspreis im Ausschreibungsverfahren", drei Optionen, Lektorentscheid ausstehend). Vorläufig beibehalten; WP4s offene Frage 5 ist der gemeinsame Blocker für WP2, WP4 und WP7 |
| from (Budget-Chip) | מעל | Budget-**Untergrenze** im Hero-Chip: „מעל €300,000" | **Geändert (Pass B M14).** Der Chip zeigt kein Objektpreis-Label, sondern die Budgetuntergrenze des Kunden; `מחיר התחלתי` wäre dort sachlich falsch. Eigener Key `budgetFrom`, symmetrisch zum vorhandenen `budgetUpTo` = `עד` |
| Immediate | מיידי | Timeline-Chip | |
| Within 3 / 6 months, a year, 2 years | תוך 3 חודשים · תוך 6 חודשים · תוך שנה · תוך שנתיים | Timeline-Chips | `שנתיים` ist der Dual, nicht `2 שנים` |
| Just looking | בשלב בדיקה | Timeline-Chip | `רק מסתכל` wäre genusgebunden; Nominalstil (§2.1) |
| View details | לפרטים נוספים | Karten-CTA | idiomatischster israelischer CTA; `קריאה נוספת` (Glossar) gehört zum Blog |
| Available units | יחידות זמינות | Overlay-Überschrift | |
| Unit · Type · Beds · Area · Price · Status | יחידה · סוג · חד׳ שינה · שטח · מחיר · סטטוס | Kopfzeile der Einheitentabelle | `חדרי שינה` statt `חדרים` ist Pflicht (Glossar §2). **Geändert (Pass B S4):** als Spaltenkopf abgekürzt zu `חד׳ שינה` — die israelische Standardabkürzung in Anzeigen; ausgeschrieben sind es 11 Zeichen in einer Spalte, deren EN 4 hat, auf Overlay-Breite neben `שטח` |
| Unit-Status (Tabelle) | זמינה / שמורה / נמכרה | Statusspalte der Einheitentabelle | **Geändert (Pass B M12).** Bezug ist `יחידה` (fem.), das direkt daneben als Spaltenkopf steht. WP2 hatte das bereits entschieden **und** in `src/lib/heFeedVocab.ts` gebaut; WP7 führte daneben eine maskuline Zweitfassung |
| No longer available (Unit-Status) | לא זמינה עוד | Status einer aus dem Feed verschwundenen Einheit | ruhige Tatsache, keine Entschuldigung; feminin wie die drei anderen. Weicht bewusst von `heFeedLabel("unlisted")` = `לא בתצוגה` ab — dort heißt es „nicht in der Anzeige", hier „gibt es nicht mehr" |
| Your personal advisor | היועץ האישי שלכם | Closing-Block über Name und Foto | maskulin wie das Glossar-CTA `לקבל שיחה מיועץ`; der Berater ist eine konkrete Person |
| New for you (Badge) | חדש עבורכם | Karten-Badge | |
| +VAT | בתוספת מע"מ | Preiszeile der Karte | `+מע"מ` würde das führende Pluszeichen im RTL-Fluss an die falsche Seite kippen; die Wortform ist eindeutig |
| Sold out (Badge) | נמכר | Karten-Badge und Ersatz für den Einheitenzähler | Glossar §2: Badge kurz `נמכר` |
| LIFE NEARBY | החיים בסביבה | Überschrift über den POIs in der Karte | EN steht in Versalien; Hebräisch kennt keine Versalien |
| DIRECT CONTACT | קשר ישיר | Eyebrow des Closing-Blocks | |
| Call (Button) | להתקשר | `tel:`-Button neben וואטסאפ und אימייל | Infinitiv-CTA; `שיחת טלפון` ist das Formularlabel (WP1), nicht der Button |
| View on site | לצפייה באתר | Link vom Overlay auf die öffentliche Projektseite | |
| units (Zähler) | יחידה / יחידות | „5 יחידות" unter dem Preis | Plural ab 2; Hebräisch braucht hier keinen Dual |
| Good morning / afternoon / evening | בוקר טוב · צהריים טובים · ערב טוב | Begrüßungswort nach Serverzeit | Standardformeln |

## 2. Booking-Seite `/book/[token]`

| EN | HE | Kontext | Begründung |
|---|---|---|---|
| Schedule a meeting | תיאום פגישה | Eyebrow | nominal |
| let's find a time | נמצא זמן שמתאים לכם | H1-Suffix hinter dem gold gesetzten Namen | 1. Pers. Plural = Firmenstimme, genusfrei |
| Your time | השעה אצלכם | Label (im aktuellen JSX ungenutzt, siehe wp7.md) | |
| Cyprus time | שעון קפריסין | steht in Klammern hinter der Cypern-Uhrzeit | |
| Detecting your timezone… | מזהים את אזור הזמן שלכם… | Platzhalter bis die Zeitzone erkannt ist | Partizip Plural (§11.2), wie `שולחים…` |
| Your selected times | המועדים שבחרתם | Überschrift der Auswahlliste | |
| Send my available times | שליחת המועדים הפנויים | Submit-Button | nominal; `שליחה` allein ist in WP1 für „Send" belegt |
| Select between 1 and 3 times | יש לבחור בין 1 ל-3 מועדים | Hinweis und Validierungsmeldung | unpersönliches `יש ל…` (§11.2); Bindestrich vor Ziffer ist erlaubt (§3) |
| Something went wrong. Please try again. | משהו השתבש, נסו שוב. | generische Fehlermeldung | Glossar §4, mit Satzpunkt |
| Your appointment is confirmed | הפגישה שלכם מאושרת | H1 des bestätigten Zustands **und** E-Mail-Betreff | wortgleich in beiden Fundstellen (§11.6) |
| calendar invite | הזמנה ליומן | Bestätigungstext und Bestätigungsmail | |
| I'll send the Zoom link separately … | את הקישור לפגישת Zoom אשלח בנפרד, זמן קצר לפני השיחה. | Booking-Seite **und** `bookingMessages.ts` | wortgleich; `לפגישת Zoom` statt `ל-Zoom`, damit kein Bindestrich direkt an einem lateinischen Wort klebt |
| I'll call you at the agreed time. | אתקשר אליכם במועד שנקבע. | dito | wortgleich in beiden Dateien |

## 3. CRM-Nachrichten, Signatur, Auto-Reply

| EN | HE | Kontext | Begründung |
|---|---|---|---|
| Hi [First], (Erstkontakt) | שלום [First], | `compose/greeting.ts`, Booking-H1, alle Client-Mails | eine Anredeform für alle Kanäle; kein `מר`/`גב'` (§2) |
| Best regards, | בברכה, | `compose/closing.ts` — Valediction | Standard-Geschäftsschluss |
| Your personal property advisor | יועץ הנדל"ן האישי שלכם | Signatur-Rollenzeile | trägt das Fach, weil die Zeile ohne Bildkontext unter dem Namen steht. **Geändert (Pass B S13):** das nachgestellte `לנדל"ן` hing hinter dem Possessiv und las sich angeklebt; als Nomen-Kette vorangestellt liest es sich als ein Begriff. Bleibt bewusst verschieden von `advisorTitle` = `היועץ האישי שלכם` unter dem Foto (kein §11.6-Verstoß — nicht derselbe String) |
| Dear Client (Fallback ohne Name) | שלום, | Auto-Reply und ROI-Mail | `לקוח יקר`/`לקוחה יקרה` erzwingt ein Genus (§2). **Geändert (Pass B M9):** die Zeile wird nicht mehr als `${name},` gerendert. Vorher trug nur der Fallback eine Grußformel und der Normalfall nicht — mit Namen stand `יוסי,` als komplette erste Zeile, und ein nackter Vorname mit Komma ist im Hebräischen keine Anrede |
| Hello [First], (Client-Mail) | שלום [First], | Auto-Reply und ROI-Mail mit Namen | wortgleich mit `compose/greeting.ts`, `bookingMessages.ts` und `presentationMessages.ts` (§11.6). Der lateinische Name steht in `<bdi>` |
| Thank you for your enquiry | תודה על הפנייה | Auto-Reply Betreff + H1 | |
| What happens next? | מה קורה עכשיו? | Zwischenüberschrift im Auto-Reply | echte Frage, kein Doppelpunkt-Titel |
| trusted developers | יזמים אמינים | Auto-Reply, Punkt 3 | EN sagt „trusted"; `מובילים` (Glossar §5) wäre eine andere Behauptung |
| Follow us: | עקבו אחרינו: | Social-Zeile im Auto-Reply | Imperativ Plural (§2.2); nominal wirkt hier gestelzt |
| Browse properties in Cyprus | לצפייה בנכסים בקפריסין | CTA-Button im Auto-Reply | |
| Close (aria-label) | סגירה | Schließen-Kreuz des Broschüren-Modals **und** des Präsentations-Overlays | nominal, genusfrei; wortgleich an beiden Stellen (Pass B S16) |
| Favorite (aria-label) | שמירה למועדפים | Herz-Button auf Karte und Overlay | **Neu (Pass B S16).** War in allen Sprachen hart englisch — ein englisches Screenreader-Label auf der hebräischen Seite |
| Speak to an adviser | לדבר עם יועץ | Überschrift des Broschüren-Modals, `יועץ` gold gesetzt | **Neu (Pass B M15).** Die Copy-Tabelle des Modals hatte gar keine `he`-Zeile; die Seite zeigte `Speak to an adviser` samt englischem Leadsatz |

## 4. ROI-Rechner (UI + Ergebnis-Mail)

| EN | HE | Kontext | Begründung |
|---|---|---|---|
| ROI Calculator | מחשבון תשואה | Modal-Titel, Rechner-Titel | Das Akronym „ROI" hat in hebräischer Endkundensprache keine Verbreitung; `תשואה` ist der Suchbegriff (Glossar §2) |
| ROI / return | תשואה | durchgehend | |
| Average annual ROI | תשואה שנתית ממוצעת | Ergebniszeile **und** Ergebnis-Mail | wortgleich (§11.6) |
| Total net return | תשואה נטו כוללת | Highlight bei Buy-&-Hold | |
| Net profit from resale | רווח נטו ממכירה | Highlight bei Buy-&-Sell | |
| Conservative · Realistic · Optimistic | שמרני · ריאלי · אופטימי | Szenario-Tabs **und** Ergebnis-Mail | wortgleich |
| Buy & Sell / Buy & Hold | רכישה ומכירה / רכישה והחזקה | Strategiezeile der Ergebnis-Mail | EN/DE/PL/RU zeigen weiterhin die englischen Fachbegriffe (unverändert); nur `he` bekommt eine Übersetzung. **Offene Frage 3** |
| Property price | מחיר הנכס | Eingabefeld | |
| Furnishing cost / Furnishing | עלות ריהוט / ריהוט | Eingabefeld / Ergebniszeile | |
| Build period | תקופת בנייה | Eingabefeld | |
| Annual off-plan growth | עליית ערך שנתית בשלב הבנייה | Eingabefeld | Glossar §2 hat `על הנייר` für off-plan als Kaufform; hier geht es um die Bauphase, deshalb `בשלב הבנייה` |
| Off-plan value growth | עליית ערך בשלב הבנייה | Ergebniszeile | dieselbe Wendung ohne „jährlich" |
| Selling costs | עלויות מכירה | Eingabefeld und Ergebniszeile | wortgleich in beiden Dateien |
| Rental parameters | נתוני השכרה | Abschnittsüberschrift | |
| Net yield (year 1) | תשואה נטו (שנה 1) | Eingabefeld | |
| Annual rent growth | עליית שכירות שנתית | Eingabefeld | |
| Rental period after completion | תקופת השכרה לאחר המסירה | Eingabefeld | `מסירה` = Handover (Glossar §2) |
| Annual appreciation | עליית ערך שנתית | Eingabefeld | |
| Horizon | אופק ההשקעה | Ergebniszeile | `אופק` allein steht im Hebräischen nicht als Finanzbegriff |
| Purchase cost (with fees) | עלות הרכישה (כולל עמלות) | Ergebniszeile | |
| Total entry cost | עלות כניסה כוללת | Ergebniszeile **und** Ergebnis-Mail | wortgleich |
| Estimated value at completion | שווי משוער במסירה | Ergebniszeile | |
| Estimated value in final year | שווי משוער בשנה האחרונה | Ergebniszeile | |
| Rental cash flow | תזרים משכירות | Ergebniszeile | `תזרים מזומנים` gekürzt, weil die Quelle „rental cash flow" ist |
| Capital gain | רווח הון | Ergebniszeile | Glossar §2 kennt `מס רווחי הון`; hier ohne Steuer |
| Property value | שווי הנכס | Diagrammlegende | |
| Cumulative rental income | הכנסה מצטברת משכירות | Diagrammlegende | |
| Total profit | רווח כולל | Diagrammlegende | |
| Amount (EUR) | סכום ב-EUR | y-Achse | Währungscode bleibt lateinisch. **Geändert (Pass B S24):** ohne Klammerpaar — Recharts rendert das Achsenlabel in ein `<text>` ohne eigenes `dir`, und Klammern um einen LTR-Lauf in einer RTL-Beschriftung sind bidi-anfällig. `ב-` vor einem Fremdwort ist nach §3 zulässig |
| Years / years / yrs | שנים | x-Achse, Slider-Suffix | eine Form für die Achsen- und Suffix-Fundstellen |
| N years (Ergebnisblock) | שנה אחת / שנתיים / N שנים | „Horizont: … " und „תזרים משכירות (…)" | **Geändert (Pass B M11).** Hebräisch ist nicht zählinvariant: `1 שנים` und `2 שנים` sind schlicht falsch, der Dual `שנתיים` ist Pflicht. Helfer `heYears()` in `RoiResults.copy.ts`, analog `heBedrooms()` |
| ROI (Kurzform im Ergebnisblock) | תשואה | `„… · ROI: 42.0%"` im Highlight | **Neu (Pass B M10).** Stand hart englisch im JSX — genau das Akronym, das dieses Glossar für `he` verworfen hat. Jetzt Key `roiShort`; en/de/pl/ru behalten `ROI` |
| Strategy / Scenario | אסטרטגיה / תרחיש | Zeilenlabels der Ergebnis-Mail | waren bisher in **allen** Sprachen englisch; siehe wp7.md „EN-Lücke" |
| Projected result | תוצאה צפויה | Zeilenlabel der Ergebnis-Mail | |
| Get investment consultation | לקבלת ייעוץ השקעות | CTA unter dem Rechner | baut auf dem WP1-Header-CTA `לקבלת ייעוץ` auf |
| Send calculation | שליחת החישוב | Button des ROI-Formulars | |
| Send calculation by email | שליחת החישוב לאימייל | Titel des Sende-Modals | |

## 5. Cross-WP-Divergenzen — entschieden in Fix-Runde 1

Pass B hat zwei Begriffe gefunden, die WP7 anders führt als ein früheres WP, plus einen,
den `he-glossary.md` §4 selbst falsch führt.

| Begriff | WP2 | WP4 | WP7 (Abgabe) | Entscheidung |
|---|---|---|---|---|
| Unit-Status (Einheitentabelle) | `זמינה / שמורה / נמכרה`, implementiert in `src/lib/heFeedVocab.ts`, Pass B #10 | — | `זמין / שמור / נמכר` | **`זמינה / שמורה / נמכרה`** — WP2 hat es entschieden *und* gebaut, und der Bezug `יחידה` ist feminin. WP7 folgt; die Copy-Tabelle trägt jetzt dieselben Formen. Das Projekt-Badge `soldOut` bleibt maskulin `נמכר`, weil es dort den פרויקט benennt. **Umgesetzt.** |
| `Price from` (Label mit Abstand zur Zahl) | `מחיר התחלתי` (Pass B #3/#4/#25, bewusst, mit Regel: inline `החל מ-`, freistehend das Wort) | `מחיר התחלתי` ⚠️ **offen** — Pass B belegt den falschen Freund („Eröffnungspreis im Ausschreibungsverfahren"), drei Optionen, Lektorentscheid ausstehend | `מחיר התחלתי`, begründet mit „gleiche Entscheidung wie in WP4" | **`מחיר התחלתי` vorläufig beibehalten** — aber die WP7-Begründung war **sachlich falsch**: WP4 hat *nicht* so entschieden, sondern die Frage offengelassen. Zeile oben korrigiert. **WP4s offene Frage 5 wird als gemeinsamer Blocker für WP2, WP4 und WP7 geführt.** Unabhängig davon hat der Budget-Chip jetzt einen eigenen Term (`מעל`). |
| `Contact us` | — | — | `ליצירת קשר` (wie WP3 `TeamBlockComponent`) | **`ליצירת קשר`.** `he-glossary.md` §4 führt `צור קשר` — maskulin Singular Imperativ, ein §2-Verstoß. WP3 hat es für Karten bereits umgangen, WP7 folgt. Empfehlung an Pass C: §4 nachziehen, `צור קשר` allenfalls als Menülabel **mit** Begründung. |

Nicht betroffen: der `הכל`/`הכול`-Streit aus WP2/WP4/WP5 kommt in WP7 nicht vor.

## 6. Neu aus Fix-Runde 1

| EN | HE | Kontext | Begründung |
|---|---|---|---|
| Consulting-language note (Entscheidung E) | הייעוץ מתקיים באנגלית או ברוסית; פנייה בעברית מתקבלת בברכה. | Auto-Reply, ROI-Ergebnismail, Booking-Seite, Präsentationsseite | Wörtlich aus `he-glossary.md` §5. Liegt als **eine** exportierte Konstante `HE_LANGUAGE_NOTE` in `src/lib/locale.ts`, damit die vier Träger nach §11.6 nicht auseinanderlaufen können. Die Annahme „einmal sagen reicht" gilt pro Kanal, nicht pro Firma (Pass B M3/M4/M5) |
| on/at + Datum (Terminbestätigung) | ביום ד׳, 14 באוק׳, 15:00 · ל-⁦14/10/2026⁩ | Booking-Seite und Bestätigungsmail | Die Ein-Buchstaben-Präposition klebt vor einem hebräischen Wort **ohne** Bindestrich und nimmt ihn vor einer Ziffer (§3). `he-IL` liefert ein Datum, das mit `יום` beginnt, also ergab `ב-${dt}` das nicht existierende `ב-יום ד׳`. Helfer `hePrefixDate()` (Pass B M6/M7) |
| viewing (Besichtigung) | סיור | `closingTrust` der Präsentationsseite | **Geändert (Pass B S9):** `ביקור` ist ein Besuch allgemein; die Branche sagt `סיור` |
| I answer every message myself | אני עונה לכל הודעה בעצמי | `closingTrust` | **Geändert (Pass B S2):** vier `אישי` auf einer Seite, zwei davon in benachbarten Absätzen (§11.5). `intro` behält `באופן אישי` |
| Browser-Tab (Präsentation / Booking) | המבחר האישי שלכם \| Cyprus VIP Estates · תיאום פגישה \| Cyprus VIP Estates | `generateMetadata()` beider Token-Seiten | **Neu (Pass B S21):** die Tabs waren englisch. `|` statt `-`, wie in allen `he`-Betreffzeilen (§3) |
