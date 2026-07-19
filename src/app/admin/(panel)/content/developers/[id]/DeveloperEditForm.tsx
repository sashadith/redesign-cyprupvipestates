"use client";
import { useFormState } from "react-dom";
import { saveDeveloperAll } from "@/app/admin/actions";
import ImagePicker from "@/app/admin/ImagePicker";
import RichFieldEditor from "@/app/admin/RichFieldEditor";
import SlugField from "@/app/admin/SlugField";
import SaveButton from "@/app/admin/SaveButton";

const input = "w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#1B4B43]";

export default function DeveloperEditForm({
  developer: d,
}: {
  developer: {
    id: string; title: string; slug: string; titleFull: string | null; excerpt: string | null;
    logo: any; seoTitle: string; seoDescription: string; description: any;
  };
}) {
  const [state, formAction] = useFormState(saveDeveloperAll.bind(null, d.id), null);

  return (
    <form action={formAction} className="space-y-5">
      <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 space-y-4">
        <div>
          <label className="block text-sm mb-1">Title</label>
          <input name="title" defaultValue={d.title} className={input} />
        </div>
        <SlugField initialValue={d.slug} />
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
          <input name="seoTitle" defaultValue={d.seoTitle} className={input} />
        </div>
        <div>
          <label className="block text-sm mb-1">Meta description</label>
          <textarea name="seoDescription" rows={2} defaultValue={d.seoDescription} className={input} />
        </div>
      </div>

      <RichFieldEditor name="description" initial={d.description} label="Description (rich text)" />

      <SaveButton result={state} />
    </form>
  );
}
