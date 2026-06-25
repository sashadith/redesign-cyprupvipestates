import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const TYPES = ["blogPage", "caseStudiesPage", "projectsPage", "notFoundPage"];
const LABELS: Record<string, string> = {
  blogPage: "Blog page",
  caseStudiesPage: "Case studies page",
  projectsPage: "Projects page",
  notFoundPage: "404 page",
};

export default async function LandingPagesList() {
  const docs = await prisma.siteDocument.findMany({ where: { type: { in: TYPES } }, orderBy: [{ language: "asc" }] });
  const byType = TYPES.map((t) => ({ type: t, docs: docs.filter((d) => d.type === t) }));

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold mb-2">Landing pages</h1>
      <p className="text-sm text-[#6B7280] mb-5">Titles, SEO, and intro content for the section/listing pages.</p>
      <div className="space-y-4">
        {byType.map(({ type, docs }) => (
          <div key={type} className="bg-white rounded-lg border border-[#E5E7EB] p-4">
            <h2 className="text-sm font-semibold mb-2">{LABELS[type] ?? type}</h2>
            <div className="flex flex-wrap gap-2">
              {docs.length === 0 ? <span className="text-xs text-[#9CA3AF]">none</span> : docs.map((d) => (
                <Link key={d.id} href={`/admin/content/landing/${d.id}`}
                  className="rounded-md border border-[#E5E7EB] px-3 py-1.5 text-sm text-[#1B4B43] hover:bg-[#1B4B43]/5">
                  {d.language.toUpperCase()}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
