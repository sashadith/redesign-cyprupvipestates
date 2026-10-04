# Hebräisch — Copy-Inventar für Phase 4 (UI-Chrome)

**Stand:** 2026-09-13 · Quelle: Code-Erkundung auf Branch `worktree-he-phase2-3` (HEAD b8ac550). Zählungen sind EN-Blattstrings mit Buchstaben, ±10 %.

## Gesamtbild

| Bucket | Dateien | EN-Strings (ca.) |
|---|---|---|
| Objekt-/Record-/switch-Tabellen | 76 | 916 |
| Rechtstexte (`privacy`/`terms`) — **Phase 5b**, hier nur Scaffolding | 8 (+`registry.ts`) | 136 |
| Ternär-Ketten (`lang === "de" ? … : …`) ohne Tabelle — müssen erst in Tabellen | 34 | ~218 |
| **Summe Phase 4** | ~110 | **~1.130** |

Nur **18** Strings sind heute als `TODO(he)` markiert, weil nur exhaustive `Record<Locale, …>`-Tabellen den Compiler zwingen. ~55 Tabellen sind `Record<string, …>` mit stillem EN-Fallback (sechs `PartnersPage/*`-Komponenten fallen sogar auf **DE** zurück; `preview-landing/blockCopy.ts` hat gar keinen Fallback). Erste Aufgabe von Phase 4 ist daher die Typ-Härtung, damit der Compiler die Restarbeit aufzählt.

## Die zehn größten Tabellen

| Tabelle | Datei | Strings |
|---|---|---|
| `DEVELOPMENT_STRINGS` | `src/lib/developmentCopy.ts` | 85 |
| `PRIVACY_EN` | `src/app/preview-legal/[lang]/[doc]/privacy.en.ts` | 81 (Phase 5b) |
| `PROJECTS_STRINGS` | `src/app/[lang]/projects/projectsI18n.ts` | 80 (~68 übersetzbar; `value`-Felder sind Query-Keys) |
| `PARTNERS_COPY` | `src/app/preview-partners/[lang]/copy.ts` | 78 (Entscheidung J: nicht in Phase 1 — bleibt EN-Fallback) |
| `ALL` (About) | `src/app/preview-about/[lang]/copy.ts` | 75 |
| `TERMS_EN` | `…/terms.en.ts` | 55 (Phase 5b) |
| `COPY` (Präsentation) | `src/app/c/[token]/copy.ts` | 54 |
| `ALL` (Contacts) | `src/app/preview-contacts/[lang]/copy.ts` | 40 |
| `CASE_STUDIES_COPY` | `src/app/preview-case-studies/[lang]/copy.ts` | 40 |
| `HOME_STRINGS` + `CASE_CATEGORY_LABELS` | `src/app/preview-home/sections/homeI18n.ts` | 27 |

## Arbeitspakete (WP)

| WP | Inhalt | ~Strings | Interpolation | SEO-relevant |
|---|---|---|---|---|
| WP1 Chrome, Formulare, Consent, Newsletter | `qualifierFields.ts`, `QualificationForm.tsx`, `consentCopy.ts`, `formFeedbackCopy.ts`, `CustomCookieConsent.tsx`, `NewsletterForm.tsx`, `Footer/FooterNewsletter.tsx`, `SectionLinks.tsx`, `NotFoundPageComponent.tsx`, `WhatsAppButton.tsx`, `WhatAppButtonProject.tsx`, `BreadcrumbsBlog.tsx`, Ternär-Formulare (`FormFull`, `FormStandard`, `FormStatic`, `FormPartners`, `FormMinimalBlockComponent`, `Footer/Footer.tsx`, `preview-home/sections/Footer.tsx`, `Breadcrumbs.tsx`, `NavWrapper.tsx`) | ~150 | ja (`${url}`, Telefon/E-Mail → `ltrIsolate`) | 404-H1 |
| WP2 Projekte-Liste + Development-Seite | `projectsI18n.ts`, `developmentCopy.ts`, `developmentSeo.ts`, `preview-projects/ProjectsMap.tsx`, `ProjectsMapAll.tsx`, `StyledProjectFilters.tsx`, `ProjectFilters.tsx`, `PropertyMap.tsx`, `DistancesStrip.tsx`, `PropertyFeatures.tsx`, `ScarcityBanner.tsx`, `ProjectCardSlider.tsx`, `NoProjects.tsx`, `ProjectSameCity.tsx`, `PropertyDistances.tsx`, `PropertyIntro.tsx` | ~215 | ja (Plurale, `(n)=>`) | **ja** (Auto-Meta aller Development-Seiten, `/projects`-H1) |
| WP3 Homepage | `homeI18n.ts`, `preview-home/sections/Form.tsx`, 7× `ACCENTS_BY_LANG`, `FeaturedCaseStudies.tsx`, `DevelopersLogos.tsx`, `ProjectsSectionSlider.tsx`, `SliderReviewsFull.tsx`, `TeamBlockComponent.tsx`, `preview-landing/blockCopy.ts` | ~90 | mittel | **ja** (H1/H2-Akzentwörter) |
| WP4 Blog, Insights, Developers | `blogI18n.ts`, `[lang]/blog/[slug]/page.tsx`, `BlogPostsRenderer.tsx`, `BlogSlide.tsx`, `[lang]/developers/page.tsx`, `DeveloperJournalIntro.tsx`, `DeveloperProjectsGrid.tsx`, `[lang]/developers/[slug]/page.tsx`, `[lang]/[...slug]/page.tsx` | ~40 | ja | **ja** (`/developers`-Meta, `PAGE_TITLE_SUFFIX`, `FALLBACK_DESC`) |
| WP5 About, Contacts, FAQ | `preview-about/copy.ts`, `preview-contacts/copy.ts` + `languages.ts`, `preview-faq/copy.ts` (Partners: EN-Fallback bleibt, Entscheidung J) | ~170 | ja (FAQ-Funktionen; Telefon/E-Mail/Adresse) | **ja** (Meta-Paare, H1) |
| WP6 Case Studies + Landing/Legal-Chrome | `preview-case-studies/copy.ts`, `CaseStudiesAll.tsx`, `CaseStudyOverview.tsx`, `CaseStudyDetails.tsx`, `CaseStudyIntro.tsx`, `[lang]/case-studies/[slug]/page.tsx`; `registry.ts` bleibt EN-Alias bis Phase 5b | ~65 | mittel | **ja** |
| WP7 Booking, Präsentation, CRM-Nachrichten, E-Mails, ROI, PDF | `c/[token]/copy.ts`, `book/[token]/copy.ts`, `crm/presentationMessages.ts`, `crm/bookingMessages.ts`, `crm/compose/{greeting,closing,loadPlaybook}.ts`, `emailTemplates.ts` (+`dir="rtl"`), `api/roi-calculator/route.ts` (+ hartkodierte EN-Labels im Body), `roi-calculator/*`, `ModalRoi*.tsx`, `FormRoi.tsx`, `ModalBrochure.tsx`; PDF: Button für `he` ausblenden (Spec) | ~250 | **sehr hoch** (Template-Literale) | nein (transaktional) |

