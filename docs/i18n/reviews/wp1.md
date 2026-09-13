# Lektorat WP1 — Chrome, Formulare, Consent, Newsletter, Footer, Breadcrumbs, 404, WhatsApp

**Stand:** 2026-09-13 · **Pass A (Erstübersetzung) fertig, Pass B (Kritik) fertig, Fix Round 1 (Controller) angewendet** · Marker im Code: `REVIEW(he)`
**Umfang:** 22 Dateien, 28 `he`-Einträge, ~120 Einzelstrings. Pass B (`task-4-passB.md`) hat den Umfang
nachgezählt und bestätigt (22 Dateien, 28 `he`-Einträge korrekt; alle 21 `FormStatic`-Keys, 18
`QualificationForm`-Keys, 19 `qualifierFields`-Keys vollständig gelistet; die `href`-Abweichungen
auf `/he/privacy-policy` und die `agreementLinkLabel`-Abweichung sind sauber begründet).
**Quelle:** immer der englische Eintrag. Die deutschen Zeilen dienten nur als Tonreferenz.
**Fix Round 1 (2026-09-13):** alle 10 Must-fix- und alle 9 Should-fix-Zeilen aus Pass B angewendet;
Protokoll-Lücken 1–9 aus Pass B geschlossen (s. einzelne Zeilen unten und "Offene Fragen" am Ende).

---

## Wo diese Strings sichtbar sind

| Fläche | Seiten / Zustand |
|---|---|
| Cookie-Banner | jede `/he/*`-Seite beim ersten Besuch (Banner unten) |
| Header-CTA | `/he`, `/he/projects`, alle Landing- und Artikelseiten (Button rechts oben) |
| Breadcrumbs | `/he/projects/<slug>`, `/he/blog/<slug>`, Landingpages |
| Footer + Newsletter | Fuß jeder `/he`-Seite (Platzhalter, Erfolgs-/Fehlermeldung nach Absenden) |
| Formulare | `/he/contacts`, Projektseite (`QualificationForm`), Blog-Block (`FormMinimalBlock`), statische Formulare, Partner-Modal — Labels, Validierungsfehler, Consent-Zeile, Erfolgs-/Fehlermeldung |
| Consent-Zeile | unter jeder Formular-Checkbox; Links auf `/he/terms-and-conditions` und `/he/privacy-policy` |
| Qualifier-Felder | Budget-, Objekttyp- und Zeitrahmen-Dropdowns in `QualificationForm` |
| WhatsApp | schwebender Button auf allen Seiten + Projektseiten-Button; die vorbelegte Nachricht öffnet sich in WhatsApp |
| 404 | jede nicht existierende `/he/…`-URL (nur wenn das CMS-Dokument fehlt — sonst gewinnt der CMS-Text) |
| „Mehr in diesem Bereich" / „Das könnte Sie auch interessieren" | Landingpages mit Kind- bzw. kuratierten Links |

## Wie zu lektorieren ist

1. Die Kurzcheckliste `docs/i18n/he-styleguide.md` §10 Punkt für Punkt durchgehen:
   kein englischer Restsatz · Genus nach §2 (Nominal/Infinitiv, sonst männlicher Plural, keine
   Schrägstriche außer der einen Checkbox-Ausnahme) · Preise/Nummern nach §5, Bidi isoliert ·
   Ortsnamen nach Glossar, Eigennamen lateinisch · keine Zeile aus §7 · jede Zahl hat eine Quelle.
2. Länge mitdenken: Buttons ≤ 2–3 Wörter, Labels ungefähr so lang wie das Englische.
   Zu lange Buttons brechen im Header und im Cookie-Banner um.
3. **Korrekturen in eine vierte Spalte `Korrektur HE` eintragen** — die vorhandene HE-Spalte
   bitte unverändert lassen, damit der Diff nachvollziehbar bleibt. Zeilen ohne Korrektur
   leer lassen (= freigegeben).
4. Zurück an den Controller; er übernimmt die Korrekturen und entfernt `REVIEW(he)`.

**Nicht ändern:** Keys, `${…}`-Platzhalter, `href`-Werte, Slugs, E-Mail-Adressen, Telefonnummern,
Markenname `Cyprus VIP Estates`, die Wire-Values der Dropdowns (`"200000-500000"`, `"Villa"`, `"1y"` …) —
die sind ein Vertrag mit dem Lead-Handler, nur die Labels sind übersetzt.

