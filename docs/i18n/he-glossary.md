# Hebräisches Glossar — Cyprus VIP Estates (`he`)

**Stand:** 2026-09-13 · verbindlich für alle `he`-Texte und als Prompt-Kontext für jeden Übersetzungs- und Generierungslauf (Projektbeschreibungen, Meta, Area-Texte).

**Konsolidiert am 2026-09-13:** Diese Datei ist die **eine verbindliche Liste**. Sie führt die Pass-A/Pass-B-Ergebnisse aus WP1–WP6 zusammen (`docs/i18n/reviews/wp2-glossary.md` … `wp6-glossary.md`; jene Dateien bleiben als Audit-Trail mit den Begründungen erhalten, sind aber **nicht** mehr die Quelle). Wo zwei Arbeitspakete unterschiedliche hebräische Formen für denselben englischen Term vorschlugen, steht hier **eine** verbindliche Form; die unterlegene Variante ist als „nicht verwenden" vermerkt. Änderungen dokumentiert §7. WP7 (CRM/E-Mail/Booking) ist noch nicht eingearbeitet und läuft weiter über `docs/i18n/reviews/wp7-glossary.md`.

Ergänzungen kommen aus den Lektor-Protokollen (`docs/i18n/reviews/`) und aus `he-keyword-map.md` (die Schreibweise mit dem höheren Suchvolumen gewinnt). Die Regeln hinter den Entscheidungen stehen in `he-styleguide.md`, insbesondere §11.

Regel: **Eigennamen in Lateinschrift bleiben lateinisch** (Marke, Projekte, Bauträger, Resorts). Umschrift nur für Geografie und Gattungsbegriffe. Ktiv male, keine Vokalzeichen.

---

## 1. Geografie

| Deutsch / Englisch | Hebräisch (verbindlich) | Varianten, die NICHT verwendet werden | Hinweis |
|---|---|---|---|
| Zypern / Cyprus | קפריסין | קפריסן | Adjektiv: קפריסאי / קפריסאית |
| Republik Zypern | הרפובליקה של קפריסין | | nur in rechtlichen Kontexten |
| Nordzypern | צפון קפריסין | | wird nicht beworben; nur zur Abgrenzung |
| Limassol | לימסול | לימאסול, לימסל | häufigste Suchschreibweise; Feed-Varianten `Lemesos`, `Limassol` |
| Paphos | פאפוס | פפוס | Feed-Varianten `Pafos`, `Paphos` |
| Larnaka | לרנקה | לרנקא, לרנאקה | kein Inventar — nicht bewerben |
| Nikosia | ניקוסיה | | |
| Ayia Napa | איה נאפה | אגיה נאפה | |
| Protaras | פרוטארס | | |
| Polis (Chrysochous) | פוליס | | |
| Peyia / Pegeia | פייה | פגייה | |
| Coral Bay | קורל ביי | מפרץ האלמוגים | Resortname, Umschrift üblich |
| Kato Paphos | קאטו פאפוס | | |
| Geroskipou | גרוסקיפו | ירוסקיפו | Feed-Variante `Yeroskipou` |
| Chloraka | כלורקה | | Feed-Variante `Chlorakas` |
| Tala | טאלה | | |
| Kissonerga | קיסונרגה | | |
| Sea Caves | סי קייבס | מערות הים | Ortsbezeichnung, Umschrift |
| Latchi / Latsi | לאצ'י | | |
| Germasogeia | גרמסוגיה | | |
| Agios Tychonas | אגיוס טיכונאס | | |
| Mesa Geitonia | מסא גיטוניה | | |
| Mouttagiaka | מוטאגיאקה | | |
| Pissouri | פיסורי | | |
| Troodos | טרודוס | | |
| Akamas | עכמס | אקמאס | Naturschutzgebiet |
| Paralimni | פראלימני | | WP2, aus dem Feed |
| Tsada | צאדה | | WP2, aus dem Feed |
| Konia | קוניה | | WP2, aus dem Feed |
| Mesa Chorio | מסה חוריו | | WP2, aus dem Feed |
| Universal (Paphos) | יוניברסל | | Ortsteil, WP2 |
| Episkopi | אפיסקופי | | WP2 |
| Pyrgos | פירגוס | | WP2 |
| Parekklisia | פרקליסיה | | WP2 |
| Oroklini | אורוקליני | | WP2 |
| Pyla | פילה | | WP2 |
| Livadia | ליבאדיה | | WP2 |
| Dhekelia | דקליה | | WP2 |
| Kouklia | קוקליה | | WP2 |
| Neapolis | נאפוליס | | WP2 |
| Venus Rock | ונוס רוק | | Resortgebiet, Umschrift |
| Famagusta | פמגוסטה | | WP2 |
| Ayia Thekla | איה תקלה | | WP2 |
| Cape Greco | כף גרקו | | WP2 |
| Mittelmeer | הים התיכון | | |
| Flughafen Paphos / Larnaka | שדה התעופה פאפוס / לרנקה | | |
| Israel → Zypern Flugzeit | כ-45 דקות טיסה מישראל | | Standardformulierung |
| District / Locality / Area (Verwaltungsebenen) | מחוז / יישוב / אזור | | drei getrennte Ebenen in den Nachbarschafts-Tags der Development-Seite |

