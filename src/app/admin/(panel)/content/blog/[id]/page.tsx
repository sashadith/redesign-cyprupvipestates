import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import TranslationsPanel from "@/app/admin/TranslationsPanel";
import BlogEditForm from "./BlogEditForm";
import { utcToZonedInput } from "@/lib/tz";
import { localizedHref } from "@/lib/locale";

export const dynamic = "force-dynamic";

export default async function EditBlog({ params }: { params: { id: string } }) {
  const b = await prisma.blog.findUnique({ where: { id: params.id } });
  if (!b) notFound();
  const seo = (b.seo as any) ?? {};
  const [authors, categories] = await Promise.all([
    prisma.author.findMany({ where: { language: b.language }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.category.findMany({ where: { language: b.language }, select: { id: true, title: true }, orderBy: { title: "asc" } }),
  ]);

  return (
    <div className="max-w-2xl">
      <Link href="/admin/content/blog" className="text-sm text-[#1B4B43] hover:underline">← Back to blog</Link>
      <h1 className="text-2xl font-semibold mt-2 mb-1">{b.title}</h1>
      <p className="text-sm text-[#6B7280] mb-6">{b.language.toUpperCase()} · /blog/{b.slug} <span className="text-[#C29A5E]">(slug editable below)</span></p>
      <TranslationsPanel type="blog" groupId={b.translationGroupId} currentId={b.id} currentLang={b.language} />
      <a href={`/api/preview?path=${encodeURIComponent(localizedHref(b.language, ["blog", b.slug]))}`} target="_blank" rel="noopener" className="inline-block mb-5 text-sm text-[#1B4B43] hover:underline">Preview draft ↗</a>

      <BlogEditForm
        blog={{
          id: b.id, title: b.title, slug: b.slug, excerpt: b.excerpt, status: b.status,
          publishedAtInput: utcToZonedInput(b.publishedAt), scheduledAtInput: utcToZonedInput(b.scheduledAt),
          previewImage: b.previewImage, authorId: b.authorId, categoryId: b.categoryId,
          seoTitle: seo.metaTitle ?? "", seoDescription: seo.metaDescription ?? "",
          contentBlocks: (b.contentBlocks as any[]) ?? [],
        }}
        authors={authors}
        categories={categories}
      />
    </div>
  );
}
