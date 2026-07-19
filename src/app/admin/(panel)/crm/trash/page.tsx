import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import TrashRowActions from "./TrashRowActions";
import EmptyTrashButton from "./EmptyTrashButton";

export const dynamic = "force-dynamic";

export default async function CrmTrash() {
  const session = await auth();
  const isAdmin = (session?.user as any)?.role === "ADMIN";

  const leads = await prisma.lead.findMany({
    where: { deletedAt: { not: null } },
    orderBy: { deletedAt: "desc" },
    select: { id: true, firstName: true, lastName: true, email: true, deletedAt: true, deletedById: true },
  });
  const deleterIds = Array.from(new Set(leads.map((l) => l.deletedById).filter((x): x is string => !!x)));
  const deleters = deleterIds.length ? await prisma.user.findMany({ where: { id: { in: deleterIds } }, select: { id: true, name: true } }) : [];
  const deleterName = (id: string | null) => deleters.find((u) => u.id === id)?.name ?? "—";

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Trash <span className="text-base font-normal text-[#6B7280]">({leads.length})</span></h1>
        <div className="flex items-center gap-3">
          {isAdmin && <EmptyTrashButton count={leads.length} />}
          <Link href="/admin/crm" className="text-sm text-[#1B4B43] hover:underline">← Back to leads</Link>
        </div>
      </div>
      <p className="text-sm text-[#6B7280] mb-4">Deleted leads are kept here for 90 days, then purged automatically.</p>

      <div className="bg-white rounded-lg border border-[#E5E7EB] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#F8F9FA] text-[#6B7280]">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">Name</th>
              <th className="text-left font-medium px-4 py-2.5">Email</th>
              <th className="text-left font-medium px-4 py-2.5">Deleted</th>
              <th className="text-left font-medium px-4 py-2.5">Deleted by</th>
              <th className="text-right font-medium px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E7EB]">
            {leads.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-[#6B7280]">Trash is empty.</td></tr>
            ) : leads.map((l) => (
              <tr key={l.id} className="hover:bg-[#F8F9FA]">
                <td className="px-4 py-2.5 font-medium text-[#111827]">{l.firstName} {l.lastName}</td>
                <td className="px-4 py-2.5 text-[#6B7280]">{l.email}</td>
                <td className="px-4 py-2.5 text-[#6B7280]">{l.deletedAt ? new Date(l.deletedAt).toLocaleDateString("en-GB") : "—"}</td>
                <td className="px-4 py-2.5 text-[#6B7280]">{deleterName(l.deletedById)}</td>
                <td className="px-4 py-2.5"><TrashRowActions id={l.id} canPermanentlyDelete={isAdmin} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
