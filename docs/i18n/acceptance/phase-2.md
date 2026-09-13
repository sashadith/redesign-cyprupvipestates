# Phase 2 — RTL-Layout: Abnahme und Operator-Schritte

**Branch:** `worktree-he-phase2-3` · **Plan:** `docs/superpowers/plans/2026-09-13-hebrew-phase2-rtl.md` · **Stand:** 2026-09-13

## Was Phase 2 liefert

Phase 2 macht die öffentliche Seite unter `<html dir="rtl">` (Hebräisch)
strukturell korrekt gespiegelt — logische CSS-Eigenschaften statt
`left`/`right`, richtungsbewusste Komponenten (Breadcrumb-Pfeile, Carousels,
Motion, Karten) und Bidi-isolierte Preise/Telefonnummern/E-Mails/lateinische
Namen — bei **pixelgleichem** Ergebnis für en/de/pl/ru. Das UI-Copy selbst
bleibt Englisch unter `/he/*` (Phase 4); diese Phase betrifft nur Layout und
Richtung, nicht Text.

| Task | Commit | Liefert |
|---|---|---|
| 1 — Foundations | `bca92f5` | `rtl.css`-Utilities (`.bidi-isolate`, `.ltr-isolate`, `.icon-dir`, Hebräisch-Headings-Fontstack, Tracking/Case-Neutralisierung); `<Bdi ltr?>`-Komponente; `ltrIsolate()` in `src/lib/locale.ts`; eine einzige `fmtPrice`-Implementierung (ersetzt 8 lokale Kopien); der Codemod `scripts/codemods/rtl-logical.mjs` (`transformCss`) mit Tests; das Zähl-Gate `scripts/qa/rtl-physical-count.mjs`. Baseline: **423** physische Deklarationen über 115 Dateien, 0 Exceptions. |
| 2 — Codemod-Lauf | `4e0b305` | Der Codemod lief automatisiert über alle 40 in-scope-Dateien: 119 Ersetzungen (`margin/padding/border-left\|right` → `*-inline-start\|end`, `text-align: left\|right` → `start\|end`, `float: left` → `inline-start`). Zählerstand danach: **423 → 304**. `tsc`/`npm test` blieben grün, LTR bleibt pixelgleich (logische Eigenschaften lösen in LTR auf dieselbe physische Seite auf). |
| 3 — Hot-Core-CSS (manuell) | `bde049d` | Manuelle Fixes für die 16 zentralen Stylesheets: Dropdown-/Sprachmenü-Anker, Mobile-Menü-Slide (`inset-inline-start: 200vw`/`0`), Underline-Wachstumsrichtung, Badge-/Overlay-Positionen, schwebende CTAs (WhatsApp-Button, Cookie-Consent), `background-position`-Select-Pfeile (`[dir="rtl"]`-Override, da `background-position` keine logische Entsprechung hat), der kompakte Preis (`[dir="rtl"] { flex-direction: row }`, Preis bleibt `<Bdi ltr>`-isoliert), symmetrische `left:0;right:0`-Paare → `inset-inline: 0`. 46 bewusste Ausnahmen in `scripts/qa/rtl-exceptions.txt` (dekorative Wolken-/Blob-Pseudoelemente + zwei komplexere Positionierungsfälle, siehe "Bekannte Asymmetrien" unten). Zählerstand danach: **304 → 107**. |
| 4 — Richtungsbewusste Komponenten | `a37e4f2` | `useIsRtl()`-Hook (+ reine `isRtlDoc()`-Testfunktion); Breadcrumb-Pfeil kippt unter `[dir="rtl"]` auf `←`; Lightbox-/Galerie-/Landing-Pager-Pfeilglyphen spiegeln sich, Pfeiltasten-Handling ist unter RTL vertauscht (`ArrowLeft`=weiter, `ArrowRight`=zurück); alle 9 Swiper-Komponenten erhalten `dir="rtl"/"ltr"`; alle 5 Motion-Dateien negieren ihr `x`-Slide-in (`40` statt `-40`) unter RTL; die drei Kartenkomponenten (`MapLibre`, `ProjectsMapAll`, `PropertyMap`) bleiben explizit `dir="ltr"`. |
| 5 — Bidi-Isolation | `3697eba` | `<Bdi ltr>`/`<Bdi>` bzw. `ltrIsolate()`/ das neue `bidiIsolate()` (FSI…PDI, für Latein-Namen in generierten Sätzen) für Preise, Telefonnummern, E-Mails und lateinische Namen in `ContactChannels`, `FooterContact` (beide Varianten), `ContactFullBlockComponent`, `ContactLink`, `preview-home/sections/Form.tsx`, `formFeedbackCopy.ts`, `QualificationForm.tsx`, `preview-partners`-Copy-Tabellen, `developmentSeo.ts`, `DeveloperProjectsGrid.tsx`, `ProjectPageBody.tsx`, `UnitsView.tsx`. `privacy.*.ts`-Rechtstexte bewusst ausgenommen (Phase 5b). |
| 6 — Visual-QA-Matrix + Checkliste + Abnahme (dieses Dokument) | — (docs/Skript, kein App-Code) | `docs/i18n/rtl-qa-checklist.md`, `scripts/qa/rtl-matrix.mjs`, dieses Dokument. |

