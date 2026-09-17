"use client";

import { useState } from "react";
import BlockEditor from "@/app/admin/BlockEditor";

type Lang = "en" | "de" | "pl" | "ru";
const LANGS: [Lang, string, string][] = [
  ["en", "English", "promoBlocksEN"],
  ["de", "Deutsch", "promoBlocksDE"],
  ["pl", "Polski", "promoBlocksPL"],
  ["ru", "Русский", "promoBlocksRU"],
];

// All four language editors stay mounted (just hidden via display:none) so
// switching tabs never discards an in-progress edit the way unmounting and
// remounting would. Each BlockEditor gets its own fieldName so the page's
// one big <form action={saveOverride}> can tell the four apart — see
// fieldName on BlockEditor.
export default function PromoBlocksField({ initial }: { initial: Record<Lang, any[]> }) {
  const [tab, setTab] = useState<Lang>("en");
  return (
    <div className="space-y-2">
      <div className="flex gap-1 border-b border-[#E5E7EB]">
        {LANGS.map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`px-3 py-1.5 text-sm -mb-px border-b-2 ${tab === k ? "border-[#1B4B43] text-[#111827] font-medium" : "border-transparent text-[#6B7280] hover:text-[#111827]"}`}
          >
            {label} {initial[k]?.length ? <span className="text-[#16A34A]">•</span> : null}
          </button>
        ))}
      </div>
      {LANGS.map(([k, , fieldName]) => (
        <div key={k} style={{ display: tab === k ? "block" : "none" }}>
          <BlockEditor kind="development" fieldName={fieldName} initialBlocks={initial[k] ?? []} />
        </div>
      ))}
      <p className="text-[11px] text-[#9CA3AF]">
        Long-form promotional text, rendered between the map and the units list — separate from the short description above. Headings, lists and comparison tables; no accordion/collapse wrapper.
      </p>
    </div>
  );
}
