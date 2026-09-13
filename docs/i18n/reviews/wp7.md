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
| intro | Thank you for your trust. I have personally selected these properties for you - each of them matches your wishes and deserves your attention. | תודה על האמון. בחרתי עבורכם את הנכסים האלה באופן אישי. כל אחד מהם מתאים למה שביקשתם וראוי לתשומת לבכם. | EN-Bindestrich → eigener Satz (§3). `בחרתי` = 1. Sg. Vergangenheit, genusfrei (§11.2) | |
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
| bedroomLabels.1 | 1 bedroom | חדר שינה אחד | Zahlwort statt Ziffer, weil „1 חדר שינה" unnatürlich klingt. Wenn der Chip-Block einheitlich Ziffern tragen soll, bitte korrigieren | |
| bedroomLabels.2–5 | 2/3/4/5+ bedrooms | 2 / 3 / 4 / 5+ חדרי שינה | Glossar §2: nie `חדרים` | |
| viewDetails | View details | לפרטים נוספים | Karten-CTA | |
| availableUnits | Available units | יחידות זמינות | | |
| unitsTable.unit | Unit | יחידה | | |
| unitsTable.type | Type | סוג | | |
| unitsTable.beds | Beds | חדרי שינה | teilt sich eine Spalte mit `שטח` | |
| unitsTable.area | Area | שטח | | |
| unitsTable.price | Price | מחיר | | |
| unitsTable.status | Status | סטטוס | | |
| statusLabel.available | Available | זמין | Glossar §2 | |
| statusLabel.reserved | Reserved | שמור | Glossar §2 | |
| statusLabel.sold | Sold | נמכר | Glossar §2 | |
| statusLabel.unlisted | No longer available | לא זמין עוד | Einheit aus dem Feed verschwunden | |
| advisorTitle | Your personal advisor | היועץ האישי שלכם | maskulin wie im Glossar-CTA | |
| unitsPlural.one / .many | unit / units | יחידה / יחידות | „5 יחידות" | |
| newForYou | New for you | חדש עבורכם | Badge | |
| vatLabel | +VAT | בתוספת מע"מ | siehe JSX-Kasten | |
| soldOut | Sold out | נמכר | Glossar §2: Badge kurz | |
| lifeNearby | LIFE NEARBY | החיים בסביבה | | |
| closingEyebrow | DIRECT CONTACT | קשר ישיר | | |
| closingTrust | I personally answer every message - usually within the hour. Ask me anything about the properties in your selection, arranging a viewing, or the details of buying in Cyprus. No obligation, no rush. | אני עונה לכל הודעה באופן אישי, בדרך כלל בתוך שעה. אפשר לשאול אותי כל דבר על הנכסים שבמבחר שלכם, על תיאום ביקור ועל פרטי הרכישה בקפריסין. בלי התחייבות ובלי לחץ. | `עונה` ist unvokalisiert für beide Genera identisch. „arranging a viewing" ohne `בנכס`, um die Wurzel `נכס` nicht zu wiederholen (§11.5) | |
| whatsapp | WhatsApp | וואטסאפ | Glossar §4 | |
| call | Call | להתקשר | Button neben וואטסאפ / אימייל | |
| email | Email | אימייל | Glossar §4 | |
| whatsappMessage | Hello, I viewed my personal selection and would like to talk about | שלום, צפיתי במבחר האישי שלי ואשמח לדבר על | **Der Besucher spricht.** Bewusst unvollständig — WhatsApp öffnet damit den Eingabecursor. `צפיתי`/`אשמח` sind 1. Sg. und genusfrei | |
| notAvailableTitle | This page is no longer available | הדף הזה כבר לא זמין | | |
| notAvailableBody | The link you used has expired or is no longer active. Please get in touch and we will be glad to help. | תוקף הקישור פג או שהוא כבר אינו פעיל. אפשר לפנות אלינו ונשמח לעזור. | zweites `קישור` durch `הוא` ersetzt (§11.5) | |
| contactUs | Contact us | ליצירת קשר | wortgleich mit Booking-Seite, `TeamBlockComponent`, `preview-about` | |
| legal | This selection is provided for informational purposes and does not constitute an offer. | המבחר הזה נועד למידע בלבד ואינו מהווה הצעה. | keine Zusatzbehauptung („verbindlich") ergänzt | |
| privacyPolicy | Privacy policy | מדיניות פרטיות | Glossar §4 | |
| priceFrom | from | מחיר התחלתי | siehe JSX-Kasten und Offene Frage 1 | |
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
| intro | Pick 2-3 times that work for you and I'll confirm one shortly. | אפשר לבחור 2-3 מועדים שמתאימים לכם, ואחזור אליכם עם אישור בקרוב. | `אחזור … עם אישור` statt `אאשר`, das unvokalisiert schwer lesbar ist | |
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
| goneTitle | This link is no longer available | הקישור הזה כבר לא זמין | Parallelbau zu `notAvailableTitle` | |
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
| ROLE_LINE | Your personal property advisor | היועץ האישי שלכם לנדל"ן | steht direkt unter „Sascha Dith"; `לנדל"ן` ergänzt, weil die Zeile sonst kontextlos ist. Vgl. `advisorTitle` der Präsentationsseite (`היועץ האישי שלכם`) — bewusst nicht identisch | |

---

## 7. `src/lib/emailTemplates.ts` — Auto-Reply auf eine Formularanfrage

| Key | EN | HE | Anmerkung | Korrektur HE |
|---|---|---|---|---|
| SAFE_NAME | Dear Client | שלום | Fallback, wenn kein Name mitkam; gerendert als `${name},` | |
| subject | Thank you for your enquiry — Cyprus VIP Estates | תודה על הפנייה \| Cyprus VIP Estates | 40 Zeichen | |
| title | Thank you for your enquiry | תודה על הפנייה | H1 der Mail | |
| intro1 | Thank you for contacting <strong>Cyprus VIP Estates</strong>. | תודה שיצרתם קשר עם <strong>Cyprus VIP Estates</strong>. | `יצרתם קשר` statt nochmals `פנייה` (steht schon im Titel) | |
| intro2 | We've received your enquiry and will get back to you shortly with personalised property options in Cyprus and answers to your questions. | קיבלנו את הפנייה שלכם ונחזור אליכם בקרוב עם הצעות נכסים מתאימות בקפריסין ועם תשובות לשאלות. | | |
| whatNextTitle | What happens next? | מה קורה עכשיו? | echte Frage, kein Doppelpunkt-Titel (§3) | |
| li1 | We will review your enquiry and your property preferences. | נעבור על הבקשה ועל העדפות הנכס שלכם. | `בקשה` statt `פנייה`, weil `פנייה` zwei Zeilen darüber steht | |
| li2 | One of our consultants will contact you via your preferred channel. | אחד היועצים שלנו ייצור אתכם קשר בדרך שנוחה לכם. | | |
| li3 | We will prepare tailored property offers directly from trusted developers in Cyprus. | נכין הצעות מותאמות אישית ישירות מיזמים אמינים בקפריסין. | „trusted" = `אמינים`; `מובילים` wäre eine andere Aussage | |
| speedUp | If you'd like to speed up the process, you can already explore our latest projects below. | כדי לזרז את התהליך, אפשר כבר עכשיו לעיין בפרויקטים העדכניים שלנו. | „below" ist im Hebräischen überflüssig, der Button steht direkt darunter | |
| ctaText | Browse properties in Cyprus | לצפייה בנכסים בקפריסין | | |
| followUs | Follow us: | עקבו אחרינו: | Imperativ Plural (§2.2) | |
| reason | You received this email because you submitted an enquiry on the Cyprus VIP Estates website. | קיבלתם את האימייל הזה כי השארתם פנייה באתר של Cyprus VIP Estates. | Fußzeile in 11 px | |
| link | …/projects | https://cyprusvipestates.com/he/projects | URL, nicht übersetzt | |

**RTL-Umbau (kein Text):** `dir="rtl"` auf `<html>` und `<body>`, die beiden
`align="left"`-Textzellen auf `right`, der Einzug der Aufzählung von `0 0 12px 20px`
auf `0 20px 12px 0` gespiegelt. Für en/de/pl/ru ist das gerenderte HTML byte-identisch
(18/18 Renderings geprüft).

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
| title | Your indicative ROI result | תוצאת התשואה המשוערת שלכם | H1 der Mail | |
| intro | Thank you for using the ROI Calculator on Cyprus VIP Estates. | תודה שהשתמשתם במחשבון התשואה של Cyprus VIP Estates. | | |
| summary | Below is a summary of your projected investment result. | לפניכם סיכום התוצאה הצפויה של ההשקעה. | | |
| cta | View property | לצפייה בנכס | Button | |
| footer | This calculation is indicative only. Final figures may vary depending on the property, transaction structure and market conditions. | החישוב הזה משוער בלבד. הנתונים הסופיים עשויים להשתנות בהתאם לנכס, למבנה העסקה ולתנאי השוק. | Fußzeile in 11 px | |

**RTL-Umbau (kein Text):** `dir="rtl"` auf `<html>`/`<body>`, die eine `align="left"`-Zelle
auf `right`, die Wertespalte der Ergebnistabelle von `text-align:right` auf `left`
gespiegelt. 192/192 Renderings für en/de/pl/ru (inkl. Junk-`lang`) sind byte-identisch.

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
| yAxis | Amount (EUR) | סכום (EUR) | Währungscode bleibt lateinisch | |
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

## 11. `src/app/components/ModalBrochure/ModalBrochure.tsx` — Schließen-Kreuz

| Key | EN | HE | Anmerkung | Korrektur HE |
|---|---|---|---|---|
| `aria-label` des Close-Buttons | Close | סגירה | nominal, genusfrei. Nur mit Screenreader hörbar | |

> **Hinweis an den Controller (nicht ans Lektorat):** Die Tabelle `COPY` in derselben
> Datei (`title`/`accent`/`lead` des Broschüren-Modals) ist noch ein `Record<string, …>`
> **ohne** `he`-Zeile und ohne Marker — sie wurde in Task 2 übersehen und fällt für `he`
> still auf Englisch zurück. Nicht Teil von WP7; sollte in einer Fix-Runde nachgezogen werden.

---

## Bewusst englisch belassen

| Stelle | Warum | Marker |
|---|---|---|
| `ProjectPdfButton.copy.ts` → `he` | Das PDF wird für `he` **nicht angeboten** (Spec Phase 1–4): das react-pdf-Dokument hat keine hebräische Schrift und kein RTL. Der Button wird auf `/he/projects/<slug>` nicht mehr gerendert (`page.tsx`), der Eintrag bleibt nur, damit die `Record<Locale, …>`-Typisierung hält | keiner — der Zähler soll ehrlich bleiben |
| `pdf/ProjectPdfDocument.copy.ts` → `he` | dieselbe Entscheidung; das Dokument kann für `he` gar nicht erzeugt werden | keiner |
| `getInternalEmailHtml` (ROI-Route) | interne Benachrichtigung an das Büro — Projektkonvention: admin-/internes Deutsch/Englisch bleibt Englisch | keiner |
| ROI-Mail-Labels für de/pl/ru | Planvorgabe „LTR-Strings identisch": sie standen bisher englisch da und bleiben es, bis jemand anders entscheidet | keiner |
| `strategyBuySell`/`strategyBuyHold` für en/de/pl/ru | unverändert „Buy & Sell"/„Buy & Hold" wie bisher | keiner |
| `preview-legal/[lang]/[doc]/registry.ts` | Rechtstexte gehen in Phase 5b | 2 × `TODO(he)` bleiben stehen |

---

## Offene Fragen an das Lektorat

1. **`priceFrom` = `מחיר התחלתי`.** Der String steht an zwei Stellen: auf der Objektkarte
   („ab €450,000") und im Budget-Chip des Hero („Budget ab €300,000"). Das Glossar-`החל מ-`
   scheidet aus, weil die Komponenten ein Leerzeichen zwischen Label und Betrag setzen
   (`${label} €450,000`) und der Bindestrich am Betrag kleben müsste. Ist `מחיר התחלתי` in
   **beiden** Kontexten in Ordnung, oder braucht der Budget-Chip ein eigenes Wort? (Dann
   bräuchte es einen zweiten Key — bitte in der Anmerkungsspalte vermerken.)

2. **Zypern-Uhrzeit auf der Booking-Seite.** `SlotPicker.tsx` rendert
   `{Uhrzeit} ({שעון קפריסין})`, wobei die Uhrzeit dort **ohne** Locale formatiert wird und
   deshalb in jeder Sprache englisch erscheint („Mon, 28 Jul, 11:00"). Auf der hebräischen
   Seite steht damit ein englischer Datumsblock neben hebräischem Text. Das ist ein
   bestehender Rendering-Punkt, kein Übersetzungsfehler — bitte nur bestätigen, ob es so
   akzeptabel ist; die Änderung wäre eine Code-Korrektur außerhalb von WP7.

3. **`Buy & Sell` / `Buy & Hold`.** In der Ergebnis-Mail bekommt `he` als einzige Sprache
   eine Übersetzung (`רכישה ומכירה` / `רכישה והחזקה`). Israelische Investoren kennen die
   englischen Begriffe. Übersetzen oder lateinisch stehen lassen?

4. **`bedroomLabels["1"]` = `חדר שינה אחד`** neben `2 חדרי שינה`, `3 חדרי שינה` …
   Zahlwort in einer sonst zifferngetragenen Chip-Reihe — gewollt oder soll es
   `1 חדר שינה` heißen?

5. **`advisorTitle` (`היועץ האישי שלכם`) vs. Signatur-Rollenzeile
   (`היועץ האישי שלכם לנדל"ן`).** Bewusst unterschiedlich, weil die Signaturzeile ohne
   Bildkontext steht. Soll das vereinheitlicht werden?

6. **Sprachhinweis (Entscheidung E).** Er steht ausschließlich im Erstkontakt-Satz
   (`FIRST_CONTACT_INTRO`). Auto-Reply, Präsentations- und Terminmail tragen ihn **nicht** —
   Annahme: einmal sagen reicht, Wiederholung wirkt abweisend. Bitte bestätigen.

---

## Gates zum Zeitpunkt der Abgabe

| Gate | Ergebnis |
|---|---|
| `npx tsc --noEmit -p tsconfig.json` | sauber |
| `npm test` | 125/125 grün |
| `node --import tsx scripts/qa/copy-snapshot.mjs --check` | keine Abweichung in einer WP7-Datei (die gemeldeten 4 Diffs liegen in `ProjectLink.copy.ts`, das ein paralleler Agent bearbeitet) |
| ROI-Route und `emailTemplates.ts` (nicht in `copy-modules.json`) | 192/192 bzw. 18/18 Renderings für en/de/pl/ru byte-identisch mit HEAD |
| `node --import tsx scripts/qa/he-meta-length.mjs` | keine neue Verletzung (die eine gemeldete liegt in `preview-partners`, Entscheidung J) |
| `node scripts/qa/he-placeholders.mjs` | `TODO(he): 2` (nur `registry.ts`, Phase 5b) · `REVIEW(he): 110` |
