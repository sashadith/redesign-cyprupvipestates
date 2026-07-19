import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import TranslationsPanel from "@/app/admin/TranslationsPanel";
import CaseStudyEditForm from "./CaseStudyEditForm";
import { utcToZonedInput } from "@/lib/tz";
import { localizedHref } from "@/lib/locale";

export const dynamic = "force-dynamic";

export default async function EditCaseStudy({ params }: { params: { id: string } }) {
  const c = await prisma.caseStudy.findUnique({ where: { id: params.id } });
  if (!c) notFound();
  const seo = (c.seo as any) ?? {};
  const co = (c.clientOverview as any) ?? {};

  return (
    <div className="max-w-2xl">
      <Link href="/admin/content/case-studies" className="text-sm text-[#1B4B43] hover:underline">← Back to case studies</Link>
      <h1 className="text-2xl font-semibold mt-2 mb-1">{c.title}</h1>
      <p className="text-sm text-[#6B7280] mb-6">{c.language.toUpperCase()} · /case-studies/{c.slug} <span className="text-[#C29A5E]">(slug editable below)</span></p>
      <TranslationsPanel type="caseStudy" groupId={c.translationGroupId} currentId={c.id} currentLang={c.language} />
      <a href={`/api/preview?path=${encodeURIComponent(localizedHref(c.language, ["case-studies", c.slug]))}`} target="_blank" rel="noopener" className="inline-block mb-5 text-sm text-[#1B4B43] hover:underline">Preview draft ↗</a>

      <CaseStudyEditForm
        cs={{
          id: c.id, title: c.title, slug: c.slug, fullTitle: c.fullTitle, excerpt: c.excerpt,
          category: c.category, status: c.status, scheduledAtInput: utcToZonedInput(c.scheduledAt),
          previewImage: c.previewImage, seoTitle: seo.metaTitle ?? "", seoDescription: seo.metaDescription ?? "",
          co, caseDetails: (c.caseDetails as any) ?? {}, mainContent: (c.mainContent as any[]) ?? [],
        }}
      />
    </div>
  );
}
