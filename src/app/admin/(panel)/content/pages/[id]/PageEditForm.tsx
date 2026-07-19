"use client";
import { useFormState } from "react-dom";
import { saveSinglepageAll } from "@/app/admin/actions";
import BlockEditor from "@/app/admin/BlockEditor";
import SlugField from "@/app/admin/SlugField";
import SaveButton from "@/app/admin/SaveButton";
import RelatedPagesEditor from "./RelatedPagesEditor";

const STATUSES = ["DRAFT", "PUBLISHED", "SCHEDULED", "ARCHIVED"];
const input = "w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#1B4B43]";

export default function PageEditForm({
  page: p, relatedOptions, relatedInitialIds, relatedEnSuggestion,
}: {
  page: {
    id: string; title: string; slug: string; excerpt: string | null; status: string;
    scheduledAtInput: string; seoTitle: string; seoDescription: string; contentBlocks: any[];
  };
  relatedOptions: { id: string; title: string }[];
  relatedInitialIds: string[];
  relatedEnSuggestion: { id: string; title: string }[];
}) {
  const [state, formAction] = useFormState(saveSinglepageAll.bind(null, p.id), null);

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
          <textarea name="excerpt" rows={3} defaultValue={p.excerpt ?? ""} className={input} />
        </div>
        <div className="flex flex-wrap gap-4">
          <div className="max-w-[12rem]">
            <label className="block text-sm mb-1">Status</label>
            <select name="status" defaultValue={p.status} className={input}>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">Publish at <span className="text-[#9CA3AF]">(German time, when Scheduled)</span></label>
            <input type="datetime-local" name="scheduledAt" defaultValue={p.scheduledAtInput} className={input} />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 space-y-4">
        <h2 className="text-sm font-semibold">SEO</h2>
        <div>
          <label className="block text-sm mb-1">Meta title</label>
          <input name="seoTitle" defaultValue={p.seoTitle} className={input} />
        </div>
        <div>
          <label className="block text-sm mb-1">Meta description</label>
          <textarea name="seoDescription" rows={2} defaultValue={p.seoDescription} className={input} />
        </div>
      </div>

      <RelatedPagesEditor initialIds={relatedInitialIds} options={relatedOptions} enSuggestion={relatedEnSuggestion} />

      <BlockEditor kind="singlepage" initialBlocks={p.contentBlocks} />

      <SaveButton result={state} />
    </form>
  );
}
