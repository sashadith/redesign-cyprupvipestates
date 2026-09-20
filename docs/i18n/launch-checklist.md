# Phase 9 — Launch-Checkliste Hebräisch (`he`)

**Stand:** 2026-09-14 · **Ausführung: nur auf ausdrückliche Anweisung des Operators — nichts hier wird von Claude selbst ausgeführt.** Diese Datei ist die Checkliste aus Spec §5 Phase 9, ergänzt um die Punkte aus Plan-Task 5 (Terms-§12-Sprachliste, Pass-C-Entscheidung, `REVIEW(he)`-Abbauregel, Partner-Seite).

Voraussetzung: Phase 1–8 sind abgenommen (`docs/i18n/acceptance/phase-1.md` … `phase-7-8.md`), Content-Pack und Placeholder-Gate sind grün (`node scripts/qa/he-launch-check.mjs`, siehe Schritt 4).

---

## 1. nginx-Regel einspielen + reload

Die `he`-Zeile ist bereits vorbereitet und auf Staging aktiv (`ops/nginx/cyprusvipestates.conf:172`):

```
location ~ ^/(de|pl|ru|he)(/|$) { include /etc/nginx/snippets/cvp_proxy.conf; }
```

Auf dem Produktions-Host dieselbe Zeile einspielen (Diff gegen die aktuelle Produktions-`nginx.conf` prüfen — die Datei in diesem Repo ist der Staging-Stand, IP-only ohne SSL; Produktion hat zusätzlich die SSL-`server`-Blöcke), dann:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

`nginx -t` **vor** dem Reload — ein Syntaxfehler in einer laufenden Produktionsdatei darf nicht scharf getestet werden.

## 2. Produktions-Env `NEXT_PUBLIC_LIVE_LOCALES` erweitern

`src/lib/locale.ts` gated `he` standardmäßig aus (`LAUNCH_GATED_LOCALES = ["he"]`), bis die Env-Variable `he` ausdrücklich einschließt:

```
NEXT_PUBLIC_LIVE_LOCALES=en,de,pl,ru,he
```

`NEXT_PUBLIC_*`-Variablen werden beim Build inlined — diese Änderung braucht also **Schritt 3 (Deploy)**, ein reiner `pm2 reload` ohne Neubuild reicht nicht.

## 3. Deploy

Voraussetzung: die drei Hebräisch-Migrationen (`locale_add_he`, `he_content_columns`, `he_promo_blocks`) sind bereits eingespielt (das passiert im Staging-Runbook, `acceptance/phase-1.md` Schritt 2 — geteilte Datenbank). Ohne den Enum-Wert `he` bricht auch der Produktions-Build bei „Collecting page data" ab. Lesende Kontrolle auf dem VPS:

```bash
sudo -u postgres psql -d cyprusvipestates -tAc 'select enum_range(null::"Locale")'
```

Produktion wird nie unaufgefordert deployed (Projektregel). Auf Anweisung:

```bash
CVP_PROD_REF=origin/main ./scripts/deploy-prod.sh
```

