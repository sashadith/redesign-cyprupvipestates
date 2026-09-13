# Phase 3 — Admin-Integration: Abnahme und Operator-Schritte

**Branch:** `he-phase2-3` · **Plan:** `.superpowers/sdd/2026-09-13-hebrew-phase3-admin/` · **Stand:** 2026-09-13

## Was ein Editor jetzt tun kann

1. **HE-Übersetzung einer Singlepage anlegen** — im TranslationsPanel `+ HE` klicken (`createTranslation`; Sprachliste kommt jetzt aus `lib/locale`, nicht mehr aus einer hartcodierten Vier-Sprachen-Liste — Commit `414773d`).
2. **Im RTL-Editor bearbeiten** — RichTextField/PtEditor/BlockEditor erhalten `dir="rtl"`, Editor-Klassen sind logisch (`ps-*`, `border-s-*` statt `pl-*`/`border-l-*`) — Commits `f76c9b7`, `bb7f8e0`.
3. **Slug bleibt lateinisch** — `SlugField` zeigt bei `language="he"` den Hinweis „Latin letters, digits and dashes only (Hebrew pages keep an English slug)", das Feld selbst bleibt `dir="ltr"` — Commit `f76c9b7`.
4. **Als DRAFT speichern** — unverändertes Save-Verhalten, jetzt fünfsprachig statt vierprachig geführt.
5. **Vorschau unter `/he/<slug>` auf Staging** — sobald `NEXT_PUBLIC_LIVE_LOCALES` dort `he` enthält (Phase 1, bereits verkabelt).

**Development-Editor:** eigener HE-Tab in `DescriptionField` (Beschreibung) und `SeoMetaFields` (Meta-Titel/-Text), jeweils `dir="rtl"` im Tab-Feld selbst; „Rewrite with Claude" liefert jetzt hebräischen Text — ein Hebräisch-Skript-Guard (`scriptLeaks`) prüft das Ergebnis, es gibt einen automatischen Retry-Versuch, danach wirft der Generator einen Fehler statt stillschweigend lateinischen/kyrillischen Text zu speichern (Commits `559b88b`, `47535eb`, `a2f24a3`). **Areas:** eigener HE-Tab in `AreaEditor`, gleiche Guard-Logik beim KI-Generator, inklusive Glossar-gebundener Ortsnamen (Limassol → לימסול, Paphos → פאפוס).

**SiteDocuments** (Header, Footer, Forms, Landing-Seiten, FAQ): jede Listenseite zeigt für jede fehlende Sprache einen `+ HE from English`-Button (`createSiteDocTranslation`), der die englische Fassung als Ausgangspunkt kopiert (Commit `a2f24a3`).

**CRM:** Hebräisch ist ab sofort als Lead-Sprache wählbar (`LEAD_LOCALES` aus `lib/locale`, Commit `414773d`). Als Präsentations-/Versand-Sprache erscheint Hebräisch erst, sobald `he` über `PUBLIC_LOCALES` live geschaltet ist (`PropertyMatching.tsx`, `PresentationEditor.tsx`, `/api/admin/presentations` — diese Flächen filtern bewusst auf `PUBLIC_LOCALES`, nicht auf die volle `LOCALES`-Liste, damit an Leads nichts Unfertiges verschickt wird).

## Gate-Zahlen

| Prüfung | Ergebnis |
|---|---|
| `npm test` | 117/117 grün (Task 5, letzter Stand) |
| `npx tsc --noEmit` | sauber (zuletzt bestätigt nach Commit `bb7f8e0`) |
| `node scripts/qa/he-admin-fields-check.mjs` | `OK` (verifiziert für diesen Report) |
| `node scripts/qa/he-placeholders.mjs` | **18** `TODO(he)`-Platzhalter (verifiziert für diesen Report; Phase 1 hatte 19 — einer wurde seither aufgelöst) |
| `grep -rn "FourLang" src \| wc -l` | **12** verbleibende Treffer (verifiziert für diesen Report) — die `@deprecated`-Alias-Definition in `areaContent.ts` plus 11 Verwender in `areas/actions.ts`, `AreaEditor.tsx` und `developments/[id]/actions.ts`; bewusst für eine spätere Aufräum-Runde belassen (Task 1/3) |

