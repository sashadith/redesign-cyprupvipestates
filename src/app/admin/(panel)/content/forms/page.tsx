import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function FormsList() {
  const items = await prisma.siteDocument.findMany({ where: { type: "formStandardDocument" }, orderBy: { language: "asc" } });
  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold mb-4">Forms</h1>
      <p className="text-sm text-[#6B7280] mb-4">Labels and messages for the standard lead form, per language.</p>
      <div className="bg-white rounded-lg border border-[#E5E7EB] divide-y divide-[#E5E7EB]">
        {items.map((f) => (
          <Link key={f.id} href={`/admin/content/forms/${f.id}`} className="flex justify-between px-4 py-3 hover:bg-[#F8F9FA]">
            <span className="text-[#1B4B43] font-medium">{f.language.toUpperCase()}</span>
            <span className="text-sm text-[#6B7280]">Edit →</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
