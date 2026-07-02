import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { updateDeveloperAccount, deleteDeveloperAccount } from "@/app/admin/actions";
import AnalyzeForm from "./analyze-form";

export const dynamic = "force-dynamic";

const input = "w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm text-[#111827] outline-none focus:border-[#1B4B43]";
const fmt = (d: Date) => new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default async function DeveloperDetailPage({ params }: { params: { id: string } }) {
  const dev = await prisma.developerAccount.findUnique({
    where: { id: params.id },
    include: { analyses: { orderBy: { createdAt: "desc" } } },
  });
  if (!dev) notFound();

  const save = updateDeveloperAccount.bind(null, dev.id);
  const del = deleteDeveloperAccount.bind(null, dev.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/feeds" className="text-sm text-[#6B7280] hover:underline">← Developers</Link>
          <h1 className="text-xl font-semibold text-[#111827] mt-1">{dev.name}</h1>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {/* Details */}
        <form action={save} className="bg-white rounded-lg border border-[#E5E7EB] p-6 space-y-4">
          <h2 className="text-sm font-semibold text-[#111827]">Developer details</h2>
          <div>
            <label className="block text-sm mb-1">Name *</label>
            <input name="name" required defaultValue={dev.name} className={input} />
          </div>
          <div>
            <label className="block text-sm mb-1">Website</label>
            <input name="website" defaultValue={dev.website ?? ""} className={input} />
          </div>
          <div>
            <label className="block text-sm mb-1">Contact info</label>
            <input name="contactInfo" defaultValue={dev.contactInfo ?? ""} className={input} />
          </div>
          <div>
            <label className="block text-sm mb-1">Notes</label>
            <textarea name="notes" rows={3} defaultValue={dev.notes ?? ""} className={input} />
          </div>
          <button className="rounded-md bg-[#1B4B43] text-white text-sm font-medium px-5 py-2.5 hover:bg-[#142E2D]">Save</button>
        </form>

        {/* Analyze a feed */}
        <div className="bg-white rounded-lg border border-[#E5E7EB] p-6 space-y-4">
          <h2 className="text-sm font-semibold text-[#111827]">Analyze a feed</h2>
          <p className="text-xs text-[#6B7280]">
            Upload an XML file or provide a feed URL. We parse the structure and build a field-mapping table — nothing is imported.
          </p>
          <AnalyzeForm developerAccountId={dev.id} />
        </div>
      </div>

      {/* Analyses */}
      <div className="bg-white rounded-lg border border-[#E5E7EB] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#E5E7EB]"><h2 className="text-sm font-semibold text-[#111827]">Analyses</h2></div>
        <table className="w-full text-sm">
          <thead className="bg-[#F8F9FA] text-[#6B7280]">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">Date</th>
              <th className="text-left font-medium px-4 py-2.5">Source</th>
              <th className="text-left font-medium px-4 py-2.5">Item node</th>
              <th className="text-left font-medium px-4 py-2.5">Items</th>
              <th className="text-left font-medium px-4 py-2.5">Fields</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E7EB]">
            {dev.analyses.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-[#6B7280]">No analyses yet.</td></tr>
            )}
            {dev.analyses.map((a) => {
              const fieldCount = Array.isArray(a.fields) ? (a.fields as any[]).length : 0;
              return (
                <tr key={a.id} className="hover:bg-[#F8F9FA]">
                  <td className="px-4 py-2.5">
                    <Link href={`/admin/feeds/${dev.id}/analysis/${a.id}`} className="text-[#1B4B43] font-medium hover:underline">
                      {fmt(a.createdAt)}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-[#6B7280]">
                    {a.sourceType === "URL" ? (a.sourceUrl ?? "URL") : (a.sourceFileName ?? "file")}
                  </td>
                  <td className="px-4 py-2.5 text-[#6B7280]"><code className="text-xs">{a.itemNodePath ?? "—"}</code></td>
                  <td className="px-4 py-2.5">{a.itemCount}</td>
                  <td className="px-4 py-2.5">{fieldCount}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Danger zone */}
      <form action={del} className="pt-2">
        <button className="text-sm text-[#C0392B] hover:underline">Delete developer and all analyses</button>
      </form>
    </div>
  );
}
