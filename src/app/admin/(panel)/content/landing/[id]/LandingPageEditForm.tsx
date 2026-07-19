"use client";
import { useFormState } from "react-dom";
import { saveSitePageAll } from "@/app/admin/actions";
import RichFieldEditor from "@/app/admin/RichFieldEditor";
import SaveButton from "@/app/admin/SaveButton";

const input = "w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#1B4B43]";
const labelOf = (k: string) => k.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());

export default function LandingPageEditForm({
  docId, title, extras, seoTitle, seoDescription, content,
}: {
  docId: string;
  title: string;
  extras: [string, string][];
  seoTitle: string;
  seoDescription: string;
  content: any;
}) {
  const [state, formAction] = useFormState(saveSitePageAll.bind(null, docId), null);

  return (
    <form action={formAction} className="space-y-5">
      <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 space-y-4">
        <div>
          <label className="block text-sm mb-1">Title</label>
          <input name="title" defaultValue={title} className={input} />
        </div>
        {extras.map(([k, v]) => (
          <div key={k}>
            <label className="block text-sm mb-1">{labelOf(k)}</label>
            {v.length > 60
              ? <textarea name={`x_${k}`} rows={3} defaultValue={v} className={input} />
              : <input name={`x_${k}`} defaultValue={v} className={input} />}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 space-y-4">
        <h2 className="text-sm font-semibold">SEO</h2>
        <div>
          <label className="block text-sm mb-1">Meta title</label>
          <input name="seoTitle" defaultValue={seoTitle} className={input} />
        </div>
        <div>
          <label className="block text-sm mb-1">Meta description</label>
          <textarea name="seoDescription" rows={2} defaultValue={seoDescription} className={input} />
        </div>
      </div>

      {Array.isArray(content) && (
        <RichFieldEditor name="content" initial={content} label="Page content (rich text)" />
      )}

      <SaveButton result={state} />
    </form>
  );
}
