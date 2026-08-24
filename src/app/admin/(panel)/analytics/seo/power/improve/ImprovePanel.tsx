"use client";

import { useState, useTransition } from "react";
import { applyImprovementAction, dismissImprovementAction, generateImprovementAction } from "./actions";
import {
  IMPROVER_DESC_BUDGET,
  IMPROVER_TITLE_BUDGET,
  type CurrentSeo,
  type ImprovementProposal,
} from "@/lib/ai/pageImprover/types";

export type PanelDraft = {
  id: string;
  createdAtLabel: string;
  /** The diagnosis AS OF generation, not today's — months later the reader has
   *  to be able to see why this draft was proposed even after the verdict moved
   *  (the snapshot columns on the `PageImprovement` model exist for this). */
  diagnosis: string;
  reason: string;
  model: string;
  proposal: ImprovementProposal;
};

export type PanelHistoryRow = {
  id: string;
  status: string;
  createdAtLabel: string;
  appliedAtLabel: string | null;
  appliedByLabel: string | null;
  metaTitle: string;
};

const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white rounded-lg border border-[#E5E7EB] p-5 ${className}`}>{children}</div>
);

const PRIMARY = "rounded-md bg-[#1B4B43] text-white text-sm px-4 py-1.5 hover:bg-[#142E2D] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#1B4B43]";
const SECONDARY = "rounded-md border border-[#E5E7EB] text-[#374151] text-sm px-4 py-1.5 hover:bg-[#F9FAFB] disabled:opacity-40 disabled:cursor-not-allowed";

/** The character count is the point, not decoration.
 *
 *  generate.ts deliberately does NOT fail on an over-long title or description
 *  — only on a digit or a brace — because Google truncates a long line rather
 *  than mis-rendering it, and because German and Russian run long enough that a
 *  hard failure could make Improve unusable for a whole locale (see the comment
 *  above `violationNotes`). That decision is only safe if the human can SEE the
 *  overrun, so this count is printed for every field, always, and turns red the
 *  moment it passes the ceiling. Hide it and the traded-away check becomes a
 *  silent bug. */
const CharCount = ({ text, budget }: { text: string; budget: number }) => {
  const n = text.trim().length;
  return (
    <span className={`text-xs tabular-nums shrink-0 ${n > budget ? "font-semibold text-[#B3261E]" : "text-[#9CA3AF]"}`}>
      {n}/{budget}
    </span>
  );
};

const MetaField = ({ label, current, proposed, budget }: { label: string; current: string; proposed: string; budget: number }) => (
  <div className="py-3">
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">{label}</span>
      <CharCount text={proposed} budget={budget} />
    </div>
    {/* Current above proposed, muted above emphasized: the reader is judging a
        replacement, and a proposal shown without the line it replaces cannot be
        judged at all. Empty rather than omitted when the page has no current
        value — "nothing there today" is itself the diagnosis on many of these. */}
    <p className="text-sm text-[#9CA3AF] mt-1 break-words">{current || <span className="italic">nothing set today</span>}</p>
    <p className="text-sm text-[#111827] font-medium mt-1 break-words">{proposed}</p>
    {proposed.trim().length > budget && (
      <p className="text-xs text-[#B3261E] mt-1">
        Over the ceiling — Google will truncate it. Trim it in the editor after applying, or regenerate.
      </p>
    )}
  </div>
);

