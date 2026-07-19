import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import TranslationsPanel from "@/app/admin/TranslationsPanel";
import PageEditForm from "./PageEditForm";
import { localizedHref } from "@/lib/locale";
import { utcToZonedInput } from "@/lib/tz";

export const dynamic = "force-dynamic";

export default async function EditPage({ params }: { params: { id: string } }) {
  const p = await prisma.singlepage.findUnique({ where: { id: params.id } });
  if (!p) notFound();
  const seo = (p.seo as any) ?? {};

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

  return (
    <div className="max-w-2xl">
      <Link href="/admin/content/pages" className="text-sm text-[#1B4B43] hover:underline">← Back to pages</Link>
      <h1 className="text-2xl font-semibold mt-2 mb-1">{p.title}</h1>
      <p className="text-sm text-[#6B7280] mb-6">{p.language.toUpperCase()} · /{p.slug} <span className="text-[#C29A5E]">(slug editable below)</span></p>
      <TranslationsPanel type="singlepage" groupId={p.translationGroupId} currentId={p.id} currentLang={p.language} />
      <a href={`/api/preview?path=${encodeURIComponent(localizedHref(p.language, p.slug))}`} target="_blank" rel="noopener" className="inline-block mb-5 text-sm text-[#1B4B43] hover:underline">Preview draft ↗</a>

      <PageEditForm
        page={{
          id: p.id, title: p.title, slug: p.slug, excerpt: p.excerpt, status: p.status,
          scheduledAtInput: utcToZonedInput(p.scheduledAt),
          seoTitle: seo.metaTitle ?? "", seoDescription: seo.metaDescription ?? "",
          contentBlocks: (p.contentBlocks as any[]) ?? [],
        }}
        relatedOptions={options}
        relatedInitialIds={currentIds}
        relatedEnSuggestion={enSuggestion}
      />
    </div>
  );
}
