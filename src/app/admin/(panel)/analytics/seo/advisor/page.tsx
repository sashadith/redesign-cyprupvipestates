import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { aiConfigured } from "@/lib/ai/anthropic";
import SuggestionCard from "./SuggestionCard";
import RunHistoryItem from "./RunHistoryItem";
import { sortSuggestions } from "./sortSuggestions";
import type { StoredSuggestion } from "@/lib/seoAdvisor/types";

export const dynamic = "force-dynamic";

export default async function SeoAdvisorPage() {
  const configured = aiConfigured();
  const runs = configured
    ? await prisma.advisorRun.findMany({ orderBy: { runDate: "desc" }, take: 25 })
    : [];
  const [latest, ...history] = runs;
  const suggestions = sortSuggestions((latest?.suggestions as unknown as StoredSuggestion[]) ?? []);
  const openCount = suggestions.filter((s) => s.status === "open").length;
  const closedCount = suggestions.length - openCount;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">SEO Advisor</h1>
          <p className="text-sm text-[#6B7280] mt-1">Weekly analysis, run Sundays 06:00 UTC — at most 5 suggestions, each citing the specific data behind it.</p>
        </div>
        <Link href="/admin/analytics/seo" className="text-sm text-[#1B4B43] hover:underline">← Back to SEO</Link>
      </div>

      {!configured ? (
        <div className="bg-white rounded-lg border border-[#E5E7EB] p-5">
          <h2 className="text-sm font-semibold mb-2">Not configured</h2>
          <p className="text-sm text-[#6B7280]">Set <code className="bg-[#F3F4F6] px-1 rounded">ANTHROPIC_API_KEY</code> in the environment for the weekly analysis to run.</p>
        </div>
      ) : !latest ? (
        <div className="bg-white rounded-lg border border-[#E5E7EB] p-5">
          <h2 className="text-sm font-semibold mb-2">No runs yet</h2>
          <p className="text-sm text-[#6B7280]">The next Sunday 06:00 UTC cron run will produce the first analysis.</p>
        </div>
      ) : suggestions.length === 0 ? (
        <div className="bg-white rounded-lg border border-[#E5E7EB] p-5">
          <h2 className="text-sm font-semibold mb-2">Nothing to show</h2>
          <p className="text-sm text-[#6B7280]">Latest run ({latest.runDate.toISOString().slice(0, 10)}) had no suggestions.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-[#6B7280]">Run: {latest.runDate.toISOString().slice(0, 10)}</p>
          {suggestions.slice(0, openCount).map((s) => <SuggestionCard key={s.id} runId={latest.id} suggestion={s} />)}
          {openCount > 0 && closedCount > 0 && (
            <div className="flex items-center gap-3 py-1">
              <div className="h-px bg-[#E5E7EB] flex-1" />
              <span className="text-[10px] font-semibold uppercase tracking-wide text-[#9CA3AF]">Completed this run</span>
              <div className="h-px bg-[#E5E7EB] flex-1" />
            </div>
          )}
          {suggestions.slice(openCount).map((s) => <SuggestionCard key={s.id} runId={latest.id} suggestion={s} />)}
        </div>
      )}

      {history.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[#9CA3AF] mb-2">Run history</h2>
          <div className="bg-white rounded-lg border border-[#E5E7EB] px-4">
            {history.map((run) => (
              <RunHistoryItem
                key={run.id}
                runId={run.id}
                runDate={run.runDate.toISOString().slice(0, 10)}
                suggestions={(run.suggestions as unknown as StoredSuggestion[]) ?? []}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
