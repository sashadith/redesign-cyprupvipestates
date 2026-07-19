"use client";
import { useFormState } from "react-dom";
import { saveBlogAll } from "@/app/admin/actions";
import BlockEditor from "@/app/admin/BlockEditor";
import ImagePicker from "@/app/admin/ImagePicker";
import SlugField from "@/app/admin/SlugField";
import SaveButton from "@/app/admin/SaveButton";

const STATUSES = ["DRAFT", "PUBLISHED", "SCHEDULED", "ARCHIVED"];
const input = "w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#1B4B43]";

export default function BlogEditForm({
  blog: b, authors, categories,
}: {
  blog: {
    id: string; title: string; slug: string; excerpt: string | null; status: string;
    publishedAtInput: string; scheduledAtInput: string; previewImage: any;
    authorId: string | null; categoryId: string | null;
    seoTitle: string; seoDescription: string; contentBlocks: any[];
  };
  authors: { id: string; name: string }[];
  categories: { id: string; title: string }[];
}) {
  const [state, formAction] = useFormState(saveBlogAll.bind(null, b.id), null);

  return (
    <form action={formAction} className="space-y-5">
      <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 space-y-4">
        <div>
          <label className="block text-sm mb-1">Title</label>
          <input name="title" defaultValue={b.title} className={input} />
        </div>
        <SlugField initialValue={b.slug} />
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
            <input type="datetime-local" name="publishedAt" defaultValue={b.publishedAtInput} className={input} />
          </div>
          <div>
            <label className="block text-sm mb-1">Publish at <span className="text-[#9CA3AF]">(German time, when Scheduled)</span></label>
            <input type="datetime-local" name="scheduledAt" defaultValue={b.scheduledAtInput} className={input} />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 space-y-4">
        <h2 className="text-sm font-semibold">Media &amp; taxonomy</h2>
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
          <input name="seoTitle" defaultValue={b.seoTitle} className={input} />
        </div>
        <div>
          <label className="block text-sm mb-1">Meta description</label>
          <textarea name="seoDescription" rows={2} defaultValue={b.seoDescription} className={input} />
        </div>
      </div>

      <BlockEditor kind="blog" initialBlocks={b.contentBlocks} />

      <SaveButton result={state} />
    </form>
  );
}
