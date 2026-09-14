# Hebräisches Glossar — Cyprus VIP Estates (`he`)

**Stand:** 2026-09-13 · verbindlich für alle `he`-Texte und als Prompt-Kontext für jeden Übersetzungs- und Generierungslauf (Projektbeschreibungen, Meta, Area-Texte).

**Konsolidiert am 2026-09-13:** Diese Datei ist die **eine verbindliche Liste**. Sie führt die Pass-A/Pass-B-Ergebnisse aus **WP1–WP7** zusammen (`docs/i18n/reviews/wp2-glossary.md` … `wp7-glossary.md`; jene Dateien bleiben als Audit-Trail mit den Begründungen erhalten, sind aber **nicht** mehr die Quelle). Wo zwei Arbeitspakete unterschiedliche hebräische Formen für denselben englischen Term vorschlugen, steht hier **eine** verbindliche Form; die unterlegene Variante ist als „nicht verwenden" vermerkt. Änderungen dokumentiert §7.

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
| off-market | נכסים שאינם מפורסמים | **nicht** `על הנייר` — off-market ≠ off-plan (Task-3-Pass-B M11: die beiden waren verwechselt). „Off-Market Opportunities" als Rubrik: `הזדמנויות בנכסים שאינם מפורסמים` |
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
| available units (Überschrift über der Einheitentabelle) | יחידות זמינות | Overlay der Präsentationsseite; Adjektiv feminin Plural, Bezug `יחידות` |
| unit table column heads (Unit · Type · Beds · Area · Price · Status) | יחידה · סוג · חד׳ שינה · שטח · מחיר · סטטוס | **dokumentierte Ausnahme:** im Spaltenkopf steht die israelische Anzeigenabkürzung `חד׳ שינה` (Geresh), nicht die ausgeschriebene Form — ausgeschrieben sind es 11 Zeichen in einer Spalte, deren EN-Vorlage 4 hat (WP7 Pass B S4). Überall sonst gilt weiter die ausgeschriebene Zählform der Zeile „bedrooms" unten; siehe §6 |
| no longer available (Unit-Status, aus dem Feed verschwunden) | לא זמינה עוד | ruhige Tatsache, keine Entschuldigung; feminin wie die drei anderen Status. Weicht bewusst von `heFeedLabel("unlisted")` = `לא בתצוגה` ab („nicht in der Anzeige" ≠ „gibt es nicht mehr"); siehe §6 |
| unit count (Zähler unter dem Preis) | יחידה / יחידות | Plural ab 2, kein Dual (`5 יחידות`). Zur Einzahl siehe §6 |
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
| viewing (Besichtigung vor Ort) | סיור בנכס | `צפייה בנכס` wäre das Anschauen von Fotos. Im Fließtext, wo der Bezug schon steht, genügt `סיור` (`תיאום סיור`, `closingTrust` der Präsentationsseite); **nicht verwenden: `ביקור`** — ein Besuch allgemein, nicht die Objektbesichtigung (WP7 Pass B S9) |
| title deed | טאבו / נסח טאבו | israelisches Äquivalent, in Zypern „Title Deed" — bei erster Nennung erklären: `שטר בעלות (Title Deed)` |
| land registry | רשם המקרקעין | |
| lawyer | עורך דין (עו"ד) | Zypern hat keinen Notar im deutschen Sinn |
| signing at the lawyer's | חתימה אצל עורך הדין | ersetzt „notary appointment" |
| sales agreement | חוזה מכר | |
| deal / transaction | עסקה | z. B. `עסקאות נדל"ן אמיתיות` |
| reservation deposit | דמי רצינות / פיקדון הרשמה | |
| stamp duty | מס בולים | |
| VAT (reduced 5%) | מע"מ (מופחת 5%) | nur mit Quelle |
| +VAT (an einer Preisangabe) | + מע"מ | mit Leerzeichen, oder `לא כולל מע"מ`; ohne Leerzeichen liest es sich als ein Wort. **nicht verwenden: `בתוספת מע"מ`** — WP7s Einwand galt der Form *ohne* Leerzeichen (`+מע"מ`), die auch hier ausgeschlossen ist; mit Leerzeichen liegt das Pluszeichen als Neutralzeichen zwischen LTR-Betrag und RTL-Wort und landet richtig. Wortgleich in `developmentCopy.ts` und auf der Präsentationskarte; siehe §6 und §7 |
| transfer fees (Grundbuch-Übertragungsgebühr) | דמי העברה | die staatliche Gebühr beim Eigentumsübergang. **Nicht** `מס העברה` (das wäre eine Steuer, die Quelle sagt „fees") |
| bank transfer fees / remittance charges | עמלות ההעברה | Bankgebühr bei Auslandsüberweisung und Währungsumtausch. **Bewusste Abgrenzung zu `דמי העברה`** — beides heißt im EN „transfer fees", meint aber zwei verschiedene Kosten; im selben Text nie vermischen (Fix-Runde 1 `c-faq`, Pass B Terminology) |
| immovable property tax | (abgeschafft, national) | laut `faq:are-annual-property-taxes-payable-in-cyprus` darf erwähnt werden, dass die nationale Grundsteuer abgeschafft ist — aber nur zusammen mit dem Hinweis, dass kommunale/lokale Abgaben je nach Standort weiterhin möglich sind; nicht als „gibt es keine Steuer mehr" ohne diese Einschränkung darstellen |
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
| foreign buyers (zyprische Rechtskategorie) | רוכשים זרים | wo das EN „foreigners"/„foreign buyers" im Rechtssinn meint: Genehmigung der `מועצת השרים`, Nicht-EU-Status, Kreditvergabe an Nicht-Ansässige. Non-EU präzise: `רוכשים שאינם אזרחי האיחוד האירופי` — `אזרחי`, nicht `תושבי`, solange das EN „citizens" sagt |
| international clients / buyers from abroad | רוכשים מחו"ל | nur als **Marktgruppe**, wo das EN „international"/„overseas buyers" sagt (Nachfrage, Investorenprofile). Nicht dort, wo es um den Rechtsstatus geht — dann `רוכשים זרים` |
| buyers (Leseransprache im Seiten-Chrome) | רוכשים מישראל | wo der Text den Leser direkt anspricht (H1, Meta, Intro, CTA). **Nicht** in 1:1 aus dem EN übersetzten Fließtext-Aussagen in der dritten Person — das wäre ein Zusatz gegenüber der Quelle (Entscheidung Fix-Runde 1 `c-faq`) |
| investor | משקיע | Plural משקיעים |
| investment | השקעה | `השקעה בנדל"ן בקפריסין` |
| investment property | נכס להשקעה | Kategorie-Chip |
| capital appreciation | עליית ערך | |
| secure investment | השקעה בטוחה | nur mit Vorsicht, keine Zusicherung |

### 3.1 Finanzen, Rendite, Transaktion (ROI-Rechner und Ergebnis-Mail)

Die Rechner-Oberfläche (`RoiInputs`, `RoiResults`, `RoiChart`, `ModalRoiCalculator`) und die Ergebnis-Mail (`/api/roi-calculator`) teilen sich diese Terme; jeder doppelt vorkommende String bleibt an beiden Fundstellen wortgleich (Styleguide §11.6).

| Englisch | Hebräisch | Hinweis |
|---|---|---|
| ROI Calculator | מחשבון תשואה | Modal- und Rechnertitel. Das Akronym „ROI" hat in hebräischer Endkundensprache keine Verbreitung; `תשואה` ist zugleich der Suchbegriff (§2) |
| ROI / return | תשואה | durchgehend, auch als Kurzlabel im Ergebnisblock (`ROI: 42.0%` → `תשואה: 42.0%`); en/de/pl/ru behalten `ROI` |
| average annual ROI | תשואה שנתית ממוצעת | Ergebniszeile **und** Ergebnis-Mail |
| total net return | תשואה נטו כוללת | Highlight bei Buy-&-Hold |
| net profit from resale | רווח נטו ממכירה | Highlight bei Buy-&-Sell |
| conservative · realistic · optimistic | שמרני · ריאלי · אופטימי | Szenario-Tabs **und** Ergebnis-Mail |
| Buy & Sell / Buy & Hold | רכישה ומכירה / רכישה והחזקה | nur `he` übersetzt die beiden Fachbegriffe; en/de/pl/ru zeigen sie weiterhin englisch |
| property price | מחיר הנכס | Eingabefeld |
| furnishing cost / furnishing | עלות ריהוט / ריהוט | Eingabefeld / Ergebniszeile |
| build period | תקופת בנייה | Eingabefeld |
| annual off-plan growth | עליית ערך שנתית בשלב הבנייה | `על הנייר` (§2) ist die Kaufform; hier geht es um die Bauphase |
| off-plan value growth | עליית ערך בשלב הבנייה | Ergebniszeile, dieselbe Wendung ohne „jährlich" |
| selling costs | עלויות מכירה | Eingabefeld und Ergebniszeile, wortgleich |
| rental parameters | נתוני השכרה | Abschnittsüberschrift |
| net yield (year 1) | תשואה נטו (שנה 1) | Eingabefeld |
| annual rent growth | עליית שכירות שנתית | Eingabefeld |
| rental period after completion | תקופת השכרה לאחר המסירה | `מסירה` = Handover (§2) |
| annual appreciation | עליית ערך שנתית | Eingabefeld; mit dem Zusatz `בשלב הבנייה` ist die Bauphase gemeint |
| horizon | אופק ההשקעה | `אופק` allein steht im Hebräischen nicht als Finanzbegriff |
| purchase cost (with fees) | עלות הרכישה (כולל עמלות) | Ergebniszeile |
| total entry cost | עלות כניסה כוללת | Ergebniszeile **und** Ergebnis-Mail |
| estimated value at completion | שווי משוער במסירה | Ergebniszeile |
| estimated value in final year | שווי משוער בשנה האחרונה | Ergebniszeile |
| rental cash flow | תזרים משכירות | `תזרים מזומנים` gekürzt, weil die Quelle „rental cash flow" ist |
| capital gain | רווח הון | §2 kennt `מס רווחי הון`; hier ohne Steuer |
| property value (Diagrammlegende) | שווי הנכס | |
| cumulative rental income | הכנסה מצטברת משכירות | Diagrammlegende; im Diagrammtitel kurz `הכנסה משכירות` |
| total profit | רווח כולל | Diagrammlegende |
| amount (EUR) | סכום ב-EUR | y-Achse, **ohne Klammerpaar**: Recharts rendert das Achsenlabel in ein `<text>` ohne eigenes `dir`, und Klammern um einen LTR-Lauf in einer RTL-Beschriftung sind bidi-anfällig. Der Währungscode bleibt lateinisch, `ב-` davor ist nach Styleguide §3 zulässig |
| years / yrs (Achse, Slider-Suffix) | שנים | eine Form für beide Fundstellen |
| N years (Ergebnisblock) | שנה אחת / שנתיים / N שנים | Hebräisch ist nicht zahlinvariant: `1 שנים` und `2 שנים` sind falsch, der Dual `שנתיים` ist Pflicht. Implementiert als `heYears()` in `RoiResults.copy.ts`, analog `heBedrooms()` (§2) |
| strategy / scenario | אסטרטגיה / תרחיש | Zeilenlabels der Ergebnis-Mail |
| projected result | תוצאה צפויה | Zeilenlabel der Ergebnis-Mail |
| get investment consultation (CTA) | לקבלת ייעוץ השקעות | baut auf dem Header-CTA `לקבלת ייעוץ` auf (§4) |
| send calculation (Button) | שליחת החישוב | nominal |
| send calculation by email (Modaltitel) | שליחת החישוב לאימייל | |

### 3.2 Rechtstexte: GDPR, Vertrag, Gerichtsstand (verbindlich)

Diese Zeilen sind **verbindlich**, nicht Vorschlag: jeder Begriff hat genau **eine** hebräische Form in `privacy.he.ts` und `terms.he.ts` (Pass B, Task 2, Fix-Runde 1). Wer eine Zeile ändert, ändert beide Dateien zusammen (Styleguide §11.6). Artikelzitate bleiben lateinisch und bidi-isoliert (`Art. 6 (1) (f) GDPR`).

| Englisch | Hebräisch (verbindlich) | Hinweis |
|---|---|---|
| controller | בעל השליטה בנתונים | bei Erstnennung glossiert: `בעל השליטה בנתונים (⁨controller⁩)`. Flexionen derselben Form: `בעלי שליטה נפרדים בנתונים`, `בעל שליטה אחר`. **Nicht** `הגורם האחראי` — das ist die Person im Haus, nicht die Rechtsrolle |
| processor | מעבד נתונים | `הם פועלים כמעבדי נתונים לפי Art. 28 GDPR` |
| personal data | נתונים אישיים | nie `מידע אישי` |
| processing | עיבוד | Verb `מעבדים`; die Rechtsgrundlage heißt immer `הבסיס המשפטי:` |
| consent | הסכמה | Bannerklick: `לאחר אישורכם` / `בכפוף להסכמתכם` — beides zulässig, weil es den Klick meint, nicht den Rechtsbegriff |
| legitimate interest | אינטרס לגיטימי שלנו | das Possessiv ist Pflicht: die EN sagt durchgehend „our legitimate interest" |
| data subject / betroffene Person | *kein Substantiv* — 2. Pl. `אתם` / `-כם` | Hebräisch hat keine etablierte Entsprechung; die Anrede trägt die Rolle |
| profiling | יצירת פרופיל | Verbform `בונה פרופיל`. Nie `פרופיילינג` (Anglizismus, Styleguide §7) |
| cookies | עוגיות | Kategorien `הכרחיות / אנליטיקה / שיווק`, wortgleich mit dem Bannertext |
| third parties | צדדים שלישיים | |
| binding / prevailing (Sprachfassung) | מחייב | `הנוסח האנגלי הוא המחייב.` (§5). Nie `הקובע` für die Sprachfassung; `הגרסה הנוכחית היא הקובעת` (aktuelle Fassung) ist ein anderer Sachverhalt und bleibt |
| governing law | הדין החל | |
| jurisdiction | סמכות שיפוט | `סמכות השיפוט הבלעדית` |
| licensor | מי שהעניק לנו רישיון | `בעלי הרישיון שלנו` heißt Lizenz**nehmer** und dreht die Eigentumslage um |
| conclude (a contract) | כריתה — `נכרת` / `כורתים` | nie `חותמים על` in derselben Aufzählung |
| right to have X done (Art. 16/17) | הזכות לדרוש ש… | `לדרוש שנתקן` / `לדרוש שנמחק` — der Anspruch richtet sich gegen uns, nicht an euch selbst |
| obtain confirmation (Art. 15) | לקבל מאיתנו אישור | nicht `לברר` (nachfragen) |
| have it sent to another controller (Art. 20) | לבקש שנעביר … ישירות | nicht `להעביר אותם` (ihr übertragt) |
| email | אימייל | nie `דואר אלקטרוני` |
| Dokumentnamen | מדיניות הפרטיות / תנאי השימוש | **definit**, weil jedes Link-Label auf der Seite definit ist (`consentCopy.ts`, beide Formular-Copys, `terms.he.ts` §10) |

## 4. Marke, Navigation, UI-Chrome

| Englisch | Hebräisch | Hinweis |
|---|---|---|
| Cyprus VIP Estates | Cyprus VIP Estates | immer lateinisch, nie umschreiben |
| Home | דף הבית | |
| Projects | פרויקטים | Navigationslabel |
| Developers | יזמים | |
| Blog / Insights | בלוג | Eyebrow über dem Blog-H1: `הבלוג` |
| Case studies | סיפורי לקוחות | H1 und Navigation; nicht „מקרי בוחן". Eyebrow darüber: `מהשטח` (§4.5) |
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
| Speak to an adviser (Überschrift Broschüren-Modal) | לדבר עם יועץ | die Komponente vergoldet das letzte Wort, deshalb der Split `לדבר עם` + `יועץ`; `יועץ` folgt §4.6 (nicht `נציג`) |
| Request a call | לקבל שיחה מיועץ | |
| Call (Button auf einem `tel:`-Link) | להתקשר | Infinitiv-CTA neben `וואטסאפ` und `אימייל`; `שיחת טלפון` ist das Formularlabel (§4.3), nicht der Button |
| View details (Karten-CTA) | לפרטים נוספים | der idiomatische israelische Karten-CTA; `קריאה נוספת` gehört zum Blog (§4.4) |
| Close (`aria-label`) | סגירה | nominal, genusfrei; wortgleich im Broschüren-Modal, im Projekt-Overlay, in `developmentCopy` und im Präsentations-Overlay |
| Favorite (`aria-label`) | שמירה למועדפים | Herz-Button auf Karte und Overlay; stand in allen Sprachen hart englisch und war damit ein englisches Screenreader-Label auf einer hebräischen Seite |
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
| Cookie consent (Accept all / Only necessary / Settings) | אישור הכל / רק ההכרחיות / הגדרות | Cookies = עוגיות; Kurzform `אישור הכל` statt `אישור כל העוגיות`, ausbalanciert neben dem 10-Zeichen-Button `רק הנחוצות` |

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
| Success Stories (Eyebrow über der H1) | מהשטח | WP6-Pass-B-Entscheidung (Wurzelwiederholung zur H1 `סיפורי לקוחות` vermeiden); `סיפורי הצלחה` nicht als Eyebrow verwenden |
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

### 4.7 Präsentations- und Booking-Seite (Token-Seiten)

`/he/c/[token]` (persönliche Auswahl) und `/he/book/[token]` (Terminvorschlag). Beide Seiten sprechen den Kunden in der 2. Pers. Plural an und den Berater in der 1. Pers. Singular.

| Englisch | Hebräisch | Hinweis |
|---|---|---|
| YOUR PERSONAL SELECTION (Hero-Eyebrow) | המבחר האישי שלכם | `מבחר` ist die kuratierte Auswahl, `בחירה` wäre der Akt des Wählens. EN steht in Versalien, Hebräisch kennt keine |
| Your preferences (über den Kriterien-Chips) | ההעדפות שלכם | nominal, genusfrei |
| up to (Budget-Chip, Obergrenze) | עד | `עד €500,000`; steht mit Leerzeichen vor dem Betrag, deshalb keine `החל מ-`-Konstruktion |
| from (Budget-Chip, Untergrenze) | מעל | `מעל €300,000`; eigener Key `budgetFrom`, symmetrisch zu `budgetUpTo`. **nicht verwenden: `מחיר התחלתי`** — der Chip zeigt die Budgetuntergrenze des Kunden, kein Objektpreis-Label (§2) |
| Immediate | מיידי | Timeline-Chip |
| within 3 / 6 months, a year, two years | תוך 3 חודשים · תוך 6 חודשים · תוך שנה · תוך שנתיים | `שנתיים` ist der Dual; nicht verwenden: `2 שנים` |
| Just looking | בשלב בדיקה | `רק מסתכל` wäre genusgebunden; Nominalstil (Styleguide §2.1) |
| New for you (Badge) | חדש עבורכם | eigener Badge neben `חדש` (§4) |
| DIRECT CONTACT (Eyebrow des Closing-Blocks) | קשר ישיר | |
| Your personal advisor (Zeile unter Name und Foto) | היועץ האישי שלכם | maskulin wie das CTA `לקבל שיחה מיועץ` (§4); die Signaturzeile der E-Mails lautet bewusst anders (§4.8). Siehe §6 |
| View on site (Link aus dem Overlay) | לצפייה באתר | |
| Good morning / afternoon / evening | בוקר טוב · צהריים טובים · ערב טוב | Begrüßungswort nach Serverzeit, Standardformeln |
| Schedule a meeting (Eyebrow) | תיאום פגישה | nominal |
| let's find a time (H1-Suffix hinter dem Namen) | נמצא זמן שמתאים לכם | 1. Pers. Plural als Firmenstimme, genusfrei; die H1 lautet `שלום {firstName}, נמצא זמן שמתאים לכם` |
| Your time | השעה אצלכם | Label neben der Kundenzeitzone |
| Cyprus time | שעון קפריסין | wortgleich mit §4.6 |
| Detecting your timezone… | מזהים את אזור הזמן שלכם… | Partizip Plural wie `שולחים…` (§4.3); nicht verwenden: `בזיהוי…` |
| Your selected times | המועדים שבחרתם | Überschrift der Auswahlliste |
| Send my available times (Submit) | שליחת המועדים הפנויים | nominal; `שליחה` allein ist in §4 für „Send" belegt |
| Select between 1 and 3 times | יש לבחור בין 1 ל-3 מועדים | unpersönliches `יש ל…` (Styleguide §11.2); der Bindestrich vor der Ziffer ist nach §3 richtig. Der Hinweis über der Liste nennt zusätzlich den Ort: `יש לבחור למעלה בין 1 ל-3 מועדים.` |
| Your appointment is confirmed | הפגישה שלכם מאושרת | H1 des bestätigten Zustands **und** Betreff der Bestätigungsmail, wortgleich |
| calendar invite | הזמנה ליומן | Bestätigungstext und Bestätigungsmail |
| on/at + Datum (Terminbestätigung) | ביום ד׳, 14 באוק׳, 15:00 · ל-⁦14/10/2026⁩ | die Ein-Buchstaben-Präposition klebt ohne Bindestrich vor einem hebräischen Wort und nimmt ihn vor einer Ziffer (§3). `he-IL` liefert ein Datum, das mit `יום` beginnt, `ב-${dt}` ergäbe also das nicht existierende `ב-יום ד׳`. Implementiert als `hePrefixDate()` in `src/lib/locale.ts` |

### 4.8 E-Mail und CRM

Betreffzeilen, Anreden, Grußformeln und Signatur — für Client-Mails (Auto-Reply, ROI-Ergebnis, Booking-Bestätigung) und für die aus dem CRM verschickten Nachrichten. Interne Admin-Texte und Telegram-Meldungen bleiben englisch (Projektkonvention) und stehen deshalb nicht in dieser Tabelle.

| Englisch | Hebräisch | Hinweis |
|---|---|---|
| Hi [First], (Anrede) | שלום {firstName}, | **eine** Anredeform für alle Kanäle: `compose/greeting.ts`, Auto-Reply, ROI-Mail, Booking-H1. Kein `מר`/`גב'` — das erzwingt ein Genus (Styleguide §2.3). Der lateinische Name steht in `<bdi>` |
| Dear Client (Fallback ohne Namen) | שלום, | `לקוח יקר`/`לקוחה יקרה` erzwingt ebenfalls ein Genus. Ein nackter Vorname mit Komma (`יוסי,`) ist im Hebräischen keine Anrede, deshalb trägt auch der Normalfall das `שלום` |
| Best regards, (Valediction) | בברכה, | Standard-Geschäftsschluss, `compose/closing.ts` |
| Your personal property advisor (Signatur-Rollenzeile) | יועץ הנדל"ן האישי שלכם | Nomen-Kette vorangestellt, weil die Zeile ohne Bildkontext unter dem Namen steht. nicht verwenden: das nachgestellte `היועץ האישי שלכם לנדל"ן`. Bewusst verschieden von `advisorTitle` unter dem Foto (§4.7) — kein §11.6-Verstoß, es ist nicht derselbe String |
| Thank you for your enquiry (Betreff und H1 des Auto-Reply) | תודה על הפנייה | `פנייה` als Substantiv (§4.3) |
| Betreffmuster | {Betreff} \| Cyprus VIP Estates | senkrechter Strich, kein Gedankenstrich; gilt auch für die Browser-Tab-Titel der Token-Seiten (§5) |
| What happens next? | מה קורה עכשיו? | echte Frage, kein Doppelpunkt-Titel |
| trusted developers | יזמים אמינים | die EN-Quelle sagt „trusted"; `מובילים` (§5) wäre eine andere Behauptung. `יזמים` nach §2 |
| Follow us: | עקבו אחרינו: | Imperativ Plural (Styleguide §2.2); nominal wirkt hier gestelzt |
| Browse properties in Cyprus (CTA-Button) | לצפייה בנכסים בקפריסין | Muster wie `לצפייה בכל הפרויקטים` (§4.1) |

## 5. Standardformulierungen (Boilerplate)

| Zweck | Hebräisch |
|---|---|
| Beratungssprache (Entscheidung E) — liegt als **eine** exportierte Konstante `HE_LANGUAGE_NOTE` in `src/lib/locale.ts`; die Annahme „einmal sagen reicht" gilt pro Kanal, nicht pro Firma, deshalb tragen Auto-Reply, ROI-Ergebnismail, Booking- und Präsentationsseite sie jeweils selbst | הייעוץ מתקיים באנגלית או ברוסית; פנייה בעברית מתקבלת בברכה. |
| Rechtsvorbehalt | המידע אינו מהווה ייעוץ משפטי או מס. בכפוף לבדיקה פרטנית. |
| Maßgeblichkeit (Legal) | הנוסח האנגלי הוא המחייב. |
| English binding (Rechtstexte) — Langfassung unter der H1 von Datenschutzerklärung und AGB (`bindingNote`, `privacy.he.ts` / `terms.he.ts`); die Kurzform darüber bleibt für Fließtext und Fußzeilen | הנוסח האנגלי של מסמך זה הוא הנוסח המחייב; התרגום לעברית נועד לנוחות בלבד. |
| Preisvorbehalt | המחירים עשויים להשתנות. הזמינות מתעדכנת מול היזם. |
| Unternehmensbeschreibung (kurz) | Cyprus VIP Estates היא סוכנות נדל"ן בקפריסין המתמחה בפרויקטים חדשים של יזמים מובילים בלימסול ובפאפוס. |
| Nähe zu Israel | כ-45 דקות טיסה מתל אביב, כמה טיסות ביום. |
| CTA Standard | לקבל שיחה מיועץ · לצפייה בזמינות ובמחירים · לכתוב לנו בוואטסאפ |
| WhatsApp-Vorbelegung (der Besucher spricht, 1. Person Singular, genusfrei) | שלום, אשמח לקבל מידע על רכישת נכס בקפריסין. תוכלו לעזור לי למצוא וילה או דירה מתאימה? |
| Versand fehlgeschlagen (wortgleich in `formFeedbackCopy.ts` und `QualificationForm.tsx`) | לא הצלחנו לשלוח את הפנייה. אפשר לנסות שוב, או ליצור איתנו קשר באימייל … או בטלפון … |
| Newsletter-Bestätigung (wortgleich in `NewsletterForm.copy.ts` und `Footer/FooterNewsletter.tsx`) | ההרשמה לניוזלטר הושלמה. |
| Datenschutzhinweis Case Studies (wortgleich in `privacyNote` und `CASE_STUDY_INTRO_COPY.disclaimer`) | פרטיות הלקוחות קודמת לכל, ולכן מידע עסקי רגיש ונתונים מזהים אינם נחשפים בסיפור זה. |
| Öffnungszeiten (Muster, wortgleich in `hoursValue`, `heroLead`, `metaDescription`) | מדי יום, 9:00 עד 18:00 |
| Zoom-Termin (wortgleich auf der Booking-Seite und in `bookingMessages.ts`) | את הקישור לפגישת Zoom אשלח בנפרד, זמן קצר לפני השיחה. |
| Telefontermin (wortgleich in denselben zwei Dateien) | אתקשר אליכם במועד שנקבע. |
| Vertrauenszeile im Closing-Block der Präsentationsseite (`closingTrust`) | אני עונה לכל הודעה בעצמי, בדרך כלל בתוך שעה. אפשר לשאול אותי כל דבר על הנכסים שבמבחר שלכם, על תיאום סיור ועל פרטי הרכישה בקפריסין. בלי התחייבות ובלי לחץ. |
| Browser-Tab der Token-Seiten (`generateMetadata()`) | המבחר האישי שלכם \| Cyprus VIP Estates · תיאום פגישה \| Cyprus VIP Estates |

Regeln zu diesen Zeilen: kein Bis-Strich in Zeitangaben (`עד` ausgeschrieben), `בסיפור זה` im Schriftregister statt `בסיפור הזה`, und jeder duplizierte String bleibt an allen Fundstellen wortgleich (Styleguide §11.6).

Zur Vertrauenszeile: sie sagt bewusst `בעצמי` und nicht ein viertes `אישי` — `intro`, `eyebrowTag` und `advisorTitle` derselben Seite tragen das Wort bereits, zwei davon in benachbarten Absätzen (Styleguide §11.5). `intro` behält `באופן אישי`.

Zum Satzpunkt: `משהו השתבש, נסו שוב` (§4.3) steht auf der Booking-Seite mit Punkt (`משהו השתבש, נסו שוב.`), weil die EN-Quelle dort zwei Sätze setzt. Der hebräische Wortlaut bleibt in beiden Fällen identisch.

## 6. Für den Lektor (Pass C) markiert

Nur die Punkte, die die Kritik-Pässe ausdrücklich dem muttersprachlichen Lektor überlassen haben. Alles andere in diesem Dokument ist entschieden.

| ⚠ Term / Frage | Aktuell verbindlich | Alternative(n) | Sichtbar auf |
|---|---|---|---|
| „Price from" als Caption | מחיר התחלתי | (a) Komponente ändern (`&nbsp;` raus) und `החל מ-` direkt am Betrag, (b) `מחירים מ-`, (c) belassen | Hero `/he/projects/<slug>`, `ProjectLink`-Karte, `BlogSlide`-Preiszeile, `/c/[token]`. Grund der Vorlage: `מחיר התחלתי` ist im Israelischen zuerst der Eröffnungspreis einer Auktion (`מחיר התחלתי במכרז`). **Gemeinsamer Blocker für WP2, WP4 und WP7** — WP4 hat die Frage offengelassen, WP7 hatte sich zunächst fälschlich auf eine WP4-Entscheidung berufen. Der Budget-Chip der Präsentationsseite ist davon ausgenommen, er hat mit `מעל` einen eigenen Term (§4.7) |
| Unit-Status Genus-Split | Einheit fem. `זמינה / שמורה / נמכרה`, Projekt-Badge mask. `זמין` | durchgehend maskulin, oder Hero-Badge ebenfalls feminisieren | Einheitentabelle und Status-Pill auf `/he/projects/<slug>`; Hero-Badge derselben Seite |
| `נכסים למכירה` vs. `דירות למכירה` | נכסים למכירה | `דירות למכירה` (140/Mon.), `דירות ווילות למכירה` | `Cities.tsx`-H2 auf `/he`. Gegen `דירות למכירה` spricht die Kannibalisierung der geplanten Spoke-Seite `/he/apartments-for-sale-cyprus` |
| `קווים ישירים` (Direct lines) | קווים ישירים | ישירות אלינו | Rubrik-Eyebrow `/he/contacts`; die Rubrik enthält auch WhatsApp und E-Mail, nicht nur Durchwahlen |
| `בשירות מלא` (full-service) | בשירות מלא | כסוכנות שיווק נדל"ן עם מעטפת מלאה | `/he/about`, Stats-Zeile; im israelischen Agentur-Sprech nicht etabliert |
| Goldakzent im Blog-H1 | תובנות מקפריסין (Akzent auf `מקפריסין`) | 1-Wort-Titel `תובנות`, dann ist der Akzent der ganze Titel | `/he/blog` H1 und Artikel-Kicker; in en/de/pl/ru trägt das Substantiv den Akzent, nie das Land |
| `נדל"ן בקפריסין, בקצרה` | so belassen | am echten `he`-`blogPage.content` gegenprüfen | Titel des SEO-Blocks unter der Blogliste |
| Umschrift kleiner Orte | §1-Formen | | `Tala`, `Kissonerga` und die WP2-Feed-Ortsnamen bestätigen |
| `פרויקט` vs. `בניין` | פרויקט | בניין für kleine Mehrfamilienbauten | Projektkarten und Development-Seiten |
| `וילה` vs. `בית פרטי` in Titeln | nach Objekttyp | | Volumen entscheidet (Keyword-Map) |
| `statusLabel.unlisted` — zwei Formen für „nicht mehr gelistet" | Präsentationsseite `לא זמינה עוד`, Feed-Vokabular `לא בתצוגה` | eine Form für beide, oder die Trennung bestätigen | Einheitentabelle auf `/he/c/[token]` (`copy.ts`) gegen `heFeedLabel("unlisted")` in `src/lib/heFeedVocab.ts`. Die Trennung ist gewollt („gibt es nicht mehr" vs. „steht nicht in der Anzeige"), aber sie sind für den Leser dasselbe Feld |
| Abkürzung `חד׳ שינה` im Spaltenkopf | חד׳ שינה (nur Spaltenkopf) | ausgeschrieben `חדרי שינה`, oder nur `חד׳` | Kopfzeile der Einheitentabelle auf `/he/c/[token]`. §2 verbietet die Abkürzung sonst ausdrücklich; hier steht sie nur, weil die Spalte 4 EN-Zeichen breit ist. Der Abkürzungsstrich ist ein Geresh (U+05F3) |
| Genus der Beraterzeile | maskulin: `היועץ האישי שלכם`, `יועץ הנדל"ן האישי שלכם`, `לדבר עם יועץ` | eine geschlechtsneutrale Rollenzeile, oder pro Berater ein Feld im CRM | Präsentationsseite, E-Mail-Signatur, Broschüren-Modal, Playbook (`compose/playbook`). Hebräisch hat keine neutrale Form; bei einer Beraterin steht heute die maskuline Zeile unter einem weiblichen Namen und Foto |
| `+ מע"מ` vs. `בתוספת מע"מ` | + מע"מ (§2) | die Wortform `בתוספת מע"מ` an beiden Fundstellen | Preiszeile der Development-Seite (`developmentCopy.ts`) und der Präsentationskarte. Verbindlich ist die kurze Form mit Leerzeichen; wenn Pass C die Wortform bevorzugt, müssen **beide** Dateien wechseln (§11.6) |
| `צור קשר` als Menü-Label | צור קשר (nur Menü), `ליצירת קשר` überall sonst | durchgehend `ליצירת קשר` | Hauptnavigation. WP7 hält `צור קשר` (mask. Sg. Imperativ) für einen §2-Verstoß und empfiehlt, das Menü nachzuziehen. Im Code ist der String derzeit **nicht** belegt, die Entscheidung kostet also nichts |
| Einzahl beim Einheitenzähler | 1 יחידה (aus `formatUnitsCount`) | `יחידה אחת` — die ausgeschriebene, nachgestellte Eins wie bei `חדר שינה אחד` (§2) und `שנה אחת` (§3.1) | Zähler unter dem Preis auf `/he/c/[token]`. Die Zählregel ist für Schlafzimmer und Jahre bereits entschieden; für „unit" hat WP7 nur den Plural geregelt |

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
| Success Stories (Eyebrow) | `סיפורי הצלחה` (frühere Controller-Vorgabe) | `מהשטח` | Controller-Ruling revidiert: WP6s Einwand (Wurzelwiederholung zur H1 `סיפורי לקוחות`) gilt; Code bleibt `מהשטח` |
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
| `src/app/preview-case-studies/[lang]/copy.ts` | `eyebrow` (Z. 231) | `מהשטח` | keine Änderung — Glossar auf `מהשטח` angeglichen |

Alle übrigen in §1–§5 verbindlich gesetzten Formen entsprechen dem heutigen Stand von `src/` (geprüft: `שולחים…`, `טוענים…`, `פתיחה ב-`, `השאירו פרטים`, `לכל סיפורי הלקוחות`, `מחיר התחלתי`, `המלצות`, `ניוזלטר`, `(לא חובה)`, `כל הערים`, `שאלות נפוצות`; keine Treffer für `בשליחה`, `בטעינה`, `חברות בנייה`, `חוות דעת`, `דיוור`, `נדלן`, `מקרי בוחן`).

### 2026-09-13 — Konsolidierung WP7 (Task 11, Teil 2)

**Zusammengeführt:** `docs/i18n/reviews/wp7-glossary.md` (Präsentationsseite `/c/[token]`, Booking-Seite `/book/[token]`, CRM-Nachrichten und Signatur, Client-E-Mails, ROI-Rechner, Broschüren-Modal). Übernommen sind alle Zeilen mit Pass-B-Verdikt „bestätigt" oder „geändert"; die Datei bleibt als Audit-Trail mit den vollständigen Begründungen erhalten und ist ab jetzt **nicht** mehr die Quelle. Damit ist §1–§5 die verbindliche Liste für WP1–WP7.

**Strukturänderung:** neu sind **§3.1 „Finanzen, Rendite, Transaktion (ROI-Rechner und Ergebnis-Mail)"**, **§4.7 „Präsentations- und Booking-Seite (Token-Seiten)"** und **§4.8 „E-Mail und CRM"**. Die Nummerierung von §1–§7 bleibt unverändert, damit die bestehenden Querverweise (§4.1 … §6) gültig bleiben; die Finanzterme hängen deshalb als Untertabelle an §3 („Aufenthalt, **Steuern**, Relocation, Zielgruppe") statt als eigener Abschnitt.

**Aufgelöste Divergenzen (eine verbindliche Form je EN-Term):**

| EN-Term | Konkurrierende Formen | Verbindlich | Grund |
|---|---|---|---|
| Unit-Status (Einheitentabelle) | WP2 `זמינה / שמורה / נמכרה` · WP7 Abgabe `זמין / שמור / נמכר` | `זמינה / שמורה / נמכרה` | WP2 hat es entschieden **und** in `heFeedVocab.ts` gebaut; der Bezug `יחידה` ist feminin. Das Projekt-Badge bleibt maskulin `נמכר`, weil es dort den `פרויקט` benennt. Von WP7 in der Fix-Runde bereits übernommen |
| +VAT | §2 `+ מע"מ` · WP7 `בתוספת מע"מ` | `+ מע"מ` | WP7s Einwand galt der Form ohne Leerzeichen (`+מע"מ`), die §2 ebenfalls ausschließt; mit Leerzeichen fällt das Pluszeichen als Neutralzeichen zwischen LTR-Betrag und RTL-Wort richtig. Code-Angleichung unten |
| „from" am Preis vs. am Budget | beides zuvor `מחיר התחלתי` | `מחיר התחלתי` (Objektpreis-Caption) · `מעל` (Budgetuntergrenze im Chip) | zwei verschiedene Aussagen: ein Objektpreis „ab" gegen die Untergrenze des Kundenbudgets. Eigener Key `budgetFrom`, symmetrisch zu `budgetUpTo` = `עד` |
| bedrooms (Abkürzung) | §2 „nicht verwenden: `חד' שינה`" · WP7 Spaltenkopf `חד׳ שינה` | kontextgetrennt | ausgeschrieben überall, `חד׳ שינה` **nur** im Spaltenkopf der Einheitentabelle (EN-Vorlage 4 Zeichen breit). Als Ausnahme in §2 dokumentiert und in §6 dem Lektor vorgelegt |
| Contact us | §4 `צור קשר` (Menü) · `ליצירת קשר` (CTA) · WP7 durchgehend `ליצירת קשר` | unverändert kontextgetrennt | WP7 hat es nur **empfohlen**, nicht per Pass-B-Verdikt geändert; die Frage steht jetzt in §6. `צור קשר` ist im Code ohnehin nicht belegt |
| viewing | §2 `סיור בנכס` · WP7 Fließtext `סיור`, Abgabe zuvor `ביקור` | `סיור בנכס`, im Fließtext `סיור` | `ביקור` ist ein Besuch allgemein; `צפייה בנכס` wäre das Anschauen von Fotos |
| advisor role line | `היועץ האישי שלכם` (Foto) · `יועץ הנדל"ן האישי שלכם` (Signatur) | beides, kontextgetrennt | kein §11.6-Verstoß: zwei verschiedene Strings an zwei Trägern. Die Signaturzeile trägt das Fach, weil sie ohne Bildkontext steht |
| ROI | Akronym `ROI` · `תשואה` | `תשואה` | das Akronym hat in hebräischer Endkundensprache keine Verbreitung und ist zugleich der Suchbegriff (§2); en/de/pl/ru behalten `ROI` |
| „N Jahre" / „N Schlafzimmer" | `1 שנים`, `2 שנים`, `1 חדר שינה` | `שנה אחת` / `שנתיים` / `N שנים`, `חדר שינה אחד` | Hebräisch ist nicht zahlinvariant; Dual und nachgestellte, ausgeschriebene Eins sind Pflicht. Helfer `heYears()` bzw. `heBedrooms()` |
| Zustandsmeldung „Detecting…" | `בזיהוי…` | `מזהים את אזור הזמן שלכם…` | dieselbe Regel wie `שולחים…` / `טוענים…`: kein `ב` + Verbalnomen (Styleguide §11.2) |
| Anrede | `יוסי,` (nackter Vorname) · `מר`/`גב'` · `לקוח יקר` | `שלום {firstName},` bzw. `שלום,` | ein nackter Vorname mit Komma ist im Hebräischen keine Anrede; `מר`/`גב'` und `לקוח יקר`/`לקוחה יקרה` erzwingen ein Genus |

**Code-Angleichung erforderlich** (Folgeaufgabe; in diesem Commit wurde **kein** `src/`-File angefasst — die drei Zeilen sind per `grep` am heutigen Stand bestätigt):

| Datei | Key / Zeile | Aktuell im Code | Verbindlich laut Glossar |
|---|---|---|---|
| `src/app/c/[token]/copy.ts` | `vatLabel` (Z. 256) | `בתוספת מע"מ` | `+ מע"מ` (§2) — **erledigt** (Controller-Commit) |
| `src/app/c/[token]/copy.ts` | `bedroomLabels["1"]` (Z. 248) | `1 חדר שינה` | `חדר שינה אחד` (§2) — **erledigt** (Controller-Commit) |
| `src/app/c/[token]/copy.ts` | `unitsPlural.one` über `formatUnitsCount` (Z. 254) | `1 יחידה` | `יחידה אחת` — erst nach der §6-Bestätigung; `formatUnitsCount` setzt `${n} ${wort}` für alle Locales und braucht dafür einen he-Sonderweg |

Die drei Code-Angleichungen aus Teil 1 sind erledigt: `filterAll` steht in `blogI18n.ts` und in `BlogPostsRenderer.tsx` inzwischen auf `הכל`, `eyebrow` in `preview-case-studies/[lang]/copy.ts` auf `מהשטח`; `הכול` kommt in `src/` nicht mehr vor.

Alle übrigen WP7-Formen entsprechen dem heutigen Stand von `src/` (geprüft: `מחשבון תשואה`, `roiShort` = `תשואה`, `מעל`/`עד`, `חד׳ שינה`, `לא זמינה עוד`, `היועץ האישי שלכם`, `יועץ הנדל"ן האישי שלכם`, `שמירה למועדפים`, `סגירה`, `להתקשר`, `לפרטים נוספים`, `לצפייה באתר`, `מזהים את אזור הזמן שלכם…`, `הפגישה שלכם מאושרת`, `תודה על הפנייה`, `עקבו אחרינו:`, `יזמים אמינים`, `HE_LANGUAGE_NOTE` in `src/lib/locale.ts` mit vier Trägern, `hePrefixDate()`).

**Zum Abkürzungszeichen:** `חד׳ שינה`, `יום ד׳` und `באוק׳` tragen den Geresh (U+05F3) — so steht es im Code und so liefert es `Intl` für `he-IL`. Wo §1–§4 einen geraden Apostroph schreibt (`דק'`, `קונסיירז'`, `לאצ'י`), ist das eine Schreibvereinfachung dieses Dokuments und keine abweichende Vorgabe an den Code.

### 2026-09-13 — Task 3 Fix-Runde 1 (Site-Dokumente)

**Neu in §2:** `off-market` → `נכסים שאינם מפורסמים`. Anlass ist Pass B M11 zu `content/he/site-documents/caseStudiesPage.he.json`: dort war „Off-Market Opportunities" mit `רכישה על הנייר` (off-plan) übersetzt. Die beiden Begriffe sind nicht dasselbe; §2 trennt sie ab sofort ausdrücklich. Rubrikform: `הזדמנויות בנכסים שאינם מפורסמים`.

Offen für Pass C (nicht entschieden, nur festgehalten): das Genus der Marke `Cyprus VIP Estates` — die Site trägt heute `הוא`, `פועלת`, `מציעה`, `הופכת`, `מציגה`, `תעזור` nebeneinander. Eine Form gehört nach der Lektorenrunde in §4.
