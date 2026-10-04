"use client";

import { useState } from "react";
import {
  BUDGET_VALUES,
  PROPERTY_VALUES,
  LEAD_TIMELINE_OPTIONS,
  budgetValueFor,
  leadBudgetLabel,
  leadTimelineLabel,
  leadFinancingLabel,
  qualifierCopy,
} from "@/app/components/qualifierFields";
import { ActionIcon } from "../ActionIcons";

/* Budget, timeline, financing and property interest change DURING a call. They
 * were read-only here, so correcting one dropdown meant leaving the lead,
 * filling a whole form page and coming back — which is why they went stale.
 *
 * Reading is still the default state, but as chips rather than a label/value
 * grid: five short facts laid out as three columns of two-line pairs read as an
 * empty form, and the eye has to walk each label to find the value. As chips
 * they are one line, scannable, and the block stops competing with the free
 * text below it.
 */

const FINANCING_OPTIONS = [
  { v: "CASH", l: "Cash purchase" },
  { v: "MORTGAGE", l: "Mortgage" },
  { v: "UNDECIDED", l: "Undecided" },
];

const selectCls =
  "w-full rounded-md border border-[#E5E7EB] bg-white px-2 py-1.5 text-sm text-[#111827] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1B4B43]";
const btn =
  "inline-flex items-center gap-1.5 rounded-md border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-xs font-medium text-[#1B4B43] transition-colors " +
  "hover:bg-[#F3F6F5] hover:border-[#1B4B43] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1B4B43] focus-visible:ring-offset-1";

/* One chip. The field name lives in the tooltip, not on screen: "€1M – €2M"
   next to a wallet does not need the word "Budget" above it, and five such
   labels are exactly what made the block noisy. */
const Chip = ({ icon, children, title }: { icon: string; children: React.ReactNode; title: string }) => (
  <span
    title={title}
    className="inline-flex items-center gap-1.5 rounded-full bg-[#F3F4F6] px-2.5 py-1 text-xs font-medium text-[#374151]"
  >
    <span className="text-[#9CA3AF]"><ActionIcon k={icon} size={13} /></span>
    {children}
  </span>
);

const MISSING = <span className="text-[#9CA3AF]">not set</span>;

export default function QualificationEditor({
  leadId, budgetMin, budgetMax, timeline, financing, propertyTypeInterest, saveAction,
}: {
  leadId: string;
  budgetMin: number | null;
  budgetMax: number | null;
  timeline: string | null;
  financing: string | null;
  propertyTypeInterest: string[];
  saveAction: (formData: FormData) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const budgets = qualifierCopy("en").budgets;
  const props = qualifierCopy("en").properties;
  const currentBudget = budgetValueFor(budgetMin, budgetMax);
  /* "Enter amounts" is its own mode rather than a separate always-visible pair
     of fields: most edits pick a bracket, and two number boxes on show for
     everyone would be the clutter this block is being rescued from. A lead that
     already carries a hand-entered range opens straight into it. */
  const [manual, setManual] = useState(currentBudget === "custom");

  if (!editing) {
    return (
      <div className="sm:col-span-2 lg:col-span-3 py-1">
        <div className="flex flex-wrap items-center gap-2">
          <Chip icon="budget" title="Budget">{leadBudgetLabel(budgetMin, budgetMax) ?? MISSING}</Chip>
          <Chip icon="clock" title="Timeline">{leadTimelineLabel(timeline) ?? MISSING}</Chip>
          <Chip icon="card" title="Financing">{leadFinancingLabel(financing) ?? MISSING}</Chip>
          {propertyTypeInterest.length ? (
            propertyTypeInterest.map((t) => (
              <Chip key={t} icon="home" title="Property interest">{t}</Chip>
            ))
          ) : (
            <Chip icon="home" title="Property interest">{MISSING}</Chip>
          )}
          <button type="button" onClick={() => setEditing(true)} className={`${btn} ml-auto`}>
            Edit
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      action={async (fd) => {
        await saveAction(fd);
        setEditing(false);
      }}
      className="sm:col-span-2 lg:col-span-3 py-1 rounded-md bg-[#F8F9FA] p-3"
    >
      <input type="hidden" name="id" value={leadId} />
      <div className="grid sm:grid-cols-3 gap-3">
        <label className="block">
          <span className="text-xs font-medium text-[#6B7280]">Budget</span>
          <select
            name="budget"
            defaultValue={manual ? "manual" : currentBudget}
            onChange={(e) => setManual(e.target.value === "manual")}
            className={`${selectCls} mt-0.5`}
          >
            <option value="">not set</option>
            {BUDGET_VALUES.map((v) => (
              <option key={v} value={v}>{budgets[v]}</option>
            ))}
            <option value="manual">Enter amounts…</option>
          </select>
          {manual && (
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number" name="budgetMin" min={0} step={10000}
                defaultValue={budgetMin ?? ""} placeholder="from €"
                className={selectCls}
              />
              <span className="text-xs text-[#9CA3AF]">–</span>
              <input
                type="number" name="budgetMax" min={0} step={10000}
                defaultValue={budgetMax ?? ""} placeholder="to €"
                className={selectCls}
              />
            </div>
          )}
        </label>

        <label className="block">
          <span className="text-xs font-medium text-[#6B7280]">Timeline</span>
          <select name="timeline" defaultValue={timeline ?? ""} className={`${selectCls} mt-0.5`}>
            <option value="">not set</option>
            {LEAD_TIMELINE_OPTIONS.map((o) => (
              <option key={o.v} value={o.v}>{o.l}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-medium text-[#6B7280]">Financing</span>
          <select name="financing" defaultValue={financing ?? ""} className={`${selectCls} mt-0.5`}>
            <option value="">not set</option>
            {FINANCING_OPTIONS.map((o) => (
              <option key={o.v} value={o.v}>{o.l}</option>
            ))}
          </select>
        </label>
      </div>

      <fieldset className="mt-3">
        <legend className="text-xs font-medium text-[#6B7280]">Property interest</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {PROPERTY_VALUES.map((v) => (
            <label
              key={v}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E7EB] bg-white px-2.5 py-1 text-xs cursor-pointer transition-colors hover:border-[#1B4B43] has-[:checked]:border-[#1B4B43] has-[:checked]:bg-[#1B4B43]/10"
            >
              <input
                type="checkbox"
                name="propertyTypeInterest"
                value={v}
                defaultChecked={propertyTypeInterest.includes(v)}
                className="accent-[#1B4B43]"
              />
              {props[v]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-3 flex gap-2">
        <button type="submit" className="inline-flex items-center gap-1.5 rounded-md bg-[#1B4B43] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#142E2D]">
          <ActionIcon k="save" />
          Save
        </button>
        <button type="button" onClick={() => setEditing(false)} className={btn}>
          Cancel
        </button>
      </div>
    </form>
  );
}
