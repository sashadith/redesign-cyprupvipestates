"use client";

import { useMemo, useState } from "react";
import { templateClassOf } from "@/lib/seo/templateClass";
import { BURIED_POSITION, POSITION_BUCKETS, WINDOW_DAYS, type PageDiagnosis } from "@/lib/seo/pagePower/types";

/** Exactly the fields this table renders — deliberately narrower than
 *  `PageVerdict`. Every field crosses the RSC boundary 1,691 times: measured
 *  against production on 2026-08-23 the nine below serialise to 682KB, and
 *  carrying `clicks` as well — it is not displayed — took it to 701KB for
 *  nothing. Add a field here when a column shows it, not before.
 *
 *  `clicks` is the only field left behind now. `templateClass` used to be the
 *  second, and it is no longer a choice this comment gets to make: it was
 *  deleted from `PageVerdict` outright once it turned out that nothing anywhere
 *  read it — not this table, not gather.ts, not the Action Center.
 *
 *  The nine grew from 581KB the same day, and the twelve listing URLs the
 *  inventory gained are almost none of it. `reason` alone is 330KB of the 682,
 *  nearly half of every row, and the publication-age sentence is a long one: the
 *  548 invisible pages published inside the window average 340 characters of
 *  reason against 190 across the whole table, 189KB between them. Saying WHY a
 *  page is not being shown costs bytes; a column that renders a number does
 *  not. That is the trade this narrowing exists to keep making. */
export type Row = {
  key: string;
  locale: string;
  /** As served, locale prefix included — see `PageKey` in pagePower/types.ts.
   *  English is prefix-less, de/pl/ru are not. */
  path: string;
  impressions: number;
  /** percent, 0–100 */
  ctr: number;
  position: number | null;
  diagnosis: PageDiagnosis;
  reason: string;
  impressionsTrendPct: number | null;
};

/** Keyed by `PageDiagnosis`, not by `string`, so a sixth diagnosis added to
 *  pagePower/types.ts fails the build here rather than silently producing a
 *  bucket of pages with no tab to reach it from. */
const DIAGNOSIS_LABEL: Record<PageDiagnosis, string> = {
  buried: "Buried",
  unclicked: "Unclicked",
  invisible: "Invisible",
  healthy: "Healthy",
  unjudged: "Not enough data",
};

/** One line per diagnosis saying what the pile IS, above the table, so a reader
 *  does not have to infer it from a row. Same exhaustive-Record argument as the
 *  labels: a sixth diagnosis fails the build rather than opening a tab with no
 *  account of what its rows have in common. */
const DIAGNOSIS_BLURB: Record<PageDiagnosis, string> = {
  buried: `Found by Google, but ranked past position ${BURIED_POSITION}, where almost nobody looks.`,
  unclicked: "Ranked high enough to be seen, and passed over anyway.",
  invisible: "Barely shown at all — too few impressions to read anything from.",
  healthy: "Clicked about as often as its ranking position predicts.",
  unjudged: "Held back deliberately: the site's own data cannot support a verdict either way.",
};

/** Severity, not hue as decoration: a tab's colour says whether its pile names
 *  work to do. `buried` and `unclicked` are the two that do; `invisible` is a
 *  long tail that mostly resolves itself as pages age; `healthy` and `unjudged`
 *  are context and stay grey. Drawn from the palette already in analytics/seo
 *  rather than a second one invented here. */
type Tone = { dot: string; text: string; border: string; band: string; bandText: string };
const DIAGNOSIS_TONE: Record<PageDiagnosis, Tone> = {
  buried:    { dot: "bg-[#B3261E]", text: "text-[#B3261E]", border: "border-[#B3261E]", band: "bg-[#FDF2F1]", bandText: "text-[#8C1D18]" },
  unclicked: { dot: "bg-[#B45309]", text: "text-[#B45309]", border: "border-[#B45309]", band: "bg-[#FEF6EA]", bandText: "text-[#8A5A0B]" },
  invisible: { dot: "bg-[#9CA3AF]", text: "text-[#374151]", border: "border-[#6B7280]", band: "bg-[#F6F7F8]", bandText: "text-[#4B5563]" },
  healthy:   { dot: "bg-[#1B5E3A]", text: "text-[#1B5E3A]", border: "border-[#1B5E3A]", band: "bg-[#F0F7F3]", bandText: "text-[#1B5E3A]" },
  unjudged:  { dot: "bg-[#D1D5DB]", text: "text-[#374151]", border: "border-[#9CA3AF]", band: "bg-[#F6F7F8]", bandText: "text-[#4B5563]" },
};