## Nicht übersetzen / Sonderbehandlung

- **Marke** `Cyprus VIP Estates`, Firmenname, Bauträger-/Projektnamen: lateinisch, im hebräischen Satz per `<Bdi>`/`bidiIsolate()` isolieren.
- **URLs, Slugs, Asset-Pfade, Query-Werte** (`projectsI18n.ts` `Opt.value`, Filter-`value`s, `LegalSection.id`, `ALIASES`/`ORDER` in `languages.ts`, `ModalBrochure.ART`, `LOCALE_HOME` in `psi-sync`, `publicUrlFor()` in `inventorySearch.ts`, `iphone-${lang}.webp` in `blog/[slug]/page.tsx` → EN-Fallback für `he`).
- **Telefon, E-Mail, Preise**: JSX → `<Bdi ltr>`; Strings → `ltrIsolate()` nur in `he`-Einträgen (vier Dateien tragen den Marker `// he (Phase 4)`).
- **Zahlen**: `numLocale` bleibt `"en-US"` auch für `he` (westliche Ziffern); `PRICE_FORMAT.he` bewusst EN-Konvention; `localizeCompletion()` für `he` entscheiden (`רבעון 3 2029`).
- **Städte**: echte Umschrift laut Glossar (`פאפוס`, `לימסול`, `לרנקה`), kein Passthrough.
- **Bekannte Altlasten**: `DistancesStrip` „Golf court" (Absicht übersetzen), ROI-Mail-Body hartkodiert EN für alle Locales, `PartnersPage/*` DE-Fallback, `blockCopy.ts` ohne Fallback, Legacy-Filter (`ProjectFilters`, `StyledProjectFilters`) nur übersetzen, wenn noch geroutet.

## Vier-Locale-Unions, die auf `Locale` gehoben werden

`qualifierFields.ts:53`, `formFeedbackCopy.ts:21`, `ScarcityBanner.tsx:5`, `DistancesStrip.tsx:37`, `QualificationForm.tsx:13,50`, `PropertyFeatures.tsx:86`, `Footer/FooterNewsletter.tsx:10`, `NewsletterForm.tsx:22`, `preview-contacts/[lang]/data.ts:26`, `preview-contacts/[lang]/page.tsx:38`, `preview-about/[lang]/page.tsx:39`, `preview-about/[lang]/data.ts:58`, `preview-projects/page.tsx:40`, `[lang]/blog/[slug]/page.tsx:307`, `mcp/tools/playbook.ts:35`, `ProjectsMapAll.tsx:14`, `PropertyMap.tsx:12`, `api/roi-calculator/route.ts:24`, `emailTemplates.ts:3`, `crm/inventorySearch.ts:50,78`, `api/cron/psi-sync/route.ts:17`. (`seo/pagePower/inventory.ts:47`, `seo/queries.ts:115,295` → Phase 8; `locale.test.ts` bleibt.)
