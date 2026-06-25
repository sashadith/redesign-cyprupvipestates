import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { saveHomepage } from "../../../actions";
import HomepageEditor from "./HomepageEditor";
import { HOMEPAGE_SCHEMA } from "@/lib/homepageSchema";

export const dynamic = "force-dynamic";

const LANGS = ["en", "de", "pl", "ru"];

export default async function HomepageEditorPage({ searchParams }: { searchParams: { lang?: string } }) {
  const lang = LANGS.includes(searchParams.lang ?? "") ? (searchParams.lang as string) : "en";

  const [doc, projects, caseStudies] = await Promise.all([
    prisma.siteDocument.findUnique({ where: { type_language: { type: "homepage", language: lang as any } } }),
    prisma.project.findMany({ where: { language: lang as any, status: "PUBLISHED", slug: { not: "" } }, select: { sanityId: true, title: true }, orderBy: { title: "asc" } }),
    prisma.caseStudy.findMany({ where: { language: lang as any, status: "PUBLISHED", slug: { not: "" } }, select: { sanityId: true, title: true }, orderBy: { title: "asc" } }),
  ]);

  const options = {
    project: projects.map((p) => ({ id: p.sanityId, title: p.title })),
    caseStudy: caseStudies.map((c) => ({ id: c.sanityId, title: c.title })),
  };

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold mb-1">Homepage</h1>
      <p className="text-sm text-[#6B7280] mb-4">
        Faithful editor mirroring the original Sanity homepage document — identical blocks, field order, images and references. Edited per language; the live frontend reads the same document shape.
      </p>

      <div className="flex gap-2 mb-5">
        {LANGS.map((l) => (
          <Link key={l} href={`/admin/content/featured?lang=${l}`}
            className={`rounded-md px-3 py-1.5 text-sm border ${l === lang ? "bg-[#1B4B43] text-white border-[#1B4B43]" : "border-[#E5E7EB] text-[#1B4B43] hover:bg-[#F8F9FA]"}`}>
            {l.toUpperCase()}
          </Link>
        ))}
      </div>

      {!doc ? (
        <p className="text-sm text-[#C0392B]">No homepage document exists for {lang.toUpperCase()}.</p>
      ) : (
        <HomepageEditor lang={lang} schema={HOMEPAGE_SCHEMA} data={doc.data} action={saveHomepage.bind(null, lang)} options={options} />
      )}
    </div>
  );
}