/** Derived from the literal above rather than hand-written a second time:
 *  non-numeric string keys enumerate in insertion order, so that one literal is
 *  both the label table and the tab order and the two cannot drift. The order
 *  is triage order — the three diagnoses that name work to do, then the two
 *  that are only ever context. */
const TABS = Object.keys(DIAGNOSIS_LABEL) as PageDiagnosis[];

const SITE_URL = "https://cyprusvipestates.com";

const fmt = (n: number): string => n.toLocaleString("en-GB");
const pages = (n: number): string => `${fmt(n)} ${n === 1 ? "page" : "pages"}`;

const LocaleBadge = ({ locale }: { locale: string }) => (
  <span className="text-[10px] font-semibold uppercase tracking-wide text-[#6B7280] bg-[#F3F4F6] px-1.5 py-0.5 rounded shrink-0">{locale}</span>
);

/** The four homepages render as `/`, `/de`, `/pl`, `/ru` — a bare slash is a
 *  four-pixel click target and reads as punctuation next to a 115-character
 *  blog path. Not hypothetical: `/` and `/de` are both in the buried pile
 *  today. `templateClassOf` rather than a second root-URL regex, so the set of
 *  paths that count as a homepage is defined in one place. */
const pathLabel = (path: string): string => (templateClassOf(path) === "homepage" ? `${path} (homepage)` : path);

/** Position is the number on this table that decides what the work IS, so it is
 *  the one that carries colour. The bands ARE `POSITION_BUCKETS` and
 *  `BURIED_POSITION`, read from types.ts rather than a second set of numbers
 *  invented here: re-banding the buckets must move this legend with them, or
 *  the colours would go on describing thresholds the module no longer uses. */
const FIRST_BAND_TOP = POSITION_BUCKETS[0][1];
const SECOND_BAND_TOP = POSITION_BUCKETS[1][1];
function positionTone(position: number): string {
  if (position < FIRST_BAND_TOP) return "bg-[#E6F1EA] text-[#14532D]";
  if (position < SECOND_BAND_TOP) return "bg-[#F0F7F3] text-[#1B5E3A]";
  if (position <= BURIED_POSITION) return "bg-[#FEF6EA] text-[#8A5A0B]";
  return "bg-[#FDF2F1] text-[#8C1D18]";
}

/** Grouping key: a reason with its numbers normalised away, so two rows whose
 *  sentences differ only in their figures land together. The key never reaches
 *  the DOM — what a reader sees is always the real string from a real verdict. */
const reasonShape = (reason: string): string => reason.replace(/[\d][\d,.]*/g, "#");

/** The wording a group's reasons share, lifted into one band above them.
 *
 *  Why this exists: measured against production on 2026-08-23, four of the five
 *  tabs hold exactly ONE reason shape — `buried` printed the same sentence 79
 *  times, `healthy` 39, `unclicked` 12 — and the varying half of each of those
 *  sentences was the impressions, CTR and position already sitting in their own
 *  columns to its left. The widest column on the screen was restating three
 *  columns and appending one constant clause. `invisible` has 7 shapes across
 *  1,129 rows and `unjudged` 3 across 436, so grouping earns its keep there
 *  too: it turns an undifferentiated wall into "published inside the window",
 *  "no impressions at all", "ranks well, nobody searches for it".
 *
 *  Computed as the longest common suffix, NOT parsed from a known template and
 *  NOT re-typed here. That is the load-bearing part: every one of these
 *  sentences lives in pageVerdicts.ts and several were rewritten during
 *  calibration. A hardcoded copy would have drifted silently the first time one
 *  changed. This cannot: where reasons share no trailing wording the suffix is
 *  empty and every row simply keeps its reason in full — which is the right
 *  outcome for the 552 publication-age rows, whose sentences END in a
 *  per-page date and carry two dates a column does not show. */