Danach die letzte Zeile der Deploy-Ausgabe lesen (`ref @ sha`) und bestätigen, dass sie den erwarteten Merge-Commit dieses Phase-7/8-PRs zeigt (siehe Memo „Local main lags behind" — `deploy-prod.sh` deployt standardmäßig den lokalen `main`-Ref, nicht `origin/main`, wenn `CVP_PROD_REF` fehlt).

## 4. Launch-Guard gegen Produktion laufen lassen

```bash
node scripts/qa/he-launch-check.mjs --host https://cyprusvipestates.com
```

Muss **PASS** zeigen (lokale Checks + `hreflang-check.mjs` + `he-smoke.sh <host> live` gegen den echten Host). Bei FAIL: nicht weitermachen, Ursache beheben, Schritt 4 wiederholen.

## 5. GSC-Property prüfen

In der Google Search Console: `he`-URLs erscheinen unter derselben Property `https://cyprusvipestates.com/` (kein separates internationales Targeting nötig — hreflang übernimmt das). Prüfen, dass die Property keine `/he/`-Sperre in `robots.txt` oder eine widersprüchliche URL-Parameter-Behandlung hat.

## 6. Sitemap neu einreichen

`/sitemap.xml` und die einzelnen `/sitemaps/<type>`-Routen führen `he`-Zeilen jetzt automatisch (Task 3, PUBLISHED-only, `PUBLIC_LOCALES`-gated). In GSC → Sitemaps → die Haupt-Sitemap-URL erneut einreichen, damit ein Rescan sofort angestoßen wird (Google crawlt sie ohnehin periodisch, ein manueller Resubmit beschleunigt nur).

## 7. IndexNow-Ping für alle `he`-URLs

Es gibt **keine** bestehende Admin-Aktion, die alle `he`-URLs auf einmal pingt — `src/lib/indexnow.ts`s `pingIndexNow(event, urls)` wird heute nur pro Einzeländerung aufgerufen (`src/app/admin/actions.ts`, `developments/[id]/actions.ts`, `api/cron/publish-scheduled/route.ts`). Für den Launch-Ping alle `he`-URLs einmalig sammeln und in einem Lauf senden, z. B. per `tsx`-Einzeiler auf dem Server (liest nur, schreibt nichts außer dem IndexNow-Ping selbst):

```bash
npx tsx -e '
import { pingIndexNow, absUrl } from "./src/lib/indexnow";
import { PUBLIC_LOCALES } from "./src/lib/locale";
// urls: alle veröffentlichten /he/*-Pfade — Landingpages, Blog-Index (falls indexierbar),
// Case-Studies, About/Kontakt, FAQ, Developments, Developer-Profile.
// Liste aus der Sitemap ziehen (curl https://cyprusvipestates.com/sitemaps/pages | grep he/)
// oder aus content/he/README.md-Layout ableiten.
const urls = [/* ... */].map(absUrl);
await pingIndexNow("he-launch", urls);
'
```

IndexNow ist **unlimitiert** (anders als GSC, siehe Schritt 8) — ein Ping mit der vollständigen Liste ist unproblematisch. `INDEXNOW_KEY` muss auf dem Produktions-Host gesetzt sein (`isIndexNowConfigured()` prüft das; ohne Key wird der Ping übersprungen und geloggt, nicht mit Fehler abgebrochen).

## 8. Erste 6 URLs manuell in GSC einreichen

**Quota-Erfahrung (siehe Memo „GSC Request-Indexing quota"): das manuelle Kontingent liegt real bei ~6 URLs/Tag, nicht 10–15** — die GSC-Karte selbst lesen, nicht dem Toast trauen. Reihenfolge (höchste Priorität zuerst):

1. `/he` (Startseite)
2. `/he/projects` (Haupt-Listing)
3. `/he/real-estate-cyprus` (Cornerstone-Landingpage, höchstes Volumen laut Keyword-Map)
4. `/he/limassol`
5. `/he/paphos`
6. `/he/property-investment-cyprus`

Restliche Landingpages (11 verbleibende + Case Studies, FAQ, About, Kontakt) über mehrere Tage verteilt nachreichen (Memo: „Listen über mehrere Tage aufteilen"). IndexNow (Schritt 7) deckt Bing/Yandex/Seznam/Naver bereits vollständig und unlimitiert ab; dieser Schritt ist nur für Google.

## 9. Monitoring der ersten 14 Tage im SEO-Advisor

Der automatisierte GSC+PSI+IndexNow+Advisor-Stack läuft bereits (siehe Memo „SEO-Advisor-Automation"). Für den `he`-Start **vor jeder Eskalation verifizieren**, ob ein Advisor-Alarm einer der drei bekannten Fehlalarm-Klassen entspricht:

1. **„Traffic-Kollaps"** durch einen Redirect (nicht durch echten `he`-Rankingverlust) — zuerst prüfen, ob eine URL zwischenzeitlich umgezogen/redirected wurde, bevor ein Ranking-Problem angenommen wird.
2. **„100 % CWV/LCP-Fehler"** aus Lab-Daten (nicht Feld-/CrUX-Daten) — Lighthouse-Lab-Werte für neu gecrawlte `he`-Seiten können in den ersten Tagen wegen fehlender Feld-Daten pauschal rot erscheinen; gegen echte CrUX-Feld-Daten gegenprüfen, sobald genug Traffic da ist.
3. **„Near-zero internal links"** unverifiziert — der interne-Links-Zähler kann `he`-Seiten in der Anfangsphase als schwach verlinkt melden, obwohl Hub↔Spoke-Verlinkung (Spec §3.6) vorhanden ist; Live-Crawl gegenprüfen, nicht dem Cache-Wert trauen.

Nur nach dieser Verifikation als reales Problem behandeln und weiter eskalieren. Zusätzlich `deriveLocale`/GSC-Zahlen für `/he/*` beobachten (Task 2 stellt sicher, dass sie nicht mehr unter `en` gezählt werden) und die Klickrate der 6 manuell eingereichten URLs (Schritt 8) täglich gegenlesen.

## 10. Hebräisch zur AGB-§12-Sprachfassungsliste hinzufügen (alle vier LTR-Versionen)

`§12 „Language versions"/„Sprachfassungen"/„Wersje językowe"/„Языковые версии"` nennt heute bewusst nur vier Sprachen (Release-Gate-Vermerk in `c-legal.md`, Phase 5). **Beim Launch, in einem gemeinsamen Commit**, den Satz in allen vier LTR-Dateien um Hebräisch erweitern:

- `src/app/preview-legal/[lang]/[doc]/terms.en.ts:201` — „These terms are published in English, German, Polish and Russian…" → **…, Polish, Russian and Hebrew…**
- `src/app/preview-legal/[lang]/[doc]/terms.de.ts` (Abschnitt „12. Sprachfassungen")
- `src/app/preview-legal/[lang]/[doc]/terms.pl.ts` (Abschnitt „12. Wersje językowe")
- `src/app/preview-legal/[lang]/[doc]/terms.ru.ts` (Abschnitt „12. Языковые версии")

Nicht vorher ändern — die vier bestehenden Sprachen sind korrekt, solange `he` nicht live ist (eine fünfte Sprache in der Liste zu nennen, bevor die Seite erreichbar ist, wäre selbst eine falsche Aussage im Rechtstext). `he-content-check.mjs` prüft `content/he/**`, nicht diese Code-Dateien — kein automatisches Gate hier, manuell verifizieren nach der Änderung (`npx tsc --noEmit`, `npm test`, `copy-snapshot.mjs --check` für die LTR-Byte-Identität der drei unveränderten Sprachfassungen-Sätze in privacy.*.ts, falls vorhanden).

## 11. Pass-C-Entscheidung erneut aufgreifen

Phase 5 hat Pass C (muttersprachliches Lektorat) bewusst zurückgestellt (Controller-Entscheidung 2026-09-13) und stattdessen mit generiertem Hebräisch geseedet, weil `he` produktionsseitig gated war. **Das ändert sich mit diesem Launch** — vor oder unmittelbar nach Schritt 3 klären:

- Ist ein muttersprachlicher Lektor (Entscheidung F) inzwischen benannt?
- Soll Pass C **vor** dem Deploy nachgeholt werden (Launch verzögert sich um die Lektoratszeit), oder **nach** dem Deploy mit `REVIEW(he)`/`"review": "pending"` weiterhin sichtbar live laufen?
- Diese Entscheidung ist Operator-/Business-Sache, nicht automatisierbar — hier nur als offener Punkt vermerkt, nicht vorentschieden.

## 12. `REVIEW(he)`-Marker — Abbauregel

`REVIEW(he)` (Code-Copy, `wp1.md`…`wp7.md`) und `"review": "pending"` (Content-Pack, `c-*.md`) sind **kein** Launch-Blocker (`he-launch-check.mjs` prüft nur `TODO(he) == 0`, nicht `REVIEW(he) == 0`) — sie dürfen live sein. Die Regel für ihren Abbau (Spec §3.6 „Veröffentlichungsregel", `docs/i18n/reviews/README.md`):

- Ein Marker/Feld wird **erst nach protokolliertem Pass-C-Sign-off** für genau die betroffene Zeile entfernt — nie pauschal für eine ganze Datei, nie vorab.
- Bis dahin bleiben alle Marker/Felder stehen, auch in Produktion. Das ist die bewusste, im Ledger dokumentierte Abwägung: Qualitätssicherung schlägt „keine sichtbaren internen Marker in Produktion" — die Marker sind ohnehin nur im Quelltext/JSON sichtbar, nie im gerenderten HTML.
- Nach jedem abgeschlossenen Lektorats-Durchgang: Korrektur im Protokoll → Code/Content-Datei ändern → Marker/Feld dieser einen Zeile entfernen (`REVIEW(he)` löschen bzw. `"review"` auf den im Protokoll vereinbarten Wert wie `"approved"` setzen) → `he-placeholders.mjs`/`he-content-check.mjs` erneut laufen lassen → committen.

## 13. Partner-Seite bleibt Englisch (Entscheidung J) — `/he/partners` darf nicht verlinkt oder indexiert sein

Entscheidung J (Spec §2): die B2B-Partnerseite wird **nicht** in Phase 1 übersetzt. Vor und nach dem Launch sicherstellen:

- Kein Header-/Footer-Link zeigt auf eine `/he/partners`-Route (der Header-Sublink zeigt bewusst weiter auf `/partners`, siehe `phase-5.md` „Zurückgestellt").
- `/he/partners` erzeugt ein hartes 404 — `preview-partners/[lang]/page.tsx`s `generateMetadata` **und** die Komponente selbst rufen `notFound()`, sobald `partnersOfferedIn(lang)` (Quelle: `localesForStaticRoute("partners")`/`UNLOCALIZED_ROUTES`, `src/lib/locale.ts`) `he` ausschließt — keine `noindex`-200-Variante, kein Sonderfall.
- `hreflang-check.mjs`/`he-launch-check.mjs --host` **decken** das Paar `/partners` ↔ `/he/partners` explizit ab: eine eigene `UNLOCALIZED_TYPE_PAGES`-Zeile mit `assertUnlocalizedPair()`-Kontrakt prüft sowohl, dass `/he/partners` 404t, als auch, dass die EN-Seite **keinen** `he`-hreflang-Alternate trägt (die Sprachumschaltung auf `/partners` selbst wird ebenfalls dagegen getestet). Das ist der Regressions-Schutz für genau diesen Punkt — kein manueller Check nötig, kein blinder Fleck.

---

## Referenzen

Spec `docs/superpowers/specs/2026-09-13-hebrew-localization-design.md` §2 (Entscheidung J), §3.6, §5 Phase 9, §7 (Risiko „nginx vergessen beim Launch", „GSC bucht /he/ als en") · Plan `docs/superpowers/plans/2026-09-14-hebrew-phase7-8-pipeline-seo.md` Task 5 · Abnahme `docs/i18n/acceptance/phase-7-8.md` · Reviewer-Handbuch `docs/i18n/reviews/README.md` · Memos (Operator-Gedächtnis): „Local main lags behind", „GSC Request-Indexing quota", „SEO-Advisor-Automation", „Never deploy unasked".
