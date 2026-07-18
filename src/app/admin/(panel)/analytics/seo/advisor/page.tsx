import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { aiConfigured } from "@/lib/ai/anthropic";
import SuggestionCard from "./SuggestionCard";
import type { StoredSuggestion } from "@/lib/seoAdvisor/types";

export const dynamic = "force-dynamic";

export default async function SeoAdvisorPage() {
  const configured = aiConfigured();
  const latest = configured ? await prisma.advisorRun.findFirst({ orderBy: { runDate: "desc" } }) : null;
  const suggestions = ((latest?.suggestions as unknown as StoredSuggestion[]) ?? []).filter((s) => s.status !== "dismissed");

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
          <h2 className="text-sm font-semibold mb-2">Nothing open</h2>
          <p className="text-sm text-[#6B7280]">Latest run ({latest.runDate.toISOString().slice(0, 10)}) had no suggestions left open — all dismissed or approved.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-[#6B7280]">Run: {latest.runDate.toISOString().slice(0, 10)}</p>
          {suggestions.map((s) => <SuggestionCard key={s.id} runId={latest.id} suggestion={s} />)}
        </div>
      )}
    </div>
  );
}
