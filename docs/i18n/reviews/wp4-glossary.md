# Glossar-Ergänzungen aus WP4 — Blog-Chrome, Developers-Seite, Catch-all-SEO-Fallbacks

**Stand:** 2026-09-13 · **Fix-Runde 1 nach Pass B eingearbeitet** · Begleitdokument zu
`docs/i18n/reviews/wp4.md`. Geänderte oder gestrichene Zeilen sind mit „Fix 1" markiert.

Begriffe, die WP4 gebraucht hat und die in `docs/i18n/he-glossary.md` §1–5 (und in
§6.1 aus WP1) fehlten. **`he-glossary.md` wurde bewusst nicht angefasst** — nach dem
Lektorat (Pass C) wandern die bestätigten Zeilen dort in §2/§4/§5.

| EN | HE | Kontext | Begründung |
|---|---|---|---|
| Cyprus Insights (Blog-H1) | תובנות מקפריסין | `/he/blog` Hero-H1, zugleich Back-Link im Artikel-Kicker | „Insights" hat kein etabliertes hebräisches Marken-Äquivalent; `תובנות` ist der übliche Fachbegriff. **Fix 1 (M9), Begründung korrigiert:** `BlogInsights.tsx` akzentuiert das **letzte** Wort, das ist hier `מקפריסין`. In en/de/pl/ru trägt dagegen das **Substantiv** den Goldakzent („Cyprus **Insights**", „Кипр **Инсайты**"), nie das Land. Die Abweichung ist wegen der hebräischen Smichut (Nomen voran) unvermeidbar und **bewusst akzeptiert**; Alternative für den Lektor: 1-Wort-Titel `תובנות`, dann ist der Akzent der ganze Titel |
| The Journal (Eyebrow) | הבלוג | Eyebrow über dem Blog-H1 | Glossar §4 hat `בלוג`; als Eyebrow bestimmt. „Journal"/`יומן` liest sich im Israelischen wie ein Tagebuch, nicht wie ein Magazin |
| article / articles | מאמר / מאמרים | Zähler unter dem Blog-H1, Ladeknopf, Related-Titel | Standardbegriff; `פוסט` wäre Blogger-Jargon, `כתבה` eher Journalismus. **Fix 1 (M1):** in der Zählzeile steht der Singular als Phrase `מאמר אחד באנגלית` (ohne Ziffer), der Nullfall als `אין עדיין מאמרים` |
| articles are in English | מאמרים באנגלית | trägt die Produktentscheidung (Artikel sind nicht übersetzt) direkt in die Zählzeile: „12 מאמרים באנגלית" | ruhige Tatsachenaussage, keine Entschuldigung (§1); siehe offene Frage 1 in `wp4.md` |
| All (Filter) | הכול | Kategorien-Tabs auf `/he/blog` und im alten `BlogPostsRenderer` | Ktiv male (§4); `הכל` ist die defektive Schreibung |
| Read (Karten-CTA) | לקריאה | Artikelkarte, Related-Karte | Nominal/Infinitiv statt Imperativ (§2.1), genusfrei |
| Read article (Featured-CTA) | לקריאת המאמר | Hero-Mockup auf `/he/blog` | wie oben, mit Objekt, damit der Featured-CTA sich vom Karten-CTA unterscheidet |
| Categories (aria) | קטגוריות | `aria-label` der Tab-Leiste | etablierter UI-Begriff |
| Blog pagination (aria) | ניווט בין עמודי הבלוג | `aria-label` des Pagers | „Paginierung" hat kein knappes hebräisches Substantiv; beschreibende a11y-Bezeichnung |
| First page / Last page | מעבר לעמוד הראשון / מעבר לעמוד האחרון | Pager-Buttons (a11y) | **Fix 1 (S4):** `aria-label` an einem `<a>` — israelische a11y-Konvention ist die Handlungsform, nicht das Substantiv; konsistent mit `pagerAria` (`ניווט…`) |
| Page {n} | עמוד {n} | Pager-`aria-label`; wortgleich mit dem Catch-all-Suffix, das nach **Fix 1 (M7)** `, עמוד {n}` lautet (Komma statt Pipe, Ziffer LRI/PDI-isoliert) | ein Wort für beide Fundstellen, damit die duplizierten Strings wortgleich bleiben (§11.6) |
| No articles yet. | אין עדיין מאמרים. | Leerzustand der Blogliste | schlicht, kein Ausrufezeichen |
| The Guide (Eyebrow) | המדריך | Eyebrow des SEO-/Content-Blocks unter der Liste | Standardbegriff, bestimmt |
| Inside the Journal | נדל"ן בקפריסין, בקצרה | Titel desselben Blocks | **Fix 1 (S2):** der Block rendert `blogPage.content`, also SEO-Fließtext über zypriotische Immobilien — `על הבלוג` versprach eine „Über uns"-Sektion und stand zudem im Widerspruch zum Eyebrow `המדריך`. Aussage, kein Doppelpunkt-Titel (§3). Vom Lektor am echten `he`-`blogPage.content` gegenzuprüfen |
| min read | דקות קריאה (+ `דקת קריאה אחת` bei n = 1) | Artikel-Meta („7 דקות קריאה") | Standardformulierung israelischer Magazine. **Fix 1 (M6):** der Wert kann 1 sein (`Math.max(1, …)`), `1 דקות קריאה` wäre falsch. Pass B schlug die numerusfeste Kurzform `דק' קריאה` vor (WP2-Konsistenz); der Controller hat stattdessen den `he`-Zweig am Render-Ort entschieden, damit die Langform erhalten bleibt. **Bekannte Abweichung zu WP2 (`דק'` in den Distanz-Chips)** — dort ist es ein enger Chip, hier eine Meta-Zeile |
| On this page (TOC) | תוכן העניינים | Sticky-Inhaltsverzeichnis im Artikel | **Fix 1 (S16):** `בעמוד הזה` ist eine Kalkierung der englischen Wortfolge (§7); israelische Magazine schreiben im Sticky-TOC `תוכן העניינים` |
| Written by | מאת | Autorenkarte | **Fix 1 (S1):** `נכתב על ידי` war grammatisch korrekt, aber kein israelisches Publishing-Hebräisch; über einer Autorenkarte steht `מאת` — ein Wort, genusfrei, kein Passiv (§3) |
| Related reading | עוד + מאמרים | Related-Überschrift, zweiteilig (`relatedLead` + gold akzentuierter `relatedAccent`) | Hebräisch stellt das Substantiv voran; damit wie in EN/DE/RU das **Substantiv** akzentuiert wird, trägt `עוד` den Vorlauf und `מאמרים` den Akzent |
| Recommended properties | נכסים מומלצים | Fallback-Überschrift des Projektblocks im Artikel | Glossar §2 `נכס`/`נכסים` |
| Recommended properties in {city} | נכסים מומלצים ב-⟦FSI⟧{city}⟦PDI⟧ | dieselbe Überschrift, wenn der Artikel eine Stadt nennt | `{city}` wird von der Route mit dem **lateinischen** Namen ersetzt (`Paphos`/`Limassol`/`Larnaca`), deshalb FSI/PDI-Isolation und die Bindestrich-Präposition aus §3. Siehe offene Frage 2 in `wp4.md` |
| Load {n} more posts | הצגת עוד {n} מאמרים | Ladeknopf im alten `BlogPostsRenderer` | **Fix 1 (S3):** WP3 Pass B hat für Pagination-Controls die Nominalform `הצגת עוד` entschieden, der Infinitiv bleibt Links/CTAs vorbehalten; `לטעון` klingt im Button zudem ungewohnt |
| Price from (Label vor dem Preis) | מחיר התחלתי ⚠️ **offen** | `BlogSlide`-Preiszeile | Das Glossar-`החל מ-` muss direkt am Betrag kleben; die Komponente schiebt ein `&nbsp;` dazwischen, der Bindestrich stünde also frei. **Fix 1 (S12), bewusst NICHT still geändert:** Pass B weist nach, dass `מחיר התחלתי` im Israelischen zuerst der Eröffnungspreis einer Auktion/Ausschreibung ist (`מחיר התחלתי במכרז`) — vor einem Neubaupreis ein falscher Freund. Entscheid des Lektors nötig, drei Optionen in `wp4.md`, offene Frage 5 |
| developer | יזם / יזמים | `/he/developers` H1, Meta, Intro | Glossar §2 (`יזם / חברה יזמית`) und §4 (Navigation: `יזמים`) — durchgehend `יזם/יזמים`, nie `קבלן` |
| vetted | עבר בדיקה | Intro `/he/developers` | konkreter als `מאומת`; sagt, dass wir selbst geprüft haben |
| clean legal title | בעלות משפטית נקייה (על הקרקע ועל הפרויקט) | Intro `/he/developers` | **Fix 1 (M3), ersetzt `טאבו נקי`:** `he-glossary.md` führt `טאבו` nur mit der Auflage, es bei Erstnennung als `שטר בעלות (Title Deed)` zu erklären — und inhaltlich liest ein israelischer Käufer `טאבו נקי` als „Title Deed ausgestellt und lastenfrei", was bei Off-Plan-Inventar regelmäßig **nicht** stimmt (§8). Die neutrale Formulierung sagt dasselbe, ohne eine Zusicherung zu machen |
| delivery track record | היסטוריית מסירות מוכחת | Intro `/he/developers` | Glossar §2 `מסירה` = handover. **Fix 1 (M5):** Plural, weil ein Singular keinen „track record" trägt; `מוכחת` statt des leeren Beteuerungsworts `אמיתית` (§7) |
| active current portfolio | צבר פרויקטים פעיל | Intro `/he/developers` | **Fix 1 (M5), ersetzt `תיק נכסים מעודכן`:** `תיק נכסים` ist im Israelischen das **Anlageportfolio eines Eigentümers**, nicht die laufende Projekt-Pipeline eines Bauträgers — falscher Referent (§8). `פורטפוליו` wäre ein unnötiger Anglizismus |
| at no markup to the buyer | בלי תוספת מחיר לרוכש | Intro `/he/developers` | sagt die Tatsache, ohne sie zu bewerben |
| boutique studio | סטודיו בוטיק | Meta + Intro `/he/developers` | im israelischen Immobilien-/Design-Sprachgebrauch etabliert |
| large international companies | חברות בינלאומיות גדולות | Intro `/he/developers` | **Fix 1 (S8), ersetzt `גופים בינלאומיים`:** `גופים` ist Behörden-/Finanzsprache für „Körperschaften"; das Ausweichwort war nur nötig, solange Satz 1 `חברות` für die Bauträger verbraucht hatte (M4) |
| premium homes | בתי יוקרה | Intro `/he/developers` | **Fix 1 (S8), ersetzt `בתים ברמה גבוהה`:** inhaltsleerer Füller für „premium" (§7 Adjektiv-Stapel) |
| developer page (Einzelseite) | עמוד ייעודי | Intro `/he/developers` | **Fix 1 (S9):** ersetzt das referenzlose `לכל אחד יש עמוד משלו`; `הזמינים` („verfügbar") wurde zu `העדכניים`, weil EN „current" sagt und Verfügbarkeit niemand garantieren kann (§8) |
| Cyprus VIP Estates (im hebräischen Meta-Title) | יזמי נדל"ן בקפריסין \| Cyprus VIP Estates | `<title>` von `/he/developers` (neuer Key `metaTitle`) | **Fix 1 (S6):** Marke lateinisch, Pipe als Separator nach Styleguide §6; 40 Graphemen. Nur Meta — die H1 bleibt ohne Marke, damit der Goldakzent auf `בקפריסין` liegt |

---

## Gestrichen in Fix-Runde 1

| EN | HE (gestrichen) | Grund |
|---|---|---|
| builders (große Baufirmen) | `חברות בנייה` | **M4 + M8.** Widerspricht `he-glossary.md` §2 (`developer = יזם / חברה יזמית`); im Israelischen ist das der ausführende Bauunternehmer (`קבלן`-Feld), den das Glossar ausdrücklich ausschließt — der Kernbegriff der Seite hätte im ersten Satz gekippt. Die zusätzlich angeführte Begründung „Keyword-Map nennt `חברות בנייה בקפריסין` als Nebenform" war **falsch**: `he-keyword-map.md` und `he-keywords.csv` (152 Zeilen) enthalten null Treffer dafür. Die Wiederholungsvermeidung nach §11.5 rechtfertigt keinen Begriffswechsel beim Referenten; die Wiederholung wird stattdessen über `חברות בינלאומיות גדולות` und den Satzbau aufgelöst |

## Abweichungen zu WP1–WP3 (gleicher EN-Term, andere HE-Lösung)

| EN | WP2/WP3 | WP4 | Stand nach Fix-Runde 1 |
|---|---|---|---|
| All (Filter) | WP2: `הכל` | `הכול` | WP4 bleibt bei `הכול` (§4 Ktiv male; `הכל` ist die defektive Schreibung). **WP2 muss nachziehen**, sonst stehen zwei Schreibungen desselben Filters auf `/he/projects` und `/he/blog` — nicht in dieser Fix-Runde geändert, `wp2`-Dateien gehören einem anderen Arbeitspaket |
| min / Minuten | WP2: `דק'` (Distanz-Chips) | `דקות קריאה` + `דקת קריאה אחת` | bewusst unterschiedlich (Chip vs. Meta-Zeile), Numerus über den Render-Zweig gelöst |
| Show more / Load more | WP3: `הצגת עוד` | `הצגת עוד {n} מאמרים` | angeglichen (S3) |
| developer | Hauptglossar §2: `יזם / חברה יזמית` | `יזם / יזמים` durchgehend | angeglichen (M4) |
| buyers | WP3: `רוכשים` | `לרוכש` / `רוכשים מישראל` | konsistent |
| Read / View | WP3: `לצפייה ב…` | `לקריאה`, `לקריאת המאמר` | konsistent |
| price on request | WP3 / Glossar §2 | `מחיר לפי פנייה` | konsistent |