## Gate-Zahlen (`node scripts/qa/rtl-physical-count.mjs`)

| Zeitpunkt | Zählerstand | Dateien gescannt | Exceptions |
|---|---:|---:|---:|
| Vor Phase 2 (Task-1-Baseline) | **423** | 115 | 0 |
| Nach Task 2 (Codemod-Lauf) | **304** | 115 | 0 |
| Nach Task 3 (Hot-Core-Fixes) — aktueller Stand | **107** | 115 | 46 |

`node scripts/qa/rtl-physical-count.mjs --strict` gibt bei 107 verbleibenden,
nicht ausgenommenen Deklarationen **Exit 1** zurück — das ist zum jetzigen
Zeitpunkt erwartet: die 107 verteilen sich auf Komponenten außerhalb des
Hot-Core-Dateisatzes von Task 3 (siehe `task-3-report.md`, "Files outside
scope") und wurden in dieser Phase nicht angefasst. Vor der finalen Freigabe
von Phase 2 muss `--strict` auf **0** kommen (entweder durch Konvertierung
oder durch eine begründete, geprüfte Eintragung in
`scripts/qa/rtl-exceptions.txt`) — das ist der harte Abnahme-Gate für Phase 2,
zusätzlich zu `tsc`/`npm test`.

## Absichtliche Preisformat-Änderung (alle Locales)

Task 1 hat die acht lokalen `fmtPrice`-Kopien durch einen einzigen Import aus
`src/lib/locale.ts` ersetzt. Bei drei Komponenten ändert sich dadurch das
sichtbare Format — **für en/de/pl/ru genauso wie für he**:

- `src/app/components/ProjectLink/ProjectLink.tsx`
- `src/app/components/BlogSlide/BlogSlide.tsx`
- `src/app/components/PropertyFeatures/PropertyFeatures.tsx`

Vorher: `1 234 €` (Zahl, Leerzeichen, Suffix `€`). Nachher: `€1,234`
(Präfix `€`, gemäß der einheitlichen `fmtPrice`-Konvention aus der
Spezifikation). Das ist **beabsichtigt** und keine Regression — bei der
LTR-Regressionsprüfung (Checkliste, Abschnitt 14) explizit als bekannte,
gewollte Änderung behandeln, nicht als Fehler melden.

## Bekannte Asymmetrien (aus Task 3, zurückgestellt bis nach der Screenshot-Matrix)

Diese zwei Stellen sind bewusst physisch geblieben, weil eine reine
CSS-Eigenschafts-Umbenennung die Positionierung nicht korrekt reproduziert;
sie sind in `docs/i18n/rtl-qa-checklist.md` (Abschnitt 13) als explizite
Checklisten-Punkte aufgenommen und werden nach der Visual-QA-Matrix in einem
eigenen Fix-Task behoben:

1. **`preview-home/tokens.css` `.formsec__consultant-wrap` / `.formsec__caption`**
   — Berater-Porträt-Komposition im Formularabschnitt der Startseite,
   Desktop-only (`transform: translateX(-150px)`, `left: calc(54% + 10px)`).
2. **`.howwork`-Connector-Pfeil** (`preview-home/sections/HowWeWork.tsx` /
   `preview-home/tokens.css`) — goldener Pfeil zwischen den
   Ablaufschritt-Medaillons im "So arbeiten wir"-Abschnitt, Desktop-only;
   Positionsformel und die Pfeilspitze selbst (festgerichtetes SVG-Icon)
   brauchen eine neu hergeleitete RTL-Variante statt einer 1:1-Umbenennung.

## Operator-Schritte für die Visual-QA-Matrix

1. **Staging-Env setzen** (falls noch nicht aus Phase 1 vorhanden):
   ```bash
   echo 'NEXT_PUBLIC_LIVE_LOCALES=en,de,pl,ru,he' >> /var/www/cve-staging/.env
   ```
2. **Phase-1-Migration muss bereits angewendet sein** (siehe
   `docs/i18n/acceptance/phase-1.md`, Schritt 3) — sonst 500er auf
   DB-gestützten Seiten.
3. **Deploy von diesem Branch:**
   ```bash
   ./scripts/deploy-staging.sh
   ```
4. **URL-Matrix erzeugen:**
   ```bash
   node scripts/qa/rtl-matrix.mjs https://design.cyprusvipestates.com
   ```
   Gibt für jeden Seitentyp (Start, Projekte-Liste, ein Development
   [`cypress-park`], Entwickler, Blog-Index, Über uns, Kontakt, FAQ,
   Datenschutz, eine Fallstudie, eine Landingpage, 404) je eine Zeile pro
   Viewport (`desktop 1440x900`, `mobile 390x844`) mit EN- und HE-URL aus.
   Andere Slugs testen: `--project <slug> --case <slug> --landing <slug>`;
   `--json` für maschinelle Weiterverarbeitung.
5. **Matrix abarbeiten**: jede Zeile öffnen (EN und HE nebeneinander, bei der
   angegebenen Viewport-Breite), gegen `docs/i18n/rtl-qa-checklist.md`
   prüfen, Abweichungen mit Screenshot festhalten. Das braucht einen
   Browser — dieses Repo lässt Browser-Werkzeuge nur nach ausdrücklicher
   Anweisung laufen; der Operator (oder eine dafür ausdrücklich
   autorisierte Session) führt diesen Schritt aus.
6. **Vor dem Abschluss von Phase 2:** `node scripts/qa/rtl-physical-count.mjs --strict`
   muss 0 zurückgeben (siehe "Gate-Zahlen" oben — aktuell noch nicht der
   Fall), `npx tsc --noEmit` und `npm test` müssen grün sein (Tasks 1–5:
   117/117 nach Task 5, `tsc` sauber).

## Abnahmekriterien Phase 2 (Spec §3.2 / Plan Self-Review)

| Kriterium | Status |
|---|---|
| `dir`-Attribut pro Locale | Phase 1 ✔ (Voraussetzung) |
| Codemod: logische Eigenschaften über in-scope CSS/SCSS | ✔ Task 1/2 |
| Hot-Core manuell (Menüs, Dropdowns, Badges, CTAs, Select-Pfeile, Preis) | ✔ Task 3 |
| Richtungsbewusste Komponenten (Breadcrumbs, Swiper, Motion, Karten) | ✔ Task 4 |
| Bidi-Isolation (Preise, Telefonnummern, E-Mails, Namen) | ✔ Task 5 |
| Karten bleiben LTR | ✔ Task 4 |
| Visual-QA (Screenshot-Matrix Desktop 1440 / Mobile 390, EN↔HE) | Werkzeuge fertig (Task 6); Aufnahme durch Operator nach Staging-Deploy offen |
| `rtl-physical-count.mjs --strict` = 0 | offen (aktuell 107, siehe "Gate-Zahlen" — die 107 liegen außerhalb des Task-3-Hot-Core-Dateisatzes) |
| `npx tsc --noEmit` | sauber (Stand Task 5) |
| `npm test` | grün (117/117 nach Task 5) |
| LTR (en/de/pl/ru) pixelgleich | ✔ per Konstruktion (logische Eigenschaften, `[dir="rtl"]`-Scoping); Stichprobe in Checkliste Abschnitt 14 |

## Was auf Phase 4 verschoben ist (UI-Copy)

| Bereich | Verschoben nach | Notiz |
|---|---|---|
| Hebräische Übersetzung der UI-Strings (`/he/*` zeigt aktuell Englisch) | Phase 4 | Betrifft NICHT das Layout/Richtungs-Ergebnis dieser Phase; die Visual-QA-Matrix beurteilt ausdrücklich nur Layout, nicht Text. |
| 19 `TODO(he)`-Copy-Platzhalter (`node scripts/qa/he-placeholders.mjs`) | Phase 4 | Aus Phase 1 übernommen, unverändert. |
| Vier-Locale-Unions (`qualifierFields.ts`, `formFeedbackCopy.ts`, `ScarcityBanner.tsx`, `PropertyFeatures.tsx`, `DistancesStrip.tsx`, `QualificationForm.tsx`) auf fünf erweitern | Phase 4 | Aus Phase 1 übernommen. |
| `Legal*`-Texte (`privacy.*.ts` u. Ä.) | Phase 5b | Aus Task 5 explizit ausgenommen — Rewrite, nicht Bidi-Isolation. |