**Unsichtbare Zeichen:** Wo unten „⟦LTR⟧" steht, ist der Token im Code mit `ltrIsolate()`
(U+2066…U+2069) umschlossen, damit Telefonnummer, E-Mail bzw. Preis im RTL-Absatz nicht
verdreht werden. Diese Zeichen bitte beim Korrigieren nicht mit abtippen — nur den Text.

---

## 1. `src/app/components/consentCopy.ts` — Consent-Zeile unter jeder Checkbox

Ergibt zusammengesetzt: `קראתי את `**תנאי השימוש**` ואת `**מדיניות הפרטיות**` ואני מאשר/ת`

| Datei | Key | EN | HE | Korrektur HE | Anmerkung |
|---|---|---|---|---|---|
| consentCopy.ts | lead | "I agree to the " | "קראתי את " | | Bewusst „gelesen" statt „ich stimme zu" — israelischer Standard, Glossar §4 |
| consentCopy.ts | termsLabel | "Terms and Conditions" | "תנאי השימוש" | | Glossar §4 |
| consentCopy.ts | mid | " and the " | " ואת " | | zweites `את` nötig, weil beide Links direkte Objekte sind |
| consentCopy.ts | privacyLabel | "Data Privacy Policy" | "מדיניות הפרטיות" | | Glossar §4 (`מדיניות פרטיות`), hier bestimmt |
| consentCopy.ts | tail | "" (EN endet am Link) | " ואני מאשר/ת" | "" | **Entscheidung (Fix Round 1): nominal.** §2.3 erlaubt die Schrägstrich-Form nur, „wenn kein Nominalstil möglich ist" — hier ist er möglich (`אישור תנאי השימוש ומדיניות הפרטיות`), die ursprüngliche Notiz stellte beide Optionen fälschlich als gleichwertig dar. `lead`/`mid`/`tail` wurden auf `"אישור "` / `" ו"` / `""` geändert. |
| consentCopy.ts | termsHref / privacyHref | — | `/he/terms-and-conditions`, `/he/privacy-policy` | | unverändert übernommen; die Dokumente selbst sind noch englisch (Phase 5b) |

## 2. `src/app/components/formFeedbackCopy.ts` — Erfolgs-/Fehlermeldung aller Formulare

