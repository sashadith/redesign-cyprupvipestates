"use client";

import { useState, useTransition } from "react";
import type { FaqCategory, FaqItem } from "@/types/faq";
import { slugify } from "@/lib/slugify";

/* Bespoke repeatable-list editor for the FAQ page's structured content
   (categories -> Q&A items) — the generic Landing Pages editor only handles
   flat strings + one rich-text field, not this nested shape (see the
   architecture note in sanity.utils.ts:getFaqPageByLang). Plain local state,
   submitted as one JSON blob to the saveFaqPage server action on save. */

let kc = 0;
const k = () => `faq-k-${Date.now().toString(36)}-${kc++}`;
const input = "w-full rounded-md border border-[#E5E7EB] px-2 py-1.5 text-sm outline-none focus:border-[#1B4B43]";
const clone = (o: any): any => (typeof structuredClone === "function" ? structuredClone(o) : JSON.parse(JSON.stringify(o)));

const newItem = (): FaqItem => ({ id: k(), question: "", answer: [""] });
const newCategory = (): FaqCategory => ({ slug: "", label: "", description: "", items: [newItem()] });

export default function FaqPageEditor({
  lang,
  initial,
  save,
}: {
  lang: string;
  initial: FaqCategory[];
  save: (categoriesJson: string) => Promise<{ ok: boolean }>;
}) {
  const [categories, setCategories] = useState<FaqCategory[]>(initial.length ? clone(initial) : [newCategory()]);
  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const patchCategory = (i: number, patch: Partial<FaqCategory>) =>
    setCategories((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const removeCategory = (i: number) => setCategories((prev) => prev.filter((_, idx) => idx !== i));
  const addCategory = () => setCategories((prev) => [...prev, newCategory()]);

  const patchItem = (ci: number, ii: number, patch: Partial<FaqItem>) =>
    setCategories((prev) =>
      prev.map((c, idx) => (idx !== ci ? c : { ...c, items: c.items.map((it, j) => (j === ii ? { ...it, ...patch } : it)) })),
    );
  const removeItem = (ci: number, ii: number) =>
    setCategories((prev) => prev.map((c, idx) => (idx !== ci ? c : { ...c, items: c.items.filter((_, j) => j !== ii) })));
  const addItem = (ci: number) =>
    setCategories((prev) => prev.map((c, idx) => (idx !== ci ? c : { ...c, items: [...c.items, newItem()] })));

  const onSave = () => {
    startTransition(async () => {
      await save(JSON.stringify(categories));
      setSavedAt(Date.now());
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{categories.length} categories</h2>
        <div className="flex items-center gap-3">
          {savedAt && <span className="text-xs text-emerald-700">Saved</span>}
          <button
            type="button"
            onClick={onSave}
            disabled={pending}
            className="rounded-md bg-[#1B4B43] text-white text-sm font-medium px-4 py-2 hover:bg-[#142E2D] disabled:opacity-60"
          >
            {pending ? "Saving…" : `Save ${lang.toUpperCase()} FAQ`}
          </button>
        </div>
      </div>

      {categories.map((cat, ci) => (
        <div key={ci} className="bg-white rounded-lg border border-[#E5E7EB] p-4 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs text-[#6B7280] mb-1">Slug</label>
              <div className="flex gap-1.5">
                <input className={input} value={cat.slug} onChange={(e) => patchCategory(ci, { slug: e.target.value })} />
                <button type="button" onClick={() => patchCategory(ci, { slug: slugify(cat.label) })} title="Generate from label"
                  className="shrink-0 rounded-md border border-[#E5E7EB] px-2 text-xs text-[#1B4B43] hover:bg-[#F8F9FA]">
                  Generate
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs text-[#6B7280] mb-1">Label</label>
              <input className={input} value={cat.label} onChange={(e) => patchCategory(ci, { label: e.target.value })} />
            </div>
            <div className="flex items-end">
              <button type="button" onClick={() => removeCategory(ci)} className="text-xs text-red-600 hover:underline">
                Remove category
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs text-[#6B7280] mb-1">Description</label>
            <input className={input} value={cat.description} onChange={(e) => patchCategory(ci, { description: e.target.value })} />
          </div>

          <div className="space-y-2 pl-3 border-l-2 border-[#F3F4F6]">
            {cat.items.map((it, ii) => (
              <div key={it.id} className="space-y-1.5">
                <div className="flex items-start gap-2">
                  <input
                    className={input}
                    placeholder="Question"
                    value={it.question}
                    onChange={(e) => patchItem(ci, ii, { question: e.target.value })}
                  />
                  <button type="button" onClick={() => removeItem(ci, ii)} className="text-xs text-red-600 hover:underline whitespace-nowrap pt-1.5">
                    Remove
                  </button>
                </div>
                <textarea
                  className={input}
                  rows={3}
                  placeholder="Answer (one paragraph per line)"
                  value={it.answer.join("\n")}
                  onChange={(e) => patchItem(ci, ii, { answer: e.target.value.split("\n") })}
                />
              </div>
            ))}
            <button type="button" onClick={() => addItem(ci)} className="text-xs text-[#1B4B43] hover:underline">
              + Add question
            </button>
          </div>
        </div>
      ))}

      <button type="button" onClick={addCategory} className="rounded-md border border-[#E5E7EB] px-4 py-2 text-sm text-[#1B4B43] hover:bg-[#1B4B43]/5">
        + Add category
      </button>
    </div>
  );
}
