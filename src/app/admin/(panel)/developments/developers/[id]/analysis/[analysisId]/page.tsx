import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { deleteFeedAnalysis } from "@/app/admin/actions";
import MappingTable from "./mapping-table";
import ReanalyzeButton from "./reanalyze-button";

export const dynamic = "force-dynamic";

export default async function AnalysisPage({ params }: { params: { id: string; analysisId: string } }) {
  const a = await prisma.developerFeedAnalysis.findUnique({
    where: { id: params.analysisId },
    include: { developerAccount: { select: { id: true, name: true } } },
  });
  if (!a || a.developerAccountId !== params.id) notFound();

  const fields = Array.isArray(a.fields) ? (a.fields as any[]) : [];
  const del = deleteFeedAnalysis.bind(null, a.id);

  return (
    <div className="space-y-5">
      <div>
        <Link href={`/admin/developments/developers/${a.developerAccount.id}`} className="text-sm text-[#6B7280] hover:underline">
          ← {a.developerAccount.name}
        </Link>
        <div className="flex items-center justify-between mt-1">
          <h1 className="text-xl font-semibold text-[#111827]">Feed analysis</h1>
          <ReanalyzeButton analysisId={a.id} />
        </div>
      </div>

      <div className="bg-white rounded-lg border border-[#E5E7EB] p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <div className="text-[#9CA3AF] text-xs">Source</div>
          <div className="text-[#111827]">{a.sourceType === "URL" ? "URL" : "File"}</div>
          <div className="text-[#6B7280] text-xs truncate">{a.sourceType === "URL" ? a.sourceUrl : a.sourceFileName}</div>
        </div>
        <div>
          <div className="text-[#9CA3AF] text-xs">Item node</div>
          <code className="text-xs text-[#111827]">{a.itemNodePath ?? "—"}</code>
        </div>
        <div>
          <div className="text-[#9CA3AF] text-xs">Items detected</div>
          <div className="text-[#111827]">{a.itemCount}</div>
        </div>
        <div>
          <div className="text-[#9CA3AF] text-xs">Fields</div>
          <div className="text-[#111827]">{fields.length}</div>
        </div>
      </div>

      {fields.length === 0 ? (
        <div className="bg-white rounded-lg border border-[#E5E7EB] p-8 text-center text-[#6B7280]">
          No fields were detected in this feed.
        </div>
      ) : (
        <MappingTable key={a.updatedAt.getTime()} analysisId={a.id} initialFields={fields as any} />
      )}

      <form action={del} className="pt-2">
        <button className="text-sm text-[#C0392B] hover:underline">Delete this analysis</button>
      </form>
    </div>
  );
}
