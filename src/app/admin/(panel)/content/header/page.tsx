import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createSiteDocTranslation } from "../../../actions";
import { LOCALES } from "@/lib/locale";

export const dynamic = "force-dynamic";

export default async function HeaderList() {
  const items = await prisma.siteDocument.findMany({ where: { type: "header" }, orderBy: { language: "asc" } });
  const existingLangs = new Set(items.map((h) => h.language));
  const missing = LOCALES.filter((l) => l !== "en" && !existingLangs.has(l));
  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold mb-4">Header</h1>
      <p className="text-sm text-[#6B7280] mb-4">Logos and navigation links, per language.</p>
      <div className="bg-white rounded-lg border border-[#E5E7EB] divide-y divide-[#E5E7EB]">
        {items.map((h) => (
          <Link key={h.id} href={`/admin/content/header/${h.id}`} className="flex justify-between px-4 py-3 hover:bg-[#F8F9FA]">
            <span className="text-[#1B4B43] font-medium">{h.language.toUpperCase()}</span>
            <span className="text-sm text-[#6B7280]">Edit →</span>
          </Link>
        ))}
      </div>
      {existingLangs.has("en") && missing.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {missing.map((l) => (
            <form key={l} action={createSiteDocTranslation.bind(null, "header", l)}>
              <button type="submit" className="rounded-md border border-dashed border-[#C29A5E] px-3 py-1.5 text-sm text-[#C29A5E] hover:bg-[#C29A5E]/10">
                + {l.toUpperCase()} from English
              </button>
            </form>
          ))}
        </div>
      )}
    </div>
  );
}
