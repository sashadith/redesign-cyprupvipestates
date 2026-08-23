import type { ActionItem, Severity } from "../types";
import { getPageVerdicts } from "@/lib/seo/pagePower/pageVerdicts";
import { getClassVerdicts, classWindow } from "@/lib/seo/pagePower/classVerdicts";
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
//
// `honoursAge` marks the diagnoses whose WORK is falsified by the page's own
// publication date, and it is the same shape of defect the sweep suppression
// above fixes: asking for work the data already rules out. `invisible` asks for
// indexing and internal links, and a page published inside the window did not
// fail to accumulate 90 days of impressions — it never had 90 days. Measured
// 2026-08-23: 548 of the 1,125 `invisible` pages were published inside the
// window, 430 of them within 30 days, so nearly half of what this item used to
// demand was work nobody could do.
//
// `buried` and `unclicked` are false on purpose. Both rest on impressions the
// page ACTUALLY received — 100 and 300 of them — so a young page reaching either
// has demonstrably been crawled, indexed and served, and its position or its CTR
// is a real measurement rather than a missing one. Only 3 `buried` and 1
// `unclicked` page were young on 2026-08-23 in any case; the flag is per
// diagnosis so that stays a decision rather than a coincidence.
const PAGE_DIAGNOSES: Array<{ diagnosis: PageDiagnosis; title: string; work: string; honoursSweep: boolean; honoursAge: boolean }> = [
  { diagnosis: "buried", title: "buried below position 20", work: "content depth, authority and internal links — not a new title", honoursSweep: true, honoursAge: false },
  { diagnosis: "unclicked", title: "getting impressions but not clicks", work: "title and meta description", honoursSweep: true, honoursAge: false },
  { diagnosis: "invisible", title: "published but not being shown", work: "indexing and internal links", honoursSweep: false, honoursAge: true },
];

/**
 * The coarse magnitude band a pile's page count sits in — the largest rung at or
 * below it — which is what the item id carries so that a snooze cannot outlive
 * the pile it was taken against. See the id comment in `pagePowerRules`.
 *
 * A 1-2-5 ladder: each rung is roughly double the last, so it takes a materially
 * bigger (or materially smaller) pile to change the band, and day-to-day drift
 * cannot. Measured against production on 2026-08-23 by recomputing the verdicts
 * with `now` set back, and comparing the piles these items actually ask for work
 * on (after both exclusions):
 *
 *              today   7 days back   14 days back
 *   buried        72        70 (50)       69 (50)
 *   unclicked      5         5  (5)        4  (2)
 *   invisible    577       577 (500)     555 (500)
 *
 * — band in brackets, and today's bands are 50, 5 and 500. So the 1d and 7d
 * snoozes the panel offers (ActionCenterPanel.tsx) all survive, and the 30d one
 * survives on every pile big enough for a page or two not to matter. `unclicked`
 * at five pages is the exception and it is inherent: on a pile that small any
 * band coarse enough to hold for a month is coarse enough to hide a doubling.
 * It fails in the safe direction — the snooze expires early and a true condition
 * comes back — which is the opposite of the failure this id scheme exists to fix.
 *
 * A fingerprint of the page set would keep the promise exactly and make timed
 * snoozes useless. Over the same seven days every pile changed membership:
 * `buried` 4 in and 2 out, `unclicked` 2 in and 2 out, `invisible` 12 in and 12
 * out — the last with no net change at all. A set-hash id would have broken a
 * seven-day snooze on all three, and `invisible`'s within a day or two.
 *
 * `n` cannot exceed the top rung today — the whole inventory is 1,691 pages —
 * but the clamp is explicit rather than left to `undefined`, because a pile
 * bigger than the site would be a bug worth surviving rather than crashing on.
 */
const PILE_RUNGS: readonly number[] = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1_000, 2_000, 5_000];

