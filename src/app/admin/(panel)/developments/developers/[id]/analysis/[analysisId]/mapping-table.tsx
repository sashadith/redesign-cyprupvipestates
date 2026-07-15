"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { saveFeedMapping } from "@/app/admin/actions";
import { INTERNAL_CATALOG } from "@/lib/devFeeds/catalog";
import { TypeBadge, RecBadge } from "../../../badges";

type Field = {
  path: string;
  originalName: string;
  inferredType: string;
  exampleValues: string[];
  occurrencePct: number;
  suggestedInternalField: string | null;
  existsInInternal: boolean;
  internalLocation: string | null;
  recommendation: string;
  include: boolean;
  notes: string;
};

const cell = "px-3 py-2 align-top";
const sel = "w-full rounded border border-[#E5E7EB] px-2 py-1 text-xs outline-none focus:border-[#1B4B43] bg-white";
const REC_OPTIONS = ["existing", "new", "optional", "ignore"];

function SaveBtn() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="rounded-md bg-[#1B4B43] text-white text-sm font-medium px-5 py-2.5 hover:bg-[#142E2D] disabled:opacity-60">
      {pending ? "Saving…" : "Save mapping"}
    </button>
  );
}

export default function MappingTable({ analysisId, initialFields }: { analysisId: string; initialFields: Field[] }) {
  const [fields, setFields] = useState<Field[]>(initialFields);
  const [state, formAction] = useFormState<{ ok?: boolean; error?: string } | null>(
    saveFeedMapping.bind(null, analysisId) as any,
    null,
  );

  const update = (i: number, patch: Partial<Field>) =>
    setFields((prev) => prev.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="fields" value={JSON.stringify(fields)} />
      <div className="flex items-center justify-between">
        <div className="text-sm text-[#6B7280]">
          {fields.length} fields · {fields.filter((f) => f.include).length} included
        </div>
        <div className="flex items-center gap-3">
          {state?.ok && <span className="text-sm text-[#1B4B43]">Saved.</span>}
          {state?.error && <span className="text-sm text-[#C0392B]">{state.error}</span>}
          <SaveBtn />
        </div>
      </div>

      <div className="bg-white rounded-lg border border-[#E5E7EB] overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#F8F9FA] text-[#6B7280]">
            <tr>
              <th className="text-left font-medium px-3 py-2.5">Feed field</th>
              <th className="text-left font-medium px-3 py-2.5">Examples</th>
              <th className="text-left font-medium px-3 py-2.5">Type</th>
              <th className="text-left font-medium px-3 py-2.5">Suggested internal field</th>
              <th className="text-left font-medium px-3 py-2.5">In our model?</th>
              <th className="text-left font-medium px-3 py-2.5">Recommendation</th>
              <th className="text-left font-medium px-3 py-2.5">Incl.</th>
              <th className="text-left font-medium px-3 py-2.5">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E7EB]">
            {fields.map((f, i) => (
              <tr key={f.path} className={f.include ? "" : "opacity-50"}>
                <td className={cell}>
                  <div className="font-medium text-[#111827]">{f.originalName}</div>
                  <code className="text-[11px] text-[#9CA3AF]">{f.path}</code>
                  {f.occurrencePct < 100 && <div className="text-[11px] text-[#9CA3AF]">{f.occurrencePct}% of items</div>}
                </td>
                <td className={`${cell} text-[#6B7280] max-w-[220px]`}>
                  <div className="truncate">{f.exampleValues.join(" · ") || "—"}</div>
                </td>
                <td className={cell}><TypeBadge type={f.inferredType} /></td>
                <td className={cell}>
                  <select
                    className={sel}
                    value={f.suggestedInternalField ?? ""}
                    onChange={(e) => {
                      const key = e.target.value || null;
                      const entry = INTERNAL_CATALOG.find((c) => c.key === key);
                      update(i, {
                        suggestedInternalField: key,
                        existsInInternal: !!entry && entry.location.kind !== "none",
                        internalLocation: entry
                          ? entry.location.kind === "column"
                            ? `${entry.location.model}.${entry.location.column} (column)`
                            : entry.location.kind === "json"
                              ? `${entry.location.model}.${entry.location.path} (JSON)`
                              : "not stored yet"
                          : null,
                      });
                    }}
                  >
                    <option value="">(none)</option>
                    {INTERNAL_CATALOG.map((c) => (
                      <option key={c.key} value={c.key}>{c.key}</option>
                    ))}
                  </select>
                </td>
                <td className={`${cell} text-xs`}>
                  {f.existsInInternal ? (
                    <span className="text-[#1B4B43]">✓ {f.internalLocation}</span>
                  ) : (
                    <span className="text-[#9CA3AF]">not stored</span>
                  )}
                </td>
                <td className={cell}>
                  <select className={sel} value={f.recommendation} onChange={(e) => update(i, { recommendation: e.target.value })}>
                    {REC_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <div className="mt-1"><RecBadge rec={f.recommendation} /></div>
                </td>
                <td className={`${cell} text-center`}>
                  <input type="checkbox" checked={f.include} onChange={(e) => update(i, { include: e.target.checked })} />
                </td>
                <td className={cell}>
                  <input className={sel} value={f.notes} onChange={(e) => update(i, { notes: e.target.value })} placeholder="…" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </form>
  );
}
