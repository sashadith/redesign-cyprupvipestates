# Lektorat WP7 — Präsentationsseite, Booking-Seite, CRM-Nachrichten an Kunden, E-Mails, ROI-Rechner

**Stand:** 2026-09-13 · **Pass A (Erstübersetzung) fertig** · Marker im Code: `REVIEW(he)`
**Umfang:** 16 Dateien, 23 `he`-Einträge, rund 195 Einzelstrings.
**Quelle:** immer der englische Eintrag. Die deutschen Zeilen dienten nur als Tonreferenz.
**Glossar-Ergänzungen:** `docs/i18n/reviews/wp7-glossary.md` (rund 90 Begriffe; `he-glossary.md` wurde nicht angefasst).

---

## Wo diese Strings sichtbar sind

| Fläche | Seite / Zustand | Auslöser |
|---|---|---|
| Client Presentation, Hero | `/c/<token>` — Eyebrow, Begrüßungswort + gold gesetzter Name, Intro-Absatz, „Ihre Wünsche"-Chips | Lead mit `languagePreference = he`, für den eine Presentation erzeugt wurde |
| Client Presentation, Karten | dieselbe Seite — Preiszeile, Badges (`חדש עבורכם`, `נמכר`), Einheitenzähler, Lieferquartal, Karten-CTA | |
| Client Presentation, Overlay | Klick auf eine Karte — Link „auf der Website ansehen", Einheitentabelle, Statusspalte | nur wenn das Development Einheiten mitliefert |
| Client Presentation, Karte/POIs | Kartenabschnitt — Überschrift `החיים בסביבה` | nur wenn Koordinaten vorliegen |
| Client Presentation, Closing | Fuß der Seite — Eyebrow, Berater-Rollenzeile, Vertrauensabsatz, drei Buttons, Rechtszeile + Datenschutzlink | |
| Client Presentation, WhatsApp | Klick auf den WhatsApp-Button — der **vorbelegte Text**, den der Besucher abschickt | |
| Client Presentation, Ablauf | `/c/<abgelaufener-token>` — „Diese Seite ist nicht mehr verfügbar" | Token abgelaufen oder deaktiviert |
| Booking, Auswahl | `/book/<token>` (Status PENDING) — Eyebrow, H1 mit goldem Vornamen, Intro, Slot-Liste, Auswahlblock, Submit, Hinweis, Fehlermeldungen |  |
| Booking, gesendet | derselbe Bildschirm nach dem Absenden, und `/book/<token>` bei Status PROPOSED | |
| Booking, bestätigt | `/book/<token>` bei Status CONFIRMED — Titel, Termin­satz, Zoom- oder Telefonzeile | |
| Booking, Ablauf | abgelaufener/stornierter Token | |
| Broschüren-Modal | jede Projektseite, Schließen-Kreuz (`aria-label`, nur mit Screenreader hörbar) | |
| ROI-Rechner, UI | Projektseite → Button „ROI berechnen" — Modal-Titel/Untertitel, Rechnertitel, Szenario-Tabs, Eingabefelder, Ergebnisliste, Diagramm, Disclaimer, CTA | |
| ROI-Rechner, Formular | „Berechnung per E-Mail senden" — Modal-Titel, vier Felder, Kontaktweg-Radios, Validierungsmeldungen, Erfolgsmeldung | |

### E-Mails (Templates — Vorschau ist Operator-Aufgabe)

Diese vier Templates lassen sich nicht durch Klicken auf der Website erzeugen; sie werden vom
Server verschickt. Zum Gegenlesen genügt der Text in der Tabelle, für eine echte Sichtprüfung
im RTL-Layout muss der Operator einen Testversand anstoßen.

| Template | Datei | Wann |
|---|---|---|
| Auto-Reply auf eine Formularanfrage | `src/lib/emailTemplates.ts` → `getAutoReplyEmail` | jede Lead-Anfrage über ein Formular |
| ROI-Ergebnis an den Kunden | `src/app/api/roi-calculator/route.ts` → `getClientEmail` | Absenden des ROI-Formulars |
| „Ihre persönliche Auswahl" | `src/lib/crm/presentationMessages.ts` → `PRESENTATION_EMAIL_TEMPLATE` | Admin klickt „Send by email" am Presentation-Modal |
| Terminbestätigung | `src/lib/crm/bookingMessages.ts` → `BOOKING_CONFIRMATION_EMAIL` | Admin bestätigt einen Terminvorschlag |

Dazu zwei Bausteine, die in **jede** CRM-Mail hineinlaufen: die Anrede (`compose/greeting.ts`)
und der Gruß + die Signaturzeile (`compose/closing.ts`).

## Wie zu lektorieren ist

1. Kurzcheckliste `docs/i18n/he-styleguide.md` §10 Punkt für Punkt:
   kein englischer Restsatz · Genus nach §2 (Nominal/Infinitiv, sonst männlicher Plural,
   keine Schrägstriche) · Preise/Zahlen nach §5, Bidi isoliert · Ortsnamen nach Glossar,
   Eigennamen lateinisch · Meta-Title ≤ 60, Description ≤ 155 (hier nur E-Mail-Betreffs,
   Ziel ≤ 60) · keine Zeile aus §7 · jede Zahl hat eine Quelle.
2. Zusätzlich §11: kein `—`, keine Wurzelwiederholung im selben String, duplizierte
   Strings wortgleich, zweiter Durchgang über das rendernde JSX (siehe Kasten unten).
3. Länge mitdenken: Buttons ≤ 3 Wörter, Tabellenköpfe und Chips ungefähr auf EN-Länge.
   Die Einheitentabelle im Overlay hat vier Spalten auf schmalem Raum.
4. **Korrekturen in die Spalte `Korrektur HE` eintragen** — die vorhandene HE-Spalte
   bitte unverändert lassen, damit der Diff nachvollziehbar bleibt. Zeile ohne Korrektur
   leer lassen (= freigegeben).
5. Zurück an den Controller; er übernimmt die Korrekturen und entfernt `REVIEW(he)`.

**Nicht ändern:** Keys, `${…}`-Platzhalter und `{min}`/`{max}`/`{current}`-Tokens,
Funktionssignaturen, `numberLocale` (`"en-US"` — ein Intl-Tag, kein Text), `href`-Werte,
Slugs, `.ics`, `Zoom`, Markenname `Cyprus VIP Estates`, Personenname `Sascha Dith`.

**Unsichtbare Zeichen:** `⟦FSI⟧…⟦PDI⟧` unten steht für `bidiIsolate()` (U+2068…U+2069) im Code —
damit ein lateinischer Kundenname im hebräischen Satz nicht verdreht wird. Beim Korrigieren
bitte nicht mit abtippen, nur den Text.

### Zweiter Durchgang über das rendernde JSX (§11.3) — was Pass A hier geprüft hat

| Stelle | Verarbeitung | Konsequenz für die Übersetzung |
|---|---|---|
| `HeroGreeting.tsx` | `{greetingWord}, <span class="it">{name}!</span>` | Das Ausrufezeichen steht **im JSX**, nicht im String — `בוקר טוב` bleibt ohne Satzzeichen |
| `PropertyCard.tsx` `fmtPrice` | `${priceFrom} ${"€"}${betrag}` — **mit Leerzeichen** | deshalb `מחיר התחלתי` statt Glossar-`החל מ-` (dessen Bindestrich muss am Betrag kleben). Offene Frage 1 |
| `page.tsx` Budget-Chip | derselbe `priceFrom`-String, aber im Sinn von „Budget ab X" | ein String, zwei Bedeutungen. Offene Frage 1 |
| `PropertyCard.tsx` Meta-Zeile | `{vatLabel} · {zähler} · {delivery}: {quartal}` | `בתוספת מע"מ` statt `+מע"מ`, damit kein führendes Pluszeichen im RTL-Fluss kippt |
| `PropertyOverlay.tsx` Tabellenkopf | `{beds} / {area}` und `{price} / {status}` | zwei Labels teilen sich eine Spalte — beide kurz halten |
| `book/page.tsx` H1 | `{titlePrefix}<span class="it">{name}</span>{titleSuffix}` | `titlePrefix` endet mit Leerzeichen, `titleSuffix` beginnt mit Komma — Reihenfolge wie EN/RU |
| `book/page.tsx` `formalGreeting` | nur DE/PL definieren die Funktion | `he` definiert sie **nicht** → immer Vorname (siehe Anmerkung in der Tabelle) |
| `SlotPicker.tsx` | `{cyprusLabel} ({cyprusTime})` | die Uhrzeit selbst kommt aus `Intl`, nicht aus dieser Datei. Offene Frage 2 |
| `emailTemplates.ts` / ROI-Mail | Tabellenlayout, `align`-Attribute | `dir="rtl"` auf `<html>`/`<body>`, `align="left"` → `right`, Listen­einzug gespiegelt, Wertespalte der Ergebnistabelle von `right` auf `left` — Layout selbst unverändert |
| `crm/compose/*` | Anrede und Gruß werden **um** den generierten Text herum gesetzt | `שלום [Vorname],` + Leerzeile + Intro; Gruß + Leerzeile + Name + Rollenzeile |

---

## 1. `src/app/c/[token]/copy.ts` — Client-Presentation-Seite

### 1.1 Begrüßungswort (`GREETING.he`)

| Key | EN | HE | Anmerkung | Korrektur HE |
|---|---|---|---|---|
| morning | Good morning | בוקר טוב | Serverzeit < 12 Uhr | |
| afternoon | Good afternoon | צהריים טובים | 12–18 Uhr | |
| evening | Good evening | ערב טוב | ab 18 Uhr | |