export default function ImprovePanel({
  pageKey,
  currentSeo,
  draft,
  history,
  applyEnabled,
  noApplyPath,
  editorHref,
  generateDisabledReason,
}: {
  pageKey: string;
  currentSeo: CurrentSeo | null;
  draft: PanelDraft | null;
  history: PanelHistoryRow[];
  applyEnabled: boolean;
  /** Set for the kinds with no row to write to (`fixed` pages) — the Apply
   *  button is not rendered at all and this sentence says what to do instead. */
  noApplyPath: string | null;
  editorHref: string | null;
  /** Set when Generate cannot succeed yet for a reason the operator cannot fix
   *  from this screen — today only the un-deployed table. Better a disabled
   *  button carrying the reason than a click that spends a Claude call and dies
   *  on the insert. */
  generateDisabledReason: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const run = (action: () => Promise<{ error?: string }>) => {
    setError(null);
    startTransition(async () => {
      // Every one of the three actions returns `{ error }` rather than
      // throwing — dismiss included, which is easy to assume cannot fail — so
      // all three are surfaced the same way instead of one of them silently
      // doing nothing on a failure.
      const res = await action();
      if (res.error) setError(res.error);
    });
  };

  const copy = (id: string, text: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(id);
        setTimeout(() => setCopied((c) => (c === id ? null : c)), 1500);
      })
      // Refused outside a secure context, and refusable by permission policy.
      // Saying so beats a Copy button that looks like it worked.
      .catch(() => setError("The browser blocked the clipboard — select the text and copy it by hand."));
  };

  const generate = () => run(() => generateImprovementAction(pageKey));

  return (
    <div className="space-y-6">
      {error && (
        <Card className="border-[#F5C6C2] bg-[#FDF2F1]">
          <p className="text-sm text-[#8C1D18]">{error}</p>
        </Card>
      )}

      {!draft ? (
        <Card>
          <h2 className="text-sm font-semibold">No open draft</h2>
          <p className="text-sm text-[#6B7280] mt-1 max-w-prose">
            Generate reads this page as it is served, its pooled search queries and the healthy pages of its own template class, then
            drafts a repair. Nothing is published: the result is a draft you read, and only the title and description can be applied,
            with one click, after you have read them.
          </p>
          <div className="flex items-center gap-3 mt-4">
            <button
              type="button"
              onClick={generate}
              disabled={pending || generateDisabledReason !== null}
              title={generateDisabledReason ?? undefined}
              className={PRIMARY}
            >
              {/* Tens of seconds, not a spinner's worth: one Claude call behind
                  a live page fetch and two verdict sets. The button says what is
                  happening and stays disabled so a second click cannot start a
                  second generation for the same page. */}
              {pending ? "Generating… (this takes a while)" : "Generate a proposal"}
            </button>
            {generateDisabledReason && <span className="text-xs text-[#6B7280]">{generateDisabledReason}</span>}
          </div>
        </Card>
      ) : (
        <>
          <Card>
            <div className="flex items-baseline justify-between gap-4 flex-wrap">
              <h2 className="text-sm font-semibold">Proposed meta</h2>
              <span className="text-xs text-[#6B7280]">
                Drafted {draft.createdAtLabel} · {draft.model} · diagnosed {draft.diagnosis} at the time
              </span>
            </div>
            {draft.reason && <p className="text-xs text-[#6B7280] mt-1 max-w-prose">{draft.reason}</p>}

            <div className="divide-y divide-[#F3F4F6] mt-2">
              <MetaField label="Title" current={currentSeo?.metaTitle ?? ""} proposed={draft.proposal.metaTitle} budget={IMPROVER_TITLE_BUDGET} />
              <MetaField label="Description" current={currentSeo?.metaDescription ?? ""} proposed={draft.proposal.metaDescription} budget={IMPROVER_DESC_BUDGET} />
            </div>

            {noApplyPath && <p className="text-sm text-[#6B7280] mt-3 max-w-prose">{noApplyPath}</p>}

            <div className="flex items-center gap-3 mt-4 flex-wrap">
              {!noApplyPath && (
                <button
                  type="button"
                  onClick={() => run(() => applyImprovementAction(draft.id))}
                  disabled={pending || !applyEnabled}
                  // The server action refuses independently — this tooltip is a
                  // courtesy so the disabled button is not a mystery.
                  title={applyEnabled ? undefined : "Behind the calibration gate"}
                  className={PRIMARY}
                >
                  {pending ? "Working…" : "Apply meta"}
                </button>
              )}
              <button type="button" onClick={() => run(() => dismissImprovementAction(draft.id))} disabled={pending} className={SECONDARY}>
                Dismiss
              </button>
              <button type="button" onClick={generate} disabled={pending || generateDisabledReason !== null} title={generateDisabledReason ?? undefined} className={SECONDARY}>
                {pending ? "Working…" : "Regenerate"}
              </button>
              {!applyEnabled && !noApplyPath && (
                <span className="text-xs text-[#6B7280]">Apply is behind the calibration gate until five real proposals have been judged by hand.</span>
              )}
            </div>
          </Card>

          {draft.proposal.contentSections.length > 0 && (
            <Card>
              <h2 className="text-sm font-semibold">Content sections</h2>
              <p className="text-xs text-[#6B7280] mt-1 max-w-prose">
                Drafts for a human editor, in the page&apos;s own locale. Nothing here is ever written by Apply — copy what earns its
                place, edit it, drop the rest.
              </p>
              <div className="space-y-5 mt-4">
                {draft.proposal.contentSections.map((s, i) => (
                  <div key={`${s.heading}-${i}`}>
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="text-sm font-medium text-[#111827]">{s.heading}</h3>
                      <button type="button" onClick={() => copy(`section-${i}`, `${s.heading}\n\n${s.draft}`)} className="text-xs text-[#1B4B43] hover:underline shrink-0">
                        {copied === `section-${i}` ? "Copied" : "Copy"}
                      </button>
                    </div>
                    <p className="text-sm text-[#374151] whitespace-pre-wrap mt-1 bg-[#FAFAFA] border border-[#F3F4F6] rounded p-3">{s.draft}</p>
                    {s.queriesServed.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {/* The queries this section is FOR, from the page's own
                            pooled GSC rows. A section with no query behind it is
                            the one to cut, and that is only visible here. */}
                        {s.queriesServed.map((q) => (
                          <span key={q} className="text-[11px] text-[#4B5563] bg-[#F3F4F6] rounded px-1.5 py-0.5">{q}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {editorHref && (
                <a href={editorHref} className="inline-block text-sm text-[#1B4B43] hover:underline mt-4">Open in editor →</a>
              )}
            </Card>
          )}

          {draft.proposal.internalLinks.length > 0 && (
            <Card>
              <h2 className="text-sm font-semibold">Internal links</h2>
              <p className="text-xs text-[#6B7280] mt-1 max-w-prose">
                Links FROM other pages TO this one. The model cannot see the whole site, so treat each `from` path as a suggestion to
                check rather than a fact.
              </p>
              <ul className="mt-3 space-y-2">
                {draft.proposal.internalLinks.map((l, i) => (
                  <li key={`${l.fromPath}-${i}`} className="text-sm">
                    <span className="text-[#374151] break-words">{l.fromPath}</span>
                    <span className="text-[#9CA3AF]"> → </span>
                    <span className="text-[#111827] font-medium break-words">{l.anchor}</span>
                    <p className="text-xs text-[#6B7280] mt-0.5">{l.why}</p>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {draft.proposal.rationale && (
            <Card>
              <h2 className="text-sm font-semibold">Rationale</h2>
              <p className="text-sm text-[#374151] mt-1 max-w-prose whitespace-pre-wrap">{draft.proposal.rationale}</p>
            </Card>
          )}
        </>
      )}

      {history.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold">History</h2>
          <div className="overflow-x-auto mt-3">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-[#6B7280] uppercase tracking-wide border-b border-[#E5E7EB]">
                  <th className="pb-2 pr-4 font-semibold">Drafted</th>
                  <th className="pb-2 pr-4 font-semibold">Status</th>
                  <th className="pb-2 pr-4 font-semibold whitespace-nowrap">Applied</th>
                  <th className="pb-2 font-semibold">Title it proposed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {history.map((h) => (
                  <tr key={h.id} className="align-top">
                    <td className="py-2 pr-4 tabular-nums whitespace-nowrap text-[#6B7280]">{h.createdAtLabel}</td>
                    <td className={`py-2 pr-4 capitalize ${h.status === "applied" ? "text-[#1B5E3A]" : "text-[#6B7280]"}`}>{h.status}</td>
                    <td className="py-2 pr-4 text-[#6B7280] whitespace-nowrap">
                      {h.appliedAtLabel ? `${h.appliedAtLabel}${h.appliedByLabel ? ` · ${h.appliedByLabel}` : ""}` : "—"}
                    </td>
                    <td className="py-2 text-[#374151] break-words">{h.metaTitle}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
