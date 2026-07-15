import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { updateBlogMeta } from "../../../../actions";
import BlockEditor from "@/app/admin/BlockEditor";
import ImagePicker from "@/app/admin/ImagePicker";
import TranslationsPanel from "@/app/admin/TranslationsPanel";
import { utcToZonedInput } from "@/lib/tz";
import { localizedHref } from "@/lib/locale";

export const dynamic = "force-dynamic";
const STATUSES = ["DRAFT", "PUBLISHED", "SCHEDULED", "ARCHIVED"];
const input = "w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#1B4B43]";

export default async function EditBlog({ params }: { params: { id: string } }) {
  const b = await prisma.blog.findUnique({ where: { id: params.id } });
  if (!b) notFound();
  const seo = (b.seo as any) ?? {};
  const [authors, categories] = await Promise.all([
    prisma.author.findMany({ where: { language: b.language }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.category.findMany({ where: { language: b.language }, select: { id: true, title: true }, orderBy: { title: "asc" } }),
  ]);
  const save = updateBlogMeta.bind(null, b.id);

  return (
    <div className="max-w-2xl">
      <Link href="/admin/content/blog" className="text-sm text-[#1B4B43] hover:underline">← Back to blog</Link>
      <h1 className="text-2xl font-semibold mt-2 mb-1">{b.title}</h1>
      <p className="text-sm text-[#6B7280] mb-6">{b.language.toUpperCase()} · /blog/{b.slug} <span className="text-[#C29A5E]">(slug editable below)</span></p>
      <TranslationsPanel type="blog" groupId={b.translationGroupId} currentId={b.id} currentLang={b.language} />
      <a href={`/api/preview?path=${encodeURIComponent(localizedHref(b.language, ["blog", b.slug]))}`} target="_blank" rel="noopener" className="inline-block mb-5 text-sm text-[#1B4B43] hover:underline">Preview draft ↗</a>

      <form action={save} className="space-y-5">
        <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 space-y-4">
          <div>
            <label className="block text-sm mb-1">Title</label>
            <input name="title" defaultValue={b.title} className={input} />
          </div>
          <div>
            <label className="block text-sm mb-1">Slug <span className="text-[#9CA3AF]">(URL path — changing it changes the live URL)</span></label>
            <input name="slug" defaultValue={b.slug} className={input} />
          </div>
          <div>
            <label className="block text-sm mb-1">Excerpt</label>
            <textarea name="excerpt" rows={3} defaultValue={b.excerpt ?? ""} className={input} />
          </div>
          <div className="flex flex-wrap gap-4">
            <div className="max-w-[12rem]">
              <label className="block text-sm mb-1">Status</label>
              <select name="status" defaultValue={b.status} className={input}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1">Publication date <span className="text-[#9CA3AF]">(German time)</span></label>
              <input type="datetime-local" name="publishedAt" defaultValue={utcToZonedInput(b.publishedAt)} className={input} />
            </div>
            <div>
              <label className="block text-sm mb-1">Publish at <span className="text-[#9CA3AF]">(German time, when Scheduled)</span></label>
              <input type="datetime-local" name="scheduledAt" defaultValue={utcToZonedInput(b.scheduledAt)} className={input} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 space-y-4">
          <h2 className="text-sm font-semibold">Media & taxonomy</h2>
          <ImagePicker name="previewImage" initial={b.previewImage} label="Preview image" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1">Author</label>
              <select name="authorId" defaultValue={b.authorId ?? ""} className={input}>
                <option value="">— none —</option>
                {authors.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1">Category</label>
              <select name="categoryId" defaultValue={b.categoryId ?? ""} className={input}>
                <option value="">— none —</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
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
        <BlockEditor targetId={b.id} kind="blog" initialBlocks={(b.contentBlocks as any[]) ?? []} />
      </div>
    </div>
  );
}
