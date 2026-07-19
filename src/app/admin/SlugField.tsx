"use client";
import { useRef, useState } from "react";
import { slugify } from "@/lib/slugify";

const input = "w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#1B4B43]";

// Slug input + "Generate" button, for use inside any plain `<form action={...}>`.
// Reads the sibling title input's LIVE value (via the native form element
// association) only when the button is clicked — it never re-derives the slug
// on its own, so a manually-edited slug is never silently overwritten.
export default function SlugField({
  name = "slug",
  titleFieldName = "title",
  initialValue,
  label = "Slug",
  helpText = "(URL path — changing it changes the live URL)",
  fallbackTitle,
}: {
  name?: string;
  titleFieldName?: string;
  initialValue: string;
  label?: string;
  helpText?: React.ReactNode;
  fallbackTitle?: string;
}) {
  const [value, setValue] = useState(initialValue ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  const generate = () => {
    const form = inputRef.current?.form;
    const titleEl = form?.elements.namedItem(titleFieldName) as HTMLInputElement | HTMLTextAreaElement | null;
    const titleVal = titleEl?.value?.trim() || fallbackTitle?.trim() || "";
    if (!titleVal) return;
    setValue(slugify(titleVal));
  };

  return (
    <div>
      <label className="block text-sm mb-1">{label} {helpText && <span className="text-[#9CA3AF]">{helpText}</span>}</label>
      <div className="flex gap-2">
        <input ref={inputRef} name={name} value={value} onChange={(e) => setValue(e.target.value)} className={input} />
        <button type="button" onClick={generate} title="Generate from title"
          className="shrink-0 rounded-md border border-[#E5E7EB] px-3 text-sm text-[#1B4B43] hover:bg-[#F8F9FA]">
          Generate
        </button>
      </div>
    </div>
  );
}
