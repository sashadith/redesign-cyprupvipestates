import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { updateSitePage, saveSitePageContent } from "../../../../actions";
import RichFieldEditor from "@/app/admin/RichFieldEditor";

export const dynamic = "force-dynamic";
const TYPES = ["blogPage", "caseStudiesPage", "projectsPage", "notFoundPage"];
const EXCLUDE = new Set(["title", "metaTitle", "metaDescription", "slug", "_type", "content", "seo"]);
const input = "w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#1B4B43]";
const labelOf = (k: string) => k.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());

export default async function EditLandingPage({ params }: { params: { id: string } }) {
  const doc = await prisma.siteDocument.findUnique({ where: { id: params.id } });
  if (!doc || !TYPES.includes(doc.type)) notFound();
  const d = (doc.data as any) ?? {};
  const seo = d.seo && typeof d.seo === "object" ? d.seo : { metaTitle: d.metaTitle, metaDescription: d.metaDescription };
  const extras = Object.entries(d).filter(([k, v]) => typeof v === "string" && !EXCLUDE.has(k)) as [string, string][];
  const hasContent = Array.isArray(d.content);
  const save = updateSitePage.bind(null, doc.id);

  return (
    <div className="max-w-2xl">
      <Link href="/admin/content/landing" className="text-sm text-[#1B4B43] hover:underline">← Back to landing pages</Link>
      <h1 className="text-2xl font-semibold mt-2 mb-6">{doc.type} · {doc.language.toUpperCase()}</h1>

      <form action={save} className="space-y-5">
        <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 space-y-4">
          <div>
            <label className="block text-sm mb-1">Title</label>
            <input name="title" defaultValue={d.title ?? ""} className={input} />
          </div>
          {extras.map(([k, v]) => (
            <div key={k}>
              <label className="block text-sm mb-1">{labelOf(k)}</label>
              {v.length > 60
                ? <textarea name={`x_${k}`} rows={3} defaultValue={v} className={input} />
                : <input name={`x_${k}`} defaultValue={v} className={input} />}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 space-y-4">
          <h2 className="text-sm font-semibold">SEO</h2>
          <div>
            <label className="block text-sm mb-1">Meta title</label>
            <input name="seoTitle" defaultValue={seo.metaTitle ?? ""} className={input} />
          </div>
          <div>
            <label className="block text-sm mb-1">Meta description</label>
            <textarea name="seoDescription" rows={2} defaultValue={seo.metaDescription ?? ""} className={input} />
          </div>
        </div>

        <button className="rounded-md bg-[#1B4B43] text-white text-sm font-medium px-5 py-2.5 hover:bg-[#142E2D]">Save page</button>
      </form>

      {hasContent && (
        <div className="mt-5">
          <RichFieldEditor initial={d.content} save={saveSitePageContent.bind(null, doc.id)} label="Page content (rich text)" />
        </div>
      )}
    </div>
  );
}
