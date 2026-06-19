import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { updateCaseStudyMeta } from "../../../../actions";
import ImagePicker from "@/app/admin/ImagePicker";
import BlockEditor from "@/app/admin/BlockEditor";
import TranslationsPanel from "@/app/admin/TranslationsPanel";
import { utcToZonedInput } from "@/lib/tz";

export const dynamic = "force-dynamic";
const STATUSES = ["DRAFT", "PUBLISHED", "SCHEDULED", "ARCHIVED"];
const input = "w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#1B4B43]";

export default async function EditCaseStudy({ params }: { params: { id: string } }) {
  const c = await prisma.caseStudy.findUnique({ where: { id: params.id } });
  if (!c) notFound();
  const seo = (c.seo as any) ?? {};
  const co = (c.clientOverview as any) ?? {};
  const save = updateCaseStudyMeta.bind(null, c.id);

  return (
    <div className="max-w-2xl">
      <Link href="/admin/content/case-studies" className="text-sm text-[#1B4B43] hover:underline">← Back to case studies</Link>
      <h1 className="text-2xl font-semibold mt-2 mb-1">{c.title}</h1>
      <p className="text-sm text-[#6B7280] mb-6">{c.language.toUpperCase()} · /case-studies/{c.slug} <span className="text-[#C29A5E]">(slug locked — protects SEO URLs)</span></p>
      <TranslationsPanel type="caseStudy" groupId={c.translationGroupId} currentId={c.id} />

      <form action={save} className="space-y-5">
        <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 space-y-4">
          <div>
            <label className="block text-sm mb-1">Title</label>
            <input name="title" defaultValue={c.title} className={input} />
          </div>
          <div>
            <label className="block text-sm mb-1">Full title</label>
            <input name="fullTitle" defaultValue={c.fullTitle ?? ""} className={input} />
          </div>
          <div>
            <label className="block text-sm mb-1">Excerpt</label>
            <textarea name="excerpt" rows={2} defaultValue={c.excerpt ?? ""} className={input} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm mb-1">Category</label>
              <input name="category" defaultValue={c.category ?? ""} className={input} />
            </div>
            <div>
              <label className="block text-sm mb-1">Status</label>
              <select name="status" defaultValue={c.status} className={input}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1">Publish at <span className="text-[#9CA3AF]">(DE)</span></label>
              <input type="datetime-local" name="scheduledAt" defaultValue={utcToZonedInput(c.scheduledAt)} className={input} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 space-y-4">
          <h2 className="text-sm font-semibold">Media</h2>
          <ImagePicker name="previewImage" initial={c.previewImage} label="Preview image" />
        </div>

        <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 space-y-4">
          <h2 className="text-sm font-semibold">Client overview</h2>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-sm mb-1">Budget</label><input name="co_budget" defaultValue={co.budget ?? ""} className={input} /></div>
            <div><label className="block text-sm mb-1">Location</label><input name="co_location" defaultValue={co.location ?? ""} className={input} /></div>
            <div><label className="block text-sm mb-1">Property type</label><input name="co_propertyType" defaultValue={co.propertyType ?? ""} className={input} /></div>
            <div><label className="block text-sm mb-1">Purchase timeline</label><input name="co_purchaseTimeline" defaultValue={co.purchaseTimeline ?? ""} className={input} /></div>
          </div>
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

        <button className="rounded-md bg-[#1B4B43] text-white text-sm font-medium px-5 py-2.5 hover:bg-[#142E2D]">Save details</button>
      </form>

      <p className="text-xs text-[#9CA3AF] mt-3 mb-2">
        Note: the “Client situation / Requirements / Solution / Result / Selected property” rich sections are preserved as-is
        (a dedicated editor for those is a follow-up). The main body below is fully editable.
      </p>

      <div className="mt-2">
        <BlockEditor targetId={c.id} kind="caseStudy" initialBlocks={(c.mainContent as any) ?? []} />
      </div>
    </div>
  );
}