### 1.2 Seitentext (`COPY.he`)

| Key | EN | HE | Anmerkung | Korrektur HE |
|---|---|---|---|---|
| eyebrowTag | YOUR PERSONAL SELECTION | המבחר האישי שלכם | Versalien gibt es im Hebräischen nicht | |
| intro | Thank you for your trust. I have personally selected these properties for you - each of them matches your wishes and deserves your attention. | תודה על האמון. בחרתי עבורכם באופן אישי את הנכסים האלה. כל אחד מהם מתאים למה שביקשתם ושווה תשומת לב. | EN-Bindestrich → eigener Satz (§3). `בחרתי` = 1. Sg. Vergangenheit, genusfrei (§11.2) | |
| requirementsTitle | Your preferences | ההעדפות שלכם | | |
| budgetUpTo | up to | עד | steht vor `€500,000` | |
| propertyTypeNames.Apartment | Apartment | דירה | Glossar §2 | |
| propertyTypeNames.Villa | Villa | וילה | Glossar §2 | |
| propertyTypeNames.Townhouse | Townhouse | בית טורי | Glossar §2, nicht `קוטג'` | |
| propertyTypeNames.Penthouse | Penthouse | פנטהאוז | Glossar §2 | |
| timelineLabels.IMMEDIATE | Immediate | מיידי | | |
| timelineLabels.THREE_MONTHS | Within 3 months | תוך 3 חודשים | | |
| timelineLabels.SIX_MONTHS | Within 6 months | תוך 6 חודשים | | |
| timelineLabels.ONE_YEAR | Within a year | תוך שנה | | |
| timelineLabels.TWO_YEARS | Within 2 years | תוך שנתיים | Dual statt `2 שנים` | |
| timelineLabels.JUST_LOOKING | Just looking | בשלב בדיקה | genusfrei; `רק מסתכל` wäre maskulin | |
| bedroomLabels.0 | Studio | סטודיו | | |
| bedroomLabels.1 | 1 bedroom | 1 חדר שינה | Fix-Runde 1 (Pass B S3): Ziffer, damit die Chip-Reihe einheitlich bleibt. `heBedrooms()` in `heFeedVocab.ts` behält bewusst `חדר שינה אחד` — dort ist der Kontext eine Freitext-Zusammenfassung, keine Filterleiste | |
| bedroomLabels.2–5 | 2/3/4/5+ bedrooms | 2 / 3 / 4 / 5+ חדרי שינה | Glossar §2: nie `חדרים` | |
| viewDetails | View details | לפרטים נוספים | Karten-CTA | |
| availableUnits | Available units | יחידות זמינות | | |
| unitsTable.unit | Unit | יחידה | | |
| unitsTable.type | Type | סוג | | |
| unitsTable.beds | Beds | חד׳ שינה | teilt sich eine Spalte mit `שטח`; abgekürzt in Fix-Runde 1 (Pass B S4) auf die in israelischen Anzeigen übliche Kurzform — 11 Zeichen passten nicht in eine Spalte, deren EN 4 hat | |
| unitsTable.area | Area | שטח | | |
| unitsTable.price | Price | מחיר | | |
| unitsTable.status | Status | סטטוס | | |
| statusLabel.available | Available | זמינה | **feminin**, Bezug ist `יחידה` — WP2 hatte das in `heFeedVocab.ts` bereits so entschieden, WP7 hatte daneben eine maskuline Zweitfassung geführt (Pass B M12) | |
| statusLabel.reserved | Reserved | שמורה | feminin, wie `.available` (Pass B M12) | |
| statusLabel.sold | Sold | נמכרה | feminin, wie `.available`. Das **Karten-Badge** `soldOut` bleibt maskulin `נמכר` — dort ist der Bezug der פרויקט (Pass B M12) | |
| statusLabel.unlisted | No longer available | לא זמינה עוד | Einheit aus dem Feed verschwunden; feminin wie die übrigen drei. Weicht bewusst von `heFeedVocab.ts`' `לא בתצוגה` ab: dort heißt „unlisted" „nicht in der Anzeige", hier „gibt es nicht mehr" (siehe Fix-Runde-1-Kasten) | |
| advisorTitle | Your personal advisor | היועץ האישי שלכם | maskulin wie im Glossar-CTA | |
| unitsPlural.one / .many | unit / units | יחידה / יחידות | „5 יחידות" | |
| newForYou | New for you | חדש עבורכם | Badge | |
| vatLabel | +VAT | בתוספת מע"מ | siehe JSX-Kasten | |
| soldOut | Sold out | נמכר | Glossar §2: Badge kurz | |
| lifeNearby | LIFE NEARBY | החיים בסביבה | | |
| closingEyebrow | DIRECT CONTACT | קשר ישיר | | |
| closingTrust | I personally answer every message - usually within the hour. Ask me anything about the properties in your selection, arranging a viewing, or the details of buying in Cyprus. No obligation, no rush. | אני עונה לכל הודעה בעצמי, בדרך כלל בתוך שעה. אפשר לשאול אותי כל דבר על הנכסים שבמבחר שלכם, על תיאום סיור ועל פרטי הרכישה בקפריסין. בלי התחייבות ובלי לחץ. הייעוץ מתקיים באנגלית או ברוסית; פנייה בעברית מתקבלת בברכה. | `עונה` ist unvokalisiert für beide Genera identisch. „arranging a viewing" ohne `בנכס`, um die Wurzel `נכס` nicht zu wiederholen (§11.5) | |
| whatsapp | WhatsApp | וואטסאפ | Glossar §4 | |
| call | Call | להתקשר | Button neben וואטסאפ / אימייל | |
| email | Email | אימייל | Glossar §4 | |
| whatsappMessage | Hello, I viewed my personal selection and would like to talk about | שלום, עברתי על המבחר האישי שלי ואשמח לדבר על | **Der Besucher spricht.** Bewusst unvollständig — WhatsApp öffnet damit den Eingabecursor. `צפיתי`/`אשמח` sind 1. Sg. und genusfrei | |
| notAvailableTitle | This page is no longer available | הדף אינו זמין עוד | | |
| notAvailableBody | The link you used has expired or is no longer active. Please get in touch and we will be glad to help. | תוקף הקישור פג או שהוא כבר אינו פעיל. אפשר לפנות אלינו ונשמח לעזור. | zweites `קישור` durch `הוא` ersetzt (§11.5) | |
| contactUs | Contact us | ליצירת קשר | wortgleich mit Booking-Seite, `TeamBlockComponent`, `preview-about` | |
| legal | This selection is provided for informational purposes and does not constitute an offer. | המבחר נועד למידע בלבד ואינו מהווה הצעה. | keine Zusatzbehauptung („verbindlich") ergänzt | |
| privacyPolicy | Privacy policy | מדיניות פרטיות | Glossar §4 | |
| priceFrom | from | מחיר התחלתי | **nur noch** die Preiszeile der Objektkarte (freistehende Bildunterschrift). Offene Frage 1 ist beantwortet: der Budget-Chip hat seit Fix-Runde 1 einen eigenen Key | |
| budgetFrom *(neu)* | from | מעל | Budget-**Untergrenze** im Hero-Chip („מעל €300,000"), symmetrisch zu `budgetUpTo` = `עד`. Ein Objektpreis ist es nicht (Pass B M14) | |
| close *(neu)* | Close | סגירה | `aria-label` des Overlay-Schließers; war in allen Sprachen hart englisch (Pass B S16) | |
| favorite *(neu)* | Favorite | שמירה למועדפים | `aria-label` des Herz-Buttons auf Karte und Overlay (Pass B S16) | |
| metaTitle *(neu)* | Your Property Selection - Cyprus VIP Estates | המבחר האישי שלכם \| Cyprus VIP Estates | Browser-Tab. Trägt weiterhin **keinen** Token-Inhalt — nur die Locale wird aus der Zeile gelesen (Pass B S21) | |
| metaDescription *(neu)* | A personal property selection. | מבחר נכסים אישי בקפריסין. | dito | |
| units | units | יחידות | derzeit von keiner Komponente gerendert | |
| delivery | Delivery | מסירה | Glossar §2 (Handover) | |
| viewOnSite | View on site | לצפייה באתר | Link aus dem Overlay auf die öffentliche Seite | |

---

## 2. `src/app/book/[token]/copy.ts` — Booking-Seite

| Key | EN | HE | Anmerkung | Korrektur HE |
|---|---|---|---|---|
| eyebrow | Schedule a meeting | תיאום פגישה | | |
| titlePrefix | „Hello " | „שלום " | Leerzeichen am Ende ist Absicht | |
| titleSuffix | , let's find a time | , נמצא זמן שמתאים לכם | steht hinter dem gold gesetzten Vornamen | |
| formalGreeting | (DE/PL) | **nicht definiert** | Hebräisch hat keine neutrale „Herr/Frau"-Anrede; `מר`/`גב'` erzwingt ein Genus. Bitte bestätigen | |
| intro | Pick 2-3 times that work for you and I'll confirm one shortly. | אפשר לבחור 2-3 מועדים שמתאימים לכם, ואחזור אליכם עם אישור בקרוב. הייעוץ מתקיים באנגלית או ברוסית; פנייה בעברית מתקבלת בברכה. | `אחזור … עם אישור` statt `אאשר`, das unvokalisiert schwer lesbar ist | |
| yourTime | Your time | השעה אצלכם | im aktuellen JSX ungenutzt | |
| cyprusTime | Cyprus time | שעון קפריסין | steht in Klammern hinter der Uhrzeit. Offene Frage 2 | |
| detectingTimezone | Detecting your timezone… | מזהים את אזור הזמן שלכם… | Partizip Plural wie `שולחים…` (WP1) | |
| selectedTitle | Your selected times | המועדים שבחרתם | | |
| submit | Send my available times | שליחת המועדים הפנויים | nominal | |
| submitting | Sending… | שולחים… | wortgleich mit `QualificationForm` (WP1) | |
| hint | Select between 1 and 3 times above. | יש לבחור למעלה בין 1 ל-3 מועדים. | | |
| pickCountError | Please select between 1 and 3 times. | יש לבחור בין 1 ל-3 מועדים. | dieselbe Wendung ohne „oben" | |
| genericError | Something went wrong. Please try again. | משהו השתבש, נסו שוב. | Glossar §4 | |
| submittedTitle | Thank you | תודה | | |
| submittedBody | I've received your available times and will confirm one shortly by email. | קיבלתי את המועדים הפנויים שלכם ואשלח אישור בקרוב באימייל. | | |
| alreadyProposedTitle | Thank you | תודה | | |
| alreadyProposedBody | I've already received your available times and will confirm one shortly by email. | כבר קיבלתי את המועדים הפנויים שלכם ואשלח אישור בקרוב באימייל. | unterscheidet sich nur durch `כבר`, wie im EN | |
| confirmedTitle | Your appointment is confirmed | הפגישה שלכם מאושרת | wortgleich mit dem Betreff der Bestätigungsmail | |
| confirmedBody | We're set for ${dt} (your time). A calendar invite has been sent to your email. | נפגשים ב-${dt} (לפי השעון שלכם). הזמנה ליומן נשלחה לאימייל שלכם. | `${dt}` kommt aus `Intl` mit `he-IL` und ist bereits hebräisch — deshalb keine LTR-Isolation | |
| confirmedZoomNote | I'll send the Zoom link separately, shortly before our call. | את הקישור לפגישת Zoom אשלח בנפרד, זמן קצר לפני השיחה. | `לפגישת Zoom` vermeidet einen Bindestrich direkt am lateinischen Wort. Wortgleich mit `bookingMessages.ts` | |
| confirmedPhoneNote | I'll call you at the agreed time. | אתקשר אליכם במועד שנקבע. | wortgleich mit `bookingMessages.ts` | |
| goneTitle | This link is no longer available | הקישור אינו זמין עוד | Parallelbau zu `notAvailableTitle` | |
| goneBody | This booking link has expired or is no longer active. Please get in touch and I'll send you a new one. | תוקף קישור התיאום פג או שהוא כבר אינו פעיל. אפשר לפנות אלינו ואשלח לכם קישור חדש. | | |
| contactUs | Contact us | ליצירת קשר | wortgleich | |

---

## 3. `src/lib/crm/presentationMessages.ts` — Nachrichten an den Kunden

| Key | EN | HE | Anmerkung | Korrektur HE |
|---|---|---|---|---|
| WHATSAPP_MSG | Hello ${name}, I have prepared your personal property selection: ${url} | שלום ⟦FSI⟧${name}⟦PDI⟧, הכנתי עבורכם מבחר נכסים אישי: ${url} | **Sascha schreibt.** Der Name ist bidi-isoliert, die URL bewusst **nicht** — WhatsApps Linkerkennung würde ein angehängtes PDI mitschlucken | |
| WHATSAPP_UPDATED_MSG | I've updated your selection - take a look, there's something new: ${url} | עדכנתי את המבחר שלכם, יש שם משהו חדש: ${url} | „take a look" ist im Hebräischen redundant, sobald der Link folgt | |
| PRESENTATION_EMAIL_TEMPLATE.subject | Your personal property selection — Cyprus VIP Estates | מבחר הנכסים האישי שלכם \| Cyprus VIP Estates | `\|` statt `—` (§3). 43 Zeichen | |
| PRESENTATION_EMAIL_TEMPLATE.body | Hello ${name},\\n\\nI have prepared your personal property selection. You can view it here:\\n${url}\\n\\nLet me know if you have any questions.\\n\\n${closing} | שלום ⟦FSI⟧${name}⟦PDI⟧,\\n\\nהכנתי עבורכם מבחר נכסים אישי. אפשר לצפות בו כאן:\\n${url}\\n\\nאשמח לענות על כל שאלה.\\n\\n${closing} | „Let me know if…" nicht als `אל תהססו` (§7). Der Gruß kommt aus `compose/closing.ts` (Abschnitt 6) | |

---

## 4. `src/lib/crm/bookingMessages.ts` — Terminbestätigung an den Kunden

| Key | EN | HE | Anmerkung | Korrektur HE |
|---|---|---|---|---|
| meetingNote PHONE | I'll call you at the agreed time. | אתקשר אליכם במועד שנקבע. | wortgleich mit der Booking-Seite (§11.6) | |
| meetingNote ZOOM | I'll send the Zoom link separately, shortly before our call. | את הקישור לפגישת Zoom אשלח בנפרד, זמן קצר לפני השיחה. | wortgleich mit der Booking-Seite | |
| BOOKING_CONFIRMATION_EMAIL.subject | Your appointment is confirmed — Cyprus VIP Estates | הפגישה שלכם מאושרת \| Cyprus VIP Estates | 38 Zeichen | |
| BOOKING_CONFIRMATION_EMAIL.body | Hello ${name},\\n\\nYour appointment is confirmed for ${dt} (your time).\\n\\nI've attached a calendar invite (.ics) with the details.\\n\\n${meetingNote} | שלום ⟦FSI⟧${name}⟦PDI⟧,\\n\\nהפגישה שלכם מאושרת ל-${dt} (לפי השעון שלכם).\\n\\nמצורפת הזמנה ליומן (.ics) עם כל הפרטים.\\n\\n${meetingNote} | `${dt}` ist bereits hebräisch formatiert (`he-IL`) | |

---

## 5. `src/lib/crm/compose/greeting.ts` — Anrede und Erstkontakt-Satz

| Key | EN | HE | Anmerkung | Korrektur HE |
|---|---|---|---|---|
| GREETING (mit Vorname) | Hi ${first}, | שלום ${first}, | eine Form für jede Tageszeit und jedes Genus | |
| GREETING (ohne Vorname) | Hi, | שלום, | | |
| FIRST_CONTACT_INTRO | thank you for your message! My name is Sascha Dith from Cyprus VIP Estates. | תודה על ההודעה! שמי Sascha Dith, מסוכנות Cyprus VIP Estates. הייעוץ מתקיים באנגלית או ברוסית; פנייה בעברית מתקבלת בברכה. | **Trägt zusätzlich den Sprachhinweis (Entscheidung E, Glossar §5)** — dies ist die eine Zeile, die jeder hebräische Lead beim Erstkontakt sieht; das Playbook verbietet die Wiederholung. `תודה על ההודעה` statt `על הפנייה`, damit die Wurzel `פנה` im Satz nur einmal steht (§11.5). Das eine Ausrufezeichen ist die vom Voice-Playbook erlaubte Ausnahme | |

---

## 6. `src/lib/crm/compose/closing.ts` — Gruß und Signaturzeile

> **Nicht im ursprünglichen WP7-Dateiplan.** Ohne diese zwei Zeilen hätte jede hebräische
> Kunden-Mail mit „Best regards, / Your personal property advisor" geendet, weil
> `buildEmailClosing` auf `en` zurückfällt. Rein additiv, keine LTR-Zeile berührt.

| Key | EN | HE | Anmerkung | Korrektur HE |
|---|---|---|---|---|
| VALEDICTION | Best regards, | בברכה, | | |
| ROLE_LINE | Your personal property advisor | יועץ הנדל"ן האישי שלכם | steht direkt unter „Sascha Dith"; `לנדל"ן` ergänzt, weil die Zeile sonst kontextlos ist. Vgl. `advisorTitle` der Präsentationsseite (`היועץ האישי שלכם`) — bewusst nicht identisch | |

---

## 7. `src/lib/emailTemplates.ts` — Auto-Reply auf eine Formularanfrage

| Key | EN | HE | Anmerkung | Korrektur HE |
|---|---|---|---|---|
| SAFE_NAME | Dear Client | שלום | Fallback, wenn kein Name mitkam; gerendert als `${name},` | |
| subject | Thank you for your enquiry — Cyprus VIP Estates | תודה על הפנייה \| Cyprus VIP Estates | 40 Zeichen | |
| title | Thank you for your enquiry | תודה על הפנייה | H1 der Mail | |
| intro1 | Thank you for contacting <strong>Cyprus VIP Estates</strong>. | ההודעה שלכם הגיעה אל <strong>Cyprus VIP Estates</strong>. | `יצרתם קשר` statt nochmals `פנייה` (steht schon im Titel) | |
| intro2 | We've received your enquiry and will get back to you shortly with personalised property options in Cyprus and answers to your questions. | נחזור אליכם בקרוב עם הצעות נכסים מתאימות בקפריסין ועם תשובות לשאלות שלכם. | | |
| whatNextTitle | What happens next? | מה קורה עכשיו? | echte Frage, kein Doppelpunkt-Titel (§3) | |
| li1 | We will review your enquiry and your property preferences. | נעבור על מה שכתבתם ועל העדפות הנכס שלכם. | `בקשה` statt `פנייה`, weil `פנייה` zwei Zeilen darüber steht | |
| li2 | One of our consultants will contact you via your preferred channel. | אחד היועצים שלנו ייצור אתכם קשר בדרך שנוחה לכם. | | |
| li3 | We will prepare tailored property offers directly from trusted developers in Cyprus. | נכין הצעות מותאמות אישית ישירות מיזמים אמינים בקפריסין. | „trusted" = `אמינים`; `מובילים` wäre eine andere Aussage | |
| speedUp | If you'd like to speed up the process, you can already explore our latest projects below. | כדי לזרז את התהליך, אפשר כבר עכשיו לעיין בפרויקטים העדכניים שלנו. | „below" ist im Hebräischen überflüssig, der Button steht direkt darunter | |
| ctaText | Browse properties in Cyprus | לצפייה בנכסים בקפריסין | | |
| followUs | Follow us: | עקבו אחרינו: | Imperativ Plural (§2.2) | |
| reason | You received this email because you submitted an enquiry on the Cyprus VIP Estates website. | קיבלתם את האימייל הזה כי השארתם פנייה באתר Cyprus VIP Estates. | Fußzeile in 11 px | |
| link | …/projects | https://cyprusvipestates.com/he/projects | URL, nicht übersetzt | |

**RTL-Umbau (kein Text), Stand Fix-Runde 1:** `dir="rtl"` steht jetzt auf `<html>`,
`<body>`, **beiden Wrapper-Tabellen**, **jeder Textzelle**, dem `<ul>` und **jedem
`<p>`** — jeweils zusammen mit einem inline gesetzten `text-align`. Dazu die beiden
`align="left"`-Textzellen auf `right` und der Einzug der Aufzählung von
`0 0 12px 20px` auf `0 20px 12px 0` gespiegelt.

**Warum das nötig war (Pass B M2):** `dir` auf `<html>`/`<body>` allein ist in Gmail
(Web **und** App), Yahoo und Outlook.com wirkungslos — diese Clients entfernen
`<html>`, `<head>` und `<body>` und hängen den Rest in ihren eigenen LTR-Container.
Übrig blieb eine richtungslose Tabelle: hebräischer Text linksbündig, gespiegelter
Listeneinzug **ohne** gespiegelte Bullets. Das ist die eine Zeile, die zwischen „RTL
erledigt" und „RTL wirkungslos" entscheidet, und sie fehlte im Abgabestand.

Für en/de/pl/ru ist das gerenderte HTML weiterhin byte-identisch — jetzt festgenagelt
durch `src/lib/__tests__/emailTemplatesRtl.test.ts` gegen die eingefrorene Datei
`src/lib/__tests__/fixtures/autoreply-en.html`, nicht nur durch einen einmaligen Lauf.

---

## 8. `src/app/api/roi-calculator/route.ts` — ROI-Ergebnis-Mail an den Kunden

**EN-Lücke, die dabei geschlossen wurde:** die fünf Zeilenlabels der Ergebnistabelle
(`Strategy`, `Scenario`, `Total entry cost`, `Projected result`, `Average annual ROI`)
standen fest verdrahtet auf Englisch — in **jeder** Sprache. Sie liegen jetzt in der
`t`-Tabelle. Für de/pl/ru wurde bewusst der bisherige **englische** Text übernommen
(Planvorgabe „LTR-Strings identisch"); nur `he` bekommt Hebräisch. Wenn de/pl/ru diese
Labels künftig übersetzt haben sollen, ist das eine eigene Entscheidung — bitte notieren.

| Key | EN | HE | Anmerkung | Korrektur HE |
|---|---|---|---|---|
| numberLocale | en-US | en-US | **kein Text.** Bleibt en-US, weil `he-IL` das `€` hinter die Zahl stellen würde (§5) | |
| strategyBuySell | Buy & Sell | רכישה ומכירה | nur `he` weicht ab. Offene Frage 3 | |
| strategyBuyHold | Buy & Hold | רכישה והחזקה | dito | |
| scenarioConservative | Conservative | שמרני | wortgleich mit dem Rechner-Tab | |
| scenarioOptimistic | Optimistic | אופטימי | dito | |
| scenarioRealistic | Realistic | ריאלי | dito | |
| safeName | Dear Client | שלום | wortgleich mit `emailTemplates.ts` | |
| labelStrategy | Strategy | אסטרטגיה | war bisher in allen Sprachen englisch | |
| labelScenario | Scenario | תרחיש | dito | |
| labelTotalEntryCost | Total entry cost | עלות כניסה כוללת | dito; wortgleich mit `RoiResults` | |
| labelProjectedResult | Projected result | תוצאה צפויה | dito | |
| labelAnnualRoi | Average annual ROI | תשואה שנתית ממוצעת | dito; wortgleich mit `RoiResults` | |
| subject | Your ROI calculation — Cyprus VIP Estates | חישוב התשואה שלכם \| Cyprus VIP Estates | 38 Zeichen | |
| title | Your indicative ROI result | התשואה המשוערת שלכם | H1 der Mail | |
| intro | Thank you for using the ROI Calculator on Cyprus VIP Estates. | תודה שהשתמשתם במחשבון התשואה של Cyprus VIP Estates. | | |
| summary | Below is a summary of your projected investment result. | לפניכם סיכום התוצאה הצפויה של ההשקעה. | | |
| cta | View property | לצפייה בנכס | Button | |
| footer | This calculation is indicative only. Final figures may vary depending on the property, transaction structure and market conditions. | החישוב משוער בלבד. הנתונים הסופיים עשויים להשתנות בהתאם לנכס, למבנה העסקה ולתנאי השוק. | Fußzeile in 11 px | |

**RTL-Umbau (kein Text), Stand Fix-Runde 1:** wie beim Auto-Reply liegt `dir="rtl"`
jetzt zusätzlich auf beiden Wrapper-Tabellen, auf der **Ergebnistabelle**, auf jeder
Textzelle und auf jedem `<p>` (Pass B M2). Unverändert: die eine `align="left"`-Zelle
auf `right` und die Wertespalte der Ergebnistabelle von `text-align:right` auf `left`.

**Zwei Sicherheits-/Zustellungspunkte aus derselben Runde:**
- `<html lang="${lang}">` interpolierte den **rohen Request-Body-Wert**; jetzt
  `${safeLang}`, und der Name läuft durch `escapeHtml()` + `<bdi>` (Pass B M16/M9).
- Beide ROI-Mails haben jetzt einen `text/plain`-Teil (`stripHtmlToText(html)`) —
  SpamAssassin bestraft HTML-only (`MIME_HTML_ONLY`), und für `he` ist ein Textteil
  der verlässlichste RTL-Fallback, weil er in der Leserichtung des Clients rendert
  (Pass B S22). Für en/de/pl/ru identisch, kein `he`-Sonderfall.

Die 192/192 Renderings für en/de/pl/ru (inkl. Junk-`lang`) bleiben byte-identisch.

---

## 9. `src/app/components/FormRoi/FormRoi.copy.ts` — ROI-Formular

`{min}`, `{max}`, `{current}` sind Tokens, die die Komponente selbst ersetzt — bitte stehen lassen.

| Key | EN | HE | Anmerkung | Korrektur HE |
|---|---|---|---|---|
| inputName | Name | שם פרטי | wortgleich mit `FormStatic` | |
| inputSurname | Surname | שם משפחה | wortgleich | |
| inputPhone | Phone | טלפון | wortgleich | |
| inputEmail | Email | אימייל | wortgleich | |
| buttonText | Send calculation | שליחת החישוב | | |
| successMessage | We sent the calculation to your email and received a copy. | שלחנו את החישוב לאימייל שלכם וקיבלנו עותק אצלנו. | | |
| validationNameRequired | Please enter your name | יש להזין שם פרטי | wortgleich mit `FormStatic.nameRequired` | |
| validationNameTooShort | Minimum {min} characters. Current: {current}. | לפחות {min} תווים. כרגע: {current}. | WP1-Muster (`מינימום` wurde dort verworfen) | |
| validationNameTooLong | Maximum {max} characters. Current: {current}. | עד {max} תווים. כרגע: {current}. | dito | |
| validationSurnameRequired | Please enter your surname | יש להזין שם משפחה | wortgleich | |
| validationSurnameTooShort / TooLong | (wie Name) | לפחות {min} תווים. כרגע: {current}. / עד {max} תווים. כרגע: {current}. | im EN identisch mit den Name-Meldungen, im HE ebenso | |
| validationPhoneRequired | Please enter your phone number | יש להזין טלפון | wortgleich mit `FormStatic.phoneRequired` | |
| validationPhoneTooShort | Phone number is too short. Minimum {min}. | מספר הטלפון קצר מדי. לפחות {min} תווים. | | |
| validationPhoneTooLong | Phone number is too long. Maximum {max}. | מספר הטלפון ארוך מדי. עד {max} תווים. | | |
| validationPhoneInvalid | Invalid phone number | מספר טלפון לא תקין | Parallelbau zu `כתובת אימייל לא תקינה` | |
| validationEmailInvalid | Invalid email address | כתובת אימייל לא תקינה | wortgleich, Glossar §6.1 | |
| validationEmailRequired | Please enter your email | יש להזין אימייל | wortgleich | |
| validationAgreementRequired | Please confirm consent | נדרש אישור | wortgleich mit `FormStatic` | |
| validationAgreementOneOf | You must accept the policy | חובה לאשר | wortgleich mit `FormStatic` | |
| contactMethodRequired | What's the best way to contact you? | מה דרך ההתקשרות הנוחה לכם? | EN nutzt hier die Frage als Fehlermeldung; wortgleich mit dem Legend darunter und mit `FormStatic`/`FormFull` | |
| contactMethodLegend | What's the best way to contact you? | מה דרך ההתקשרות הנוחה לכם? | | |
| phoneCallLabel | Phone call | שיחת טלפון | wortgleich, Glossar §6.1 | |
| emailRadioLabel | Email | אימייל | | |

---

## 10. ROI-Rechner — Modale und Rechnerbausteine

### 10.1 `ModalRoi.copy.ts`

| Key | EN | HE | Anmerkung | Korrektur HE |
|---|---|---|---|---|
| title | Send calculation by email | שליחת החישוב לאימייל | | |
| text | We will send you a copy of the calculation and receive it on our side as well. | נשלח לכם עותק של החישוב ונקבל אותו גם אצלנו. | | |

### 10.2 `ModalRoiCalculator.copy.ts`

| Key | EN | HE | Anmerkung | Korrektur HE |
|---|---|---|---|---|
| title | ROI Calculator | מחשבון תשואה | Akronym ersetzt, siehe Glossar-Begründung | |
| subtitle | Estimate the potential return of this property. | הערכת התשואה הפוטנציאלית של הנכס הזה. | nominal statt Imperativ (§2.1) | |

### 10.3 `RoiCalculator.copy.ts`

| Key | EN | HE | Anmerkung | Korrektur HE |
|---|---|---|---|---|
| title | ROI Calculator | מחשבון תשואה | wortgleich mit dem Modal | |
| subtitle | Estimated calculation based on Cyprus new-build market conditions | חישוב משוער לפי תנאי השוק של פרויקטים חדשים בקפריסין | `פרויקטים חדשים` = Glossar §2 „new build" | |
| conservative | Conservative | שמרני | wortgleich mit der Ergebnis-Mail | |
| realistic | Realistic | ריאלי | dito | |
| optimistic | Optimistic | אופטימי | dito | |
| disclaimer | Results are indicative only and depend on purchase price, VAT rate, holding period, selling costs and market conditions. | התוצאות משוערות בלבד ותלויות במחיר הרכישה, בשיעור המע"מ, בתקופת ההחזקה, בעלויות המכירה ובתנאי השוק. | `מע"מ` mit Gershayim | |
| cta | Get investment consultation | לקבלת ייעוץ השקעות | baut auf dem WP1-CTA `לקבלת ייעוץ` auf | |

### 10.4 `RoiChart.copy.ts`

| Key | EN | HE | Anmerkung | Korrektur HE |
|---|---|---|---|---|
| numberLocale | en-US | en-US | **kein Text**, Intl-Tag (§5: westliche Ziffern) | |
| chartTitleBuyHold | Projected property value and rental income | תחזית שווי הנכס והכנסה משכירות | | |
| chartTitleBuySell | Projected property value and resale profit | תחזית שווי הנכס ורווח ממכירה | | |
| xAxis | Years | שנים | | |
| yAxis | Amount (EUR) | סכום ב-EUR | Währungscode bleibt lateinisch | |
| year | Year | שנה | Tooltip | |
| estimatedValue | Property value | שווי הנכס | Legende | |
| cumulativeNetRent | Cumulative rental income | הכנסה מצטברת משכירות | Legende | |
| cumulativeProfit | Total profit | רווח כולל | Legende | |

### 10.5 `RoiInputs.copy.ts`

| Key | EN | HE | Anmerkung | Korrektur HE |
|---|---|---|---|---|
| purchasePrice | Property price | מחיר הנכס | | |
| furnishing | Furnishing cost | עלות ריהוט | | |
| buildPeriod | Build period | תקופת בנייה | | |
| offPlanGrowth | Annual off-plan growth | עליית ערך שנתית בשלב הבנייה | grenzt sich bewusst von `annualAppreciation` ab | |
| sellingCosts | Selling costs | עלויות מכירה | wortgleich mit `RoiResults` | |
| rentalSection | Rental parameters | נתוני השכרה | Abschnittsüberschrift | |
| netYieldYearOne | Net yield (year 1) | תשואה נטו (שנה 1) | | |
| annualRentGrowth | Annual rent growth | עליית שכירות שנתית | | |
| rentalPeriodYears | Rental period after completion | תקופת השכרה לאחר המסירה | | |
| annualAppreciation | Annual appreciation | עליית ערך שנתית | | |
| yearsUnit | yrs | שנים | Hebräisch hat keine übliche Kurzform | |

### 10.6 `RoiResults.copy.ts`

| Key | EN | HE | Anmerkung | Korrektur HE |
|---|---|---|---|---|
| numberLocale | en-US | en-US | **kein Text** | |
| highlightLabelBuyHold | Total net return | תשואה נטו כוללת | große Zahl oben | |
| highlightLabelBuySell | Net profit from resale | רווח נטו ממכירה | | |
| horizon | Horizon | אופק ההשקעה | `אופק` allein trägt im Hebräischen keine Finanzbedeutung | |
| purchaseCostWithFees | Purchase cost (with fees) | עלות הרכישה (כולל עמלות) | | |
| furnishing | Furnishing | ריהוט | | |
| totalEntryCost | Total entry cost | עלות כניסה כוללת | wortgleich mit der Ergebnis-Mail | |
| offPlanGain | Off-plan value growth | עליית ערך בשלב הבנייה | | |
| valueAtCompletion | Estimated value at completion | שווי משוער במסירה | | |
| rentalCashFlow | Rental cash flow | תזרים משכירות | | |
| valueInFinalYear | Estimated value in final year | שווי משוער בשנה האחרונה | | |
| capitalGain | Capital gain | רווח הון | | |
| sellingCosts | Selling costs | עלויות מכירה | wortgleich mit `RoiInputs` | |
| annualized | Average annual ROI | תשואה שנתית ממוצעת | wortgleich mit der Ergebnis-Mail | |
| disclaimer | Important: values are indicative and may vary depending on the property, developer and market conditions. | חשוב לדעת: הנתונים משוערים ועשויים להשתנות בהתאם לנכס, ליזם ולתנאי השוק. | Doppelpunkt im Satz, keine Überschrift (§3 gilt nur für Titel) | |
| yearsText | years | שנים | | |

---

## 11. `src/app/components/ModalBrochure/` — Broschüren-Modal

| Key | EN | HE | Anmerkung | Korrektur HE |
|---|---|---|---|---|
| `aria-label` des Close-Buttons (`ModalBrochure.tsx`) | Close | סגירה | nominal, genusfrei. Nur mit Screenreader hörbar | |
| `title` (`ModalBrochure.copy.ts`) | Speak to an | לדבר עם | Infinitiv statt Imperativ — ein Imperativ erzwänge ein Genus (§2) | |
| `accent` | adviser | יועץ | das **gold gesetzte letzte Wort** der Überschrift (§11.3); die Aufteilung `לדבר עם` + `יועץ` hält diese Position | |
| `lead` | Leave your details and we will get back to you, usually the same day. | אפשר להשאיר פרטים ונחזור אליכם, בדרך כלל עוד באותו יום. | unpersönliches `אפשר ל…` (§11.2); der Gedankenstrich der LTR-Sätze entfällt (§3) | |

**Fix-Runde 1 (Pass B M15):** Die Tabelle war ein `Record<string, …>` **ohne** `he`-Zeile
und ohne Marker, sodass `COPY[lang] ?? COPY.en` der hebräischen Seite eine englische
Überschrift und einen englischen Leadsatz servierte — übersetzt war nur das `aria-label`.
Sie liegt jetzt als `Record<Locale, …>` im Geschwistermodul `ModalBrochure.copy.ts`
(Repo-Muster, in `copy-modules.json` registriert); die LTR-Werte sind wortgleich
übernommen. `ART` hat weiterhin **keinen** `he`-Eintrag: die he-Variante zeigt das
englische Berater-Artwork, was inhaltlich sogar stimmt (der Berater spricht Englisch),
aber hier protokolliert gehört.

---

## 12. `src/lib/crm/emailBodyHtml.ts` + `getSignatureHtml` — der dritte Mail-Pfad

**In der Abgabe nicht erfasst (Pass B M1).** Die Tabelle „E-Mails" oben listet **vier**
Kunden-Mails; der RTL-Umbau war nur für die zwei Standalone-Templates (Abschnitte 7 und
8) dokumentiert. Die anderen zwei — Präsentations-Mail (`renderLeadEmail.ts`) und
Terminbestätigung (`bookingActions.ts`) — laufen über `bodyToHtml()`, und **zusätzlich**
läuft dort jede vom Modell verfasste CRM-Antwort durch (`sendLeadEmail.ts`) sowie die
Operator-Vorschau (`mcp/drafts/previewEmail.ts`). Dieser Helfer hatte **gar kein** `dir`:
alles ging als `<div style="…white-space:pre-wrap;">` raus und renderte in Gmail
linksbündig LTR, mit Satzzeichen am falschen Zeilenende.

| Datei | Änderung | LTR |
|---|---|---|
| `emailBodyHtml.ts` | `bodyToHtml(body, locale?)`; für `he` `<div dir="rtl" … text-align:right;>`. `SIGNATURE_SPACER` unverändert | ohne `locale` **und** mit en/de/pl/ru byte-identisch (Test) |
| `renderLeadEmail.ts` | reicht `locale` durch (3. Parameter, optional) | unverändert |
| `sendLeadEmail.ts` · `bookingActions.ts` · `previewEmail.ts`/`createDraft.ts` | übergeben die bereits vorhandene Lead-Locale | unverändert |

Kein Text, nur Textrichtung. Der Satz „E-Mail-RTL erledigt" aus dem Abgabestand war
ohne diesen Abschnitt nicht haltbar.

**Ebenfalls zu protokollieren:** `getSignatureHtml(userId, "he")` fällt auf die
EN-Signatur zurück, solange der Operator keine hebräische Signatur gespeichert hat. Das
ist kein Fehler dieses WPs, aber es ist der Grund, warum unter einer hebräischen Mail
eine englische Signatur stehen kann.

---

## Bewusst englisch belassen

| Stelle | Warum | Marker |
|---|---|---|
| `ProjectPdfButton.copy.ts` → `he` | Das PDF wird für `he` **im UI nicht angeboten** (Spec Phase 1–4): das react-pdf-Dokument hat keine hebräische Schrift und kein RTL. Der Button wird auf `/he/projects/<slug>` nicht mehr gerendert (`page.tsx:322`), der Eintrag bleibt nur, damit die `Record<Locale, …>`-Typisierung hält. **Erledigt in Fix-Runde 2 (Pass B S23):** die Route `/api/projects/he/<slug>/pdf` gibt jetzt am Handler-Anfang `404` zurück (`route.tsx`, vor dem Sanity-Query) — vorher war sie erreichbar und rendert mit DejaVuSans ohne hebräische Glyphen (Tofu). Die Aussage „wird für `he` nicht angeboten" gilt damit für UI **und** Route | keiner — der Zähler soll ehrlich bleiben |
| `pdf/ProjectPdfDocument.copy.ts` → `he` | dieselbe Entscheidung; das Dokument kann für `he` gar nicht erzeugt werden | keiner |
| `getInternalEmailHtml` (ROI-Route) | interne Benachrichtigung an das Büro — Projektkonvention: admin-/internes Deutsch/Englisch bleibt Englisch | keiner |
| ROI-Mail-Labels für de/pl/ru | Planvorgabe „LTR-Strings identisch": sie standen bisher englisch da und bleiben es, bis jemand anders entscheidet | keiner |
| `strategyBuySell`/`strategyBuyHold` für en/de/pl/ru | unverändert „Buy & Sell"/„Buy & Hold" wie bisher | keiner |
| `preview-legal/[lang]/[doc]/registry.ts` | Rechtstexte gehen in Phase 5b | 2 × `TODO(he)` bleiben stehen |

---

## Offene Fragen an das Lektorat

> **Stand nach Fix-Runde 1:** Pass B hat 1, 3, 4, 5 und 6 beantwortet, 2 als echten
> Code-Fehler eingestuft. Die Antworten stehen unter der jeweiligen Frage; offen bleibt
> allein die WP4-Frage zu `מחיר התחלתי` als Karten-Bildunterschrift.

1. **`priceFrom` = `מחיר התחלתי`.** Der String steht an zwei Stellen: auf der Objektkarte
   („ab €450,000") und im Budget-Chip des Hero („Budget ab €300,000"). Das Glossar-`החל מ-`
   scheidet aus, weil die Komponenten ein Leerzeichen zwischen Label und Betrag setzen
   (`${label} €450,000`) und der Bindestrich am Betrag kleben müsste. Ist `מחיר התחלתי` in
   **beiden** Kontexten in Ordnung, oder braucht der Budget-Chip ein eigenes Wort? (Dann
   bräuchte es einen zweiten Key — bitte in der Anmerkungsspalte vermerken.)

   **Beantwortet (Pass B M14, umgesetzt):** Nein. Karte ja, Budget-Chip nein. Der Chip
   zeigt die Budget-Untergrenze des Kunden, keinen Objektpreis, und `מחיר התחלתי` liest
   sich im Israelischen zuerst als „Eröffnungspreis einer Ausschreibung". Neuer Key
   `budgetFrom` = `מעל`, symmetrisch zum vorhandenen `budgetUpTo` = `עד`.
   **Weiterhin offen:** ob `מחיר התחלתי` als *Karten*-Bildunterschrift bleibt — das ist
   WP4s offene Frage 5 und blockiert WP2, WP4 und WP7 gemeinsam.

2. **Zypern-Uhrzeit auf der Booking-Seite.** `SlotPicker.tsx` rendert
   `{Uhrzeit} ({שעון קפריסין})`, wobei die Uhrzeit dort **ohne** Locale formatiert wird und
   deshalb in jeder Sprache englisch erscheint („Mon, 28 Jul, 11:00"). Auf der hebräischen
   Seite steht damit ein englischer Datumsblock neben hebräischem Text. Das ist ein
   bestehender Rendering-Punkt, kein Übersetzungsfehler — bitte nur bestätigen, ob es so
   akzeptabel ist; die Änderung wäre eine Code-Korrektur außerhalb von WP7.

   **Falsch eingeordnet (Pass B M19, korrigiert).** Es war ein fehlendes drittes Argument
   in `SlotPicker.tsx:103` — in einer Komponente, deren komplette `he`-Copy WP7 liefert,
   direkt neben Zeile 43, die dasselbe Argument korrekt übergibt. Gefixt, und zwar
   ausschließlich für `he`: die LTR-Sprachen behalten die bisherige `en-GB`-Ausgabe,
   damit sich für sie nichts ändert.

3. **`Buy & Sell` / `Buy & Hold`.** In der Ergebnis-Mail bekommt `he` als einzige Sprache
   eine Übersetzung (`רכישה ומכירה` / `רכישה והחזקה`). Israelische Investoren kennen die
   englischen Begriffe. Übersetzen oder lateinisch stehen lassen?

   **Beantwortet (Pass B):** Hebräisch behalten. Ein zweiwortiger lateinischer Einschub
   in einer RTL-Tabellenzelle ist Bidi-Risiko ohne Nutzen; `רכישה ומכירה` /
   `רכישה והחזקה` sind eindeutig. Keine Änderung.

4. **`bedroomLabels["1"]` = `חדר שינה אחד`** neben `2 חדרי שינה`, `3 חדרי שינה` …
   Zahlwort in einer sonst zifferngetragenen Chip-Reihe — gewollt oder soll es
   `1 חדר שינה` heißen?

   **Beantwortet (Pass B S3, umgesetzt):** Ziffer — hier ist es eine Filter-Chipleiste.
   `heBedrooms()` in `heFeedVocab.ts` bleibt bewusst bei `חדר שינה אחד`; dort steht die
   Zahl in einer Freitext-Zusammenfassung, nicht in einer Chip-Reihe. Bewusste Abweichung,
   hier protokolliert.

5. **`advisorTitle` (`היועץ האישי שלכם`) vs. Signatur-Rollenzeile
   (`יועץ הנדל"ן האישי שלכם`).** Bewusst unterschiedlich, weil die Signaturzeile ohne
   Bildkontext steht. Soll das vereinheitlicht werden?

   **Beantwortet (Pass B, teils umgesetzt):** Unterschiedlich lassen ist richtig. Nach
   S13 lauten sie `היועץ האישי שלכם` (unter dem Foto) und `יועץ הנדל"ן האישי שלכם`
   (Signatur) — sichtbar verwandt, nicht identisch, kein §11.6-Verstoß, weil es nicht
   derselbe String ist. Das nachgestellte `לנדל"ן` hing hinter dem Possessiv und ist
   nach vorn gezogen.

6. **Sprachhinweis (Entscheidung E).** Er steht ausschließlich im Erstkontakt-Satz
   (`FIRST_CONTACT_INTRO`). Auto-Reply, Präsentations- und Terminmail tragen ihn **nicht** —
   Annahme: einmal sagen reicht, Wiederholung wirkt abweisend. Bitte bestätigen.

   **Nicht bestätigt (Pass B M3/M4/M5, umgesetzt).** „Einmal sagen reicht" gilt für
   aufeinanderfolgende Nachrichten **desselben Kanals**, nicht für vier voneinander
   unabhängige automatisierte Flächen. Der Hinweis fehlte genau dort, wo der Lead ihn
   zuerst bräuchte: der Auto-Reply ist die *erste* Mail an einen neuen he-Lead und geht
   raus, bevor `FIRST_CONTACT_INTRO` je gerendert wird; die Booking-Seite terminiert bei
   `meetingType = PHONE` einen Telefontermin; die Präsentationsseite bietet einen
   `להתקשר`-Button. Der Satz steht jetzt zusätzlich im Auto-Reply (`languageNote`), in
   der ROI-Ergebnismail, in `book/[token]`s `intro` und in `c/[token]`s `closingTrust` —
   alle vier aus **einer** exportierten Konstante `HE_LANGUAGE_NOTE` (`src/lib/locale.ts`),
   damit der Wortlaut nach §11.6 gar nicht auseinanderlaufen kann.

---

## Gates zum Zeitpunkt der Abgabe

| Gate | Ergebnis (Abgabe) | Ergebnis (Fix-Runde 1) |
|---|---|---|
| `npx tsc --noEmit -p tsconfig.json` | sauber | sauber |
| `npm test` | 125/125 grün | 164/164 grün (149 Bestand + 15 neu) |
| `node --import tsx scripts/qa/copy-snapshot.mjs --check` | keine Abweichung in einer WP7-Datei | sauber, nachdem die drei geänderten Module mit `--write --only` neu eingetragen wurden |
| ROI-Route und `emailTemplates.ts` (nicht in `copy-modules.json`) | 192/192 bzw. 18/18 Renderings byte-identisch mit HEAD | Auto-Reply zusätzlich als Test festgenagelt (`emailTemplatesRtl.test.ts` gegen `fixtures/autoreply-en.html`) |
| `node --import tsx scripts/qa/he-meta-length.mjs` | keine neue Verletzung | keine neue Verletzung (weiterhin nur `preview-partners`, Entscheidung J) |
| `node scripts/qa/he-placeholders.mjs` | `TODO(he): 2` · `REVIEW(he): 110` | `TODO(he): 2` (unverändert) · `REVIEW(he): 111` (+1: `ModalBrochure.copy.ts`) |

---

## Fix-Runde 1 — was aus Pass B umgesetzt wurde

**19 Must fix:** alle umgesetzt.
**24 Should fix:** 22 umgesetzt, 2 bewusst nicht (siehe unten).
**Playbook:** alle 6 Korrekturen plus die fehlende Zeile zum Genus des Beraters.

| Nicht umgesetzt | Warum |
|---|---|
| **S17** — Amenity-Chips (`Swimming pool`, `Gym`, …) stehen auf der hebräischen Präsentationsseite weiter englisch | Die Korrektur verlangt einen Amenity-Block in `src/lib/heFeedVocab.ts` (Glossar §2). Diese Datei gehört WP2 und lag außerhalb der für diese Runde freigegebenen Dateien. Eine zweite Label-Tabelle unter `c/[token]/` anzulegen wäre genau der Fehler, den Pass B unter „Systemic S-A" beschreibt: `heFeedVocab.ts` ist der **eine** Ort für Feed-Vokabular. ~~Bleibt offen.~~ **Erledigt in Fix-Runde 2.** |
| **S23** — `/api/projects/he/<slug>/pdf` ist ohne `he`-Guard weiter erreichbar und rendert Tofu | `src/app/api/projects/[lang]/[slug]/pdf/route.tsx` lag außerhalb der freigegebenen Dateien. Der Button ist für `he` bereits ausgeblendet, die Route selbst nicht. ~~Bleibt offen~~ **Erledigt in Fix-Runde 2.** |

**Bewusste Abweichungen, die protokolliert gehören:**

- `bedroomLabels["1"]` = `1 חדר שינה` (Chipleiste) **≠** `heBedrooms(1)` = `חדר שינה אחד`
  (Freitext-Zusammenfassung in `heFeedVocab.ts`). Unterschiedlicher Kontext, kein
  §11.6-Verstoß — `heFeedVocab.ts` wurde bewusst nicht angefasst (Pass B S3).
- `statusLabel.unlisted` = `לא זמינה עוד` **≠** `heFeedLabel("unlisted")` = `לא בתצוגה`.
  Die Präsentationsseite meint „diese Einheit gibt es nicht mehr" (vom Sync abgeleitet,
  wenn eine Einheit aus dem Feed verschwindet), der Feed-Begriff meint „nicht in der
  Anzeige". Deshalb rendert das Overlay **Typ** und **Betten** über `heFeedLabel()` /
  `heBedrooms()`, den **Status** aber weiter über die Copy-Tabelle — deren `he`-Werte
  jetzt feminin sind und damit mit `heFeedVocab.ts` übereinstimmen, wo es dieselbe Sache
  benennt (Pass B M12/M13).
- Der Sprachhinweis aus Entscheidung E liegt jetzt als `HE_LANGUAGE_NOTE` in
  `src/lib/locale.ts` und wird von allen vier automatisierten Flächen importiert
  (Pass B Systemic S-C). Ein Test prüft, dass er en/de/pl/ru **nicht** erreicht.
- Die Datums-Präposition ist ein Helfer `hePrefixDate(prefix, formatted)` in
  `src/lib/locale.ts`: `ב`/`ל` klebt am hebräischen Intl-Datum (`ביום ד׳`), bekommt vor
  einer Ziffer den Bindestrich und wird dort LRI-isoliert (Pass B M6/M7, §3).
- `metaTitle`/`metaDescription` sind neue Keys **in beiden Copy-Tabellen** statt inline
  in den Seiten. `generateMetadata()` liest dafür je einen zusätzlichen
  `select`-Einzeiler (Locale, sonst nichts) — die Regel „kein Token-Inhalt in den
  Metadaten" bleibt unangetastet (Pass B S21).

---

## Fix-Runde 2 — die zwei aus Fix-Runde 1 übrig gebliebenen Zeilen

Beide Zeilen waren nicht inhaltlich strittig, sondern lagen in Dateien, die für
Fix-Runde 1 nicht freigegeben waren. Sie sind jetzt umgesetzt.

### S23 — die PDF-Route ist für `he` geschlossen

`src/app/api/projects/[lang]/[slug]/pdf/route.tsx`, direkt nach `await params` und
**vor** dem Sanity-Query:

```ts
// Spec (Hebrew Phases 1-4): the project PDF is not offered for `he`. …
if (lang === "he") {
  return new Response("Not found", { status: 404 });
}
```

Bewusst ein kleiner expliziter Vergleich und keine Locale-Liste: `he` ist der einzige
Locale ohne PDF, und eine Liste würde vortäuschen, dass die Regel konfigurierbar wäre.
Am Rendering wurde nichts geändert; die vier LTR-Locales laufen durch denselben Pfad wie
vorher.

### S17 — Amenity-Chips auf `/c/[token]`

Die Chips im Objekt-Overlay (`PropertyOverlay.tsx`) rendern je einen rohen Feed-String.
Nach Pass B **Systemic S-A** entsteht dafür *keine* zweite Label-Tabelle unter
`c/[token]/`: die Begriffe stehen im Amenity-Block der **einen** Tabelle
`HE_FEED_VOCAB` in `src/lib/heFeedVocab.ts`, und das Overlay ruft für `he`
`heFeedLabel(a)` auf — genau wie schon für Typ (`heFeedLabel`) und Betten
(`heBedrooms`). Zwei Eigenschaften bleiben dabei erhalten:

- **`iconFor(a)` sieht weiter den rohen englischen Wert.** Die Icon-Zuordnung ist
  regex-getrieben (`/pool|swim/`, `/gym|fitness/`, …) und würde an hebräischem Text
  scheitern. Übersetzt wird ausschließlich das sichtbare Label.
- **LTR ist byte-identisch.** Der Aufruf steht hinter `isHe ? … : a`; en/de/pl/ru
  rendern denselben String wie vorher.

Unbekannte Amenities fallen wie überall in `heFeedLabel()` auf den **bidi-isolierten
Rohwert** zurück — nie auf eine geratene Übersetzung.

#### Protokoll der neu aufgenommenen Amenity-Begriffe

Schlüssel sind normalisiert (`norm()`: lowercase, `[\s_-]+` → ein Leerzeichen), deshalb
deckt ein Eintrag alle Schreibweisen mit Bindestrich, Unterstrich und Groß-/Kleinschreibung
ab; Pluralformen und Synonyme bekommen jeweils einen eigenen Schlüssel. Herkunft: **G** =
`he-glossary.md` §2 wörtlich, **S** = israelischer Standardbegriff aus Anzeigen (nicht im
Glossar, für Pass C zu prüfen).

| Key `amenity:<raw>` | EN | HE | Anmerkung | Korrektur HE |
|---|---|---|---|---|
| `amenity:pool` / `pools` | pool / pools | בריכת שחייה / בריכות שחייה | S — Glossar kennt nur die private/gemeinsame Variante; der generische Chip braucht einen neutralen Begriff | |
| `amenity:swimming pool` / `swimming pools` | swimming pool(s) | בריכת שחייה / בריכות שחייה | S | |
| `amenity:private pool` / `private swimming pool` | private (swimming) pool | בריכה פרטית | **G** | |
| `amenity:communal pool` / `communal swimming pool` / `shared pool` | communal / shared pool | בריכה משותפת | **G** | |
| `amenity:infinity pool` / `overflow pool` | infinity / overflow pool | בריכת אינסוף | S | |
| `amenity:childrens pool` / `kids pool` | children's pool | בריכת ילדים | S | |
| `amenity:heated pool` | heated pool | בריכה מחוממת | S | |
| `amenity:garden` / `gardens` | garden(s) | גינה / גינות | **G** | |
| `amenity:private garden` | private garden | גינה פרטית | **G** + פרטית | |
| `amenity:landscaped garden(s)` / `landscaping` | landscaped garden / landscaping | גינון מעוצב | S — `גינון` ist die Anlage, `מעוצב` das „landscaped" | |
| `amenity:communal gardens` | communal gardens | גינות משותפות | S, parallel zu `בריכה משותפת` | |
| `amenity:roof garden` / `roof terrace` | roof garden / roof terrace | מרפסת גג | **G** (`גג / מרפסת גג` — hier die eindeutige Langform) | |
| `amenity:roof` | roof | גג | **G** | |
| `amenity:terrace` / `terraces` | terrace(s) | מרפסת / מרפסות | **G** (terrace/balcony fallen im Hebräischen zusammen) | |
| `amenity:balcony` / `balconies` | balcony / balconies | מרפסת / מרפסות | **G** — dieselbe Zeile; im Hebräischen korrekt, kein Fehler | |
| `amenity:veranda(s)` / `covered veranda` | veranda | מרפסת מקורה | S — die zyprische „covered veranda" ist die überdachte Terrasse | |
| `amenity:patio` | patio | פטיו | S, Lehnwort, in israelischen Anzeigen üblich | |
| `amenity:pergola` | pergola | פרגולה | S, Lehnwort | |
| `amenity:bbq` / `bbq area` / `barbecue` / `barbecue area` | BBQ (area) | אזור מנגל | S — `מנגל` ist der israelische Alltagsbegriff, `ברביקיו` klingt nach Katalog | |
| `amenity:outdoor kitchen` | outdoor kitchen | מטבח חוץ | S | |
| `amenity:parking` / `parking space` | parking | חניה | **G** | |
| `amenity:covered parking` | covered parking | חניה מקורה | **G** (`חניה (מקורה)` — ohne Klammern, die Klammer war Notation) | |
| `amenity:underground parking` | underground parking | חניה תת-קרקעית | S | |
| `amenity:private parking` | private parking | חניה פרטית | S | |
| `amenity:storage` / `storage room` | storage (room) | מחסן | **G** | |
| `amenity:ev charger` / `ev charging` / `ev charging point` | EV charger | עמדת טעינה לרכב חשמלי | S — ausgeschrieben; `עמדת טעינה` allein ist auch das Handy-Ladepult | |
| `amenity:sea view` / `sea views` | sea view(s) | נוף לים | **G** | |
| `amenity:panoramic sea view` | panoramic sea view | נוף פנורמי לים | **G** + פנורמי | |
| `amenity:panoramic view` | panoramic view | נוף פנורמי | S | |
| `amenity:mountain view(s)` | mountain view(s) | נוף להרים | S, parallel gebaut zu `נוף לים` | |
| `amenity:unobstructed view(s)` / `open view` | unobstructed / open view | נוף פתוח | S — `נוף פתוח` ist der Anzeigenbegriff; ein wörtliches „unverbaut" gibt es als Chip nicht | |
| `amenity:beachfront` / `first line` | beachfront / first line | קו ראשון לים | **G** | |
| `amenity:beach access` | beach access | גישה לחוף | S | |
| `amenity:walking distance to (the) beach` | walking distance to the beach | במרחק הליכה מהחוף | **G** | |
| `amenity:gym` / `fitness` / `fitness centre` / `fitness center` / `fitness room` | gym / fitness | חדר כושר | **G** | |
| `amenity:spa` | spa | ספא | S, Lehnwort | |
| `amenity:sauna` | sauna | סאונה | S, Lehnwort | |
| `amenity:steam room` | steam room | חדר אדים | S | |
| `amenity:jacuzzi` / `hot tub` | jacuzzi / hot tub | ג'קוזי | S — mit Geresh, wie im Hebräischen für /dʒ/ üblich | |
| `amenity:playground` / `childrens playground` | playground | גן משחקים | S | |
| `amenity:tennis court(s)` | tennis court(s) | מגרש טניס / מגרשי טניס | S (Smichut-Plural) | |
| `amenity:golf` / `golf course` | golf (course) | מגרש גולף | S | |
| `amenity:golf resort` | golf resort | ריזורט גולף | **G** (`ריזורט`) + גולף | |
| `amenity:resort` | resort | ריזורט | **G** | |
| `amenity:lounge area` | lounge area | פינת ישיבה | S | |
| `amenity:sunbeds` | sunbeds | מיטות שיזוף | S | |
| `amenity:restaurant` | restaurant | מסעדה | S | |
| `amenity:lift(s)` / `elevator(s)` | lift / elevator | מעלית / מעליות | S — im Hebräischen gibt es nur ein Wort für beide | |
| `amenity:concierge` | concierge | קונסיירז' | **G** | |
| `amenity:concierge service` | concierge service | שירות קונסיירז' | **G** + שירות | |
| `amenity:reception` | reception | קבלה | S | |
| `amenity:lobby` | lobby | לובי | S, Lehnwort | |
| `amenity:communal areas` | communal areas | שטחים משותפים | S | |
| `amenity:management company` | management company | חברת ניהול | **G** | |
| `amenity:gated` / `gated community` | gated (community) | קהילה מגודרת | **G** | |
| `amenity:gated complex` | gated complex | פרויקט מגודר | **G** (zweite Glossarform, für das Bauprojekt statt der Nachbarschaft) | |
| `amenity:security` | security | אבטחה | S | |
| `amenity:24/7 security` / `24 7 security` | 24/7 security | אבטחה ⁦24/7⁩ | S — die Ziffernfolge steht im LRI-Isolat, damit `24/7` im RTL-Absatz nicht kippt (dieselbe Technik wie in `heBedrooms()`) | |
| `amenity:cctv` / `video surveillance` | CCTV | מצלמות אבטחה | S — das Akronym wird in Israel nicht benutzt | |
| `amenity:alarm` / `alarm system` | alarm (system) | מערכת אזעקה | S | |
| `amenity:intercom` | intercom | אינטרקום | S, Lehnwort | |
| `amenity:video intercom` | video intercom | אינטרקום עם וידאו | S | |
| `amenity:smart home` / `home automation` | smart home / home automation | בית חכם | **G** | |
| `amenity:smart home system` | smart home system | מערכת בית חכם | **G** + מערכת | |
| `amenity:air conditioning` / `a/c` / `ac` / `vrv` / `vrf` | air conditioning, A/C, VRV, VRF | מיזוג אוויר | **G** — die Feeds liefern alle vier Schreibweisen für dieselbe Sache | |
| `amenity:climate control` | climate control | בקרת אקלים | S | |
| `amenity:provision for air conditioning` | provision for A/C | הכנה למיזוג אוויר | S — `הכנה ל…` ist der Anzeigenbegriff für „vorbereitet, nicht installiert" | |
| `amenity:underfloor heating` | underfloor heating | חימום תת-רצפתי | **G** (Glossar §2; **nicht** `הסקה תת-רצפתית`) | |
| `amenity:central heating` | central heating | חימום מרכזי | S | |
| `amenity:solar panels` / `photovoltaic` | solar panels / PV | פאנלים סולאריים | S | |
| `amenity:solar water heating` | solar water heating | דוד שמש | S — in Israel der feststehende Begriff für die Solar-Warmwasseranlage | |
| `amenity:double glazing` | double glazing | זיגוג כפול | S | |
| `amenity:double glazed windows` | double glazed windows | חלונות בזיגוג כפול | S | |
| `amenity:pressurised water` / `pressurized water` / `pressurised water system` | pressurised water (system) | מערכת מים בלחץ | S — beide englischen Schreibweisen kommen aus den zyprischen Feeds | |
| `amenity:fireplace` | fireplace | קמין | S | |
| `amenity:furnished` | furnished | מרוהט | **G** | |
| `amenity:fully furnished` | fully furnished | מרוהט במלואו | **G** + במלואו | |
| `amenity:unfurnished` | unfurnished | לא מרוהט | S | |
| `amenity:fitted kitchen` | fitted kitchen | מטבח מאובזר | S | |
| `amenity:fitted wardrobes` / `wardrobes` | fitted wardrobes | ארונות קיר | S | |
| `amenity:walk in wardrobe` / `walk in closet` | walk-in wardrobe/closet | חדר ארונות | S — das begehbare Ankleidezimmer, gegenüber `ארונות קיר` abgegrenzt | |
| `amenity:en suite` / `ensuite` / `en suite bathroom` | en-suite (bathroom) | חדר רחצה צמוד | **G** (§2, „en suite": `חדר רחצה צמוד`) | |
| `amenity:guest wc` / `guest toilet` | guest WC | שירותי אורחים | S | |
| `amenity:utility room` | utility room | חדר שירות | S | |
| `amenity:laundry room` | laundry room | חדר כביסה | S | |
| `amenity:corner plot` | corner plot | מגרש פינתי | **G** (`מגרש`) + פינתי | |

**Für Pass C:** die mit **S** markierten Zeilen sind neu und stehen nicht im Glossar —
sie sind der eigentliche Prüfauftrag dieser Tabelle. Die mit **G** markierten Zeilen
übernehmen den Glossarwortlaut unverändert und sollten nur dann geändert werden, wenn
gleichzeitig `he-glossary.md` §2 geändert wird.

### Tests

`src/lib/__tests__/heFeedVocab.test.ts` bekommt fünf Tests: 14 Amenity-Zuordnungen ·
Varianten-Schreibweisen (`SWIMMING POOL`, `roof-garden`, `smart_home`, `En-suite`,
`Walk-in wardrobe`, `A/C`, `Pressurized`/`Pressurised`) · zwei unbekannte Werte
(`Padel court`, `Helipad`) fallen bidi-isoliert zurück · `24/7` bleibt LTR-isoliert ·
kein einziger Wert der Tabelle enthält `–` oder `—`.

Für S23 gibt es bewusst **keinen** Test: die Datei ist ein Next.js-Route-Handler und
importiert `@react-pdf/renderer` auf Modulebene; sie in einem Unit-Test zu laden hieße,
PDF-Code auszuführen. Der Guard steht drei Zeilen vor dem ersten Datenzugriff und ist im
Diff nachprüfbar.

### Gates Fix-Runde 2

| Gate | Ergebnis |
|---|---|
| `npx tsc --noEmit -p tsconfig.json` | sauber |
| `npm test` | 169/169 grün (164 Bestand + 5 neu) |
| `node --import tsx scripts/qa/copy-snapshot.mjs --check` | sauber, 3197 Leaves — keine Copy-Tabelle angefasst |
| `node scripts/qa/he-placeholders.mjs` | `TODO(he): 2` · `REVIEW(he): 111` — unverändert |