**Ortsnamen aus dem Feed** werden für `he` umgeschrieben, nicht lateinisch durchgereicht: die hebräische Nachfrage lautet `וילות בפאפוס` / `דירות בלימסול`, ein Snippet mit `ב-Paphos` matcht keine dieser Queries (WP2 Pass B #5). Die Tabelle liegt als Code in `src/lib/hePlaces.ts` (diese §1-Liste plus die Schreibvarianten der Feeds). Projekt-, Bauträger- und Resortmarken bleiben lateinisch (§4) und stehen bewusst **nicht** in der Tabelle.

**Präposition „in <Ort>":** Das Bindestrich-Kriterium ist der **Schrifttyp des Ortsnamens**, nicht die Locale. Hebräischer Ort → gebundenes Präfix ohne Bindestrich (`בפאפוס`); lateinischer Ort → Bindestrich und Bidi-Isolat (`ב-⁨Konia, Paphos⁩`). `ב-פאפוס` ist falsch. Implementiert als `heLocative()` in `src/lib/hePlaces.ts`.

## 2. Immobilientypen, Objekt- und Kaufbegriffe

| Englisch | Hebräisch | Hinweis |
|---|---|---|
| property / real estate (Branche) | נדל"ן | mit Gershayim; SEO-Kernbegriff |
| property (ein Objekt) | נכס | Plural נכסים; auch Fallback-Typbezeichnung im SEO-Title (`TYPE_LABEL.generic`, `developmentSeo.ts`) |
| properties for sale | נכסים למכירה | Startseite (`Cities.tsx`-H2). Bewusst nicht `דירות למכירה` — das ist das Primär-KW der Spoke-Seite `/he/apartments-for-sale-cyprus` (`he-keyword-map.md` §4); siehe §6 |
| apartment | דירה | Plural דירות |
| villa | וילה | Plural וילות |
| luxury villa | וילת יוקרה | Smichut-Standardform; Case-Kategorie: `רכישת וילת יוקרה` |
| premium homes | בתי יוקרה | nicht verwenden: `בתים ברמה גבוהה` (inhaltsleerer Füller) |
| house / detached house | בית פרטי | Plural בתים פרטיים |
| townhouse | בית טורי | nicht „קוטג'" |
| penthouse | פנטהאוז | |
| duplex / maisonette | דופלקס | |
| studio | סטודיו | |
| bungalow | בונגלו | selten; meist בית פרטי חד-קומתי |
| office (Objekttyp) | משרד | Objekttyp-Liste in den Qualifier-Feldern |
| commercial (Objekttyp) | נכס מסחרי | Filter „Property type"; `מסחרי` allein hängt als Dropdown-Eintrag adjektivisch ab |
| Objekttypen aus dem Feed (Anzeige-Mapping) | דירה / וילה / בית פרטי / בית טורי / פנטהאוז / דופלקס / בונגלו / סטודיו / מגרש / נכס מסחרי | nur für die Anzeige in `he`; die englischen Feed-Werte steuern weiterhin Filter und Matching (`heFeedLabel()` in `src/lib/heFeedVocab.ts`) |
| second home | בית שני | nicht `דירת נופש` (klingt nach Ferienvermietung) |
| new build / new development | פרויקט חדש | Plural פרויקטים חדשים; auch Abschnittstitel „Latest developments" (nicht `אחרונים`) |
| off-plan | על הנייר | Standardbegriff: `רכישה על הנייר` |
| under construction | בבנייה | |
| construction stage | שלב הבנייה | Faktenpanel Development-Seite |
| completed / ready | מוכן למגורים | „key-ready" |
| resale | יד שנייה | |
| development (project) | פרויקט | nie „פיתוח" |
| developer | יזם / חברה יזמית | Plural יזמים; Firmennamen lateinisch. **nicht verwenden: `חברות בנייה`, `קבלן`** — das ist der ausführende Bauunternehmer, nicht der Bauträger (WP4 Fix 1, M4/M8) |
| brand of (Firmenzugehörigkeit) | מותג של | nicht `פרויקט של` — `פרויקט` ist verbindlich das Bauprojekt (WP5 Frage 2) |
| vetted (Bauträger geprüft) | עבר בדיקה | konkreter als `מאומת`: sagt, dass wir selbst geprüft haben |
| clean legal title | בעלות משפטית נקייה (על הקרקע ועל הפרויקט) | nicht verwenden: `טאבו נקי` — ein israelischer Käufer liest das als „Title Deed ausgestellt und lastenfrei", was bei Off-Plan regelmäßig nicht stimmt |
| delivery track record | היסטוריית מסירות מוכחת | Plural; `מוכחת` statt des Beteuerungsworts `אמיתית` |
| active current portfolio | צבר פרויקטים פעיל | nicht verwenden: `תיק נכסים` (= Anlageportfolio eines Eigentümers), `פורטפוליו` |
| at no markup to the buyer | בלי תוספת מחיר לרוכש | Tatsache, keine Werbung |
| boutique studio (Bauträgertyp) | סטודיו בוטיק | im israelischen Immobilien-/Designsprachgebrauch etabliert |
| large international companies | חברות בינלאומיות גדולות | nicht verwenden: `גופים בינלאומיים` (Behörden-/Finanzsprache) |
| unit | יחידה | Plural יחידות; im UI meist דירה/וילה konkret |
| unit status (Einheitentabelle, Bezug `יחידה`) | זמינה / שמורה / נמכרה | feminine Reihe, weil der Bezug `יחידה` ist. Das Hero-Badge über dem **Projekt** bleibt maskulin (`זמין`, §2 unten). Implementiert als `heFeedLabel()`; siehe §6 |
| last unit available / only {n} units left | יחידה אחרונה / נותרו רק {n} יחידות | Scarcity-**Badge**, kein Satz; Satzform `נותרה יחידה אחרונה` bleibt für Fließtext gültig |
| plot / land | מגרש / קרקע | |
| floor plan | תוכנית קומה / תוכנית דירה | |
| gated community | קהילה מגודרת / פרויקט מגודר | |
| resort | ריזורט | |
| sea view | נוף לים | |
| beachfront / first line | קו ראשון לים | Suchbegriff |
| walking distance to the beach | במרחק הליכה מהחוף | |
| swimming pool (private) | בריכה פרטית | |
| communal pool | בריכה משותפת | |
| roof garden / roof terrace | גג / מרפסת גג | |
| terrace / balcony | מרפסת | |
| garden | גינה | |
| parking (covered) | חניה (מקורה) | |
| storage room | מחסן | |
| bedroom | חדר שינה | Zypern zählt Schlafzimmer — immer `חדרי שינה`, nie `חדרים` |
| bedrooms (Zählformen auf Chips) | סטודיו · חדר שינה אחד · 3 חדרי שינה · ⁦2-4⁩ חדרי שינה | Hebräisch ist nicht zahlinvariant: die Eins wird ausgeschrieben und nachgestellt, ein Studio bekommt kein Einheitswort, eine Spanne steht mit einfachem Bindestrich im LRI-Isolat. nicht verwenden: `חד' שינה`. Implementiert als `heBedrooms()` in `src/lib/heFeedVocab.ts` |
| bathroom | חדר רחצה | „en suite": חדר רחצה צמוד |
| living area / built area | שטח בנוי | |
| covered area | שטח מקורה | |
| plot size | שטח מגרש | |
| energy class (Faktenpanel) | דירוג אנרגטי | |
| energy (Kurzlabel auf der Projektkarte) | אנרגיה | Chip `אנרגיה A`; die englische Vorlage unterscheidet ebenso `Energy` (Karte) von `Energy rating` (Faktenpanel) |
| amenities | מתקנים ושירותים | nicht „אמניטיז" |
| gym | חדר כושר | |
| concierge | קונסיירז' | |
| smart home | בית חכם | |
| air conditioning | מיזוג אוויר | |
| underfloor heating | חימום תת-רצפתי | |
| furnished | מרוהט | |
| visualisation / rendering | הדמיה | Bildunterschrift Galerie, Branchenbegriff |
| virtual tour | סיור וירטואלי | `סיור` allein liest sich als Besichtigung vor Ort |
| viewing (Besichtigung vor Ort) | סיור בנכס | `צפייה בנכס` wäre das Anschauen von Fotos |
| title deed | טאבו / נסח טאבו | israelisches Äquivalent, in Zypern „Title Deed" — bei erster Nennung erklären: `שטר בעלות (Title Deed)` |
| land registry | רשם המקרקעין | |
| lawyer | עורך דין (עו"ד) | Zypern hat keinen Notar im deutschen Sinn |
| signing at the lawyer's | חתימה אצל עורך הדין | ersetzt „notary appointment" |
| sales agreement | חוזה מכר | |
| deal / transaction | עסקה | z. B. `עסקאות נדל"ן אמיתיות` |
| reservation deposit | דמי רצינות / פיקדון הרשמה | |
| stamp duty | מס בולים | |
| VAT (reduced 5%) | מע"מ (מופחת 5%) | nur mit Quelle |
| +VAT (an einer Preisangabe) | + מע"מ | mit Leerzeichen, oder `לא כולל מע"מ`; ohne Leerzeichen liest es sich als ein Wort |
| transfer fees | דמי העברה | |
| immovable property tax | (abgeschafft) | nicht erwähnen |
| capital gains tax | מס רווחי הון | |
| rental yield | תשואה משכירות | Suchbegriff: תשואה |
| buy-to-let | להשקעה להשכרה | |
| short-term rental | השכרה לטווח קצר | |
| management company | חברת ניהול | |
| service charge / communal fees | דמי ניהול / ועד בית | |
| mortgage | משכנתא | |
| payment plan | תוכנית תשלומים | |
| financing | מימון | auch Formularfeld |
| completion date | מועד מסירה | |
| quarter (Fertigstellung) | רבעון | Format `רבעון 3 2027` |
| handover | מסירה | |
| handover of the keys | מסירת המפתחות | vollständige Wendung |
| ceremonial handover | מסירה בטקס חגיגי | „ceremoniously" braucht den Zusatz |
| price from (inline, direkt an der Zahl) | החל מ- | `החל מ-€450,000`; der Bindestrich muss am Betrag kleben |
| price from (Caption auf eigener Zeile) | מחיר התחלתי | nur wo das Label allein steht oder durch `&nbsp;` von der Zahl getrennt ist (Hero der Development-Seite, `ProjectLink`, `BlogSlide`, `/c/[token]`). Sold-out-Variante: `נמכר במחיר התחלתי`. Siehe §6 |
| price on request | מחיר לפי פנייה | |
| on request (kurze Preiszelle) | לפי פנייה | wenn nur eine Zeile Platz ist |
| sold out | נמכר במלואו | Badge kurz: `נמכר` |
| available | זמין / זמינות | maskulin nur für das Projekt-Hero-Badge; für eine Einheit `זמינה` |
| reserved | שמור | für eine Einheit `שמורה` |

## 3. Aufenthalt, Steuern, Relocation, Zielgruppe

| Englisch | Hebräisch | Hinweis |
|---|---|---|
| permanent residency | תושבות קבע | Suchbegriff; Programm: `תושבות קבע דרך רכישת נדל"ן` |
| residence permit | אשרת שהייה / היתר שהייה | |
| golden visa (umgangssprachlich) | ויזת זהב | in Zypern offiziell „Permanent Residency" — beide Begriffe nennen, offiziell bevorzugen |
| EU citizenship | אזרחות אירופית | Zypern vergibt keine Staatsbürgerschaft durch Investment mehr — nie versprechen |
| member of the European Union | מדינה חברה באיחוד האירופי | als alleinstehender Bullet mit `מדינה`, sonst liest `חברה` zuerst als „eine Firma" |
| non-dom tax status | מעמד Non-Dom | lateinisch beibehalten, einmal erklären |
| tax resident | תושב מס | |
| tax system | מערכת מס | |
| double taxation treaty | אמנת מס | Israel–Zypern: `אמנת המס בין ישראל לקפריסין` |
| relocation | רילוקיישן | Suchbegriff (170/Mon.); formeller: `העתקת מגורים` — für Chips zu lang |
| cost of living | יוקר המחיה | |
| quality of life | איכות חיים | |
| standard of education | רמת חינוך | |
| international school | בית ספר בינלאומי | |
| healthcare (GESY) | מערכת הבריאות (GESY) | das zyprische System namentlich |
| healthcare system (allgemein) | מערכת בריאות | ohne Artikel, wenn kein konkretes System gemeint ist |
| sunny days a year | ימי שמש בשנה | |
| Israeli community | הקהילה הישראלית | |
| expats | תושבים זרים / זרים | nicht „אקספטים" |
| buyers | רוכשים | nicht `קונים` (Einzelhandel) |
| international clients / buyers from abroad | רוכשים מחו"ל | |
| investor | משקיע | Plural משקיעים |
| investment | השקעה | `השקעה בנדל"ן בקפריסין` |
| investment property | נכס להשקעה | Kategorie-Chip |
| capital appreciation | עליית ערך | |
| secure investment | השקעה בטוחה | nur mit Vorsicht, keine Zusicherung |

## 4. Marke, Navigation, UI-Chrome

| Englisch | Hebräisch | Hinweis |
|---|---|---|
| Cyprus VIP Estates | Cyprus VIP Estates | immer lateinisch, nie umschreiben |
| Home | דף הבית | |
| Projects | פרויקטים | Navigationslabel |
| Developers | יזמים | |
| Blog / Insights | בלוג | Eyebrow über dem Blog-H1: `הבלוג` |
| Case studies | סיפורי לקוחות | H1 und Navigation; nicht „מקרי בוחן". Eyebrow darüber: `סיפורי הצלחה` (§4.5) |
| About us | עלינו | Slug bleibt `about-us` |
| Contact | צור קשר | Menü-Label; Nominal ist hier akzeptierter Standard. CTA auf einer Personenkarte: `ליצירת קשר` |
| FAQ | שאלות ותשובות | **nur Navigationslabel.** Als Überschrift über einem Akkordeon: `שאלות נפוצות` |
| Partners | שותפים | nicht übersetzt in Phase 1 |
| Privacy policy | מדיניות פרטיות | |
| Cookie policy | מדיניות העוגיות | Cookies = עוגיות |
| Terms and conditions | תנאי שימוש | |
| Search | חיפוש | |
| Filter | סינון | Plural der Einzelfelder: `מסננים` (§4.1) |
| Map | מפה | |
| List | רשימה | |
| Show more | הצגת עוד | Pagination-Control, nominal |
| Show less | הצגת פחות | Gegenstück zu `הצגת עוד`; nicht verwenden: `הצגה מצומצמת` |
| Back | חזרה | |
| Next / Previous (Pagination) | הבא / הקודם | |
| Read more | קריאה נוספת | |
| Download brochure | הורדת חוברת | |
| Request a call | לקבל שיחה מיועץ | |
| Get consultation (Header-CTA) | לקבלת ייעוץ | Kurzform des CTA-Standards §5 für den schmalen Header-Button |
| Book a consultation | לקבוע פגישת ייעוץ | |
| WhatsApp us | לכתוב לנו בוואטסאפ | WhatsApp = וואטסאפ |
| Send | שליחה | Button nominal |
| Newsletter | ניוזלטר | nicht verwenden: `דיוור` (Marketer-Jargon für die versendende Branche) |
| Skip to main content | דלג לתוכן הראשי | a11y, bereits im Code |
| Language (Switcher) | שפה | Label des Hebrew-Eintrags: עברית |
| Scroll (Hinweis im Hero) | גלילה | nominal; derzeit nicht gerendert, als Regressionsschutz übersetzt |
| More in this section | עוד בנושא זה | Schriftregister `זה`, nicht `הזה` |
| You may also be interested in | אולי יעניין אתכם גם | |
| 404-Headline | לא מצאנו את הדף | ruhige Aussage, kein Wortspiel; die Komponente vergoldet das letzte Wort — der Akzent liegt auf `הדף` |
| Sold out badge | נמכר | |
| New badge | חדש | |
| Featured (Badge an einem einzelnen Objekt) | מובחר | **nur Badge** |
| featured (Auswahl, Plural) | נבחרים | z. B. H2 `פרויקטים נבחרים בקפריסין`; `מובחר` taugt dafür nicht |
| From (price) | החל מ- | siehe §2 zur Caption-Variante |
| per month | לחודש | |
| sqm | מ"ר | |
| Completion | מסירה | |
| Distance to beach / airport / centre | מרחק מהחוף / משדה התעופה / מהמרכז | |
| minutes | דקות | `10 דקות ברכב`; Kurzform auf engen Chips: `דק'` (§4.2) |
| km | ק"מ | |

### 4.1 Filter, Sortierung, Listen

| Englisch | Hebräisch | Hinweis |
|---|---|---|
| All (Filter-Tab / Chip) | הכל | **verbindlich in allen Fundstellen** (Projekte, Blog, FAQ, Kontakt, About). nicht verwenden: `הכול` — cross-WP-Entscheidung zugunsten der Wortgleichheit (§11.6), siehe §7 |
| Any location / Any type / Any beds (Placeholder) | כל הערים / כל הסוגים / הכל | Feld-Label ist `עיר` mit drei Städten, deshalb `כל הערים` und nicht `כל האזורים` (`אזור` ist dreifach belegt). `הכל` für „Any beds" ist die bewusste Ausnahme vom `כל ה…`-Muster (Chip-Breite) |
| Please choose… (Select-Placeholder) | בחרו… | männl. Plural; Nominalform wirkt hier unnatürlich |
| Reset (Filter) | איפוס | nominal, kein Imperativ |
| More filters / Hide filters | עוד מסננים / הסתרת מסננים | beide Zustände indefinit, die Determination darf nicht springen |
| Sort by | מיון לפי | `aria-label` |
| Recommended (Sortierung) | מומלצים | maskulin Plural, Bezug `פרויקטים` |
| Price · low to high / high to low | מחיר: מהנמוך לגבוה / מהגבוה לנמוך | Doppelpunkt statt Mittelpunkt |
| Min price / Max price (`aria-label`) | מחיר מינימלי / מחיר מקסימלי | **dokumentierte Ausnahme:** die Substantive `מינימום`/`מקסימום` sind verworfen (§4.3), die Adjektivform ist das, was israelische Portale im Preisfilter schreiben |
| Cards / Table (Ansichts-Umschalter) | כרטיסים / טבלה | |
| View project | לצפייה בפרויקט | nicht `צפה בפרויקט` |
| Open project (Karten-Popup) | מעבר לפרויקט | |
| Show all projects (Link im Listenkopf) | לכל הפרויקטים | zwei Wörter, Link neben einem Pfeil |
| View all projects (Hero-Button) | לצפייה בכל הפרויקטים | bewusst anders als der Listenkopf-Link |
| Show all case studies | לכל סיפורי הלקוחות | verbindlich; nicht verwenden: `לקריאת כל סיפורי הלקוחות` |
| Similar projects | פרויקטים דומים | nur wo Ähnlichkeit tatsächlich berechnet wird |
| View tour (3D-/Virtual-Tour-Link) | לסיור וירטואלי ↗ | |
| Factsheet PDF | דף נתונים PDF | en/de/pl/ru lassen „Factsheet" englisch; für `he` unlesbar |

### 4.2 Karte, Standort, Entfernungen

| Englisch | Hebräisch | Hinweis |
|---|---|---|
| min (Kurzform Minuten) | דק' | nur in Distanz-Chips; ausgeschrieben `דקות` im Fließtext und in Meta-Zeilen |
| Golf course | מגרש גולף | EN-Quelle schreibt „Golf court" — im Hebräischen stillschweigend korrigiert |
| Hospital | בית חולים | |
| Shops | חנויות | folgt der englischen Quelle, nicht dem deutschen „Supermarkt" |
| Supermarkets / Pharmacies / Clinics (POI-Layer) | סופרמרקטים / בתי מרקחת / מרפאות | Plural wie in der EN-Quelle |
| Public / private school | בית ספר ציבורי / בית ספר פרטי | |
| LIFE NEARBY (Eyebrow über der POI-Leiste) | החיים בסביבה | Hebräisch kennt keine Versalien |
| Zoom (Kartenbedienung) | זום | `שינוי מרחק תצוגה` wäre Behördensprache |
| Coordinates / Copy / Copied | קואורדינטות / העתקה / הועתק ללוח | ohne Ausrufezeichen; `הועתק` kongruiert nicht mit `קואורדינטות` (fem. Pl.), deshalb die bezugsfreie Form mit Zielangabe |
| Open in Google Maps / OSM | פתיחה ב-⁨Google Maps⁩ / פתיחה ב-⁨OSM⁩ | nominal (`פתיחה ב-`), Produktname lateinisch **und bidi-isoliert**, Präposition mit Bindestrich. Wortgleich in `PropertyMap.tsx`, `ProjectsMapAll.tsx` und auf der Kontaktseite |
| Explore on the map | לצפייה במפה | `לחקור` wäre eine Kalkierung von „explore" |
| Location (Stat-Label) | מיקום | nicht `אזור` — der Wert kann eine Stadt sein |

### 4.3 Formulare, Validierung, Statusmeldungen

| Englisch | Hebräisch | Hinweis |
|---|---|---|
| Leave your details (Formular-Headline) | השאירו פרטים | stehende israelische Lead-Formel. nicht verwenden: `השאירו פנייה` (Kalkierung von «Оставьте заявку») |
| enquiry / request (Lead, Substantiv) | פנייה | als Substantiv weiterhin gültig, z. B. `לא הצלחנו לשלוח את הפנייה` |
| Your name / Email / Phone | שם מלא / אימייל / טלפון | Formularlabels nominal, kein Genus |
| first name / surname | שם פרטי / שם משפחה | |
| Country | מדינה | `FormPartners` |
| nationality | אזרחות | Optionsliste (`QualificationForm.NATIONALITIES`): `ישראלית / גרמנית / בריטית / פולנית / רוסית / אוקראינית / אחר`; `ישראלית` steht als erste Option (Wire-Value `"Israeli"`) |
| Message | הודעה | |
| Budget | תקציב | |
| budget range | טווח תקציב | |
| timeline (Formularfeld) | לוח זמנים | |
| financing (Formularfeld) | מימון | |
| Preferred language | שפה מועדפת | |
| preferred contact method | דרך התקשרות מועדפת | |
| phone call (Kontaktweg) | שיחת טלפון | |
| Your email (Placeholder) | האימייל שלכם | |
| (optional) | (לא חובה) | Suffix am Formularlabel |
| required fields | שדות חובה | `יש למלא את שדות החובה.` |
| I agree to the privacy policy | אישור מדיניות הפרטיות | **nominal, verbindlich.** Die Schrägstrich-Form (`קראתי את מדיניות הפרטיות ואני מאשר/ת`) ist die Notlösung für den Fall, dass kein Nominalstil möglich ist (Styleguide §2.3) — hier ist er möglich |
| Consent is required / Consent required | נדרש אישור / חובה לאשר | `FormStatic`, zwei unterscheidbare Validierungsmeldungen |
| Invalid email address | כתובת אימייל לא תקינה | `FormStatic`; im Newsletter dagegen `יש להזין כתובת אימייל תקינה.` (die EN-Quelle sagt dort „Please enter a valid…") |
| „at least N characters" (Validierung) | `לפחות ${n} תווים` / `עד ${n} תווים` | Muster für alle Längenvalidierungen; ersetzt `מינימום`/`מקסימום` als überflüssige Fremdwörter |
| Send request (Button) | שליחת בקשה | `QualificationForm`, bewusste Abgrenzung zu `שליחה` (§4) |
| Sending… (Button-Status) | שולחים… | Partizip Plural, genusfrei. **nicht verwenden: `בשליחה…`** oder irgendein `ב` + Verbalnomen als Zustandsangabe |
| Loading… / Loading map… | טוענים… / טוענים את המפה… | dieselbe Regel wie `שולחים…`; nicht verwenden: `בטעינה…` |
| Thank you, we will contact you shortly | תודה, ניצור קשר בהקדם | |
| Something went wrong | משהו השתבש, נסו שוב | |
| Cookie consent (Accept all / Only necessary / Settings) | אישור הכל / רק הנחוצות / הגדרות | Cookies = עוגיות; Kurzform `אישור הכל` statt `אישור כל העוגיות`, ausbalanciert neben dem 10-Zeichen-Button `רק הנחוצות` |

### 4.4 Blog und Artikel

| Englisch | Hebräisch | Hinweis |
|---|---|---|
| Cyprus Insights (Blog-H1) | תובנות מקפריסין | zugleich Back-Link im Artikel-Kicker. Der Goldakzent fällt wegen der Smichut auf `מקפריסין` statt auf das Substantiv; siehe §6 |
| The Journal (Eyebrow) | הבלוג | `יומן` liest sich wie ein Tagebuch |
| article / articles | מאמר / מאמרים | nicht `פוסט` (Blogger-Jargon), nicht `כתבה` (Journalismus) |
| articles are in English (Zählzeile) | מאמרים באנגלית | `12 מאמרים באנגלית`; Singular als Phrase `מאמר אחד באנגלית` (ohne Ziffer), Nullfall `אין עדיין מאמרים` |
| No articles yet. | אין עדיין מאמרים. | kein Ausrufezeichen |
| Read (Karten-CTA) | לקריאה | ein Wort, genusfrei |
| Read article (Featured-CTA) | לקריאת המאמר | mit Objekt, damit er sich vom Karten-CTA unterscheidet |
| Load {n} more posts | הצגת עוד {n} מאמרים | Nominalform wie `הצגת עוד` (§4) |
| Categories (aria) | קטגוריות | |
| Blog pagination (aria) | ניווט בין עמודי הבלוג | beschreibende a11y-Bezeichnung |
| First page / Last page | מעבר לעמוד הראשון / מעבר לעמוד האחרון | Handlungsform am `<a>`, nicht das Substantiv |
| Page {n} | עמוד {n} | wortgleich mit dem Catch-all-Suffix `, עמוד {n}` (Komma, Ziffer LRI/PDI-isoliert) |
| min read | דקות קריאה | bei n = 1: `דקת קריאה אחת`. Bewusst die Langform (Meta-Zeile), anders als `דק'` auf den engen Distanz-Chips |
| On this page (TOC) | תוכן העניינים | nicht `בעמוד הזה` (Kalkierung) |
| Written by | מאת | ein Wort, genusfrei, kein Passiv; nicht `נכתב על ידי` |
| Related reading | עוד + מאמרים | zweiteilig; der Goldakzent gehört auf das Substantiv `מאמרים` |
| Recommended properties | נכסים מומלצים | Fallback-Überschrift des Projektblocks im Artikel |
| Recommended properties in {city} | נכסים מומלצים ב-⟦FSI⟧{city}⟦PDI⟧ | solange die Route den **lateinischen** Städtenamen einsetzt. Sobald `hePlaces.ts` den Wert umschreibt: `נכסים מומלצים ב{city}` ohne Bindestrich und ohne Isolation |
| The Guide (Eyebrow) | המדריך | Eyebrow des SEO-/Content-Blocks unter der Liste |
| Inside the Journal (Titel desselben Blocks) | נדל"ן בקפריסין, בקצרה | der Block rendert `blogPage.content`, also SEO-Fließtext; `על הבלוג` versprach eine „Über uns"-Sektion. Siehe §6 |
| Your guide to … | המדריך שלכם ל… | |

### 4.5 Case Studies

| Englisch | Hebräisch | Hinweis |
|---|---|---|
| Success Stories (Eyebrow über der H1) | סיפורי הצלחה | Controller-Entscheidung; H1 darunter bleibt `סיפורי לקוחות`. Die WP6-Variante `מהשטח` wird **nicht** verwendet (§7) |
| case study (Einzelfall) | סיפור לקוח | Plural und Nav-Label: `סיפורי לקוחות` (§4) |
| Read the story (Mockup-CTA) | לקריאת הסיפור | |
| Read the full story (Karten-CTA) | לסיפור המלא | bewusst ohne Wurzelwiederholung zu `לקריאת הסיפור` |
| The Journey (Label über der Sticky-TOC) | שלבי התהליך | `המסע` ist Reisevokabular und würde neben „Zypern" als Urlaub gelesen |
| Client Situation | רקע הלקוח | `המצב של הלקוח` klingt nach Fallakte |
| Client Requirements | דרישות הלקוח | |
| Our Solution | הפתרון שלנו | |
| Selected Property | הנכס שנבחר | Passiv-Partizip; `הנכס הנבחר` hieße „der auserwählte" |
| Result | התוצאה | mit Artikel, Überschrift des letzten Abschnitts |
| Location (Stat-Label) | מיקום | |
| Property (Stat-Label, Wert = Objekttyp) | סוג הנכס | der Wert darunter ist der **Typ**; `נכס` allein ist als SEO-Wert belegt (§2) |
| Related Properties | עוד + נכסים | wortgleich an beiden Fundstellen; nicht `נכסים דומים` — die Karten sind redaktionell verknüpft, nicht berechnet |
| Considering your own move? | שוקלים מהלך דומה? | `מהלך` deckt Umzug und Kaufschritt ab |
| Ready to write your own …? | מוכנים לכתוב סיפור משלכם? | auf Hebräisch wird der Satz zu Ende gebracht |
| Request Personal Offer | לקבלת הצעה אישית | parallel zum Header-CTA `לקבלת ייעוץ` |
| Understanding Case Studies | איך לקרוא סיפורי לקוחות | letztes Wort wird vergoldet, deshalb Ende auf `לקוחות` |
| A Cyprus property success story (Fallback) | סיפור הצלחה של רוכשים בקפריסין | nur sichtbar, wenn keine Case Study veröffentlicht ist |

### 4.6 Startseite, Über uns, Kontakt, FAQ, Developers

| Englisch | Hebräisch | Hinweis |
|---|---|---|
| Cyprus Property Experts (Hero-H1) | מומחי נדל"ן בקפריסין | trägt den Hub-Term `נדל"ן בקפריסין` (320/Mon.) wörtlich; Akzent auf `נדל"ן` |
| Why … choose us | בוחרים בנו | H2 `למה רוכשים מישראל בוחרים בנו`; Verb + gebundenes Pronomen als **eine** Akzenteinheit |
| Frequently asked questions (Überschrift) | שאלות נפוצות | Menü-Label bleibt `שאלות ותשובות` (§4) |
| Expand all / Collapse all | פתיחת הכל / סגירת הכל | nominal; zweiter Bestandteil folgt der `הכל`-Entscheidung (§4.1) |
| Support (Rubrik-Eyebrow) | תמיכה | FAQ-Hero |
| review / testimonial (Kundenstimme) | המלצה / המלצות | **nicht verwenden: `חוות דעת`** (professionelles Gutachten) und `ביקורות` (Sterne-/Portalbewertungen) |
| Read full review | לקריאת ההמלצה המלאה | drei Wörter, nominal |
| consultant (Berater der Agentur) | יועץ / יועצים | nicht `נציג` (Callcenter) |
| point of contact | איש קשר | Eyebrow über einem Personen-Grid im Plural: `אנשי הקשר שלכם` |
| Contact (Button auf einer Personenkarte) | ליצירת קשר | Menü-Label bleibt `צור קשר` (§4) |
| Speaks (Label über einer Sprachliste) | שפות | ein Verb (`מדבר`/`מדברת`) würde jeder Karte ein Geschlecht aufzwingen; `דוברים` klingt auf einer Einzelkarte falsch |
| language names (Chips) | אנגלית · גרמנית · רוסית · פולנית · ספרדית · צרפתית · הולנדית · יוונית · קזחית · אוזבקית | Akademie-Standardformen (`הולנדית`, nicht `נדרלנדית`) |
| office (eigener Standort) | המשרד שלנו | `משרד` allein ist als Objekttyp belegt (§2) |
| Working hours | שעות פעילות | `שעות עבודה` wäre die Arbeitszeit der Mitarbeiter, gemeint ist die Erreichbarkeit |
| Open now / Closed right now / Opens at | פתוח עכשיו / סגור כרגע / נפתח ב- | Subjekt ist das Büro, kein Genusproblem |
| Cyprus time (Zeitzone) | שעון קפריסין | wie `שעון ישראל` |
| Direct lines (Rubrik-Eyebrow) | קווים ישירים | siehe §6 |
| Core values | ערכי הליבה | `ליבה` ist der geläufigere Unternehmenssprech ohne Pathos |
| Integrity | יושרה | `כנות` wäre nur „Offenheit" |
| Sustainability | קיימות | |
| AI / AI-assisted | בינה מלאכותית / בעזרת בינה מלאכותית | ausgeschrieben; `בינ"מ` ist ungebräuchlich |
| full-service (Agenturbeschreibung) | בשירות מלא | siehe §6 |
| full-service support (Leistung am Käufer) | ליווי מלא | `ליווי` ist im israelischen Immobilienkontext das Wort für die Begleitung des Käufers |
| after-sales support | תמיכה אחרי הרכישה | nicht `שירות לאחר מכירה` (Handelsjargon für Geräte) |
| moving-in service | ליווי במעבר | gilt auch für Villen; nicht `שירותי כניסה לדירה` |
| developer page (Einzelseite) | עמוד ייעודי | |
| Developers-Meta-Title | יזמי נדל"ן בקפריסין \| Cyprus VIP Estates | nur `<title>`; die H1 bleibt ohne Marke, damit der Goldakzent auf `בקפריסין` liegt |

## 5. Standardformulierungen (Boilerplate)

| Zweck | Hebräisch |
|---|---|
| Beratungssprache (Entscheidung E) | הייעוץ מתקיים באנגלית או ברוסית; פנייה בעברית מתקבלת בברכה. |
| Rechtsvorbehalt | המידע אינו מהווה ייעוץ משפטי או מס. בכפוף לבדיקה פרטנית. |
| Maßgeblichkeit (Legal) | הנוסח האנגלי הוא המחייב. |
| Preisvorbehalt | המחירים עשויים להשתנות. הזמינות מתעדכנת מול היזם. |
| Unternehmensbeschreibung (kurz) | Cyprus VIP Estates היא סוכנות נדל"ן בקפריסין המתמחה בפרויקטים חדשים של יזמים מובילים בלימסול ובפאפוס. |
| Nähe zu Israel | כ-45 דקות טיסה מתל אביב, כמה טיסות ביום. |
| CTA Standard | לקבל שיחה מיועץ · לצפייה בזמינות ובמחירים · לכתוב לנו בוואטסאפ |
| WhatsApp-Vorbelegung (der Besucher spricht, 1. Person Singular, genusfrei) | שלום, אשמח לקבל מידע על רכישת נכס בקפריסין. תוכלו לעזור לי למצוא וילה או דירה מתאימה? |
| Versand fehlgeschlagen (wortgleich in `formFeedbackCopy.ts` und `QualificationForm.tsx`) | לא הצלחנו לשלוח את הפנייה. אפשר לנסות שוב, או ליצור איתנו קשר באימייל … או בטלפון … |
| Newsletter-Bestätigung (wortgleich in `NewsletterForm.copy.ts` und `Footer/FooterNewsletter.tsx`) | ההרשמה לניוזלטר הושלמה. |
| Datenschutzhinweis Case Studies (wortgleich in `privacyNote` und `CASE_STUDY_INTRO_COPY.disclaimer`) | פרטיות הלקוחות קודמת לכל, ולכן מידע עסקי רגיש ונתונים מזהים אינם נחשפים בסיפור זה. |
| Öffnungszeiten (Muster, wortgleich in `hoursValue`, `heroLead`, `metaDescription`) | מדי יום, 9:00 עד 18:00 |

Regeln zu diesen Zeilen: kein Bis-Strich in Zeitangaben (`עד` ausgeschrieben), `בסיפור זה` im Schriftregister statt `בסיפור הזה`, und jeder duplizierte String bleibt an allen Fundstellen wortgleich (Styleguide §11.6).

## 6. Für den Lektor (Pass C) markiert

Nur die Punkte, die die Kritik-Pässe ausdrücklich dem muttersprachlichen Lektor überlassen haben. Alles andere in diesem Dokument ist entschieden.

| ⚠ Term / Frage | Aktuell verbindlich | Alternative(n) | Sichtbar auf |
|---|---|---|---|
| „Price from" als Caption | מחיר התחלתי | (a) Komponente ändern (`&nbsp;` raus) und `החל מ-` direkt am Betrag, (b) `מחירים מ-`, (c) belassen | Hero `/he/projects/<slug>`, `ProjectLink`-Karte, `BlogSlide`-Preiszeile, `/c/[token]`. Grund der Vorlage: `מחיר התחלתי` ist im Israelischen zuerst der Eröffnungspreis einer Auktion (`מחיר התחלתי במכרז`) |
| Unit-Status Genus-Split | Einheit fem. `זמינה / שמורה / נמכרה`, Projekt-Badge mask. `זמין` | durchgehend maskulin, oder Hero-Badge ebenfalls feminisieren | Einheitentabelle und Status-Pill auf `/he/projects/<slug>`; Hero-Badge derselben Seite |
| `נכסים למכירה` vs. `דירות למכירה` | נכסים למכירה | `דירות למכירה` (140/Mon.), `דירות ווילות למכירה` | `Cities.tsx`-H2 auf `/he`. Gegen `דירות למכירה` spricht die Kannibalisierung der geplanten Spoke-Seite `/he/apartments-for-sale-cyprus` |
| `קווים ישירים` (Direct lines) | קווים ישירים | ישירות אלינו | Rubrik-Eyebrow `/he/contacts`; die Rubrik enthält auch WhatsApp und E-Mail, nicht nur Durchwahlen |
| `בשירות מלא` (full-service) | בשירות מלא | כסוכנות שיווק נדל"ן עם מעטפת מלאה | `/he/about`, Stats-Zeile; im israelischen Agentur-Sprech nicht etabliert |
| Goldakzent im Blog-H1 | תובנות מקפריסין (Akzent auf `מקפריסין`) | 1-Wort-Titel `תובנות`, dann ist der Akzent der ganze Titel | `/he/blog` H1 und Artikel-Kicker; in en/de/pl/ru trägt das Substantiv den Akzent, nie das Land |
| `נדל"ן בקפריסין, בקצרה` | so belassen | am echten `he`-`blogPage.content` gegenprüfen | Titel des SEO-Blocks unter der Blogliste |
| Umschrift kleiner Orte | §1-Formen | | `Tala`, `Kissonerga` und die WP2-Feed-Ortsnamen bestätigen |
| `פרויקט` vs. `בניין` | פרויקט | בניין für kleine Mehrfamilienbauten | Projektkarten und Development-Seiten |
| `וילה` vs. `בית פרטי` in Titeln | nach Objekttyp | | Volumen entscheidet (Keyword-Map) |

## 7. Änderungsprotokoll

### 2026-09-13 — Konsolidierung WP1–WP6 (Task 11, Teil 1)

**Zusammengeführt:** `docs/i18n/reviews/wp2-glossary.md`, `wp3-glossary.md`, `wp4-glossary.md`, `wp5-glossary.md`, `wp6-glossary.md` sowie das bisherige §6.1 („Neu aus WP1"). Alle mit Pass-B-Verdikt „keep"/„change" versehenen Zeilen stehen jetzt thematisch in §1–§5; gestrichene Zeilen sind nicht übernommen. Die wpN-Dateien bleiben als Audit-Trail mit den vollständigen Begründungen erhalten. WP7 ist bewusst **nicht** eingearbeitet (laufende Fix-Runde).

**Strukturänderung:** §4 hat Untertabellen bekommen (4.1 Filter/Listen, 4.2 Karte, 4.3 Formulare/Status, 4.4 Blog, 4.5 Case Studies, 4.6 Seitenrubriken). §6 ist von „Offene Begriffe" zu „Für den Lektor (Pass C) markiert" geworden; §6.1 ist aufgelöst.

**Aufgelöste Divergenzen (eine verbindliche Form je EN-Term):**

| EN-Term | Konkurrierende Formen | Verbindlich | Grund |
|---|---|---|---|
| All (Filter) | WP2/WP5 `הכל` · WP4 `הכול` | `הכל` | Controller-Entscheidung; Wortgleichheit über `/he/projects`, `/he/blog`, `/he/faq`, `/he/contacts`, `/he/about` (§11.6) |
| Open in Google Maps / OSM | WP2 `פתיחה ב-Google Maps` (ohne Isolat) · WP5 mit Bidi-Isolat | `פתיחה ב-⁨Google Maps⁩` | Nominalform aus WP2 plus Bidi-Isolation aus WP5 |
| Show all case studies | WP3 `לכל סיפורי הלקוחות` · WP5 `לקריאת כל סיפורי הלקוחות` | `לכל סיפורי הלקוחות` | Link im Listenkopf neben einem Pfeil, zwei Wörter |
| Success Stories (Eyebrow) | WP6 `מהשטח` | `סיפורי הצלחה` | Controller-Entscheidung. WP6s Einwand (Wurzelwiederholung zur H1 `סיפורי לקוחות`) bleibt im Audit-Trail dokumentiert |
| developer | WP4 Pass A `חברות בנייה` | `יזם / חברה יזמית / יזמים` | `חברות בנייה`/`קבלן` ist der ausführende Bauunternehmer; in `he-keywords.csv` null Treffer |
| Sending… / Loading… | `בשליחה…` / `בטעינה…` | `שולחים…` / `טוענים…` | `ב` + Verbalnomen als Zustandsangabe existiert im israelischen UI nicht (Styleguide §11.2) |
| Price from | `החל מ-` · `מחיר התחלתי` | beides, kontextgetrennt | `החל מ-` inline direkt am Betrag, `מחיר התחלתי` nur wo die Caption allein steht (§2, §6) |
| Consent-Zeile | Schrägstrich-Form | `אישור מדיניות הפרטיות` | Nominalstil ist hier möglich, also verbindlich |
| testimonial | `חוות דעת` · `ביקורות` | `המלצות` | drei getrennte Register; der Slider zeigt Kundenstimmen |
| newsletter | `דיוור` | `ניוזלטר` | `דיוור` ist die Sprache der versendenden Branche, nicht des Empfängers |
| (optional) | `(אופציונלי)` | `(לא חובה)` | |
| Leave your details | WP1 `השאירו פנייה` | `השאירו פרטים` | `השאירו פנייה` ist eine Kalkierung von «Оставьте заявку»; `פנייה` bleibt als Substantiv gültig |
| Featured | §4 `מובחר` für alles | `מובחר` (Badge) · `נבחרים` (Auswahl, Plural) | `מובחר` taugt nur am einzelnen Objekt |
| FAQ | §4 `שאלות ותשובות` für alles | `שאלות ותשובות` (Nav) · `שאלות נפוצות` (Überschrift) | |
| Contact | §4 `צור קשר` für alles | `צור קשר` (Menü) · `ליצירת קשר` (CTA/Personenkarte) | |
| Any location (Placeholder) | `כל האזורים` | `כל הערים` | Das Feld heißt `עיר` und listet drei Städte; `אזור` ist dreifach belegt |
| minutes | `דק'` · `דקות` | beides, kontextgetrennt | `דק'` nur in engen Distanz-Chips, ausgeschrieben in Meta-Zeilen (`דקות קריאה`) |
| min/max (Preisfilter) | Substantive `מינימום`/`מקסימום` verworfen | Adjektive `מחיר מינימלי / מחיר מקסימלי` | dokumentierte Ausnahme, damit sie beim nächsten Durchlauf nicht zurückkippt |
| Property (Wert vs. Label) | WP2 `נכס` (SEO-Wert) · WP6 `נכס` (Stat-Label) | Label `סוג הנכס`, Wert `נכס` | der Stat-Wert ist ein Typ, nicht der Objektname |
| Related (Überschriften) | `נכסים דומים` · `פרויקטים דומים` | `עוד נכסים` (redaktionell verknüpft) · `פרויקטים דומים` (berechnet) | keine Ähnlichkeit behaupten, die die Daten nicht hergeben |
| Show more / Show less | `הצגה מצומצמת` | `הצגת עוד` / `הצגת פחות` | regelmäßiges Nominalpaar |

**Code-Angleichung erforderlich** (Folgeaufgabe; in diesem Commit wurde **kein** `src/`-File angefasst):

| Datei | Key / Zeile | Aktuell im Code | Verbindlich laut Glossar |
|---|---|---|---|
| `src/app/[lang]/blog/blogI18n.ts` | `filterAll` (Z. 86) | `הכול` | `הכל` (§4.1) |
| `src/app/components/BlogPostsRenderer/BlogPostsRenderer.tsx` | `he.filterAll` (Z. 37) | `הכול` | `הכל` (§4.1) |
| `src/app/preview-case-studies/[lang]/copy.ts` | `eyebrow` (Z. 231) | `מהשטח` | `סיפורי הצלחה` (§4.5) |

Alle übrigen in §1–§5 verbindlich gesetzten Formen entsprechen dem heutigen Stand von `src/` (geprüft: `שולחים…`, `טוענים…`, `פתיחה ב-`, `השאירו פרטים`, `לכל סיפורי הלקוחות`, `מחיר התחלתי`, `המלצות`, `ניוזלטר`, `(לא חובה)`, `כל הערים`, `שאלות נפוצות`; keine Treffer für `בשליחה`, `בטעינה`, `חברות בנייה`, `חוות דעת`, `דיוור`, `נדלן`, `מקרי בוחן`).
