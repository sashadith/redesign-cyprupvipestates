import Link from "next/link";
import { prisma } from "@/lib/prisma";
import CreateLeadForm from "../create-lead-form";

export const dynamic = "force-dynamic";

export default async function NewLeadPage() {
  const users = await prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  return (
    <div>
      <Link href="/admin/crm" className="text-sm text-[#1B4B43] hover:underline">← Back to leads</Link>
      <h1 className="text-2xl font-semibold mt-2 mb-6">New lead</h1>
      <CreateLeadForm users={users} />
    </div>
  );
}
