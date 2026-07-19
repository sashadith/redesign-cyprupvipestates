"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { snoozeActionItemAction } from "./actionCenterActions";
import { NavIcon } from "./NavIcons";
import type { Severity, Category } from "@/lib/actionCenter";

export type ActionCenterItemVM = {
  id: string; severity: Severity; title: string; description: string; deepLink: string; sinceLabel: string;
};
export type ActionCenterGroupVM = { category: Category; items: ActionCenterItemVM[] };

const DOT_COLOR: Record<Severity, string> = { URGENT: "bg-red-600", ACTION: "bg-amber-500", INFO: "bg-[#9CA3AF]" };
const CATEGORY_LABEL: Record<Category, string> = { DEVELOPERS: "Developers", CRM: "CRM", SEO: "SEO", SEO_ADVISOR: "SEO Advisor", SYSTEM: "System" };
// Echoes the sidebar rail's own module icon per category, for visual continuity.
const CATEGORY_ICON: Record<Category, string> = { DEVELOPERS: "developments", CRM: "crm", SEO: "analytics", SEO_ADVISOR: "analytics", SYSTEM: "settings" };
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

const VISIBLE_CAP = 5;

function CategoryGroup({ group }: { group: ActionCenterGroupVM }) {
  const [expanded, setExpanded] = useState(false);
  const items = expanded ? group.items : group.items.slice(0, VISIBLE_CAP);
  const hidden = group.items.length - items.length;
  return (
    <div>
      <div className="px-5 py-3 flex items-center justify-between" style={{ background: "var(--champagne, #C29A5E)" }}>
        <span className="flex items-center gap-2.5 text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--paper, #F5F1E8)" }}>
          <NavIcon k={CATEGORY_ICON[group.category]} size={17} />
          {CATEGORY_LABEL[group.category]}
        </span>
        <span
          className="rounded-full text-xs font-medium px-2.5 py-1 normal-case tracking-normal"
          style={{ background: "var(--sea-deep-text, #142E2D)", color: "var(--paper, #F5F1E8)" }}
        >
          {group.items.length}
        </span>
      </div>
      <ul className="divide-y divide-[#F3F4F6]">
        {items.map((item) => (
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
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="w-full text-left px-5 py-2 text-xs font-medium text-[#1B4B43] hover:bg-[#F8F9FA] border-t border-[#F3F4F6]"
        >
          Show {hidden} more
        </button>
      )}
      {expanded && group.items.length > VISIBLE_CAP && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="w-full text-left px-5 py-2 text-xs font-medium text-[#6B7280] hover:bg-[#F8F9FA] border-t border-[#F3F4F6]"
        >
          Show less
        </button>
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
            <CategoryGroup key={g.category} group={g} />
          ))}
        </div>
      )}
    </div>
  );
}