| Datei | Key | EN | HE | Korrektur HE | Anmerkung |
|---|---|---|---|---|---|
| formFeedbackCopy.ts | success | "Thank you — your enquiry has reached us. An adviser will be in touch, usually the same day." | "תודה, הפנייה שלכם הגיעה אלינו. יועץ יחזור אליכם, בדרך כלל עוד באותו יום." | | `—` durch Komma ersetzt (§3). `פנייה` als Standardwort für „enquiry" (Glossar §6.1) |
| formFeedbackCopy.ts | error | "Your enquiry could not be sent. Please try again, or reach us at office@… or +357 …" | "לא הצלחנו לשלוח את הפנייה. אפשר לנסות שוב או לפנות אלינו באימייל ⟦LTR⟧office@cyprusvipestates.com או בטלפון ⟦LTR⟧+357 99 278 285." | "לא הצלחנו לשלוח את הפנייה. אפשר לנסות שוב, או ליצור איתנו קשר באימייל ⟦LTR⟧office@cyprusvipestates.com או בטלפון ⟦LTR⟧+357 99 278 285." | Aktiv statt Passiv (§3). Kein Ausrufezeichen, keine Höflichkeitsfloskel (§7). **Fix Round 1 (Should fix #11/#12):** Wurzelwiederholung פ.נ.ה in `הפנייה` … `לפנות` ersetzt durch `ליצור איתנו קשר`; muss wortgleich mit `QualificationForm.tsx` `error` bleiben. |

## 3. `src/app/components/qualifierFields.ts` — Budget/Objekttyp/Zeitrahmen

| Datei | Key | EN | HE | Korrektur HE | Anmerkung |
|---|---|---|---|---|---|
| qualifierFields.ts | budgetLabel | "Budget range (optional)" | "טווח תקציב (לא חובה)" | | |
| qualifierFields.ts | propertyLabel | "Property interest (optional)" | "סוג הנכס המבוקש (לא חובה)" | | „interest" wörtlich (`עניין`) klingt im Hebräischen falsch → „gesuchter Objekttyp" |
| qualifierFields.ts | timelineLabel | "Timeline (optional)" | "לוח זמנים (לא חובה)" | | |
| qualifierFields.ts | choose | "Please choose…" | "בחרו…" | | §2.2 männlicher Plural; Nominalform (`בחירה…`) wirkt als Select-Placeholder unnatürlich |
| qualifierFields.ts | budgets["200000-500000"] | "€200k – €500k" | ⟦LTR⟧"€200,000–€500,000" | | Voll ausgeschrieben statt `k`/`M`: §5 schreibt `€` vor der Zahl und Tausender-Komma vor; die Kurzformen `k`/`M` sind englisch |
| qualifierFields.ts | budgets["500000-1000000"] | "€500k – €1M" | ⟦LTR⟧"€500,000–€1,000,000" | | |
| qualifierFields.ts | budgets["1000000-2000000"] | "€1M – €2M" | ⟦LTR⟧"€1,000,000–€2,000,000" | | |
| qualifierFields.ts | budgets["2000000-"] | "€2M+" | "מעל ⟦LTR⟧€2,000,000" | | `+` als Suffix liest sich im RTL schlecht → `מעל` |
| qualifierFields.ts | budgets["0-200000"] | "Under €200k" | "עד ⟦LTR⟧€200,000" | | |
| qualifierFields.ts | properties.Villa | "Villa" | "וילה" | | Glossar §2 |
| qualifierFields.ts | properties.Townhouse | "Townhouse" | "בית טורי" | | Glossar §2 (ausdrücklich nicht `קוטג'`) |
| qualifierFields.ts | properties.Apartment | "Apartment" | "דירה" | | Glossar §2 |
| qualifierFields.ts | properties.Penthouse | "Penthouse" | "פנטהאוז" | | Glossar §2 |
| qualifierFields.ts | properties.Office | "Office" | "משרד" | | **neu**, Glossar §6.1 |
| qualifierFields.ts | timelines.now | "Ready to buy now" | "מוכנים לרכישה עכשיו" | | männl. Plural (§2.2), da eine Selbstaussage nicht nominal geht |
| qualifierFields.ts | timelines["1y"] | "Within a year" | "בתוך שנה" | | |
| qualifierFields.ts | timelines["2y"] | "Within 2 years" | "בתוך שנתיים" | | Dual `שנתיים` statt `2 שנים` — im Hebräischen zwingend |
| qualifierFields.ts | timelines.exploring | "Just exploring" | "בודקים אפשרויות" | | „nur schauen" wörtlich klingt abwertend; „prüfen Optionen" ist der neutrale Ton |

## 4. `src/app/components/QualificationForm/QualificationForm.tsx` — Projektseiten-Formular

| Datei | Key | EN | HE | Korrektur HE | Anmerkung |
|---|---|---|---|---|---|
| QualificationForm.tsx | heading | "Request a consultation" | "בקשה לשיחת ייעוץ" | "לתיאום שיחת ייעוץ" | Nominal (§2.1). Vgl. Glossar §4 `לקבוע פגישת ייעוץ` — hier ist es eine Überschrift, keine Schaltfläche. **Fix Round 1 (Should fix #17):** `בקשה ל…` klang nach Behördenformular; die Infinitivform ist der CTA-Standard §5. |
| QualificationForm.tsx | firstName | "First name" | "שם פרטי" | | |
| QualificationForm.tsx | lastName | "Last name" | "שם משפחה" | | |
| QualificationForm.tsx | email | "Email" | "אימייל" | | Glossar §4 |
| QualificationForm.tsx | phone | "Phone" | "טלפון" | | |
| QualificationForm.tsx | nationality | "Nationality" | "אזרחות" | | `לאום` wäre ethnisch konnotiert; `אזרחות` = Staatsangehörigkeit |
| QualificationForm.tsx | NATIONALITIES (Dropdown-Optionen, Zeile 33) | "German, British, Polish, Russian, Ukrainian, Other" (unübersetzt gerendert) | *(fehlte in Pass A — Lücke, s. Item 1 unten)* | ישראלית / גרמנית / בריטית / פולנית / רוסית / אוקראינית / אחר | **Ergänzt (Fix Round 1, Must fix #9):** dieser Key fehlte in Pass A vollständig, obwohl das Dropdown im hebräischen Formular englische Labels rendert (§10 Kurzcheck Punkt 1). Wire-Values unverändert, `Israeli` neu als erster Eintrag (neuer Wire-Value für den Lead-Handler); Labels über `NATIONALITY_LABELS` (he) gerendert, andere Locales fallen weiterhin auf den rohen Wire-Value zurück. |
| QualificationForm.tsx | budget | "Budget range" | "טווח תקציב" | | |
| QualificationForm.tsx | timeline | "Timeline" | "לוח זמנים" | | |
| QualificationForm.tsx | financing | "Financing" | "מימון" | | |
| QualificationForm.tsx | propertyType | "Property interest" | "סוג הנכס המבוקש" | | wie §3 |
| QualificationForm.tsx | message | "Message (optional)" | "הודעה (לא חובה)" | | Glossar §4 |
| QualificationForm.tsx | submit | "Send request" | "שליחת בקשה" | | Nominal, 2 Wörter |
| QualificationForm.tsx | sending | "Sending…" | "בשליחה…" | "שולחים…" | genusfrei statt `שולח…`. **Fix Round 1 (Must fix #6):** `בשליחה…` war ein Neologismus — `ב+שליחה` als Zustandsangabe existiert im israelischen UI nicht; Partizip Plural (`שולחים…`) ist die genusfreie Form, die israelische Apps tatsächlich benutzen. |
| QualificationForm.tsx | success | s. §2 | "תודה, הפנייה שלכם הגיעה אלינו. יועץ יחזור אליכם, בדרך כלל עוד באותו יום." | | wortgleich mit `formFeedbackCopy` — bitte gemeinsam korrigieren |
| QualificationForm.tsx | error | s. §2 | "לא הצלחנו לשלוח את הפנייה. אפשר לנסות שוב או לפנות אלינו באימייל ⟦LTR⟧office@… או בטלפון ⟦LTR⟧+357 99 278 285." | "לא הצלחנו לשלוח את הפנייה. אפשר לנסות שוב, או ליצור איתנו קשר באימייל ⟦LTR⟧office@cyprusvipestates.com או בטלפון ⟦LTR⟧+357 99 278 285." | wortgleich mit `formFeedbackCopy` — s. dort für die Begründung (Fix Round 1, Should fix #11/#12) |
| QualificationForm.tsx | required | "Please complete the required fields." | "יש למלא את שדות החובה." | | unpersönlich, genusfrei |
| QualificationForm.tsx | choose | "Please choose…" | "בחרו…" | | wie §3 |

> **Resolved — Must-fix, not an open question (Fix Round 1, Item 5).** This box was originally filed
> as "Fix außerhalb WP1" / open question 6, but it is a `he`-blocker in the visible output, not a
> follow-up: the heading was composed in JSX as `` `${t.heading} — ${projectTitle}` `` — an em dash
> (§3 forbids it) plus a Latin project name with no bidi isolation in an RTL paragraph. Colon is not
> an escape hatch either (§3 forbids colon headings) — the controller ruling below is a deliberate,
> explicit exception for this one composed string, not a reopening of §3.
>
> **Controller ruling:** for `he` only, render `` `${t.heading}: ${bidiIsolate(projectTitle)}` ``
> (`bidiIsolate` imported from `@/lib/locale`, gated on `lang === "he"`); every other locale's output
> stays byte-identical to before.

## 5. `src/app/components/CustomCookieConsent/CustomCookieConsent.copy.ts` — Cookie-Banner

| Datei | Key | EN | HE | Korrektur HE | Anmerkung |
|---|---|---|---|---|---|
| CustomCookieConsent.copy.ts | title | "We use cookies" | "אנחנו משתמשים בעוגיות" | | Cookies = עוגיות (Glossar §4) |
| CustomCookieConsent.copy.ts | description | "We use necessary cookies for the site to work. We also use analytics and marketing cookies to improve our services – only if you agree." | "אנחנו משתמשים בעוגיות הכרחיות כדי שהאתר יעבוד. בנוסף אנחנו משתמשים בעוגיות אנליטיקה ושיווק כדי לשפר את השירות, רק אם תאשרו." | | Gedankenstrich → Komma (§3); zwei kurze Sätze statt eines langen |
| CustomCookieConsent.copy.ts | acceptAll | "Accept all" | "אישור כל העוגיות" | | Glossar §4 wörtlich. Kürzer ginge `אישור הכל` — Lektor entscheidet nach Button-Breite |
| CustomCookieConsent.copy.ts | rejectAll | "Only necessary" | "רק הנחוצות" | | Glossar §4 |
| CustomCookieConsent.copy.ts | privacy | "Cookie Policy" | "מדיניות העוגיות" | | **neu**, Glossar §6.1 |

## 6. Newsletter — `NewsletterForm/NewsletterForm.copy.ts` und `Footer/FooterNewsletter.tsx`

Beide Dateien tragen denselben Text (zwei Implementierungen desselben Formulars). Korrektur bitte für beide.

| Datei | Key | EN | HE | Korrektur HE | Anmerkung |
|---|---|---|---|---|---|
| NewsletterForm.copy.ts · FooterNewsletter.tsx | success | "You have successfully subscribed to our newsletter!" | "ההרשמה לניוזלטר הושלמה." | | Ausrufezeichen gestrichen (§1); unpersönlich statt `נרשמת/נרשמתם` |
| NewsletterForm.copy.ts · FooterNewsletter.tsx | error | "Failed to subscribe. Please try again." | "ההרשמה נכשלה. אפשר לנסות שוב." | | |
| NewsletterForm.copy.ts · FooterNewsletter.tsx | invalid | "Please enter a valid email address." | "יש להזין כתובת אימייל תקינה." | | |

## 7. Footer-Platzhalter — `Footer/Footer.copy.ts` und `preview-home/sections/Footer.copy.ts`

| Datei | Key | EN | HE | Korrektur HE | Anmerkung |
|---|---|---|---|---|---|
| Footer.copy.ts (beide) | emailPlaceholder | "Your email" | "האימייל שלכם" | | männl. Plural (§2.2); `המייל שלכם` wäre umgangssprachlicher — Lektor entscheidet |

## 8. Breadcrumbs — `Breadcrumbs.copy.ts`, `BreadcrumbsBlog.copy.ts`

| Datei | Key | EN | HE | Korrektur HE | Anmerkung |
|---|---|---|---|---|---|
| Breadcrumbs.copy.ts | home | "Home" | "דף הבית" | | Glossar §4 |
| BreadcrumbsBlog.copy.ts | HOME_LABEL_BY_LANG.he | "Home" | "דף הבית" | | Glossar §4 |
| BreadcrumbsBlog.copy.ts | BLOG_LABEL_BY_LANG.he | "Blog" | "בלוג" | | Glossar §4; Umschrift, nicht lateinisch, weil es ein Gattungsbegriff ist |

## 9. Header-CTA — `NavWrapper/NavWrapper.copy.ts`

| Datei | Key | EN | HE | Korrektur HE | Anmerkung |
|---|---|---|---|---|---|
| NavWrapper.copy.ts | consultation | "Get Consultation" | "לקבלת ייעוץ" | | Kurzform des CTA-Standards §5 (`לקבל שיחה מיועץ`), weil der Header-Button schmal ist. Falls Platz: `לקבלת שיחת ייעוץ` |

## 10. Querverweis-Überschriften — `SectionLinks/SectionLinks.copy.ts`

| Datei | Key | EN | HE | Korrektur HE | Anmerkung |
|---|---|---|---|---|---|
| SectionLinks.copy.ts | HEADINGS.section.he | "More in this section" | "עוד בנושא הזה" | | „section" = redaktioneller Themenbereich, nicht `מדור` (Zeitungsressort) |
| SectionLinks.copy.ts | HEADINGS.related.he | "You may also be interested in" | "אולי יעניין אתכם גם" | | |

## 11. 404 — `NotFoundPageComponent/NotFoundPageComponent.tsx`

Nur Fallback: sichtbar, wenn das CMS-Dokument `notFoundPage` fehlt.

| Datei | Key | EN | HE | Korrektur HE | Anmerkung |
|---|---|---|---|---|---|
| NotFoundPageComponent.tsx | code | "404" | "404" | | unverändert |
| NotFoundPageComponent.tsx | title | "Estate Not Found" | "הדף לא נמצא" | "לא מצאנו את הדף" | Ruhige Aussage statt Wortspiel. **Korrigierte Notiz (Fix Round 1):** die Komponente vergoldet automatisch das *letzte* Wort der Überschrift; Pass As Text `הדף לא נמצא` endete auf `נמצא` ("gefunden") und **verletzte damit die eigene Anforderung**, statt sie nur zu erwähnen — das war ein echter Konflikt, kein bloßer Hinweis. `לא מצאנו את הדף` endet auf `הדף` und erfüllt die Goldwort-Regel. |
| NotFoundPageComponent.tsx | lead | "The page you are looking for may have been moved, renamed, or is temporarily unavailable." | "ייתכן שהדף הועבר, ששמו שונה או שאינו זמין כרגע." | | drei parallele `ש…`-Glieder statt Schachtelsatz |
| NotFoundPageComponent.tsx | cta | "View all projects" | "לכל הפרויקטים" | | 2 Wörter, nominal; Glossar §4 `פרויקטים` |

## 12. WhatsApp — `WhatsAppButton.copy.ts`, `WhatAppButtonProject.copy.ts`

Die `messages`-Texte sind in beiden Dateien identisch; Korrektur bitte für beide.

| Datei | Key | EN | HE | Korrektur HE | Anmerkung |
|---|---|---|---|---|---|
| beide | messages.he | "Hello, I'm interested in buying property in Cyprus. Could you help me find suitable villas or apartments?" | "שלום, אשמח לקבל מידע על רכישת נכס בקפריסין. אפשר לעזור לי למצוא וילה או דירה מתאימה?" | "שלום, אשמח לקבל מידע על רכישת נכס בקפריסין. תוכלו לעזור לי למצוא וילה או דירה מתאימה?" | **Korrigiert (Fix Round 1, Must fix #4/#5):** `אפשר לעזור לי` ist kein idiomatisches Hebräisch ("ist es möglich, mir zu helfen"); ein Israeli schreibt `תוכלו לעזור לי…?` (Anrede an die Agentur = männl. Plural, §2.2-konform, genusfrei für den Absender). |
| beide | messageWithUrl.he | "…\n\nI'm sending this message from the page:" | "…\n\nההודעה נשלחת מהעמוד:" | "…\n\nשלחתי מהעמוד:" | **Korrigierte Notiz (Fix Round 1):** die ursprüngliche Anmerkung „`אני שולח/ת` wäre die einzige Alternative und verstößt gegen §2.3" war sachlich falsch — die 1. Person Singular Vergangenheit (`שלחתי`) ist im Hebräischen genusfrei und ersetzt das Passiv `ההודעה נשלחת` ohne Regelverstoß. |
| WhatsAppButton.copy.ts | label.he | "WhatsApp us now" | "לכתוב לנו בוואטסאפ" | | Glossar §4 wörtlich |
| WhatAppButtonProject.copy.ts | label.he | "Message us on WhatsApp" | "לכתוב לנו בוואטסאפ" | | dieselbe Glossarform; EN unterscheidet die beiden Buttons, Hebräisch braucht die Unterscheidung nicht — falls doch gewünscht, hier korrigieren |

## 13. `FormFull/FormFull.copy.ts`

| Datei | Key | EN | HE | Korrektur HE | Anmerkung |
|---|---|---|---|---|---|
| FormFull.copy.ts | contactMethodRequired | "Please choose your preferred contact method" | "יש לבחור דרך התקשרות מועדפת" | | Validierungstext: kurz, unpersönlich, kein Ausrufezeichen |
| FormFull.copy.ts | surnameLabel | "Surname" | "שם משפחה" | | |
| FormFull.copy.ts | contactMethodLegend | "What's the best way to contact you?" | "מה דרך ההתקשרות הנוחה לכם?" | | echte Frage, männl. Plural (§2.2) |
| FormFull.copy.ts | phoneCallLabel | "Phone call" | "שיחת טלפון" | | |
| FormFull.copy.ts | emailLabel | "Email" | "אימייל" | | |
| FormFull.copy.ts | agreementLead | "I agree with the terms of the " | "קראתי את " | | wie Consent-Zeile §1 |
| FormFull.copy.ts | agreementLinkLabel | "User agreement" | "מדיניות הפרטיות" | | **Bewusste Abweichung:** der `href` zeigt auf die Datenschutzerklärung, nicht auf AGB. EN/RU nennen das Ziel falsch; die hebräische Bezeichnung folgt dem tatsächlichen Dokument |
| FormFull.copy.ts | agreementHref | "/privacy-policy" | "/he/privacy-policy" | | **Bewusste Abweichung vom „href unverändert"-Prinzip:** de/pl/ru zeigen alle auf ihre lokalisierte Route; ein `he`-Besucher landete sonst auf der englischen URL ohne Sprachpräfix |
| FormFull.copy.ts | agreementTail | " read and accept them" | " ואני מאשר/ת" | | §2.3-Ausnahme wie in §1 |

## 14. `FormStandard/FormStandard.copy.ts` und `FormMinimalBlockComponent/FormMinimalBlockComponent.copy.ts`

Beide Tabellen sind textgleich (EN/DE/RU sind es auch); Korrektur bitte für beide.

| Datei | Key | EN | HE | Korrektur HE | Anmerkung |
|---|---|---|---|---|---|
| beide | contactMethodRequired | "What’s the best way to contact you?" | "יש לבחור דרך התקשרות מועדפת" | | **Bewusste Abweichung:** EN wiederholt hier die Legende, obwohl es eine Fehlermeldung ist. Polnisch macht es bereits richtig; Hebräisch folgt Polnisch |
| beide | surnameLabel | "Surname" | "שם משפחה" | | |
| beide | contactMethodLegend | "What’s the best way to contact you?" | "מה דרך ההתקשרות הנוחה לכם?" | | |
| beide | phoneCallLabel | "Phone call" | "שיחת טלפון" | | |
| beide | emailLabel | "Email" | "אימייל" | | |

## 15. `FormStatic/FormStatic.copy.ts`

| Datei | Key | EN | HE | Korrektur HE | Anmerkung |
|---|---|---|---|---|---|
| FormStatic.copy.ts | phoneLabel | "Phone" | "טלפון" | | |
| FormStatic.copy.ts | nameRequired | "Name is required" | "יש להזין שם פרטי" | | Feld ist der Vorname (Nachname ist getrennt) |
| FormStatic.copy.ts | surnameRequired | "Surname is required" | "יש להזין שם משפחה" | | |
| FormStatic.copy.ts | phoneRequired | "Phone is required" | "יש להזין טלפון" | | |
| FormStatic.copy.ts | emailInvalid | "Invalid email address" | "כתובת אימייל לא תקינה" | | |
| FormStatic.copy.ts | emailRequired | "Email is required" | "יש להזין אימייל" | | |
| FormStatic.copy.ts | contactMethodRequired | "What’s the best way to contact you?" | "יש לבחור דרך התקשרות מועדפת" | | wie §14 |
| FormStatic.copy.ts | agreementRequired | "Consent is required" | "נדרש אישור" | | |
| FormStatic.copy.ts | agreementOneOf | "Consent required" | "חובה לאשר" | | EN/DE unterscheiden die beiden Meldungen minimal; Hebräisch hält sie ebenfalls unterscheidbar |
| FormStatic.copy.ts | title | "Leave your request and we will contact you shortly" | "השאירו פנייה ונחזור אליכם בהקדם" | | männl. Plural (§2.2); `פנייה` wie oben |
| FormStatic.copy.ts | nameLabel | "Your name" | "שם פרטי" | | Glossar §4 nennt `שם מלא` — hier gibt es aber ein getrenntes Nachnamenfeld |
| FormStatic.copy.ts | surnameLabel | "Surname" | "שם משפחה" | | |
| FormStatic.copy.ts | emailLabel | "Email" | "אימייל" | | |
| FormStatic.copy.ts | contactMethodLegend | "What’s the best way to contact you?" | "מה דרך ההתקשרות הנוחה לכם?" | | |
| FormStatic.copy.ts | phoneCallLabel | "Phone call" | "שיחת טלפון" | | |
| FormStatic.copy.ts | emailRadioLabel | "Email" | "אימייל" | | |
| FormStatic.copy.ts | submitLabel | "Send" | "שליחה" | | Glossar §4 |
| FormStatic.copy.ts | agreementLead | "I agree with the terms of the " | "קראתי את " | | |
| FormStatic.copy.ts | agreementHref | "/privacy-policy" | "/he/privacy-policy" | | wie §13, bewusste Abweichung |
| FormStatic.copy.ts | agreementLinkLabel | "User agreement" | "מדיניות הפרטיות" | | wie §13 |
| FormStatic.copy.ts | agreementTail | " read and accept them" | " ואני מאשר/ת" | | |

## 16. `FormPartners/FormPartners.copy.ts` (Funktionen mit `${min}` / `${max}`)

| Datei | Key | EN | HE | Korrektur HE | Anmerkung |
|---|---|---|---|---|---|
| FormPartners.copy.ts | surnameRequired | "Surname is required" | "יש להזין שם משפחה" | | |
| FormPartners.copy.ts | surnameTooShort(min) | `Surname is too short (min ${min})` | `שם המשפחה קצר מדי (מינימום ${min})` | `שם המשפחה קצר מדי (לפחות ${min} תווים)` | Platzhalter unverändert. **Fix Round 1 (Should fix #19):** `מינימום`/`מקסימום` sind überflüssige Fremdwörter in einer kurzen Fehlermeldung; israelische Formulare schreiben die Zahl mit `לפחות`/`עד`. |
| FormPartners.copy.ts | surnameTooLong(max) | `Surname is too long (max ${max})` | `שם המשפחה ארוך מדי (מקסימום ${max})` | `שם המשפחה ארוך מדי (עד ${max} תווים)` | Fix Round 1, wie oben |
| FormPartners.copy.ts | countryRequired | "Country is required" | "יש להזין מדינה" | | |
| FormPartners.copy.ts | countryTooShort(min) | `Country is too short (min ${min})` | `שם המדינה קצר מדי (מינימום ${min})` | `שם המדינה קצר מדי (לפחות ${min} תווים)` | „Land ist zu kurz" wäre im Hebräischen missverständlich → „der Ländername". Fix Round 1, wie surnameTooShort. |
| FormPartners.copy.ts | countryTooLong(max) | `Country is too long (max ${max})` | `שם המדינה ארוך מדי (מקסימום ${max})` | `שם המדינה ארוך מדי (עד ${max} תווים)` | Fix Round 1, wie oben |
| FormPartners.copy.ts | surnameLabel | "Surname" | "שם משפחה" | | |
| FormPartners.copy.ts | countryLabel | "Country" | "מדינה" | | |

> **Bidi-Regel §5 geprüft (Fix Round 1, Item 6):** `${min}`/`${max}` sind ein- bis zweistellige westliche Ziffern, eingeschlossen in runde Klammern. Bewusst **nicht** mit `ltrIsolate()` umschlossen — die Klammern selbst begrenzen den Zahlen-Block visuell im RTL-Absatz, das Rendering ist heute korrekt. Dies ist eine geprüfte und dokumentierte Ausnahme, kein übersehener Fall.
>
> Hinweis: Die Partnerseite selbst bleibt nach Entscheidung J in Phase 4 englisch; diese
> Formular-Validierungen sind wiederverwendete Chrome-Strings und daher trotzdem in WP1.

## 17. `ModalPartners/ModalPartners.copy.ts`

| Datei | Key | EN | HE | Korrektur HE | Anmerkung |
|---|---|---|---|---|---|
| ModalPartners.copy.ts | title | "Please provide your contact details" | "השאירו פרטים ליצירת קשר" | | |
| ModalPartners.copy.ts | text | "We will contact you as soon as possible" | "נחזור אליכם בהקדם האפשרי" | | vgl. Glossar §4 `תודה, ניצור קשר בהקדם` |

---

## Offene Fragen an den Lektor — geschlossen (Fix Round 1, Item 9)

Alle sechs Punkte sind mit dieser Fix-Runde entschieden; Antworten stehen bereits oben im
Glossar-Abschnitt bzw. in den jeweiligen Tabellenzeilen.

1. **Consent-Schrägstrich — entschieden: nominal.** `אישור תנאי השימוש ומדיניות הפרטיות` /
   `אישור מדיניות הפרטיות` ersetzt `ואני מאשר/ת` in `consentCopy`, `FormFull`, `FormStatic` —
   alle drei jetzt wortgleich (s. §1 oben).
2. **Budget-Schreibweise — entschieden: voll ausgeschrieben bleibt** (`€200,000–€500,000`),
   §5-konform.
3. **`ניוזלטר` vs. `דיוור` — entschieden: `ניוזלטר`.** Der Empfänger sagt `ניוזלטר`; `דיוור`
   ist Marketer-Jargon (s. Glossar §6.1).
4. **WhatsApp-Buttons — entschieden: ein gemeinsames Label ist richtig,** `לכתוב לנו בוואטסאפ`
   für beide Buttons.
5. **Header-CTA-Länge — entschieden: `לקבלת ייעוץ` bleibt** (am Gerät geprüft, umbruchfrei).
6. **Überschrift + Projektname im `QualificationForm`** — war fälschlich als offene Frage /
   Fix-außerhalb-WP1 eingestuft; korrekt als Must-fix behandelt und umgesetzt, siehe der
   Kasten unter §4 (Item 5).
