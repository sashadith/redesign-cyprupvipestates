"use client";
import { useFormState, useFormStatus } from "react-dom";

const input = "w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm text-[#111827] outline-none focus:border-[#1B4B43]";

function Submit({ kind }: { kind: string }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="rounded-md bg-[#1B4B43] text-white text-sm font-medium px-5 py-2.5 hover:bg-[#142E2D] disabled:opacity-60">
      {pending ? "Creating…" : `Create ${kind}`}
    </button>
  );
}

export default function NewContentForm({
  action,
  kind,
  titleLabel = "Title",
  hasSlug = true,
  hasExcerpt = true,
}: {
  action: (prev: any, formData: FormData) => Promise<any>;
  kind: string;
  titleLabel?: string;
  hasSlug?: boolean;
  hasExcerpt?: boolean;
}) {
  const [state, formAction] = useFormState<{ error?: string } | null>(action as any, null);
  return (
    <form action={formAction} className="bg-white rounded-lg border border-[#E5E7EB] p-6 space-y-4 max-w-lg">
      {state?.error && <p className="text-sm text-[#C0392B] bg-[#C0392B]/10 rounded px-3 py-2">{state.error}</p>}
      <div className="max-w-[10rem]">
        <label className="block text-sm mb-1">Language</label>
        <select name="language" defaultValue="en" className={input}>
          {["en", "de", "pl", "ru"].map((l) => <option key={l} value={l}>{l.toUpperCase()}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm mb-1">{titleLabel} *</label>
        <input name="title" required className={input} />
      </div>
      {hasSlug && (
        <div>
          <label className="block text-sm mb-1">Slug (leave blank to derive from title)</label>
          <input name="slug" placeholder="my-page-slug" className={input} />
        </div>
      )}
      {hasExcerpt && (
        <div>
          <label className="block text-sm mb-1">Excerpt</label>
          <textarea name="excerpt" rows={2} className={input} />
        </div>
      )}
      <p className="text-xs text-[#9CA3AF]">Created as a draft — you can edit details and body after creation.</p>
      <Submit kind={kind} />
    </form>
  );
}
