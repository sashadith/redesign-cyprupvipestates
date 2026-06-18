import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { updateLeadStatus } from "../../../actions";

export const dynamic = "force-dynamic";

const PIPELINE = ["NEW", "QUALIFIED", "CONTACTED", "VIEWING_SCHEDULED", "OFFER", "CLOSED", "LOST"];
const COL_ACCENT: Record<string, string> = {
  NEW: "border-t-blue-400", QUALIFIED: "border-t-purple-400", CONTACTED: "border-t-yellow-400",
  VIEWING_SCHEDULED: "border-t-orange-400", OFFER: "border-t-indigo-400", CLOSED: "border-t-green-500", LOST: "border-t-red-400",
};

export default async function CrmBoard() {
  const leads = await prisma.lead.findMany({ orderBy: { updatedAt: "desc" } });
  const byStatus: Record<string, typeof leads> = Object.fromEntries(PIPELINE.map((s) => [s, []]));
  for (const l of leads) (byStatus[l.status] ??= []).push(l);

  async function move(formData: FormData) {
    "use server";
    await updateLeadStatus(String(formData.get("id")), String(formData.get("status")));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Pipeline</h1>
        <Link href="/admin/crm" className="text-sm text-[#1B4B43] hover:underline">List view →</Link>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {PIPELINE.map((status) => (
          <div key={status} className="w-64 shrink-0">
            <div className={`bg-white rounded-t-lg border-t-2 ${COL_ACCENT[status]} border-x border-[#E5E7EB] px-3 py-2 flex items-center justify-between`}>
              <span className="text-xs font-semibold">{status.replace(/_/g, " ")}</span>
              <span className="text-xs text-[#6B7280]">{byStatus[status].length}</span>
            </div>
            <div className="bg-[#F8F9FA] border-x border-b border-[#E5E7EB] rounded-b-lg p-2 space-y-2 min-h-[120px]">
              {byStatus[status].map((l) => (
                <div key={l.id} className="bg-white rounded-md border border-[#E5E7EB] p-3">
                  <Link href={`/admin/crm/${l.id}`} className="text-sm font-medium text-[#1B4B43] hover:underline block truncate">
                    {l.firstName} {l.lastName}
                  </Link>
                  <div className="text-xs text-[#6B7280] truncate">{l.email}</div>
                  <div className="text-[11px] text-[#9CA3AF] mt-1">{l.source.replace(/_/g, " ")} · {new Date(l.createdAt).toLocaleDateString("en-GB")}</div>
                  <form action={move} className="mt-2 flex gap-1">
                    <input type="hidden" name="id" value={l.id} />
                    <select name="status" defaultValue={status} className="flex-1 rounded border border-[#E5E7EB] text-[11px] px-1 py-1 text-[#111827]">
                      {PIPELINE.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                    </select>
                    <button className="rounded bg-[#1B4B43] text-white text-[11px] px-2 hover:bg-[#142E2D]">Move</button>
                  </form>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
