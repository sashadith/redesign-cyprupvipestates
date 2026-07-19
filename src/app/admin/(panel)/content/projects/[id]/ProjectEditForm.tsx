"use client";
import { useFormState } from "react-dom";
import { saveProjectAll } from "@/app/admin/actions";
import ImagePicker from "@/app/admin/ImagePicker";
import GalleryPicker from "@/app/admin/GalleryPicker";
import PtEditor from "@/app/admin/PtEditor";
import SlugField from "@/app/admin/SlugField";
import SaveButton from "@/app/admin/SaveButton";

const STATUSES = ["DRAFT", "PUBLISHED", "SCHEDULED", "ARCHIVED"];
const input = "w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#1B4B43]";

export default function ProjectEditForm({
  project: p,
}: {
  project: {
    id: string; title: string; slug: string; excerpt: string | null; status: string;
    scheduledAtInput: string; city: string | null; propertyType: string | null;
    price: number | null; listingPriority: number; isFeatured: boolean; isNew: boolean; isSold: boolean;
    previewImage: any; images: any; latitude: number | null; longitude: number | null;
    seoTitle: string; seoDescription: string; description: any; fullDescription: any;
  };
}) {
  const [state, formAction] = useFormState(saveProjectAll.bind(null, p.id), null);

  return (
    <form action={formAction} className="space-y-5">
      <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 space-y-4">
        <div>
          <label className="block text-sm mb-1">Title</label>
          <input name="title" defaultValue={p.title} className={input} />
        </div>
        <SlugField initialValue={p.slug} />
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
            <input type="datetime-local" name="scheduledAt" defaultValue={p.scheduledAtInput} className={input} />
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
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isNew" defaultChecked={p.isNew} /> New</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isSold" defaultChecked={p.isSold} /> Sold</label>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 space-y-4">
        <h2 className="text-sm font-semibold">Media &amp; location</h2>
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
          <input name="seoTitle" defaultValue={p.seoTitle} maxLength={60} className={input} />
        </div>
        <div>
          <label className="block text-sm mb-1">Meta description</label>
          <textarea name="seoDescription" rows={2} defaultValue={p.seoDescription} maxLength={160} className={input} />
        </div>
      </div>

      <div className="space-y-6">
        <PtEditor name="description" label="Description (rich text)" initial={p.description} />
        <PtEditor name="fullDescription" label="Full description (rich text)" initial={p.fullDescription} />
      </div>

      <SaveButton result={state} />
    </form>
  );
}
