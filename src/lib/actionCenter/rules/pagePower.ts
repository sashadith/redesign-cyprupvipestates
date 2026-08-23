import type { ActionItem, Severity } from "../types";
import { getPageVerdicts } from "@/lib/seo/pagePower/pageVerdicts";
import { getClassVerdicts } from "@/lib/seo/pagePower/classVerdicts";
import { templateClassLabel } from "@/lib/seo/templateClass";
import type { PageDiagnosis } from "@/lib/seo/pagePower/types";
import { pagesInSuppressionWindow } from "@/lib/seo/titleSweepLog";
import { REMEASURE_WINDOW_DAYS } from "@/lib/seo/titleSweepRemeasure";

// One item per DIAGNOSIS, not per page. On 2026-08-23 the buried pile alone
// held 78 pages; seventy-eight items would drown every other rule in the panel.
// The detail belongs on /admin/analytics/seo/power, which each item links to.
//
// Severity follows impressions at stake rather than page count: eight of the
// nine commercial city/type landing pages sit in the buried pile at positions
// 27-51, which matters more than a long tail of forgotten blog posts.
//
// `honoursSweep` marks the diagnoses whose WORK is a title/meta rewrite, and
// which therefore must not ask for that work again on a page a sweep already
// rewrote and is currently measuring — the same suppression getCtrWatchlist
// applies in src/lib/seo/queries.ts, from the same log
// (docs/SEO-TITLE-SWEEP-LOG.md, 42-day window). Measured against production on
// 2026-08-23: 7 of the 12 `unclicked` pages and 7 of the 78 `buried` ones sit
// inside a window — batches 2026-07-18 and 2026-07-27, closing 2026-08-29 and
// 2026-09-07 — so without this the `unclicked` item would tell the team to
// rewrite seven titles that were rewritten five weeks ago, and the whole point
// of the 42 days is to wait and see.
//
// `invisible` is false on purpose, and it is not an oversight to revisit. A
// rewritten snippet says nothing about whether a page is indexed, linked to, or
// has any search demand — the work that diagnosis asks for — so an in-flight
// sweep is no reason to go quiet about it. It would also be a no-op: none of
// the 1,118 invisible pages is in a window on 2026-08-23, and none plausibly
// could be, since a page under 10 impressions in 90 days was never a sweep
// candidate.
//
// Suppression only ever removes pages from the ITEM. The diagnosis itself is
// true of them — they really are getting impressions and not clicks — so
// pageVerdicts.ts is deliberately left unaware of the sweep log and the admin
// screen keeps listing them.
const PAGE_DIAGNOSES: Array<{ diagnosis: PageDiagnosis; title: string; work: string; honoursSweep: boolean }> = [
  { diagnosis: "buried", title: "buried below position 20", work: "content depth, authority and internal links — not a new title", honoursSweep: true },
  { diagnosis: "unclicked", title: "getting impressions but not clicks", work: "title and meta description", honoursSweep: true },
  { diagnosis: "invisible", title: "published but not being shown", work: "indexing and internal links", honoursSweep: false },
];

export async function pagePowerRules(): Promise<ActionItem[]> {
  // Matched on `path` rather than on the `locale::path` key: the sweep log
  // records paths exactly as served — English prefix-less, de/pl/ru prefixed —
  // which is the shape PageVerdict.path carries too (see the PageKey comment in
  // pagePower/types.ts). Checked against production on 2026-08-23 rather than
  // assumed: all 34 entries the log holds inside a window matched an inventory
  // path, none left over. A mismatch would fail OPEN — suppressing nothing,
  // which reads exactly like a clean run.
  const [pages, classes, sweptPaths] = await Promise.all([
    getPageVerdicts(), getClassVerdicts(), pagesInSuppressionWindow(REMEASURE_WINDOW_DAYS),
  ]);
  const items: ActionItem[] = [];

  for (const { diagnosis, title, work, honoursSweep } of PAGE_DIAGNOSES) {
    const diagnosed = pages.verdicts.filter((v) => v.diagnosis === diagnosis);
    const matching = honoursSweep ? diagnosed.filter((v) => !sweptPaths.has(v.path)) : diagnosed;
    const swept = diagnosed.length - matching.length;
    if (matching.length === 0) continue;
    // Count, impressions, severity and examples are all computed AFTER the
    // exclusion, so the item never quotes a pile it is not asking for work on.
    const impressions = matching.reduce((sum, v) => sum + v.impressions, 0);
    const examples = matching.slice().sort((a, b) => b.impressions - a.impressions).slice(0, 3).map((v) => v.path);
    const severity: Severity = impressions >= 20_000 ? "URGENT" : impressions >= 5_000 ? "ACTION" : "INFO";
    // Said out loud, with the number: the reader is looking at a smaller pile
    // than the screen behind the link shows, and silently shrinking it would
    // make the two surfaces look like they disagree.
    const sweptNote = swept === 0 ? ""
      : swept === 1 ? " 1 more is left out: its title was rewritten by a sweep still inside its re-measurement window (docs/SEO-TITLE-SWEEP-LOG.md)."
      : ` ${swept} more are left out: their titles were rewritten by a sweep still inside its re-measurement window (docs/SEO-TITLE-SWEEP-LOG.md).`;
    items.push({
      id: `page-power:${diagnosis}`,
      severity,
      category: "SEO",
      // Grouped, like the impression count in the very next sentence and like
      // `fmt` on the screen this links to: `invisible` is a four-digit pile, and
      // "1118 pages … 1,463 impressions" in one item reads as two tools.
      title: `${matching.length.toLocaleString("en-GB")} page${matching.length === 1 ? "" : "s"} ${title}`,
      description: `${impressions.toLocaleString("en-GB")} impressions behind them. Work: ${work}. Largest: ${examples.join(", ")}.${sweptNote}`,
      deepLink: "/admin/analytics/seo/power",
      since: pages.windowStart,
    });
  }

  for (const cls of classes) {
    if (cls.diagnosis !== "repelling" && cls.diagnosis !== "mute") continue;
    items.push({
      id: `page-power:class:${cls.templateClass}:${cls.diagnosis}`,
      severity: "ACTION",
      category: "SEO",
      title: `${templateClassLabel(cls.templateClass)} — ${cls.diagnosis === "repelling" ? "visitors arrive but do not browse on" : "visitors compare properties but do not enquire"}`,
      description: cls.reason,
      deepLink: "/admin/analytics/seo/power",
      since: pages.windowStart,
    });
  }

  return items;
}
