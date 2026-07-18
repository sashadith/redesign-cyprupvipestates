"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { snoozeActionItemAction } from "./actionCenterActions";
import type { Severity, Category } from "@/lib/actionCenter";

export type ActionCenterItemVM = {
  id: string; severity: Severity; title: string; description: string; deepLink: string; sinceLabel: string;
};
export type ActionCenterGroupVM = { category: Category; items: ActionCenterItemVM[] };

const DOT_COLOR: Record<Severity, string> = { URGENT: "bg-red-600", ACTION: "bg-amber-500", INFO: "bg-[#9CA3AF]" };
const CATEGORY_LABEL: Record<Category, string> = { DEVELOPERS: "Developers", CRM: "CRM", SEO: "SEO", SEO_ADVISOR: "SEO Advisor", SYSTEM: "System" };
const SNOOZE_OPTIONS: [string, number][] = [["1d", 1], ["7d", 7], ["30d", 30]];

function SnoozeMenu({ itemId }: { itemId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const snooze = (days: number) => {
    setOpen(false);
    startTransition(() => {
      snoozeActionItemAction(itemId, days);
    });
  };
  return (
    <div className="relative">
      <button
        type="button" onClick={() => setOpen((v) => !v)} disabled={pending}
        className="text-xs text-[#9CA3AF] hover:text-[#111827] px-1.5 py-0.5 rounded hover:bg-[#F3F4F6] disabled:opacity-50"
        aria-label="Snooze this item" aria-expanded={open}
      >
        ⋯
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-[#E5E7EB] rounded-md shadow-md text-xs overflow-hidden min-w-[110px]">
            {SNOOZE_OPTIONS.map(([label, days]) => (
              <button
                key={label} type="button" onClick={() => snooze(days)}
                className="block w-full text-left px-3 py-1.5 hover:bg-[#F8F9FA] text-[#374151]"
              >
                Snooze {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function ActionCenterPanel({ groups }: { groups: ActionCenterGroupVM[] }) {
  const totalCount = groups.reduce((n, g) => n + g.items.length, 0);
  return (
    <div className="bg-white rounded-lg border border-[#E5E7EB] mb-8">
      <div className="px-5 py-3 border-b border-[#E5E7EB]">
        <h2 className="text-sm font-semibold">
          Action Center{totalCount > 0 && <span className="ml-2 text-xs font-normal text-[#6B7280]">{totalCount} open</span>}
        </h2>
      </div>
      {totalCount === 0 ? (
        <p className="px-5 py-6 text-sm text-[#6B7280]">All clear — nothing needs your attention.</p>
      ) : (
        <div className="divide-y divide-[#E5E7EB]">
          {groups.map((g) => (
            <div key={g.category}>
              <div className="px-5 py-2 bg-[#FAFAFA] text-xs font-semibold text-[#6B7280] flex items-center justify-between">
                <span>{CATEGORY_LABEL[g.category]}</span>
                <span className="rounded-full bg-[#E5E7EB] text-[#374151] px-2 py-0.5">{g.items.length}</span>
              </div>
              <ul className="divide-y divide-[#F3F4F6]">
                {g.items.map((item) => (
                  <li key={item.id} className="flex items-start gap-3 px-5 py-3">
                    <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${DOT_COLOR[item.severity]}`} aria-hidden />
                    <div className="flex-1 min-w-0">
                      <Link href={item.deepLink} className="text-sm font-medium text-[#111827] hover:text-[#1B4B43] hover:underline">
                        {item.title}
                      </Link>
                      <p className="text-xs text-[#6B7280] mt-0.5">{item.description}</p>
                    </div>
                    <span className="text-xs text-[#9CA3AF] whitespace-nowrap mt-0.5">since {item.sinceLabel}</span>
                    <Link href={item.deepLink} className="text-[#9CA3AF] hover:text-[#1B4B43] mt-0.5" aria-label="Open">→</Link>
                    <SnoozeMenu itemId={item.id} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