const MIN_SHARED_SUFFIX = 24;
function longestCommonSuffix(strings: string[]): string {
  if (strings.length < 2) return "";
  const first = strings[0];
  // Whole-sentence case, and not a rare one: 380 of the 1,129 invisible rows
  // carry byte-identical reasons, because that branch interpolates only
  // constants. Trimming those forward to a word boundary would leave "Fewer"
  // in 380 cells and open the band mid-sentence.
  if (strings.every((s) => s === first)) return first;
  let end = first.length;
  for (const s of strings.slice(1)) {
    let i = 0;
    while (i < end && i < s.length && first[first.length - 1 - i] === s[s.length - 1 - i]) i++;
    end = i;
  }
  const candidate = first.slice(first.length - end);
  // Trimmed forward to a word boundary so a band never opens mid-word, and
  // required to be long enough to be worth a band at all — under that the rows
  // keep their reasons rather than losing a clause to a header nobody reads.
  const space = candidate.indexOf(" ");
  // Also past a leading em dash, which is where most of these sentences turn
  // from evidence to advice: the trim lands on "— nobody scrolls that far",
  // and a band opening on a dangling dash reads as a rendering fault.
  const suffix = (space === -1 ? candidate : candidate.slice(space + 1)).replace(/^—\s*/, "");
  return suffix.length >= MIN_SHARED_SUFFIX ? suffix : "";
}

/** Whether what is left of a reason after its band says anything the columns do
 *  not already say.
 *
 *  This is measured per row, not assumed per diagnosis. `buried` leaves "850
 *  impressions at average position 25.8" — both figures are the two columns
 *  immediately to its left, so the cell is pure restatement and is dropped.
 *  `unclicked` leaves "CTR 0.24% against 1.50% typical for position 7.7", where
 *  1.50% is the median for that position band and appears in no column at all,
 *  so that cell stays. Nothing distinguishes those two cases except the numbers
 *  themselves, which is why the test reads them rather than listing diagnoses.
 *
 *  `WINDOW_DAYS` is admitted alongside the columns because "in 90 days" is the
 *  window this whole screen is scoped to and is printed in its header. A number
 *  that is neither a column nor the window is, by definition, something the
 *  reader can only learn here. */
function detailAddsSomething(detail: string, row: Row): boolean {
  const known = [row.impressions, row.ctr, WINDOW_DAYS, ...(row.position == null ? [] : [row.position])];
  const numbers = detail.match(/\d[\d,]*(?:\.\d+)?/g) ?? [];
  if (numbers.length === 0) return detail.trim().length > 0;
  return numbers.some((raw) => {
    const value = Number(raw.replace(/,/g, ""));
    // Rounded to the precision the sentence itself prints, so a printed 25.8
    // matches a stored 25.83 — exactly what the Position column does. A
    // tolerance band instead of rounding left one row in sixty showing a
    // restatement its neighbours had dropped.
    const places = (raw.split(".")[1] ?? "").length;
    return !known.some((k) => Number(k.toFixed(places)) === value);
  });
}

type Group = { key: string; shared: string; rows: Row[] };

function groupByReason(rows: Row[]): Group[] {
  const byShape = new Map<string, Row[]>();
  for (const r of rows) {
    const key = reasonShape(r.reason);
    const bucket = byShape.get(key);
    if (bucket) bucket.push(r);
    else byShape.set(key, [r]);
  }
  return Array.from(byShape.entries())
    .map(([key, groupRows]) => ({ key, shared: longestCommonSuffix(groupRows.map((r) => r.reason)), rows: groupRows }))
    // Largest group first: the pile's dominant story is the one a reader should
    // meet, and on `invisible` that is the pages published inside the window —
    // the ones the Action Center deliberately does not ask for work on.
    .sort((a, b) => b.rows.length - a.rows.length);
}

