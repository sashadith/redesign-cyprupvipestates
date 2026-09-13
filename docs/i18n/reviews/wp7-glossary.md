# Glossar-Ergänzungen aus WP7 — Präsentationsseite, Booking, CRM-Nachrichten, E-Mails, ROI

**Stand:** 2026-09-13 · Begleitdokument zu `docs/i18n/reviews/wp7.md`.

Begriffe, die WP7 gebraucht hat und die in `docs/i18n/he-glossary.md` §1–5 (und in §6.1
aus WP1) fehlten. **`he-glossary.md` wurde bewusst nicht angefasst** — nach dem Lektorat
(Pass C) wandern die bestätigten Zeilen dort in §2/§4/§5.

## 1. Präsentationsseite `/c/[token]`

| EN | HE | Kontext | Begründung |
|---|---|---|---|
| YOUR PERSONAL SELECTION (Eyebrow) | המבחר האישי שלכם | Hero-Eyebrow über der Begrüßung | `מבחר` ist das neutrale Wort für eine kuratierte Auswahl; `בחירה` wäre der Akt des Wählens |
| Your preferences | ההעדפות שלכם | Überschrift über den Kriterien-Chips | nominal, genusfrei |
| up to (Budget-Chip) | עד | `עד €500,000` | steht mit Leerzeichen vor dem Betrag, deshalb keine `החל מ-`-Konstruktion |
| from (Preis-Präfix) | מחיר התחלתי | Kartenpreis „from €450,000" **und** Budget-Chip | Die Komponente setzt `${präfix} ${betrag}` mit **Leerzeichen** — das Glossar-`החל מ-` braucht aber den Bindestrich direkt am Betrag. Gleiche Entscheidung wie in WP4 (`BlogSlide`), damit die duplizierten Strings wortgleich bleiben. **Offene Frage 1** |
| Immediate | מיידי | Timeline-Chip | |
| Within 3 / 6 months, a year, 2 years | תוך 3 חודשים · תוך 6 חודשים · תוך שנה · תוך שנתיים | Timeline-Chips | `שנתיים` ist der Dual, nicht `2 שנים` |
| Just looking | בשלב בדיקה | Timeline-Chip | `רק מסתכל` wäre genusgebunden; Nominalstil (§2.1) |
| View details | לפרטים נוספים | Karten-CTA | idiomatischster israelischer CTA; `קריאה נוספת` (Glossar) gehört zum Blog |
| Available units | יחידות זמינות | Overlay-Überschrift | |
| Unit · Type · Beds · Area · Price · Status | יחידה · סוג · חדרי שינה · שטח · מחיר · סטטוס | Kopfzeile der Einheitentabelle | `חדרי שינה` statt `חדרים` ist Pflicht (Glossar §2) |
| No longer available (Unit-Status) | לא זמין עוד | Status einer aus dem Feed verschwundenen Einheit | ruhige Tatsache, keine Entschuldigung |
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
| Your personal property advisor | היועץ האישי שלכם לנדל"ן | Signatur-Rollenzeile | ergänzt `לנדל"ן`, weil die Zeile ohne Kontext unter dem Namen steht |
| Dear Client (Fallback ohne Name) | שלום | Auto-Reply und ROI-Mail, gerendert als `${name},` | `לקוח יקר`/`לקוחה יקרה` erzwingt ein Genus (§2); die nackte Grußformel trägt dieselbe Zeile |
| Thank you for your enquiry | תודה על הפנייה | Auto-Reply Betreff + H1 | |
| What happens next? | מה קורה עכשיו? | Zwischenüberschrift im Auto-Reply | echte Frage, kein Doppelpunkt-Titel |
| trusted developers | יזמים אמינים | Auto-Reply, Punkt 3 | EN sagt „trusted"; `מובילים` (Glossar §5) wäre eine andere Behauptung |
| Follow us: | עקבו אחרינו: | Social-Zeile im Auto-Reply | Imperativ Plural (§2.2); nominal wirkt hier gestelzt |
| Browse properties in Cyprus | לצפייה בנכסים בקפריסין | CTA-Button im Auto-Reply | |
| Close (aria-label) | סגירה | Schließen-Kreuz des Broschüren-Modals | nominal, genusfrei |

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
| Amount (EUR) | סכום (EUR) | y-Achse | Währungscode bleibt lateinisch |
| Years / years / yrs | שנים | x-Achse, Einheiten | eine Form für alle drei Fundstellen |
| Strategy / Scenario | אסטרטגיה / תרחיש | Zeilenlabels der Ergebnis-Mail | waren bisher in **allen** Sprachen englisch; siehe wp7.md „EN-Lücke" |
| Projected result | תוצאה צפויה | Zeilenlabel der Ergebnis-Mail | |
| Get investment consultation | לקבלת ייעוץ השקעות | CTA unter dem Rechner | baut auf dem WP1-Header-CTA `לקבלת ייעוץ` auf |
| Send calculation | שליחת החישוב | Button des ROI-Formulars | |
| Send calculation by email | שליחת החישוב לאימייל | Titel des Sende-Modals | |
