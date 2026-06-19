import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { updateProjectMeta } from "../../../../actions";
import PtEditor from "@/app/admin/PtEditor";
import ImagePicker from "@/app/admin/ImagePicker";
import GalleryPicker from "@/app/admin/GalleryPicker";
import TranslationsPanel from "@/app/admin/TranslationsPanel";
import { utcToZonedInput } from "@/lib/tz";

export const dynamic = "force-dynamic";
const STATUSES = ["DRAFT", "PUBLISHED", "SCHEDULED", "ARCHIVED"];
const input = "w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#1B4B43]";

export default async function EditProject({ params }: { params: { id: string } }) {
  const p = await prisma.project.findUnique({ where: { id: params.id } });
  if (!p) notFound();
  const seo = (p.seo as any) ?? {};
  const save = updateProjectMeta.bind(null, p.id);

  return (
    <div className="max-w-2xl">
      <Link href="/admin/content/projects" className="text-sm text-[#1B4B43] hover:underline">← Back to projects</Link>
      <h1 className="text-2xl font-semibold mt-2 mb-1">{p.title}</h1>
      <p className="text-sm text-[#6B7280] mb-6">{p.language.toUpperCase()} · /{p.slug} <span className="text-[#C29A5E]">(slug locked — protects SEO URLs)</span></p>
      <TranslationsPanel type="project" groupId={p.translationGroupId} currentId={p.id} />

      <form action={save} className="space-y-5">
        <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 space-y-4">
          <div>
            <label className="block text-sm mb-1">Title</label>
            <input name="title" defaultValue={p.title} className={input} />
          </div>
          <div>
            <label className="block text-sm mb-1">Excerpt</label>
            <textarea name="excerpt" rows={2} defaultValue={p.excerpt ?? ""} className={input} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm mb-1">Status</label>
              <select name="status" defaultValue={p.status} className={input}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1">Publish at <span className="text-[#9CA3AF]">(DE, if Scheduled)</span></label>
              <input type="datetime-local" name="scheduledAt" defaultValue={utcToZonedInput(p.scheduledAt)} className={input} />
            </div>
            <div>
              <label className="block text-sm mb-1">City</label>
              <input name="city" defaultValue={p.city ?? ""} className={input} />
            </div>
            <div>
              <label className="block text-sm mb-1">Property type</label>
              <input name="propertyType" defaultValue={p.propertyType ?? ""} className={input} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1">Price (€)</label>
              <input name="price" type="number" defaultValue={p.price ?? ""} className={input} />
            </div>
            <div>
              <label className="block text-sm mb-1">Listing priority (0–100)</label>
              <input name="listingPriority" type="number" defaultValue={p.listingPriority} className={input} />
            </div>
          </div>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isFeatured" defaultChecked={p.isFeatured} /> Featured</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isSold" defaultChecked={p.isSold} /> Sold</label>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 space-y-4">
          <h2 className="text-sm font-semibold">Media & location</h2>
          <ImagePicker name="previewImage" initial={p.previewImage} label="Preview image" />
          <GalleryPicker name="images" initial={p.images} label="Gallery images" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1">Latitude</label>
              <input name="latitude" type="number" step="any" defaultValue={p.latitude ?? ""} className={input} placeholder="34.77" />
            </div>
            <div>
              <label className="block text-sm mb-1">Longitude</label>
              <input name="longitude" type="number" step="any" defaultValue={p.longitude ?? ""} className={input} placeholder="32.42" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 space-y-4">
          <h2 className="text-sm font-semibold">SEO</h2>
          <div>
            <label className="block text-sm mb-1">Meta title</label>
            <input name="seoTitle" defaultValue={seo.metaTitle ?? ""} maxLength={60} className={input} />
          </div>
          <div>
            <label className="block text-sm mb-1">Meta description</label>
            <textarea name="seoDescription" rows={2} defaultValue={seo.metaDescription ?? ""} maxLength={160} className={input} />
          </div>
        </div>

        <button className="rounded-md bg-[#1B4B43] text-white text-sm font-medium px-5 py-2.5 hover:bg-[#142E2D]">Save changes</button>
      </form>

      <div className="mt-6 space-y-6">
        <PtEditor projectId={p.id} field="description" label="Description (rich text)" initial={p.description} />
        <PtEditor projectId={p.id} field="fullDescription" label="Full description (rich text)" initial={p.fullDescription} />
      </div>
      <p className="text-xs text-[#9CA3AF] mt-2">Gallery editing & in-editor image upload coming next.</p>
    </div>
  );
}
