"use client";
import { useFormState } from "react-dom";
import { saveCaseStudyAll } from "@/app/admin/actions";
import BlockEditor from "@/app/admin/BlockEditor";
import ImagePicker from "@/app/admin/ImagePicker";
import PtEditor from "@/app/admin/PtEditor";
import SlugField from "@/app/admin/SlugField";
import SaveButton from "@/app/admin/SaveButton";

const STATUSES = ["DRAFT", "PUBLISHED", "SCHEDULED", "ARCHIVED"];
const input = "w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#1B4B43]";

const DETAIL_FIELDS = [
  ["clientSituation", "Client Situation"],
  ["requirements", "Requirements"],
  ["solution", "Solution"],
  ["result", "Result"],
  ["selectedProperty", "Selected Property"],
] as const;

export default function CaseStudyEditForm({
  cs: c,
}: {
  cs: {
    id: string; title: string; slug: string; fullTitle: string | null; excerpt: string | null;
    category: string | null; status: string; scheduledAtInput: string; previewImage: any;
    seoTitle: string; seoDescription: string;
    co: { budget?: string; location?: string; propertyType?: string; purchaseTimeline?: string };
    caseDetails: Record<string, any>;
    mainContent: any[];
  };
}) {
  const [state, formAction] = useFormState(saveCaseStudyAll.bind(null, c.id), null);

  return (
    <form action={formAction} className="space-y-5">
      <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 space-y-4">
        <div>
          <label className="block text-sm mb-1">Title</label>
          <input name="title" defaultValue={c.title} className={input} />
        </div>
        <SlugField initialValue={c.slug} />
        <div>
          <label className="block text-sm mb-1">Full title</label>
          <input name="fullTitle" defaultValue={c.fullTitle ?? ""} className={input} />
        </div>
        <div>
          <label className="block text-sm mb-1">Excerpt</label>
          <textarea name="excerpt" rows={2} defaultValue={c.excerpt ?? ""} className={input} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm mb-1">Category</label>
            <input name="category" defaultValue={c.category ?? ""} className={input} />
          </div>
          <div>
            <label className="block text-sm mb-1">Status</label>
            <select name="status" defaultValue={c.status} className={input}>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">Publish at <span className="text-[#9CA3AF]">(DE)</span></label>
            <input type="datetime-local" name="scheduledAt" defaultValue={c.scheduledAtInput} className={input} />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 space-y-4">
        <h2 className="text-sm font-semibold">Media</h2>
        <ImagePicker name="previewImage" initial={c.previewImage} label="Preview image" />
      </div>

      <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 space-y-4">
        <h2 className="text-sm font-semibold">Client overview</h2>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-sm mb-1">Budget</label><input name="co_budget" defaultValue={c.co.budget ?? ""} className={input} /></div>
          <div><label className="block text-sm mb-1">Location</label><input name="co_location" defaultValue={c.co.location ?? ""} className={input} /></div>
          <div><label className="block text-sm mb-1">Property type</label><input name="co_propertyType" defaultValue={c.co.propertyType ?? ""} className={input} /></div>
          <div><label className="block text-sm mb-1">Purchase timeline</label><input name="co_purchaseTimeline" defaultValue={c.co.purchaseTimeline ?? ""} className={input} /></div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 space-y-4">
        <h2 className="text-sm font-semibold">SEO</h2>
        <div>
          <label className="block text-sm mb-1">Meta title</label>
          <input name="seoTitle" defaultValue={c.seoTitle} className={input} />
        </div>
        <div>
          <label className="block text-sm mb-1">Meta description</label>
          <textarea name="seoDescription" rows={2} defaultValue={c.seoDescription} className={input} />
        </div>
      </div>

      <div className="space-y-5">
        <h2 className="text-sm font-semibold">Case details (rich sections)</h2>
        {DETAIL_FIELDS.map(([fieldKey, fieldLabel]) => (
          <PtEditor key={fieldKey} name={`caseDetail_${fieldKey}`} label={fieldLabel} initial={c.caseDetails?.[fieldKey]} />
        ))}
      </div>

      <div>
        <h2 className="text-sm font-semibold mb-2">Main body</h2>
        <BlockEditor kind="caseStudy" initialBlocks={c.mainContent} />
      </div>

      <SaveButton result={state} />
    </form>
  );
}