## Operator-Hinweise

- Die produktive `AiPromptTemplate`-Zeile für `seoMeta` kann in ihrem gespeicherten Text weiterhin nur vier Sprachen **nennen** — das ändert nichts an der Ausgabe: `getSeoPromptTemplate()` hängt einen fixen, nicht editierbaren `OUTPUT LOCALES`-Block an (`en, de, pl, ru, he`), der die Sprachliste unabhängig vom gespeicherten Prompt-Text erzwingt. Zum Auffrischen der sichtbaren Prompt-Vorschau im Admin-Prompt-Editor genügt ein erneutes Speichern ("Save prompt") — der Block wird beim Speichern automatisch abgeschnitten und beim nächsten Laden wieder neu angehängt, verdoppelt sich also nicht.
- `max_tokens`-Budgets wurden angehoben: Description/Area-Generator je **4000**, SEO-Meta-Generator **1400** (vorher 1024) — Hebräischer Text braucht mehr Tokens als lateinischer/kyrillischer.
- Der Hebräische Styleguide (`docs/i18n/he-styleguide.md`) und das Glossar (`docs/i18n/he-glossary.md`) werden als gecachter System-Block (`heSystemBlock`, `cache_control: ephemeral`) in jeden der drei KI-Generatoren (Description, Area, SEO-Meta) injiziert. **Wer diese beiden Dateien bearbeitet, ändert damit direkt das Verhalten der Generatoren** — kein Code-Deploy nötig, die Dateien werden bei jedem Aufruf frisch von der Festplatte gelesen.

## Staging-Verifikation

1. Voraussetzung: die Phase-1-Migration (`descriptionHE`/`textHE`-Spalten, Enum-Wert `he`) muss auf der geteilten Datenbank bereits angewendet sein (siehe `docs/i18n/acceptance/phase-1.md`, Schritt 3).
2. Deploy dieses Branches: `./scripts/deploy-staging.sh`.
3. Env-Variable auf Staging: `NEXT_PUBLIC_LIVE_LOCALES=en,de,pl,ru,he` (Deploy-Skripte syncen `.env` nicht automatisch — muss vorher gesetzt sein).
4. Danach die Editor-Schritte oben (HE-Übersetzung anlegen → RTL-Editor → Latin-Slug → DRAFT speichern → `/he/<slug>` ansehen) manuell im Staging-Admin durchlaufen.
5. **Es existiert kein automatisierter Admin-UI-Test** für diesen Fluss — die Verifikation ist ausschließlich manuell.

## Zurückgestellt

- **Echter hebräischer Content**: die 18 `TODO(he)`-Platzhalter (englischer Text in Copy-Tabellen) sowie die in `phase-1.md` gelisteten Vier-Sprachen-Union-Typen (`qualifierFields.ts`, `formFeedbackCopy.ts`, `ScarcityBanner.tsx`, `PropertyFeatures.tsx`, `DistancesStrip.tsx`, `QualificationForm.tsx`) — Phase 4.
- **`staleCopyFigures.SEO_FIELDS`-HE-Abdeckung**: `DESC_FIELDS` wurde um `descriptionHE` erweitert, `SEO_FIELDS` (titleEN/DE/PL/RU, descEN/DE/PL/RU) und die `COUNT`/Einheiten-Wort-Regex bleiben vorerst vierprachig — Phase 8.
- **`SlugField`-Hinweistext** auf den beiden Erstellungs-Formularen (`content/new-content-form.tsx`, `developments/developers/new/new-developer-form.tsx`) — diese haben noch kein `row.language`, also keinen Hinweis; ebenso `developments/[id]/page.tsx`s eigenes `SlugField` innerhalb des mehrsprachigen Tab-Editors.
- **Prettier-Durchlauf über Swiper-Dateien** (Notiz aus Phase 2).

## Referenzen

- Commits: `559b88b`, `414773d`, `843355f`, `bde049d`, `47535eb`, `f76c9b7`, `bb7f8e0`, `a37e4f2`, `a2f24a3`.
- Task-Reports: `.superpowers/sdd/2026-09-13-hebrew-phase3-admin/task-{1,2,3,4,5,6}-report.md`.
- Stilreferenz: `docs/i18n/acceptance/phase-1.md`.
