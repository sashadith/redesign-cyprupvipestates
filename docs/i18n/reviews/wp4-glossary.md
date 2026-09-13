# Glossar-Ergänzungen aus WP4 — Blog-Chrome, Developers-Seite, Catch-all-SEO-Fallbacks

**Stand:** 2026-09-13 · Begleitdokument zu `docs/i18n/reviews/wp4.md`.

Begriffe, die WP4 gebraucht hat und die in `docs/i18n/he-glossary.md` §1–5 (und in
§6.1 aus WP1) fehlten. **`he-glossary.md` wurde bewusst nicht angefasst** — nach dem
Lektorat (Pass C) wandern die bestätigten Zeilen dort in §2/§4/§5.

| EN | HE | Kontext | Begründung |
|---|---|---|---|
| Cyprus Insights (Blog-H1) | תובנות מקפריסין | `/he/blog` Hero-H1, zugleich Back-Link im Artikel-Kicker | „Insights" hat kein etabliertes hebräisches Marken-Äquivalent; `תובנות` ist der übliche Fachbegriff. Letztes Wort = `מקפריסין`, weil `BlogInsights.tsx` das letzte Wort gold akzentuiert (wie „Cyprus" im EN) |
| The Journal (Eyebrow) | הבלוג | Eyebrow über dem Blog-H1 | Glossar §4 hat `בלוג`; als Eyebrow bestimmt. „Journal"/`יומן` liest sich im Israelischen wie ein Tagebuch, nicht wie ein Magazin |
| article / articles | מאמר / מאמרים | Zähler unter dem Blog-H1, Ladeknopf, Related-Titel | Standardbegriff; `פוסט` wäre Blogger-Jargon, `כתבה` eher Journalismus |
| articles are in English | מאמרים באנגלית | trägt die Produktentscheidung (Artikel sind nicht übersetzt) direkt in die Zählzeile: „12 מאמרים באנגלית" | ruhige Tatsachenaussage, keine Entschuldigung (§1); siehe offene Frage 1 in `wp4.md` |
| All (Filter) | הכול | Kategorien-Tabs auf `/he/blog` und im alten `BlogPostsRenderer` | Ktiv male (§4); `הכל` ist die defektive Schreibung |
| Read (Karten-CTA) | לקריאה | Artikelkarte, Related-Karte | Nominal/Infinitiv statt Imperativ (§2.1), genusfrei |
| Read article (Featured-CTA) | לקריאת המאמר | Hero-Mockup auf `/he/blog` | wie oben, mit Objekt, damit der Featured-CTA sich vom Karten-CTA unterscheidet |
| Categories (aria) | קטגוריות | `aria-label` der Tab-Leiste | etablierter UI-Begriff |
| Blog pagination (aria) | ניווט בין עמודי הבלוג | `aria-label` des Pagers | „Paginierung" hat kein knappes hebräisches Substantiv; beschreibende a11y-Bezeichnung |
| First page / Last page | העמוד הראשון / העמוד האחרון | Pager-Buttons (a11y) | bestimmt, weil auf eine konkrete Seite verwiesen wird |
| Page {n} | עמוד {n} | Pager-`aria-label`; identisch mit dem Suffix ` \| עמוד {n}` im Catch-all-Title | ein Wort für beide Fundstellen, damit die duplizierten Strings wortgleich bleiben (§11.6) |
| No articles yet. | אין עדיין מאמרים. | Leerzustand der Blogliste | schlicht, kein Ausrufezeichen |
| The Guide (Eyebrow) | המדריך | Eyebrow des SEO-/Content-Blocks unter der Liste | Standardbegriff, bestimmt |
| Inside the Journal | על הבלוג | Titel desselben Blocks | Aussage, kein Doppelpunkt-Titel (§3) |
| min read | דקות קריאה | Artikel-Meta („7 דקות קריאה") | Vorgabe aus dem Task-Briefing; Standardformulierung israelischer Magazine |
| On this page (TOC) | בעמוד הזה | Sticky-Inhaltsverzeichnis im Artikel | knapp, genusfrei |
| Written by | נכתב על ידי | Autorenkarte | Passiv bezieht sich auf den Artikel, nicht auf die Leserin — kein Genusproblem |
| Related reading | עוד + מאמרים | Related-Überschrift, zweiteilig (`relatedLead` + gold akzentuierter `relatedAccent`) | Hebräisch stellt das Substantiv voran; damit wie in EN/DE/RU das **Substantiv** akzentuiert wird, trägt `עוד` den Vorlauf und `מאמרים` den Akzent |
| Recommended properties | נכסים מומלצים | Fallback-Überschrift des Projektblocks im Artikel | Glossar §2 `נכס`/`נכסים` |
| Recommended properties in {city} | נכסים מומלצים ב-⟦FSI⟧{city}⟦PDI⟧ | dieselbe Überschrift, wenn der Artikel eine Stadt nennt | `{city}` wird von der Route mit dem **lateinischen** Namen ersetzt (`Paphos`/`Limassol`/`Larnaca`), deshalb FSI/PDI-Isolation und die Bindestrich-Präposition aus §3. Siehe offene Frage 2 in `wp4.md` |
| Load {n} more posts | לטעון עוד {n} מאמרים | Ladeknopf im alten `BlogPostsRenderer` | Infinitiv statt Imperativ, genusfrei |
| Price from (Label vor dem Preis) | מחיר התחלתי | `BlogSlide`-Preiszeile | Das Glossar-`החל מ-` muss direkt am Betrag kleben; die Komponente schiebt ein `&nbsp;` dazwischen, der Bindestrich stünde also frei. `מחיר התחלתי` ist als eigenständiges Label natürlich |
| developer | יזם / יזמים | `/he/developers` H1, Meta, Intro | Glossar §2 (`יזם / חברה יזמית`) und §4 (Navigation: `יזמים`) — durchgehend `יזם/יזמים`, nie `קבלן` |
| builders (große Baufirmen) | חברות בנייה | Intro `/he/developers`, um `יזם` im selben String nicht zu wiederholen (§11.5) | Keyword-Map nennt `חברות בנייה בקפריסין` als Nebenform; hier als Synonym im Fließtext |
| vetted | עבר בדיקה | Intro `/he/developers` | konkreter als `מאומת`; sagt, dass wir selbst geprüft haben |
| clean legal title | טאבו נקי | Intro `/he/developers` | Glossar §2 führt `טאבו` als israelisches Äquivalent zum Title Deed; `טאבו נקי` ist die geläufige Kaufformel |
| delivery track record | היסטוריית מסירה | Intro `/he/developers` | Glossar §2 `מסירה` = handover |
| active current portfolio | תיק נכסים מעודכן | Intro `/he/developers` | `פורטפוליו` wäre ein unnötiger Anglizismus |
| at no markup to the buyer | בלי תוספת מחיר לרוכש | Intro `/he/developers` | sagt die Tatsache, ohne sie zu bewerben |
| boutique studio | סטודיו בוטיק | Meta + Intro `/he/developers` | im israelischen Immobilien-/Design-Sprachgebrauch etabliert |