export default function PagePowerTable({ rows }: { rows: Row[] }) {
  const [filter, setFilter] = useState<PageDiagnosis>("buried");

  const counts = useMemo(() => {
    const c = new Map<PageDiagnosis, number>();
    for (const r of rows) c.set(r.diagnosis, (c.get(r.diagnosis) ?? 0) + 1);
    return c;
  }, [rows]);

  const shown = useMemo(
    () =>
      rows
        .filter((r) => r.diagnosis === filter)
        // Tie-broken on path, not left to impressions alone: 622 pages have
        // zero impressions and `sort` is stable, so ties fall back to inventory
        // order — which comes from Prisma `findMany` calls with no `orderBy`,
        // i.e. whatever order Postgres happened to return. Without the
        // tie-break the 1,129-row `invisible` tab reshuffles between loads.
        .sort((a, b) => b.impressions - a.impressions || a.path.localeCompare(b.path)),
    [rows, filter],
  );

  const groups = useMemo(() => groupByReason(shown), [shown]);
  const totalImpressions = useMemo(() => shown.reduce((sum, r) => sum + r.impressions, 0), [shown]);
  // Scales the impressions bar. Taken per tab rather than per group, so one
  // row's bar means the same thing as another's everywhere a reader is looking.
  const maxImpressions = useMemo(() => shown.reduce((m, r) => Math.max(m, r.impressions), 0), [shown]);

  const tone = DIAGNOSIS_TONE[filter];

  return (
    <div>
      <div className="flex gap-1 border-b border-[#E5E7EB] flex-wrap">
        {TABS.map((d) => {
          const t = DIAGNOSIS_TONE[d];
          const active = filter === d;
          return (
            <button
              key={d}
              type="button"
              onClick={() => setFilter(d)}
              aria-pressed={active}
              className={`px-3 py-1.5 text-sm -mb-px border-b-2 flex items-center gap-1.5 ${active ? `${t.border} ${t.text} font-medium` : "border-transparent text-[#6B7280] hover:text-[#111827]"}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${t.dot} ${active ? "" : "opacity-40"}`} />
              {DIAGNOSIS_LABEL[d]} <span className="text-[#9CA3AF] tabular-nums">{fmt(counts.get(d) ?? 0)}</span>
            </button>
          );
        })}
      </div>

      {/* The pile's headline before any row: what it is, how big, and how much
          search traffic sits behind it. Impressions-at-stake is what the Action
          Center scales its severity on, so it belongs where someone deciding
          which tab to open can see it. */}
      <div className="flex items-baseline flex-wrap gap-x-3 gap-y-1 mt-4 mb-3">
        <span className="text-sm text-[#111827]">{DIAGNOSIS_BLURB[filter]}</span>
        <span className="text-xs text-[#6B7280] tabular-nums">{pages(shown.length)} · {fmt(totalImpressions)} impressions</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-[#6B7280] uppercase tracking-wide border-b border-[#E5E7EB]">
              <th className="pb-2 pr-4 font-semibold">Page</th>
              <th className="pb-2 pr-4 font-semibold text-right whitespace-nowrap">Impressions</th>
              <th className="pb-2 pr-4 font-semibold text-right whitespace-nowrap" title="Impressions in the last 28 days against the 28 days before them">28d</th>
              <th className="pb-2 pr-4 font-semibold text-right whitespace-nowrap">CTR</th>
              <th className="pb-2 pr-4 font-semibold text-right whitespace-nowrap">Position</th>
              {/* Only what the group band above does not already say. On a tab
                  whose rows all share one sentence this column is empty by
                  design — the sentence is up there, once. */}
              <th className="pb-2 font-semibold">Detail</th>
            </tr>
          </thead>
          {/* Every matching row, uncapped. `invisible` is 1,129 rows today and
              renders in well under a second, while a cap would hide exactly
              what makes that pile worth opening — the pages whose reason rules
              a cause OUT rather than in. 552 of those rows were published
              inside the window and say so, and the Action Center deliberately
              does not ask for work on them; this screen is where they stay
              visible, because the diagnosis is still true of them. The default
              tab is `buried` (79 rows), so the long list only renders when
              someone asks for it. */}
          {groups.map((group) => (
            <tbody key={group.key} className="divide-y divide-[#F3F4F6]">
              {group.shared !== "" && (
                <tr>
                  <td colSpan={6} className="pt-4">
                    <div className={`rounded px-3 py-2 flex items-baseline gap-2 flex-wrap ${tone.band} ${tone.bandText}`}>
                      <span className="text-xs font-semibold tabular-nums shrink-0">{pages(group.rows.length)}</span>
                      <span className="text-xs">{group.shared}</span>
                    </div>
                  </td>
                </tr>
              )}
              {group.rows.map((r) => {
                // The remainder after the band. Sliced by length off the same
                // string the suffix was derived from, so band plus detail is
                // exactly the original reason — never a re-worded copy of it.
                // Suppression only ever applies UNDER a band. With no band the
                // reason is the only explanation this row has, and dropping it
                // as "redundant with the columns" would leave the cell blank
                // and the reader with nothing — which is what happened to all
                // 39 healthy rows before this was tested against live data.
                const remainder = group.shared === "" ? r.reason : r.reason.slice(0, r.reason.length - group.shared.length).trim();
                const detail = group.shared === "" || detailAddsSomething(remainder, r) ? remainder : "";
                return (
                  <tr key={r.key} className="align-top hover:bg-[#FAFAFA]">
                    <td className="py-2 pr-4">
                      <div className="flex items-baseline gap-2">
                        <LocaleBadge locale={r.locale} />
                        <a href={`${SITE_URL}${r.path}`} target="_blank" rel="noreferrer" className="text-[#374151] hover:text-[#1B4B43] hover:underline break-words" title={r.path}>
                          {pathLabel(r.path)}
                        </a>
                      </div>
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums whitespace-nowrap">
                      {fmt(r.impressions)}
                      {/* Relative scale, so the few rows carrying most of a
                          pile's traffic separate from its tail at a glance.
                          Omitted at zero rather than drawn as an empty track:
                          622 pages have no impressions, and a column of empty
                          troughs reads as a rendering fault. */}
                      {maxImpressions > 0 && r.impressions > 0 && (
                        <span className="block mt-1 h-[3px] rounded-sm bg-[#EDEFF1] overflow-hidden">
                          <span className={`block h-full ${tone.dot}`} style={{ width: `${Math.max(2, (r.impressions / maxImpressions) * 100)}%` }} />
                        </span>
                      )}
                    </td>
                    <td className={`py-2 pr-4 text-right tabular-nums whitespace-nowrap ${r.impressionsTrendPct == null ? "text-[#9CA3AF]" : r.impressionsTrendPct >= 0 ? "text-[#1B5E3A]" : "text-[#B3261E]"}`}>
                      {/* Null on 1,596 of 1,691 pages — the prior 28 days must clear
                          MIN_IMPRESSIONS_TREND before a percentage means anything,
                          and an invisible page never will. Empty is the honest
                          reading; see `impressionsTrendPct` in pagePower/types.ts. */}
                      {r.impressionsTrendPct == null ? "—" : `${r.impressionsTrendPct >= 0 ? "+" : ""}${r.impressionsTrendPct.toFixed(0)}%`}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums whitespace-nowrap">{r.ctr.toFixed(2)}%</td>
                    {/* Null exactly when the page drew no impressions (622 pages).
                        Rendering 0 there would read as "ranked first". */}
                    <td className="py-2 pr-4 text-right tabular-nums whitespace-nowrap">
                      {r.position == null ? (
                        <span className="text-[#9CA3AF]">—</span>
                      ) : (
                        <span className={`inline-block rounded px-1.5 py-0.5 font-medium ${positionTone(r.position)}`}>{r.position.toFixed(1)}</span>
                      )}
                    </td>
                    <td className="py-2 text-[#6B7280]">{detail}</td>
                  </tr>
                );
              })}
            </tbody>
          ))}
          {shown.length === 0 && (
            <tbody>
              <tr><td colSpan={6} className="py-6 text-center text-[#9CA3AF]">No pages with this diagnosis.</td></tr>
            </tbody>
          )}
        </table>
      </div>
    </div>
  );
}
