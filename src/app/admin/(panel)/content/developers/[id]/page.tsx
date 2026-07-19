import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import TranslationsPanel from "@/app/admin/TranslationsPanel";
import DeveloperEditForm from "./DeveloperEditForm";

export const dynamic = "force-dynamic";

export default async function EditDeveloper({ params }: { params: { id: string } }) {
  const d = await prisma.developer.findUnique({ where: { id: params.id } });
  if (!d) notFound();
  const seo = (d.seo as any) ?? {};

  return (
    <div className="max-w-2xl">
      <Link href="/admin/content/developers" className="text-sm text-[#1B4B43] hover:underline">← Back to developers</Link>
      <h1 className="text-2xl font-semibold mt-2 mb-1">{d.title}</h1>
      <p className="text-sm text-[#6B7280] mb-6">{d.language.toUpperCase()} · /developers/{d.slug} <span className="text-[#C29A5E]">(slug editable below)</span></p>
      <TranslationsPanel type="developer" groupId={d.translationGroupId} currentId={d.id} currentLang={d.language} />

      <DeveloperEditForm
        developer={{
          id: d.id, title: d.title, slug: d.slug, titleFull: d.titleFull, excerpt: d.excerpt,
          logo: d.logo, seoTitle: seo.metaTitle ?? "", seoDescription: seo.metaDescription ?? "",
          description: d.description,
        }}
      />
    </div>
  );
}
