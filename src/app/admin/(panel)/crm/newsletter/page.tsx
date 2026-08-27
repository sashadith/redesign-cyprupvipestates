import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ONLY_NEWSLETTER } from "@/lib/crm/leadBucket";
import { adminDate } from "@/lib/adminTime";
import MoveLeadMenu from "../MoveLeadMenu";

export const dynamic = "force-dynamic";

// Deliberately NOT the leads table. No colour dot, no status popover, no hot
// flame: those are sales instruments, and a subscriber is not a sales process.
// The only action offered here is moving one out — a subscriber who turns into
// a real enquiry belongs in Leads, where all of that applies again.
export default async function CrmNewsletter() {
  const leads = await prisma.lead.findMany({
    where: { deletedAt: null, ...ONLY_NEWSLETTER },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, email: true, source: true, createdAt: true,
      languagePreference: true, sourceLocale: true,
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">
          Newsletter <span className="text-base font-normal text-[#6B7280]">({leads.length})</span>
        </h1>
        <Link href="/admin/crm" className="text-sm text-[#1B4B43] hover:underline">← Back to leads</Link>
      </div>
      <p className="text-sm text-[#6B7280] mb-4">
        Newsletter subscribers, kept out of the leads list, the pipeline and the Action Center.
        Move one to Leads when they turn into a real enquiry.
      </p>

      <div className="bg-white rounded-lg border border-[#E5E7EB] overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#F8F9FA] text-[#6B7280]">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">Email</th>
              <th className="text-left font-medium px-4 py-2.5">Subscribed</th>
              <th className="text-left font-medium px-4 py-2.5">Language</th>
              <th className="text-right font-medium px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E7EB]">
            {leads.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-[#6B7280]">No subscribers yet.</td></tr>
            ) : leads.map((l) => (
              <tr key={l.id} className="hover:bg-[#F8F9FA]">
                <td className="px-4 py-2.5 font-medium text-[#111827]">
                  {/* Linked to the full lead page: the row here is intentionally
                      thin, and everything else about the person lives there. */}
                  <Link href={`/admin/crm/${l.id}`} className="hover:underline">{l.email ?? "—"}</Link>
                </td>
                <td className="px-4 py-2.5 text-[#6B7280]">{adminDate(l.createdAt)}</td>
                <td className="px-4 py-2.5 text-[#6B7280]">
                  {(l.languagePreference ?? l.sourceLocale ?? "—").toUpperCase()}
                </td>
                <td className="px-4 py-2.5 text-right"><MoveLeadMenu id={l.id} source={l.source} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
