import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { updateSinglepageMeta, saveRelatedLandingPages } from "../../../../actions";
import BlockEditor from "@/app/admin/BlockEditor";
import RelatedPagesEditor from "./RelatedPagesEditor";
import TranslationsPanel from "@/app/admin/TranslationsPanel";
import SlugField from "@/app/admin/SlugField";
import { utcToZonedInput } from "@/lib/tz";
import { localizedHref } from "@/lib/locale";

export const dynamic = "force-dynamic";
const STATUSES = ["DRAFT", "PUBLISHED", "SCHEDULED", "ARCHIVED"];
const input = "w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#1B4B43]";

export default async function EditPage({ params }: { params: { id: string } }) {
  const p = await prisma.singlepage.findUnique({ where: { id: params.id } });
  if (!p) notFound();
  const seo = (p.seo as any) ?? {};
  const save = updateSinglepageMeta.bind(null, p.id);

  // Related Landing Pages picker data — options are ONLY same-language published pages (excl self).
  const options = (await prisma.singlepage.findMany({
    where: { language: p.language, status: "PUBLISHED", slug: { not: "" }, sanityId: { not: p.sanityId } },
    select: { sanityId: true, title: true }, orderBy: { title: "asc" },
  })).map((o) => ({ id: o.sanityId, title: o.title }));
  const currentIds = Array.isArray(p.relatedLandingPages)
    ? (p.relatedLandingPages as any[]).map((r) => r?._ref).filter(Boolean)
    : [];

  // "Copy relations from EN": map the EN sibling's related pages to THIS language's equivalents
  // (via translationGroupId). Offered as a reviewable starting point only — never auto-applied.
  let enSuggestion: { id: string; title: string }[] = [];
  if (p.language !== "en" && p.translationGroupId) {
    const en = await prisma.singlepage.findFirst({ where: { translationGroupId: p.translationGroupId, language: "en" }, select: { relatedLandingPages: true } });
    const enRefs = Array.isArray(en?.relatedLandingPages) ? (en!.relatedLandingPages as any[]).map((r) => r?._ref).filter(Boolean) : [];
    if (enRefs.length) {
      const enPages = await prisma.singlepage.findMany({ where: { sanityId: { in: enRefs } }, select: { sanityId: true, translationGroupId: true } });
      const tgidByEn = new Map(enPages.map((e) => [e.sanityId, e.translationGroupId]));
      const tgids = enPages.map((e) => e.translationGroupId).filter(Boolean) as string[];
      const sib = await prisma.singlepage.findMany({ where: { translationGroupId: { in: tgids }, language: p.language, status: "PUBLISHED", slug: { not: "" } }, select: { sanityId: true, title: true, translationGroupId: true } });
      const byTgid = new Map(sib.map((s) => [s.translationGroupId, s]));
      enSuggestion = enRefs
        .map((id) => { const tg = tgidByEn.get(id); const cur = tg ? byTgid.get(tg) : null; return cur && cur.sanityId !== p.sanityId ? { id: cur.sanityId, title: cur.title } : null; })
        .filter((x): x is { id: string; title: string } => Boolean(x));
    }
  }
  const saveRelated = saveRelatedLandingPages.bind(null, p.id);

  return (
    <div className="max-w-2xl">
      <Link href="/admin/content/pages" className="text-sm text-[#1B4B43] hover:underline">← Back to pages</Link>
      <h1 className="text-2xl font-semibold mt-2 mb-1">{p.title}</h1>
      <p className="text-sm text-[#6B7280] mb-6">{p.language.toUpperCase()} · /{p.slug} <span className="text-[#C29A5E]">(slug editable below)</span></p>
      <TranslationsPanel type="singlepage" groupId={p.translationGroupId} currentId={p.id} currentLang={p.language} />
      <a href={`/api/preview?path=${encodeURIComponent(localizedHref(p.language, p.slug))}`} target="_blank" rel="noopener" className="inline-block mb-5 text-sm text-[#1B4B43] hover:underline">Preview draft ↗</a>

      <form action={save} className="space-y-5">
        <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 space-y-4">
          <div>
            <label className="block text-sm mb-1">Title</label>
            <input name="title" defaultValue={p.title} className={input} />
          </div>
          <SlugField initialValue={p.slug} />
          <div>
            <label className="block text-sm mb-1">Excerpt</label>
            <textarea name="excerpt" rows={3} defaultValue={p.excerpt ?? ""} className={input} />
          </div>
          <div className="flex flex-wrap gap-4">
            <div className="max-w-[12rem]">
              <label className="block text-sm mb-1">Status</label>
              <select name="status" defaultValue={p.status} className={input}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1">Publish at <span className="text-[#9CA3AF]">(German time, when Scheduled)</span></label>
              <input type="datetime-local" name="scheduledAt" defaultValue={utcToZonedInput(p.scheduledAt)} className={input} />
            </div>
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

        <button className="rounded-md bg-[#1B4B43] text-white text-sm font-medium px-5 py-2.5 hover:bg-[#142E2D]">Save changes</button>
      </form>

      <div className="mt-6">
        <RelatedPagesEditor initialIds={currentIds} options={options} enSuggestion={enSuggestion} action={saveRelated} />
      </div>

      <div className="mt-6">
        <BlockEditor targetId={p.id} kind="singlepage" initialBlocks={(p.contentBlocks as any[]) ?? []} />
      </div>
    </div>
  );
}
