# Hebräische Lokalisierung (`he`) — Design & Phasenplan

**Stand:** 2026-09-13 · **Status:** Entwurf zur Freigabe · **Umsetzung:** nur auf Staging (`design.cyprusvipestates.com`), Produktions-Freischaltung ist eine separate Operator-Entscheidung.

---

## 0. Kurzfassung

Die Website bekommt eine fünfte Locale `he` (Hebräisch, RTL) unter dem Präfix `/he/`. Das ist keine „weitere Sprache im Dictionary" — die Codebasis hat **kein Dictionary-System**, **keinerlei RTL-Unterstützung**, ein **Prisma-Enum `Locale`** mit vier Werten, **zwei verschiedene Speichermuster** für lokalisierte Inhalte und rund **85 Dateien mit inline gepflegten Sprachtabellen**. Deshalb gliedert sich die Arbeit in drei Schichten, die nacheinander stabil sein müssen:

1. **Plumbing** (Locale-Registrierung, Routing, DB-Enum, RTL-Grundlage, Fonts, Formate) — macht `/he/*` technisch erreichbar, noch mit englischem Fallback-Text.
2. **Admin-Integration** — macht hebräische Inhalte pflegbar (Übersetzungs-Panel, Development-Tabs, Area-Editor, KI-Generatoren auf 5 Sprachen, RTL-Editor).
3. **Inhalt & SEO** — Seitenliste nach echter hebräischer Suchnachfrage, Übersetzungen mit Qualitäts-Gate, Blog-Index ohne Artikel, Lead-Pipeline, hreflang/Sitemap/GSC.

Schutzmechanismus über allem: die neue Konstante **`PUBLIC_LOCALES`** (env-gesteuert) trennt „Locale existiert im Code und in der DB" von „Locale ist öffentlich geroutet, in hreflang, Sitemaps und Sprachumschalter sichtbar". Damit kann Staging `he` zeigen, während Produktion — die **dieselbe Datenbank** benutzt — `/he/*` weiter mit 404 beantwortet und keine hreflang-Links auf nicht existierende Seiten emittiert.

---

## 1. Kontext und Ist-Zustand (aus der Code-Erkundung)

### 1.1 Markt
Israelische Käufer sind seit Jahren die größte oder zweitgrößte ausländische Käufergruppe auf Zypern (Limassol, Larnaka, zunehmend Paphos). Treiber: 45 Minuten Flug, Steuerregime (Non-Dom), Sicherheit, Euro-Anlage, Aufenthaltsrecht. Das Inventar der Website ist Paphos-lastig (166 Projekte) mit Limassol als zweitem Markt (55), Larnaka praktisch nicht vorhanden (1). **Die hebräische Seitenliste darf deshalb kein 1:1-Spiegel der DE-Seiten sein** — sie muss dort ansetzen, wo hebräische Nachfrage auf vorhandenes Inventar trifft (Limassol-Apartments, Paphos-Villen, Investment, Aufenthaltsrecht, Steuern).

### 1.2 Wo Locales heute definiert sind
| Quelle | Datei | Rolle |
|---|---|---|
| Client-sichere Konstante | `src/lib/locale.ts:7-8` (`LOCALES`, `DEFAULT_LOCALE`, `isLocale`, `localizedHref`) | 57 Importer — **der richtige Engpass** |
| Middleware-Konfig | `src/i18n.config.ts:5-18` (`languages`, `locales`) | 26 Importer, treibt next-intl-Middleware und Sprachumschalter |
| Middleware-Duplikat | `src/middleware.ts:11` `ALL_LOCALES` | |
| Legacy-Duplikat | `src/sanity/sanity.utils.ts:885` `ALL_LOCALES` | |
| Datenbank | `prisma/schema.prisma:22-27` `enum Locale { en de pl ru }` | 9 Content-Modelle + 5 Skalarfelder |
| nginx | `ops/nginx/cyprusvipestates.conf:171` `location ~ ^/(de\|pl\|ru)(/\|$)` | außerhalb der App |

Hartkodierte Listen im `src/`-Baum: **53** Array-Literale `["en","de","pl","ru"]` in 50 Dateien, **16** Union-Typen, **37** Objekt-Maps `{en,de,pl,ru}`, **230** `lang === "ru"`-artige Bedingungen, **16** Regexe der Form `(de|pl|ru)` (Middleware Z. 355/371/383/400, `navShared.tsx:26`, Inline-Script in `[lang]/layout.tsx:128`, `seo/templateClass.ts`, `seo/urlCanonical.ts`, `pagePower/classVerdicts.ts`, `sanity.utils.ts:200`).

