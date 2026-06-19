import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { updateDeveloperMeta, saveDeveloperDescription } from "../../../../actions";
import ImagePicker from "@/app/admin/ImagePicker";
import RichFieldEditor from "@/app/admin/RichFieldEditor";
import TranslationsPanel from "@/app/admin/TranslationsPanel";

export const dynamic = "force-dynamic";
const input = "w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#1B4B43]";

export default async function EditDeveloper({ params }: { params: { id: string } }) {
  const d = await prisma.developer.findUnique({ where: { id: params.id } });
  if (!d) notFound();
  const seo = (d.seo as any) ?? {};
  const save = updateDeveloperMeta.bind(null, d.id);
  const saveDesc = saveDeveloperDescription.bind(null, d.id);

  return (
    <div className="max-w-2xl">
      <Link href="/admin/content/developers" className="text-sm text-[#1B4B43] hover:underline">← Back to developers</Link>
      <h1 className="text-2xl font-semibold mt-2 mb-1">{d.title}</h1>
      <p className="text-sm text-[#6B7280] mb-6">{d.language.toUpperCase()} · /developers/{d.slug} <span className="text-[#C29A5E]">(slug locked — protects SEO URLs)</span></p>
      <TranslationsPanel type="developer" groupId={d.translationGroupId} currentId={d.id} />

      <form action={save} className="space-y-5">
        <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 space-y-4">
          <div>
            <label className="block text-sm mb-1">Title</label>
            <input name="title" defaultValue={d.title} className={input} />
          </div>
          <div>
            <label className="block text-sm mb-1">Full title</label>
            <input name="titleFull" defaultValue={d.titleFull ?? ""} className={input} />
          </div>
          <div>
            <label className="block text-sm mb-1">Excerpt</label>
            <textarea name="excerpt" rows={2} defaultValue={d.excerpt ?? ""} className={input} />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 space-y-4">
          <h2 className="text-sm font-semibold">Logo</h2>
          <ImagePicker name="logo" initial={d.logo} label="Developer logo" />
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

      <div className="mt-5">
        <RichFieldEditor initial={d.description} save={saveDesc} label="Description (rich text)" />
      </div>
    </div>
  );
}
