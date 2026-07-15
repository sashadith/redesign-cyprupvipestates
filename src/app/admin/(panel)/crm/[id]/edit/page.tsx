import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { updateLead } from "../../../../actions";
import EditLeadForm from "./edit-lead-form";

export const dynamic = "force-dynamic";

export default async function EditLead({ params }: { params: { id: string } }) {
  const lead = await prisma.lead.findFirst({ where: { id: params.id, deletedAt: null } });
  if (!lead) notFound();
  const action = updateLead.bind(null, lead.id);

  return (
    <div>
      <Link href={`/admin/crm/${lead.id}`} className="text-sm text-[#1B4B43] hover:underline">← Back to lead</Link>
      <h1 className="text-2xl font-semibold mt-2 mb-6">Edit lead · {lead.firstName} {lead.lastName}</h1>
      <EditLeadForm action={action} lead={lead} />
    </div>
  );
}