### 1.3 Zwei Speichermuster für Inhalte
- **Muster A — eine Zeile pro Sprache**, verbunden über `translationGroupId`: `Project`, `Blog`, `Singlepage`, `CaseStudy`, `Property`, `Developer`, `Author`, `Category`, `SiteDocument` (Homepage/Header/Footer/FAQ/404/Blog-Page/Projects-Page als JSON-Singletons `@@unique([type, language])`). Admin-UI: `src/app/admin/TranslationsPanel.tsx` (+ `createTranslation` in `admin/actions.ts:1726`, kopiert die Quellzeile als DRAFT ohne Übersetzung).
- **Muster B — Spalten mit Sprachsuffix** auf einer Zeile: `DevelopmentOverride.descriptionEN/DE/PL/RU` (Schema Z. 1400-1403), `DevelopmentOverride.seo` Json `{titleEN…, descEN…}` (Z. 1417), `AreaDescription.textEN/DE/PL/RU` (Z. 1433-1436), `User.signature` Json `{en,de,pl,ru}` (Z. 701). Admin-Tabs: `developments/[id]/DescriptionField.tsx`, `SeoMetaFields.tsx`, `developments/areas/AreaEditor.tsx` (hartkodiert „/4").
- **KI-Generatoren** schreiben heute nativ in 4 Sprachen pro Aufruf: `src/lib/ai/projectDescription.ts:97` (`required: ["en","de","pl","ru"]`), `src/lib/ai/areaContent.ts:45,63` (`FourLang`), `src/lib/ai/seoMeta.ts`. Der gemeinsame Prompt-Vorspann `src/lib/ai/projectBrief.ts:23` sagt dem Modell wörtlich „Four locales". **Es gibt keinen Übersetzungs-Endpoint und keinen Übersetzen-Button.**

### 1.4 UI-Strings
Kein JSON, kein `getDictionary`, `next-intl` nur als Middleware. Strings liegen als `const EN = {...}` + `Record<string, T>` inline neben Komponenten. Größte Module: `[lang]/projects/projectsI18n.ts` (448 Z.), `preview-partners/[lang]/copy.ts` (384), `preview-about/[lang]/copy.ts` (399), `lib/developmentCopy.ts`, `preview-contacts/[lang]/copy.ts` (272), `preview-case-studies/[lang]/copy.ts`, `c/[token]/copy.ts`, `components/qualifierFields.ts`, `book/[token]/copy.ts`, `[lang]/blog/blogI18n.ts`, `preview-faq/[lang]/copy.ts`, `preview-home/sections/homeI18n.ts`. Rechtstexte als eigene Dateien `preview-legal/[lang]/[doc]/{privacy,terms}.{en,de,pl,ru}.ts` (1.443 Zeilen). **Gefahr:** die meisten Tabellen sind `Record<string, T>` mit `?? EN` — eine fehlende `he`-Spalte kompiliert und rendert stumm Englisch.

### 1.5 RTL, Fonts, Formate
- RTL: **null**. Kein `dir`-Attribut, kein `[dir="rtl"]`-CSS. 458 physische `left/right`-Deklarationen gegen 47 logische; 148 richtungsgebundene Tailwind-Utilities in TSX. 13 separate Root-Layouts setzen `<html lang>` unabhängig voneinander.
- Fonts (`[lang]/layout.tsx:33-58`): Nur **Rubik** (Body) hat einen Hebrew-Subset. `Fraunces` (`--font-display`), `Mulish` (`--font-body`), `Playfair Display` (`--font-display-cyr`) haben **keine hebräischen Glyphen**. Präzedenzfall für ein sprachspezifisches Display-Font existiert (`--font-display-cyr`). PDF-Route nutzt DejaVu Sans (hat Hebrew), aber `@react-pdf/renderer` macht kein Bidi-Reordering.
- Formate: 4 duplizierte BCP-47-Maps (`formatMonthYear.ts`, `crm/bookingMessages.ts`, `book/[token]/page.tsx`, `SlotPicker.tsx`, `ProjectsMapAll.tsx`, `PropertyMap.tsx`, `preview-legal/[doc]/page.tsx`); 39× hartes `"en-GB"`, 15× `"en-US"`; Preise überall `€` + `toLocaleString("en-US")`.

### 1.6 SEO-Stack, der eine Locale kennen muss
`src/lib/seo.ts` (`staticAlternates` iteriert `LOCALES` → **emittiert sofort hreflang auf `/he/*`, sobald `LOCALES` erweitert wird, auch für Seiten ohne Inhalt**), `src/app/sitemaps/[type]/route.ts` (`langs` Z. 15, `XDEFAULT_ORDER` Z. 100), `src/lib/gsc/client.ts:48-53` (`deriveLocale` kennt nur de/pl/ru → `/he/` würde als `en` gebucht), `src/lib/seo/urlCanonical.ts:57-60`, `src/lib/seo/queries.ts:115,295`, `src/lib/seo/pagePower/inventory.ts:47-115`, `scripts/verify-page-power.mjs` (schlägt laut fehl, wenn Sitemap und Inventar auseinanderlaufen — gut), IndexNow-Fan-out in `developments/[id]/actions.ts:473,637`, `corporatePageSlugs.ts` (exhaustiv typisiert — Build bricht bis 4 hebräische Slugs da sind — gut), `nestedPageRedirects.json` + `genNestedRedirects.mjs:16`.

### 1.7 Staging
`./scripts/deploy-staging.sh` synct den **lokalen Arbeitsbaum** (ohne `--delete`) nach `/var/www/cve-staging`, baut dort und lädt `cve-staging` (Port 3200) neu. Staging ist per nginx domainweit `noindex` + `robots Disallow: /`. **Staging und Produktion teilen eine Postgres-Instanz.** Konsequenz: jede Migration und jeder hebräische Inhaltsdatensatz landet in der Produktions-DB. Das ist akzeptabel (additive Enum-Migration, Inhalte als DRAFT oder durch `PUBLIC_LOCALES` unsichtbar), muss aber bewusst so geplant sein.

### 1.8 Tests
Kein Vitest/Playwright. `npm test` = Node-Runner über MCP-Tests. Vorhandene Wächter: `scripts/verify-page-power.mjs`, `scripts/qa/url-sweep.sh`, `scripts/verify-landing-merges.sh` (mit `CVP_VERIFY_HOST` auf Staging zeigbar), `scripts/qa/homepage-lang-check.mjs`.

---

## 2. Entscheidungen, die du treffen musst

Jede Entscheidung hat eine Empfehlung. Ohne Rückmeldung setze ich die Empfehlung um.

| # | Frage | Optionen | Empfehlung & Begründung |
|---|---|---|---|
| **A** | **Slug-Schrift** für hebräische Seiten | (1) Lateinische Slugs unter `/he/` (z. B. `/he/apartments-limassol`) · (2) Hebräische Slugs (`/he/דירות-בלימסול`) · (3) Gemischt | **(1) in Phase 1.** hreflang trägt die Sprache; Hebrew-Slugs bringen einen kleinen CTR-Vorteil in israelischen SERPs, kosten aber ein UTF-8-Audit über 16 Regex-Stellen, nginx, Sitemap-XML, IndexNow, GSC-Ingest und Teilen per WhatsApp (percent-encoded). Hebräische Slugs später als Experiment auf 2–3 Landingpages. |
| **B** | **Rechtstexte** (Datenschutz, AGB) | (1) Ins Hebräische übersetzen mit Hinweis „englische Fassung ist maßgeblich" · (2) Englisch belassen, nur Chrome hebräisch · (3) Juristisch geprüfte Übersetzung | **(1).** Vollständige Lokalisierung, rechtlich durch die Maßgeblichkeitsklausel abgesichert; (3) nur wenn ein Anwalt eingeplant ist. |
| **C** | **Blog-Index `/he/blog`** ohne übersetzte Artikel | (1) Englische Artikel als Karten anzeigen, Badge „באנגלית", Link auf `/blog/<slug>`; Index `noindex` bis ≥5 hebräische Artikel · (2) Leerer Index mit hebräischem Intro und Link zum EN-Blog · (3) Blog aus der `/he`-Navigation ausblenden | **(1).** Gibt dem Besucher Substanz, vermeidet Thin-Content-Indexierung, und der Codepfad (Cross-Locale-Query) ist klein. |
| **D** | **Anrede/Genus** im Hebräischen | (1) Männlicher Plural/neutrale Formulierungen (Branchenstandard) · (2) Konsequent beide Formen (את/ה) · (3) Infinitiv-/Nominalstil | **(1) mit (3) wo möglich.** Standard israelischer Immobilien-Marketing-Register; (2) wirkt formularhaft. |
| **E** | **Kontaktseite**: Team spricht kein Hebräisch (Sprachliste in `preview-contacts/[lang]/languages.ts` kennt kein `he`) | (1) Ehrlich: „Beratung auf Englisch/Russisch, Anfragen auf Hebräisch willkommen" · (2) Hebräischsprachigen Partner/Berater aufnehmen · (3) Nichts sagen | **(1)** sofort, (2) als Geschäftsentscheidung. Viele israelische Käufer sprechen Russisch oder Englisch; Ehrlichkeit schützt die Conversion. |
| **F** | **Native Review** der Übersetzungen | (1) Externer muttersprachlicher Lektor für alle client-facing Seiten vor Veröffentlichung (Pflicht-Gate) · (2) Nur Stichproben · (3) Kein Human-Review | **(1)** für UI-Chrome, Homepage, Corporate, Landingpages, Formulare, E-Mails. **(2)** für die 200+ Projektbeschreibungen (Stichprobe 15, Prompt nachschärfen, erneut Stichprobe). „Kein AI-Slop" ist ohne Muttersprachler nicht garantierbar. |
| **G** | **Umfang Landingpages Phase 1** | (1) 15–25 keyword-gestützte Seiten · (2) Vollspiegel der 68 EN-Seiten · (3) Nur Hub-Seiten (Paphos/Limassol/Investment) | **(1).** Qualität vor Menge; die DE-Erfahrung zeigt, dass Cluster mit echter Nachfrage schlagen, nicht Volumen. Liste entsteht in Phase 0 aus Keyword-Daten. |
| **H** | **Legacy-Projektseiten** (221 `Project`-Zeilen ×4) | (1) Nur Developments (neue Pipeline) hebräisch, Legacy-Projekte ohne `he`-Zeile → im Switcher nicht angeboten · (2) Auch Legacy-Zeilen per KI anlegen | **(1).** Legacy-Projekte laufen aus; Developments sind das Zukunftsmodell und haben bereits den KI-Generator. |
| **I** | **Case Studies** (3 Stories ×4) | übersetzen / nicht | **Übersetzen** — 3 Seiten, hoher EEAT-Wert, kleiner Aufwand. |
| **J** | **Partner-Seite** (`/partners`, 384 Zeilen B2B-Copy) | übersetzen / nur EN | **Nicht in Phase 1.** B2B-Zielgruppe ist nicht der israelische Endkäufer. |

---

## 3. Architektur-Prinzipien

### 3.1 Eine Wahrheit für Locales
`src/lib/locale.ts` wird die einzige Definitionsstelle:

```ts
export const LOCALES = ["en", "de", "pl", "ru", "he"] as const;          // existiert (Code + DB-Enum)
export const PUBLIC_LOCALES = parsePublicLocales(process.env.NEXT_PUBLIC_LIVE_LOCALES) // Default: alle
export const RTL_LOCALES = ["he"] as const;
export const localeDir = (l: string) => RTL_LOCALES.includes(l) ? "rtl" : "ltr";
export const BCP47: Record<Locale, string> = { en: "en-GB", de: "de-DE", pl: "pl-PL", ru: "ru-RU", he: "he-IL" };
export const LOCALE_LABELS: Record<Locale, {code,name}> = { …, he: { code: "HE", name: "עברית" } };
```
`i18n.config.ts`, `middleware.ts:11`, `sanity.utils.ts:885`, `corporatePageSlugs.ts:15`, `developmentSeo.ts:68`, `developmentCopy.ts:11`, `crm/presentationMessages.ts:8`, `c/[token]/copy.ts`, `book/[token]/copy.ts`, `crm/filters.ts:12`, `admin/actions.ts:45`, `admin/TranslationsPanel.tsx:9`, `sitemaps/[type]/route.ts:15,100` importieren statt zu duplizieren. Die 4 BCP-47-Maps werden auf `BCP47` zusammengezogen.

**Trennung Existenz vs. Veröffentlichung:**
- `LOCALES` → Prisma-Validierung (`isLocale`), Admin-Tabs, Übersetzungs-Panel, KI-Generatoren, Lead-API-Akzeptanz.
- `PUBLIC_LOCALES` → Middleware-Locale-Set, `generateStaticParams`, `staticAlternates`/`languageAlternates`, Sitemaps, `XDEFAULT_ORDER`, Sprachumschalter, IndexNow-Fan-out.
- Env: Staging `NEXT_PUBLIC_LIVE_LOCALES=en,de,pl,ru,he`; Produktion unverändert (Default ohne Variable = alle **außer** Locales in `LAUNCH_GATED_LOCALES=he`, damit ein vergessenes Env nicht versehentlich freischaltet). Die Freischaltung in Produktion ist dann eine Env-Änderung plus nginx-Zeile, kein Code-Deploy.

### 3.2 RTL-Strategie
1. `<html lang={lang} dir={localeDir(lang)}>` in **allen 13 Root-Layouts**; Admin bleibt `ltr`, aber Editor-Inhalte mit `language === "he"` bekommen `dir="rtl"`.
2. **Tailwind 3.4** (vorhanden): Codemod `ml-→ms-`, `mr-→me-`, `pl-→ps-`, `pr-→pe-`, `left-→start-`, `right-→end-`, `text-left→text-start`, `text-right→text-end`, `rounded-l/r→rounded-s/e` über die 148 Fundstellen; Ausnahmen (absolute Overlays auf Bildern, Map-Controls) bewusst mit `ltr:`/`rtl:`-Varianten markieren.
3. **SCSS/CSS**: Codemod `margin/padding/border-left|right` → `-inline-start|end` (sicher), `left:`/`right:` (Positionierung) manuell prüfen — Liste der 458 Stellen wird in Phase 2 generiert und abgehakt.
4. **Komponenten mit Richtungssemantik**: Chevrons/Pfeile (`[dir=rtl] .icon-dir { transform: scaleX(-1) }`), Swiper 11 (`dir="rtl"` Prop, unterstützt), Breadcrumb-Trenner, Fortschrittsbalken, Slide-In-Menüs (Mobile-Menü kommt von der anderen Seite), Formular-Icons, Tooltips.
5. **Bidi-Inseln**: Preise (`€ 450.000`), Telefonnummern, E-Mails, URLs, Projektnamen in Lateinschrift, Datumsausgaben → `<bdi>` bzw. `unicode-bidi: isolate`. Zentrale Helfer `fmtPrice(lang)`, `fmtDate(lang)` ersetzen die ~15 `en-US`-Preisformatierer im öffentlichen Baum.
6. **Karten** (MapLibre/Leaflet) bleiben LTR-Container mit `dir="ltr"`; Popups hebräisch.
7. **Visuelle QA**: Screenshot-Matrix pro Seitentyp (Desktop/Mobile) auf Staging, Vergleich EN↔HE nebeneinander; Checkliste in `docs/i18n/rtl-qa-checklist.md`.

### 3.3 Font-Stack Hebräisch
- Body: `Rubik` mit Subset `hebrew` ergänzen (bereits geladen, Rubik wurde ursprünglich für Hebräisch entworfen).
- Display: `Frank Ruhl Libre` (Serif, hebräisch, editorialer Charakter — passt zur Fraunces-Stimmung) als `--font-display-he`, analog zum `--font-display-cyr`-Präzedenzfall; Aktivierung über `:lang(he)`/`[dir=rtl]`.
- Fallback-Stack: `"Frank Ruhl Libre", "Noto Serif Hebrew", serif` bzw. `Rubik, Heebo, Arial, sans-serif`.
- Ziffern bleiben westlich (Standard in Israel).
- PDF (`api/projects/[lang]/[slug]/pdf`): hebräische Fassung in Phase 1 **nicht** angeboten (Button ausblenden für `he`), weil react-pdf kein Bidi kann; separater Folgeschritt.

### 3.4 Datenmodell
- Migration 1: `ALTER TYPE "Locale" ADD VALUE 'he'` — eigene Migration, in Postgres ≥12 innerhalb der Prisma-Transaktion erlaubt, der neue Wert darf aber nicht in derselben Migration verwendet werden. Ausrollen über `scripts/migrate-deploy-safe.sh`.
- Migration 2: `DevelopmentOverride.descriptionHE String?`, `AreaDescription.textHE String?`; `seo`-Json und `User.signature`-Json bekommen die Keys `titleHE/descHE` bzw. `he` (keine Migration nötig, Typ-Kommentare aktualisieren).
- Muster A braucht keine Schemaänderung — nur `he`-Zeilen.

### 3.5 Qualitäts-Gate für Übersetzungen (gegen „AI-Slop")
Verbindlicher Prozess für alle client-facing Texte:

1. **Styleguide** `docs/i18n/he-styleguide.md`: Register (professionell-warm, kein Marketing-Geschrei), Genus (Entscheidung D), Satzlänge (kürzer als im Deutschen, kein Schachtelsatz), Zahlen/Währung (`€` vor der Zahl, westliche Ziffern, Tausenderpunkt wie in Israel üblich: `450,000 €` **oder** `€450,000` — eine Konvention festlegen), Datumsformat `he-IL`, Anführungszeichen „״", Bindestrich vs. Maqaf.
2. **Glossar** `docs/i18n/he-glossary.md` mit festgelegten Ortsnamen (קפריסין, לימסול, פאפוס, לרנקה, ניקוסיה, איה נאפה, פרוטארס, פולי, פייה, קורל ביי, קאטו פאפוס, ג'רוסקיפו…), Immobilienbegriffen (off-plan = „על הנייר", Penthouse = פנטהאוז, Townhouse = בית טורי/קוטג' טורי, Villa = וילה, Bauträger = יזם/חברה יזמית, Titeldeed = טאבו/נסח, Non-Dom, Golden Visa = ויזת זהב/אשרת משקיע, Permanent Residency = תושבות קבע), Marke „Cyprus VIP Estates" (bleibt lateinisch), CTA-Standardformulierungen.
3. **Drei Pässe pro Text**: (a) Erstübersetzung mit Styleguide+Glossar im Kontext, Quelltext ist immer **Englisch** (nicht Deutsch — weniger Kalkierungsfehler); (b) unabhängiger Kritik-Pass mit anderem Prompt („Finde Anglizismen, Kalkierungen, falsche Genus-Kongruenz, unnatürliche Wortfolge, Marketing-Floskeln; schreibe um, als wäre es original hebräisch geschrieben"); (c) **Muttersprachler-Review** (Entscheidung F) mit Änderungsprotokoll, das ins Glossar zurückfließt.
4. **Verbotsliste** typischer KI-Muster im Hebräischen: übersetzte englische Idiome, Häufung von „ייחודי/מושלם/חלומי", Passiv-Konstruktionen aus dem Englischen, Doppelpunkt-Überschriften, `—`-Gedankenstriche, Aufzählungs-Dreiklänge, wörtliche Übersetzung von „discover/unlock/elevate".
5. **Technische Prüfung**: Meta-Title ≤ 60 Zeichen (hebräische Zeichen sind etwa gleich breit wie lateinische Großbuchstaben, Pixelgrenze ~580 px), Description ≤ 155, keine gemischte Schrift in Slugs, `inLanguage: "he"` in JSON-LD, `og:locale he_IL`.

### 3.6 SEO-Regeln speziell für `he`
- hreflang `he` (nicht `he-IL`), x-default bleibt `en`.
- Sprachumschalter zeigt `he` nur, wenn die aktuelle Seite eine `he`-Fassung hat (heutiges Verhalten beibehalten).
- Keine Seite geht mit englischem Fallback-Text in den Index: **Veröffentlichungsregel** — eine `he`-Zeile wird nur PUBLISHED, wenn der Review-Pass (3.5c) protokolliert ist.
- Interne Verlinkung: jede hebräische Landingpage verlinkt Hub↔Spoke innerhalb `he` (Lehre aus DE/PL/RU-Clustern), keine Querlinks in andere Locales außer Blog (Entscheidung C).
- GSC: `deriveLocale` erweitern, damit `/he/` nicht als `en` gezählt wird; Page-Power-Inventar und `verify-page-power.mjs` um `he` erweitern **bevor** die Sitemap `he` enthält.

---

## 4. Seitenliste (Lokalisierungs-Inventar)

### 4.1 Pflicht — System- und Chrome-Seiten (alle über Code oder `SiteDocument`)
| Seite | Quelle | Art |
|---|---|---|
| Homepage `/he` | `SiteDocument homepage` + `preview-home/sections/homeI18n.ts` | DB + Code |
| Header, Footer, Newsletter, Cookie-Consent, Formular-Feedback | `SiteDocument header/footer`, `navShared.tsx`, `Footer*`, `consentCopy.ts`, `formFeedbackCopy.ts`, `qualifierFields.ts`, `QualificationForm` | Code + DB |
| 404 | `SiteDocument notFoundPage`, `NotFoundPageComponent` | DB + Code |
| Projekte-Liste `/he/projects` (Filter, Karte, Karten) | `projectsI18n.ts`, `SiteDocument projectsPage`, `ProjectFilters`, `DistancesStrip`, `ScarcityBanner` | Code + DB |
| Projektseite (Development) | `developmentCopy.ts`, `developmentSeo.ts` (Labels, Auto-Title/Desc), `DevelopmentOverride.descriptionHE`, `seo.titleHE/descHE` | Code + DB |
| Bauträger-Liste + Profile `/he/developers` | `Developer`-Zeilen (88) — Kurzprofile per KI + Stichprobe | DB |
| Über uns | `preview-about/[lang]/copy.ts` + `Singlepage`-Zeile (Team/Reviews) + hebr. Slug in `corporatePageSlugs.ts` | Code + DB |
| Kontakt | `preview-contacts/[lang]/copy.ts`, `languages.ts` (LABELS `he`-Spalte), Slug | Code |
| FAQ `/he/faq` | `SiteDocument faqPage` (+ `createFaqTranslation`), `preview-faq/[lang]/copy.ts` | DB + Code |
| Datenschutz, AGB | `privacy.he.ts`, `terms.he.ts`, `registry.ts`, Slugs (Entscheidung B) | Code |
| Case Studies (3) | `CaseStudy`-Zeilen + `preview-case-studies/[lang]/copy.ts` (Entscheidung I) | DB + Code |
| Blog-Index `/he/blog` (+ `/page/[n]`) | `blogI18n.ts`, `SiteDocument blogPage`, Cross-Locale-Karten (Entscheidung C) | Code + DB |
| Booking `/book/[token]`, Präsentation `/c/[token]` | `book/[token]/copy.ts`, `c/[token]/copy.ts` — folgen `Lead.languagePreference` | Code |
| E-Mails: Auto-Reply, Buchungsbestätigung, Präsentations-Share, CRM-Signatur | `emailTemplates.ts`, `crm/bookingMessages.ts`, `crm/presentationMessages.ts`, `emailSignature/resolve.ts`, `crm/compose/greeting.ts`, `playbook/by-language.md` (Abschnitt Hebräisch) | Code |
| ROI-Rechner | `roi-calculator/*` | Code |
| Statisches Asset | `public/img/contact/iphone-he.webp` | Asset |

### 4.2 Keyword-gesteuert — kommerzielle Landingpages (`Singlepage`, Ziel 15–25, Entscheidung G)
Kandidaten-Cluster, endgültige Liste nach Keyword-Recherche in Phase 0 (Volumen google.co.il, SERP-Wettbewerber wie yad2/madlan-Auslandsrubriken, israelische Zypern-Makler, AI-Sichtbarkeit):
1. **Hub „Immobilien auf Zypern"** (נדל"ן בקפריסין / דירות למכירה בקפריסין) — Cornerstone.
2. **Limassol-Hub** + Apartments Limassol + Meerblick/Beachfront Limassol (49 Apartments im Inventar).
3. **Paphos-Hub** + Villen Paphos + Apartments Paphos + Luxusvillen (166 Projekte).
4. **Investment**: Rendite/Vermietung (השקעה בנדל"ן בקפריסין, תשואה), Off-Plan/Neubau (פרויקטים חדשים / על הנייר).
5. **Aufenthalt & Steuern**: Permanent Residency durch Immobilienkauf (תושבות קבע קפריסין), Non-Dom-Steuerstatus, Kaufprozess für Israelis (תהליך רכישת נכס בקפריסין) — Buying-Process-Cornerstone, den auch die EN/DE-Roadmap vermisst.
6. **Relocation-Brücke**: Umzug nach Zypern aus Israel (רילוקיישן לקפריסין), Leben in Limassol — kommerziell verlinkt, nicht als Blog.
7. **Typ-Seiten**: Penthäuser, Stadthäuser, Villen mit Pool — nur wenn Volumen nachweisbar.
Nicht bauen: Larnaka-Seiten (kein Inventar), Nordzypern, Partner-Seite.

### 4.3 Projekt- und Bauträger-Inhalte (Volumen)
- Developments (veröffentlicht): Beschreibung `descriptionHE` + Meta `titleHE/descHE` per erweitertem KI-Generator, Stichproben-Review 15 Stück → Prompt-Iteration → Freigabe des Rests. Anzahl wird in Phase 0 aus der DB ermittelt (Produktions-Lesezugriff, wird als solcher genannt).
- `AreaDescription.textHE` (Nachbarschafts-Texte) analog.
- 88 Developer-Kurzprofile: KI + Stichprobe.
- Legacy `Project`-Zeilen: keine `he`-Fassung (Entscheidung H).

### 4.4 Bewusst nicht lokalisiert
Blog-Artikel (Vorgabe), Partner-Seite, Sandbox/Style-Seiten, Admin (Englisch laut Projektkonvention), Legacy-Projekte, PDF-Factsheet (Bidi-Limit), `preview-project`-QA-Route.

---

## 5. Phasenplan

Jede Phase endet mit einem Staging-Deploy und einer Abnahme-Checkliste. Reihenfolge ist zwingend: 1 → 2 → 3 parallel zu 4 → 5 → 6/7 → 8 → 9. Relative Größe: S (< 1 Tag), M (1–3 Tage), L (3–7 Tage), XL (> 1 Woche inkl. Review-Schleifen).

### Phase 0 — Fundament & Entscheidungen (M)
- Entscheidungen A–J einholen; Defaults dokumentieren.
- **Keyword-Recherche Hebräisch** (echte Daten, kein Bauchgefühl): Volumen, SERP-Sieger, Fragen („People also ask" in Hebräisch), AI-Sichtbarkeit (ChatGPT/Perplexity-Antworten auf hebräische Zypern-Fragen). Ergebnis: priorisierte Seitenliste 4.2 mit Ziel-Keyword, Intent, Zielseite im Inventar. Datei `docs/i18n/he-keyword-map.md`.
- Styleguide + Glossar (3.5) schreiben; Muttersprachler-Lektor beauftragen (Entscheidung F) und Review-Protokoll-Vorlage anlegen.
- DB-Inventar: Anzahl veröffentlichter Developments, Developer, Areas; Liste der `SiteDocument`-Typen mit Zeilen pro Locale.
- **Abnahme:** Keyword-Map liegt vor, Glossar ≥ 80 Einträge, Lektor bestätigt.

### Phase 1 — Locale-Plumbing (L)
1. `src/lib/locale.ts` als einzige Quelle (3.1); alle Duplikate darauf umstellen (Liste 1.2). Typen von `Record<string,T>` mit `?? EN` auf `Record<Locale,T>` heben, wo es Copy-Tabellen sind — **so wird jede fehlende `he`-Spalte ein Build-Fehler**, nicht ein stiller englischer Text. Übergangsweise `he: EN`-Platzhalter mit `// TODO(he)`-Marker, die ein Skript `scripts/qa/he-placeholders.mjs` zählt (Ziel 0 vor Launch).
2. `PUBLIC_LOCALES`-Gating in Middleware (`createIntlMiddleware` Z. 504), `generateStaticParams` (6 Routen), `staticAlternates`/`languageAlternates`, Sitemaps, Sprachumschalter, IndexNow-Fan-out.
3. Die 16 `(de|pl|ru)`-Regexe auf generierte Muster aus `LOCALES` umstellen (`nonDefaultLocalePattern()`); `nestedPageRedirects.json` um `he: {}`; `genNestedRedirects.mjs`.
4. Prisma-Migrationen (3.4); Zod/Set-Validierer in `api/leads`, `api/email`, `api/roi-calculator`, `api/monday-newsletter`, MCP `createLeadInput.ts`/`updateLead.ts`.
5. `dir`-Attribut in 13 Layouts; `localeDir`-Helper; Inline-Pre-Paint-Script in `[lang]/layout.tsx:128` anpassen; Cookie-Consent-Cast Z. 209.
6. Fonts (3.3); zentrale `fmtPrice`/`fmtDate`/`BCP47`.
7. `corporatePageSlugs.ts`: 4 hebräische **lateinische** Slugs (`about-us`, `contact`, `privacy-policy`, `terms` — Entscheidung A).
8. nginx-Zeile `^/(de|pl|ru|he)(/|$)` als **vorbereiteter Patch** in `ops/nginx/` (Produktion erst bei Launch).
9. `projectBrief.ts:23` Prosa auf fünf Locales.
- **Abnahme (Staging):** `/he` rendert Homepage-Chrome mit `dir="rtl"`, Fonts laden, `/he/projects` listet, Sprachumschalter zeigt HE nur wo Inhalt existiert; Produktion antwortet weiterhin 404 auf `/he` (lokal mit Produktions-Env-Simulation geprüft); `npm run build` grün; `he-placeholders.mjs` zeigt die Ausgangszahl.

### Phase 2 — RTL-Layout (L)
- Tailwind- und SCSS-Codemods (3.2) laufen lassen, Diff prüfen, Ausnahmen markieren.
- Komponenten mit Richtungssemantik händisch: Header/Mobile-Menü, Breadcrumbs, Swiper-Galerien, Projektkarten, Filterleiste, Formulare, Footer, Cookie-Banner, Blog-Karten, Kontakt-Layout, Legal-Layout, Booking-Slot-Picker, Präsentationsseite.
- Bidi-Inseln (Preise, Telefon, E-Mail, lateinische Projektnamen).
- Screenshot-Matrix EN↔HE (Desktop 1440, Mobile 390) für jeden Seitentyp aus 4.1; Checkliste `docs/i18n/rtl-qa-checklist.md` abgehakt.
- **Abnahme:** keine physischen `left/right`-Deklarationen mehr außerhalb der markierten Ausnahmen (Zählskript); alle Screenshots ohne Überlappungen, abgeschnittene Texte oder falsch gerichtete Icons.

### Phase 3 — Admin-Integration (M)
- `TranslationsPanel.tsx` + `createTranslation`/`createFaqTranslation` lesen `LOCALES` → HE-Pille für Blog, Pages, Projekte, Case Studies, Developer, Autoren, Kategorien.
- Development-Tabs auf 5 Sprachen: `DescriptionField.tsx`, `SeoMetaFields.tsx`, `AreaEditor.tsx` (Zähler `/5`), `developments/[id]/page.tsx:111`; Speicher-Aktionen schreiben `descriptionHE`/`textHE`/`titleHE`/`descHE`.
- KI-Generatoren auf 5 Sprachen: `projectDescription.ts`, `areaContent.ts` (`FourLang`→`ContentLang`), `seoMeta.ts`; Prompt-Regeln für Hebräisch aus Styleguide/Glossar (Glossar wird als Prompt-Kontext injiziert, nicht auswendig gelernt). `AiPromptTemplate seoMeta` in der DB ergänzen.
- Listen-Filter, `new-content-form.tsx`, Settings-Footer, Featured-Homepage, FAQ-Seiten, CRM-Selects (`filters.ts`, Lead-Formulare, `PropertyMatching.tsx`, `PresentationEditor.tsx`, `bookingActions.ts`).
- **RTL im Editor**: Tiptap-Content und Textareas mit `dir="rtl"`, wenn die bearbeitete Zeile `language === "he"` ist; Slug-Feld bleibt LTR.
- Admin-Sprache bleibt Englisch (Projektkonvention).
- **Abnahme:** Auf Staging kann ein Redakteur eine HE-Übersetzung einer Singlepage anlegen, im RTL-Editor bearbeiten, als DRAFT speichern und über `/he/<slug>` (Draft-Preview) sehen; ein Development bekommt per Klick eine hebräische Beschreibung + Meta.

### Phase 4 — UI-Chrome-Übersetzung (L, mit Review-Schleife)
- Alle Copy-Tabellen aus 1.4 und 4.1 hebräisch befüllen (Reihenfolge: Header/Footer/Forms → Projekte → Homepage → Blog-Chrome → Kontakt/About/FAQ → Legal → Booking/Präsentation → E-Mails → ROI).
- Prozess 3.5 pro Datei; Review-Protokoll in `docs/i18n/reviews/<datei>.md`.
- `he-placeholders.mjs` → 0.
- **Abnahme:** Lektor-Freigabe für jede Datei; Build grün; Screenshot-Matrix erneut (Textlängen ändern Layout).

### Phase 5 — Inhalte (XL)
5a. `SiteDocument`-Zeilen `he`: homepage, header, footer, notFoundPage, faqPage, blogPage, projectsPage, formStandardDocument.
5b. Corporate: About (Team/Reviews), Kontakt, Legal (`privacy.he.ts`, `terms.he.ts`).
5c. Case Studies ×3.
5d. Landingpages aus der Keyword-Map (15–25): Struktur je Seite (H1, Intro, Nutzenblöcke, Inventar-Bezug, FAQ-Block mit JSON-LD, interne Links Hub↔Spoke, CTA), Erstellung als DRAFT über das Übersetzungs-Panel oder neu, Review, dann PUBLISHED — nur auf Staging sichtbar, weil Produktion `he` nicht routet.
5e. Developments: Generator-Lauf für `descriptionHE` + Meta über alle veröffentlichten Developments; 15er-Stichprobe → Lektor → Prompt-Korrektur → Rest. `AreaDescription.textHE` analog. Developer-Profile analog.
- **Abnahme:** jede Seite aus 4.1 + 4.2 hat eine hebräische, freigegebene Fassung; `verify-page-power.mjs` und `url-sweep` gegen Staging (Host-Variable) grün für alle `he`-URLs.

### Phase 6 — Blog-Index HE (S–M, Entscheidung C)
- `BlogInsights` bekommt einen Cross-Locale-Modus: für `he` ohne eigene Artikel Karten der EN-Artikel mit Badge „באנגלית", `href` auf `/blog/<en-slug>`; `robots: noindex` auf `/he/blog*` solange `count(he) < 5`; hebräisches Intro aus `SiteDocument blogPage he`; `blogI18n.ts` `he`-Block.
- Sprachumschalter auf EN-Artikeln bietet HE **nicht** an (keine Fassung) — bleibt so.
- **Abnahme:** `/he/blog` rendert RTL mit EN-Karten, ist `noindex`, Links funktionieren, Sitemap enthält `/he/blog` nicht.

### Phase 7 — Lead-Pipeline (M)
- Formulare senden `lang=he`; APIs akzeptieren; `Lead.languagePreference = he`; Auto-Reply hebräisch (`emailTemplates.ts` mit `dir="rtl"` im HTML-Mail-Body, Tabellenlayout für Mail-Clients); Buchungs- und Präsentations-Mails; Signatur `he`; CRM-Playbook `by-language.md` Abschnitt Hebräisch (Anrede, Register, Hinweis „Beratung auf EN/RU" gemäß Entscheidung E); Telegram-Lead-Alert zeigt `HE` (Admin-Copy bleibt Englisch).
- Testlead auf Staging (landet in der Produktions-DB — als Testlead kennzeichnen und danach in den Papierkorb).
- **Abnahme:** Testlead erhält hebräische Auto-Reply, erscheint im CRM mit Sprache HE, Booking-Seite rendert hebräisch.

### Phase 8 — SEO-Härtung & Verifikation (M)
- hreflang/x-default-Stichproben über alle Seitentypen (curl + Parser-Skript, kein Browser); Sitemap `he` nur für PUBLISHED-Seiten; `robots` korrekt; JSON-LD `inLanguage`, `og:locale`.
- GSC `deriveLocale`, `urlCanonical.localeOfPath`, `seo/queries.ts`, Page-Power-Inventar, `templateClass.ts`, `classVerdicts.ts`.
- IndexNow-Fan-out (nur `PUBLIC_LOCALES`).
- Performance: Font-Subsets prüfen (kein Doppelladen), CLS auf RTL-Seiten.
- Neuer Wächter `scripts/qa/he-launch-check.mjs`: Placeholder = 0, jede `he`-PUBLISHED-Zeile hat Review-Protokoll, keine `he`-URL ohne hreflang-Rückverweis von `en`, nginx-Patch vorhanden.
- **Abnahme:** alle Skripte grün gegen Staging.

### Phase 9 — Launch-Vorbereitung (S; Ausführung nur auf Anweisung)
Checkliste für den Operator, **nicht** von mir ausgeführt: nginx-Zeile einspielen + reload; Produktions-Env `NEXT_PUBLIC_LIVE_LOCALES` erweitern; Deploy; GSC-Property prüfen; Sitemap neu einreichen; IndexNow-Ping für alle `he`-URLs; erste 6 URLs manuell in GSC (Quota-Erfahrung beachten); Monitoring der ersten 14 Tage im SEO-Advisor (bekannte Fehlalarm-Klassen im Kopf behalten).

---

## 6. Staging- und Verifikationsregeln

- Deploy nur mit `./scripts/deploy-staging.sh`; jede Phase endet mit einem Deploy und einer Abnahmeliste in `docs/i18n/acceptance/phase-N.md`.
- Verifikation per Node-Fetch/curl gegen `https://design.cyprusvipestates.com` und lokal; Browser-Tools nur auf ausdrückliche Anweisung (Projektregel).
- Produktion wird **nie** unaufgefordert deployed; die `he`-Freischaltung ist eine Operator-Entscheidung (Phase 9).
- Jede lokale Prisma-Schreiboperation gilt als Produktionsschreibzugriff: Content-Anlage läuft über das Staging-Admin-UI, nicht über lokale Skripte; Migrationen über `migrate-deploy-safe.sh`.
- Commits über isolierte Git-Worktrees, nie `git add -A` im geteilten Arbeitsbaum; ein PR pro Phase.

---

## 7. Risiken und Gegenmaßnahmen

| Risiko | Wirkung | Gegenmaßnahme |
|---|---|---|
| `LOCALES` erweitern emittiert sofort hreflang/Sitemap auf leere `/he/*` | Google crawlt 404s, Vertrauensverlust | `PUBLIC_LOCALES`-Gating **vor** der Enum-Erweiterung mergen (Phase 1, Schritt 2 vor Schritt 1 im Deploy) |
| Stille englische Fallbacks durch `Record<string,T> ?? EN` | Halb-hebräische Seiten im Index | Typen auf `Record<Locale,T>` heben + Placeholder-Zähler + Veröffentlichungsregel |
| Geteilte DB Staging/Prod | Hebräische Zeilen liegen in Prod | Harmlos durch Gating; DRAFT-Status; keine lokalen Skript-Writes |
| RTL-Regressionen in LTR-Locales durch Codemods | Layoutbruch DE/EN | Logische Properties sind in LTR identisch; Screenshot-Matrix auch für EN nach Phase 2 |
| Enum-Migration in Transaktion | Migration schlägt fehl | Eigene Migration, Wert erst in Folge-Migration nutzen; Postgres-Version vorab prüfen |
| Fehlende hebräische Glyphen in Display-Font | Systemfont-Fallback wirkt billig | `--font-display-he` (Frank Ruhl Libre), Test auf Staging |
| Übersetzungsqualität | „AI-Slop", Vertrauensverlust bei israelischen Käufern | Prozess 3.5, Muttersprachler-Gate, Glossar-Rückfluss |
| Team spricht kein Hebräisch | Enttäuschte Anrufer | Entscheidung E, ehrliche Kontaktseite, WhatsApp-CTA prominent (in Israel Standard) |
| nginx vergessen beim Launch | `/he` läuft nur über Catch-all, `$cvp_de_only`-Map inkonsistent | Patch liegt vorbereitet in `ops/nginx/`, Launch-Checkliste |
| GSC bucht `/he/` als `en` | Verfälschte Locale-Statistik | `deriveLocale` in Phase 8 vor Launch |
| PDF-Factsheet in Hebräisch kaputt | Peinlich | Button für `he` ausblenden, Folgeprojekt |

---

## 8. Nicht im Scope
Übersetzung der Blog-Artikel; hebräische Slugs (Experiment später); PDF-Factsheet RTL; Admin-UI auf Hebräisch; Legacy-`Project`-Zeilen; Partner-Seite; Hebrew-sprechender Berater (Geschäftsentscheidung); Änderungen an der Produktions-Infrastruktur außer dem vorbereiteten nginx-Patch.

---

## 9. Offene Fragen an dich
1. Entscheidungen A–J bestätigen oder ändern.
2. Gibt es einen Zugang zu einem Keyword-Tool mit israelischen Daten (z. B. Ahrefs/Semrush/DataForSEO, Google Ads Keyword-Planer)? Ohne echtes Volumen wird Phase 0 auf SERP-Analyse und Autocomplete beschränkt.
3. Wer ist der hebräische Lektor (Entscheidung F) und wie schnell kann er Texte drehen? Das bestimmt die Dauer von Phase 4 und 5.
4. Soll die WhatsApp-Nummer für den israelischen Markt dieselbe bleiben?
5. Zeithorizont: Phasen 0–8 sind realistisch mehrere Wochen mit Review-Schleifen. Gibt es einen Zieltermin (z. B. Messe, Kampagne), an dem sich die Reihenfolge orientieren muss?