function pileBand(n: number): number {
  let band = PILE_RUNGS[0];
  for (const rung of PILE_RUNGS) if (n >= rung) band = rung;
  return band;
}

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
  // Keyed on `key`, not `path`, unlike the sweep log above: this set comes from
  // the same `getPageVerdicts` call as the verdicts, so the exact join key is
  // available and there is no reason to match on the weaker half of it.
  const youngKeys = new Set(pages.publishedInsideWindow);
  const items: ActionItem[] = [];

  for (const { diagnosis, title, work, honoursSweep, honoursAge } of PAGE_DIAGNOSES) {
    const diagnosed = pages.verdicts.filter((v) => v.diagnosis === diagnosis);
    const afterSweep = honoursSweep ? diagnosed.filter((v) => !sweptPaths.has(v.path)) : diagnosed;
    const matching = honoursAge ? afterSweep.filter((v) => !youngKeys.has(v.key)) : afterSweep;
    const swept = diagnosed.length - afterSweep.length;
    const tooYoung = afterSweep.length - matching.length;
    if (matching.length === 0) continue;
    // Count, impressions, severity and examples are all computed AFTER both
    // exclusions, so the item never quotes a pile it is not asking for work on.
    const impressions = matching.reduce((sum, v) => sum + v.impressions, 0);
    const examples = matching.slice().sort((a, b) => b.impressions - a.impressions).slice(0, 3).map((v) => v.path);
    const severity: Severity = impressions >= 20_000 ? "URGENT" : impressions >= 5_000 ? "ACTION" : "INFO";
    // Said out loud, with the number: the reader is looking at a smaller pile
    // than the screen behind the link shows, and silently shrinking it would
    // make the two surfaces look like they disagree.
    const sweptNote = swept === 0 ? ""
      : swept === 1 ? " 1 more is left out: its title was rewritten by a sweep still inside its re-measurement window (docs/SEO-TITLE-SWEEP-LOG.md)."
      : ` ${swept} more are left out: their titles were rewritten by a sweep still inside its re-measurement window (docs/SEO-TITLE-SWEEP-LOG.md).`;
    // Same treatment, same reason. The admin screen still lists these pages under
    // this diagnosis with a reason naming their publication date — they are not
    // hidden, they are just not work.
    const youngNote = tooYoung === 0 ? ""
      : tooYoung === 1 ? " 1 more is left out: it was published inside the 90-day window, so it has not had the window to be counted over."
      : ` ${tooYoung.toLocaleString("en-GB")} more are left out: they were published inside the 90-day window, so they have not had the window to be counted over.`;
    items.push({
      // Diagnosis AND the pile's magnitude band, not the diagnosis alone.
      //
      // The bare `page-power:${diagnosis}` this replaced could not keep the
      // promise the design spec makes for it. `dismissForeverItem` writes
      // `snoozedUntil = 2099` (../snooze.ts), so one dismissal of "72 pages
      // buried below position 20" silenced the buried diagnosis for good —
      // including every page that became buried afterwards, which is exactly the
      // "an old snooze cannot hide a new problem" case the spec rules out.
      //
      // Reverting to one item per page would keep the promise and lose the panel:
      // 72 items for `buried` alone and 577 for `invisible`, measured 2026-08-23.
      // The band is the third option. It changes when the pile roughly doubles or
      // halves, so a dismissal covers the pile it was actually taken against and
      // expires the moment that pile becomes a materially different one — while
      // surviving the churn a timed snooze has to survive. See `pileBand` for
      // both measurements, and for why a fingerprint of the page set was
      // rejected even though it would keep the promise exactly.
      //
      // The band is the count AFTER both exclusions, i.e. of the pile this item
      // actually asks for work on — the same rule the title, the impressions and
      // the severity already follow.
      id: `page-power:${diagnosis}:${pileBand(matching.length)}+`,
      severity,
      category: "SEO",
      // Grouped, like the impression count in the very next sentence and like
      // `fmt` on the screen this links to: `invisible` is a four-digit pile, and
      // "1118 pages … 1,463 impressions" in one item reads as two tools.
      title: `${matching.length.toLocaleString("en-GB")} page${matching.length === 1 ? "" : "s"} ${title}`,
      description: `${impressions.toLocaleString("en-GB")} impressions behind them. Work: ${work}. Largest: ${examples.join(", ")}.${sweptNote}${youngNote}`,
      deepLink: "/admin/analytics/seo/power",
      // APPROXIMATION, declared as `ActionItem.since` requires each rule to.
      // Nothing records when a page became buried, unclicked or invisible: the
      // verdict is a 90-day aggregate recomputed from scratch on every call, and
      // there is no history table behind it. So this is the first day the
      // evidence covers, NOT the first day the condition held, and every Page
      // Power item consequently renders as 90 days old and always will. Read it
      // as "measured over the window starting here". Making it truthful needs a
      // stored per-page verdict history, which is a feature, not a fix — and one
      // the Action Center's no-persisted-items contract (../types.ts) rules out
      // as it stands.
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
      // Same approximation as the page items above, but the CLASS layer's own
      // window start rather than the page layer's. They are not the same date:
      // `getClassVerdicts` deliberately does not hold back GSC_LAG_DAYS (see
      // `classWindow`), so its window ends today and starts three days later
      // than the page window does. Quoting the page window on a class item would
      // date it to evidence it was not computed from.
      since: classWindow().windowStart,
    });
  }

  return items;
}
