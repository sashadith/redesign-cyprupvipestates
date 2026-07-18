"use client";

import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { matchLeadAction, type LocationOptions } from "../../../presentationActions";
import type { DevelopmentMatch, MatchFilters } from "@/lib/crm/matching";
import { normalizeRef } from "@/lib/unitRef";

const LOCALES = ["en", "de", "pl", "ru"] as const;
type Locale = (typeof LOCALES)[number];
const PROPERTY_TYPES = ["Apartment", "Villa", "Townhouse", "Penthouse"];
const BED_OPTIONS = [0, 1, 2, 3, 4, 5]; // 5 = "5+"

const fmtPrice = (n: number | null) => (n == null ? "—" : `€${n.toLocaleString("en-US")}`);
const scoreColor = (s: number) => (s >= 80 ? "#166534" : s >= 60 ? "#92400E" : "#6B7280");
const scoreBg = (s: number) => (s >= 80 ? "#DCFCE7" : s >= 60 ? "#FEF3C7" : "#F3F4F6");

const field = "rounded-md border border-[#E5E7EB] px-2.5 py-1.5 text-sm focus:border-[#1B4B43] focus:outline-none";
const label = "block text-xs font-medium text-[#6B7280] mb-1";
const chip = (on: boolean) =>
  `rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${on ? "border-[#1B4B43] bg-[#1B4B43] text-white" : "border-[#E5E7EB] text-[#6B7280] hover:bg-[#F8F9FA]"}`;

export type EditorUnit = {
  id: string; ref: string | null; label: string | null; type: string | null; beds: string | null;
  areaBuilt: string | null; price: number | null; currency: string; status: string;
};

export type EditorItem = {
  developmentId: string;
  publicName: string; // real development name — always shown, muted
  mainImage: string | null;
  district: string | null;
  area: string | null;
  town: string | null;
  priceFrom: number | null;
  currency: string;
  aliasName: string; // editable, "" = no alias
  advisorComment: string;
  sortIndex: number;
  isNew: boolean;
  units: EditorUnit[];
  checkedUnitIds: string[];
};

// Same "whole project vs specific units" split used at generation time
// (PropertyMatching.tsx's splitUnitSelection) — a fully-checked available set
// collapses to unitRefs: null, unitIds: null ("whole project").
function splitUnitSelection(item: { publicName: string; units: EditorUnit[]; checkedUnitIds: string[] }) {
  const availableIds = item.units.filter((u) => u.status === "available").map((u) => u.id);
  const checked = new Set(item.checkedUnitIds);
  const isWholeProject = availableIds.length > 0 && checked.size === availableIds.length && availableIds.every((id) => checked.has(id));
  if (isWholeProject) return { unitRefs: null as string[] | null, unitIds: null as string[] | null };
  const refs: string[] = [];
  const idsWithoutRef: string[] = [];
  for (const u of item.units) {
    if (!checked.has(u.id)) continue;
    if (u.ref && u.ref.trim()) refs.push(normalizeRef(u.ref, item.publicName));
    else idsWithoutRef.push(u.id);
  }
  return { unitRefs: refs.length ? refs : null, unitIds: idsWithoutRef.length ? idsWithoutRef : null };
}

export default function PresentationEditor({
  leadId, presentationId, token, general, items: initialItems, users, locations, initialCriteria, lead,
}: {
  leadId: string;
  presentationId: string;
  token: string;
  general: { greetingName: string; locale: string; personalNote: string; advisorId: string; expiresAt: string };
  items: EditorItem[];
  users: { id: string; name: string }[];
  locations: LocationOptions;
  initialCriteria: MatchFilters | null;
  lead: { budgetMin: number | null; budgetMax: number | null; propertyTypeInterest: string[]; lastMatchFilters: MatchFilters | null };
}) {
  const router = useRouter();

  const [items, setItems] = useState<EditorItem[]>(initialItems);
  const [greetingName, setGreetingName] = useState(general.greetingName);
  const [locale, setLocale] = useState<Locale>((LOCALES as readonly string[]).includes(general.locale) ? (general.locale as Locale) : "en");
  const [personalNote, setPersonalNote] = useState(general.personalNote);
  const [advisorId, setAdvisorId] = useState(general.advisorId);
  const [expiresAt, setExpiresAt] = useState(general.expiresAt);

  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());
  const [removeConfirmId, setRemoveConfirmId] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [confirmation, setConfirmation] = useState<{ url: string; whatsappUrl: string | null } | null>(null);

  // ---- Add Properties panel ----
  // Reopening always shows the SAME basis the presentation was actually
  // generated/last-saved with (presentation.criteria) — never the lead's own
  // profile fields, which can differ from what was actually searched for.
  // lead.lastMatchFilters is only a fallback for presentations that predate
  // the criteria field entirely.
  const [addOpen, setAddOpen] = useState(false);
  const [filters, setFilters] = useState<MatchFilters>({
    budgetMin: lead.budgetMin, budgetMax: lead.budgetMax,
    bedrooms: [], districts: [], areas: [], propertyTypes: lead.propertyTypeInterest ?? [],
    includeReady: false, onlyAvailable: true,
    ...(lead.lastMatchFilters ?? {}),
    ...(initialCriteria ?? {}),
  });
  const availableAreas = useMemo(() => {
    const set = new Set<string>();
    for (const d of filters.districts ?? []) for (const a of locations.areasByDistrict[d] ?? []) set.add(a);
    return Array.from(set).sort();
  }, [filters.districts, locations.areasByDistrict]);
  const [addResults, setAddResults] = useState<DevelopmentMatch[]>([]);
  const [addLoading, setAddLoading] = useState(false);
  const [addExpanded, setAddExpanded] = useState<Set<string>>(new Set());
  const [addSelected, setAddSelected] = useState<Set<string>>(new Set());
  const [addUnitOverrides, setAddUnitOverrides] = useState<Map<string, Set<string>>>(new Map());
  const [addComments, setAddComments] = useState<Map<string, string>>(new Map());

  const existingDevIds = useMemo(() => new Set(items.map((i) => i.developmentId)), [items]);
  const addableResults = addResults.filter((m) => !existingDevIds.has(m.development.id));

  function runAddSearch(f: MatchFilters) {
    setAddLoading(true);
    matchLeadAction(leadId, f).then((r) => { setAddResults(r); setAddLoading(false); }).catch(() => setAddLoading(false));
  }
  function openAddPanel() {
    setAddOpen(true);
    if (addResults.length === 0) runAddSearch(filters);
  }
  const toggleBed = (n: number) => { const f = { ...filters, bedrooms: (filters.bedrooms ?? []).includes(n) ? (filters.bedrooms ?? []).filter((x) => x !== n) : [...(filters.bedrooms ?? []), n] }; setFilters(f); runAddSearch(f); };
  const toggleDistrict = (d: string) => {
    const districts = (filters.districts ?? []).includes(d) ? (filters.districts ?? []).filter((x) => x !== d) : [...(filters.districts ?? []), d];
    const stillValid = new Set(districts.flatMap((dd) => locations.areasByDistrict[dd] ?? []));
    const f = { ...filters, districts, areas: (filters.areas ?? []).filter((a) => stillValid.has(a)) };
    setFilters(f); runAddSearch(f);
  };
  const toggleArea = (a: string) => { const f = { ...filters, areas: (filters.areas ?? []).includes(a) ? (filters.areas ?? []).filter((x) => x !== a) : [...(filters.areas ?? []), a] }; setFilters(f); runAddSearch(f); };
  const toggleType = (t: string) => { const f = { ...filters, propertyTypes: (filters.propertyTypes ?? []).includes(t) ? (filters.propertyTypes ?? []).filter((x) => x !== t) : [...(filters.propertyTypes ?? []), t] }; setFilters(f); runAddSearch(f); };
  const toggleAddDev = (id: string) => setAddSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAddExpand = (id: string) => setAddExpanded((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAddUnit = (devId: string, unitId: string, allAvailableIds: string[]) => {
    setAddUnitOverrides((prev) => {
      const n = new Map(prev);
      const current = n.get(devId) ?? new Set(allAvailableIds);
      const next = new Set(current);
      next.has(unitId) ? next.delete(unitId) : next.add(unitId);
      if (next.size === allAvailableIds.length && allAvailableIds.every((id) => next.has(id))) n.delete(devId);
      else n.set(devId, next);
      return n;
    });
  };

  function confirmAddSelected() {
    const toAdd: EditorItem[] = Array.from(addSelected).map((devId) => {
      const m = addableResults.find((r) => r.development.id === devId) ?? addResults.find((r) => r.development.id === devId)!;
      const allAvailableIds = m.matchedUnits.filter((u) => u.status === "available").map((u) => u.id);
      const override = addUnitOverrides.get(devId);
      const checkedUnitIds = override ? Array.from(override) : allAvailableIds;
      return {
        developmentId: devId,
        publicName: m.development.publicName,
        mainImage: m.development.mainImage,
        district: m.development.district, area: m.development.area, town: m.development.town,
        priceFrom: m.development.priceFrom, currency: m.development.currency,
        aliasName: "", advisorComment: addComments.get(devId) ?? "",
        sortIndex: 0, isNew: true,
        units: m.matchedUnits.map((u) => ({ ...u, currency: m.development.currency })),
        checkedUnitIds,
      };
    });
    setItems((prev) => [...prev, ...toAdd]);
    setAddSelected(new Set());
    setAddUnitOverrides(new Map());
    setAddComments(new Map());
    setAddOpen(false);
  }

  // ---- Selected Properties: reorder / edit / remove ----
  function moveItem(index: number, dir: -1 | 1) {
    setItems((prev) => {
      const next = [...prev];
      const j = index + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
    // Reorder autosaves immediately, silently — everything else waits for the
    // explicit "Save changes" button (PART 2D).
    setTimeout(() => save({ silent: true }), 0);
  }
  function updateItem(devId: string, patch: Partial<EditorItem>) {
    setItems((prev) => prev.map((it) => (it.developmentId === devId ? { ...it, ...patch } : it)));
  }
  function toggleItemUnit(devId: string, unitId: string) {
    setItems((prev) => prev.map((it) => {
      if (it.developmentId !== devId) return it;
      const checked = new Set(it.checkedUnitIds);
      checked.has(unitId) ? checked.delete(unitId) : checked.add(unitId);
      return { ...it, checkedUnitIds: Array.from(checked) };
    }));
  }
  function removeItem(devId: string) {
    setItems((prev) => prev.filter((it) => it.developmentId !== devId));
    setRemoveConfirmId(null);
  }
  const toggleExpandUnits = (devId: string) => setExpandedUnits((prev) => { const n = new Set(prev); n.has(devId) ? n.delete(devId) : n.add(devId); return n; });

  // ---- Save ----
  async function save(opts: { silent?: boolean } = {}) {
    if (items.length === 0) { setSaveError("At least one property is required."); return; }
    setSaving(true); setSaveError("");
    try {
      const payloadItems = items.map((it, i) => {
        const { unitRefs, unitIds } = splitUnitSelection(it);
        return {
          developmentId: it.developmentId,
          aliasName: it.aliasName || null,
          advisorComment: it.advisorComment || null,
          unitRefs, unitIds,
          sortIndex: i,
        };
      });
      const res = await fetch(`/api/admin/presentations/${presentationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ greetingName, locale, personalNote, advisorId, expiresAt, items: payloadItems, criteria: filters }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      if (!opts.silent) {
        setConfirmation({ url: data.url, whatsappUrl: data.whatsappUrl });
        router.refresh();
      }
    } catch (e: any) {
      if (!opts.silent) setSaveError(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* ---- A) GENERAL ---- */}
      <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 space-y-3">
        <h2 className="text-sm font-semibold text-[#111827]">General</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className={label}>Greeting name</label>
            <input value={greetingName} onChange={(e) => setGreetingName(e.target.value)} className={`${field} w-full`} />
          </div>
          <div>
            <label className={label}>Locale</label>
            <select value={locale} onChange={(e) => setLocale(e.target.value as Locale)} className={`${field} w-full`}>
              {LOCALES.map((l) => <option key={l} value={l}>{l.toUpperCase()}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Advisor</label>
            <select value={advisorId} onChange={(e) => setAdvisorId(e.target.value)} className={`${field} w-full`}>
              <option value="">—</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Expires</label>
            <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className={`${field} w-full`} />
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <label className={label}>Personal note (optional)</label>
            <textarea value={personalNote} onChange={(e) => setPersonalNote(e.target.value)} rows={2} className={`${field} w-full`} placeholder="A short message shown as a signed note on the client's page…" />
          </div>
        </div>
      </div>

      {/* ---- B) SELECTED PROPERTIES ---- */}
      <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 space-y-3">
        <h2 className="text-sm font-semibold text-[#111827]">Selected properties <span className="font-normal text-[#9CA3AF]">({items.length})</span></h2>
        <div className="space-y-2">
          {items.map((it, i) => {
            const isOpen = expandedUnits.has(it.developmentId);
            const allAvailableIds = it.units.filter((u) => u.status === "available").map((u) => u.id);
            return (
              <div key={it.developmentId} className="border border-[#E5E7EB] rounded-md p-3">
                <div className="flex items-start gap-3">
                  <div className="flex flex-col gap-0.5 shrink-0 pt-1">
                    <button type="button" onClick={() => moveItem(i, -1)} disabled={i === 0} className="text-[#9CA3AF] hover:text-[#111827] disabled:opacity-30 leading-none text-xs" title="Move up">▲</button>
                    <button type="button" onClick={() => moveItem(i, 1)} disabled={i === items.length - 1} className="text-[#9CA3AF] hover:text-[#111827] disabled:opacity-30 leading-none text-xs" title="Move down">▼</button>
                  </div>
                  {it.mainImage ? <img src={it.mainImage} alt="" className="w-16 h-12 object-cover rounded shrink-0" /> : <div className="w-16 h-12 rounded bg-[#F3F4F6] shrink-0" />}
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-[#9CA3AF]">{it.publicName}</span>
                      {it.isNew && <span className="text-[10px] font-semibold text-[#92400E] bg-[#FEF3C7] rounded-full px-2 py-0.5">NEW</span>}
                      <span className="text-xs text-[#9CA3AF] ml-auto">{[it.district || it.town, it.area].filter(Boolean).join(" · ")} · {fmtPrice(it.priceFrom)}</span>
                    </div>
                    {it.units.length > 0 && allAvailableIds.length === 0 && (
                      <p className="text-xs text-[#92400E] bg-[#FFFBEB] border border-[#FCD34D] rounded px-2 py-1">
                        ⚠ This development is sold out — consider removing it.
                      </p>
                    )}
                    <input
                      value={it.aliasName}
                      onChange={(e) => updateItem(it.developmentId, { aliasName: e.target.value })}
                      placeholder={it.publicName}
                      className={`${field} w-full`}
                    />
                    <input
                      value={it.advisorComment}
                      onChange={(e) => updateItem(it.developmentId, { advisorComment: e.target.value })}
                      placeholder="Personal note shown on this card"
                      className={`${field} w-full`}
                    />
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={() => toggleExpandUnits(it.developmentId)} className="text-xs text-[#1B4B43] hover:underline">
                        {isOpen ? "▾" : "▸"} Units ({it.checkedUnitIds.length}/{it.units.length})
                      </button>
                      {removeConfirmId === it.developmentId ? (
                        <span className="text-xs">
                          Remove this property?{" "}
                          <button type="button" onClick={() => removeItem(it.developmentId)} className="text-[#DC2626] font-medium hover:underline">Confirm</button>
                          {" · "}
                          <button type="button" onClick={() => setRemoveConfirmId(null)} className="text-[#6B7280] hover:underline">Cancel</button>
                        </span>
                      ) : (
                        <button type="button" onClick={() => setRemoveConfirmId(it.developmentId)} className="text-xs text-[#DC2626] hover:underline ml-auto">Remove</button>
                      )}
                    </div>
                    {isOpen && (
                      <table className="w-full text-xs mt-2">
                        <thead className="text-[#9CA3AF] text-left">
                          <tr><th className="py-1 w-6"></th><th className="py-1">Ref</th><th className="py-1">Type</th><th className="py-1">Beds</th><th className="py-1">Area</th><th className="py-1">Price</th><th className="py-1">Status</th></tr>
                        </thead>
                        <tbody>
                          {it.units.map((u) => {
                            const checked = it.checkedUnitIds.includes(u.id);
                            return (
                              <tr key={u.id} className="border-t border-[#E5E7EB]">
                                <td className="py-1"><input type="checkbox" disabled={u.status !== "available"} checked={checked} onChange={() => toggleItemUnit(it.developmentId, u.id)} className="h-3.5 w-3.5 rounded border-[#D1D5DB] text-[#1B4B43]" /></td>
                                <td className="py-1">{u.ref || u.label || "—"}</td>
                                <td className="py-1">{u.type || "—"}</td>
                                <td className="py-1">{u.beds || "—"}</td>
                                <td className="py-1">{u.areaBuilt || "—"}</td>
                                <td className="py-1">{fmtPrice(u.price)}</td>
                                <td className="py-1 capitalize">{u.status}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {items.length === 0 && <p className="text-sm text-[#9CA3AF] py-4 text-center">No properties selected — add at least one below.</p>}
        </div>
      </div>

      {/* ---- C) ADD PROPERTIES ---- */}
      <div className="bg-white rounded-lg border border-[#E5E7EB] p-5">
        {!addOpen ? (
          <button type="button" onClick={openAddPanel} className="text-sm text-[#1B4B43] font-medium hover:underline">+ Add properties</button>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#111827]">Add properties</h2>
              <button type="button" onClick={() => setAddOpen(false)} className="text-xs text-[#6B7280] hover:text-[#111827]">Collapse</button>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-[#F8F9FA] rounded-md p-3 border border-[#E5E7EB]">
              <div>
                <label className={label}>Budget min</label>
                <input type="number" className={`${field} w-full`} value={filters.budgetMin ?? ""} onChange={(e) => { const f = { ...filters, budgetMin: e.target.value ? Number(e.target.value) : null }; setFilters(f); runAddSearch(f); }} />
              </div>
              <div>
                <label className={label}>Budget max</label>
                <input type="number" className={`${field} w-full`} value={filters.budgetMax ?? ""} onChange={(e) => { const f = { ...filters, budgetMax: e.target.value ? Number(e.target.value) : null }; setFilters(f); runAddSearch(f); }} />
              </div>
              <div className="sm:col-span-2 lg:col-span-2">
                <label className={label}>Bedrooms</label>
                <div className="flex flex-wrap gap-1.5">
                  {BED_OPTIONS.map((n) => (
                    <button key={n} type="button" onClick={() => toggleBed(n)} className={chip((filters.bedrooms ?? []).includes(n))}>{n === 5 ? "5+" : n === 0 ? "Studio" : n}</button>
                  ))}
                </div>
              </div>
              <div className="lg:col-span-2">
                <label className={label}>District</label>
                <div className="flex flex-wrap gap-1.5">
                  {locations.districts.map((d) => (
                    <button key={d} type="button" onClick={() => toggleDistrict(d)} className={chip((filters.districts ?? []).includes(d))}>{d}</button>
                  ))}
                </div>
              </div>
              {(filters.districts ?? []).length > 0 && availableAreas.length > 0 && (
                <div className="lg:col-span-2">
                  <label className={label}>Area</label>
                  <div className="flex flex-wrap gap-1.5">
                    {availableAreas.map((a) => (
                      <button key={a} type="button" onClick={() => toggleArea(a)} className={chip((filters.areas ?? []).includes(a))}>{a}</button>
                    ))}
                  </div>
                </div>
              )}
              <div className="lg:col-span-2">
                <label className={label}>Property type</label>
                <div className="flex flex-wrap gap-1.5">
                  {PROPERTY_TYPES.map((t) => (
                    <button key={t} type="button" onClick={() => toggleType(t)} className={chip((filters.propertyTypes ?? []).includes(t))}>{t}</button>
                  ))}
                </div>
              </div>
              {addLoading && <span className="text-xs text-[#9CA3AF]">Matching…</span>}
            </div>

            <div className="border border-[#E5E7EB] rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-[#F8F9FA] text-[#6B7280] text-left">
                  <tr>
                    <th className="px-3 py-2 w-8"></th>
                    <th className="px-3 py-2 w-14"></th>
                    <th className="px-3 py-2 font-medium">Project</th>
                    <th className="px-3 py-2 font-medium">Location</th>
                    <th className="px-3 py-2 font-medium">Price from</th>
                    <th className="px-3 py-2 font-medium text-right">Match</th>
                    <th className="px-3 py-2 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F4F6]">
                  {addableResults.length === 0 && !addLoading && (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-[#9CA3AF]">No other developments match these filters.</td></tr>
                  )}
                  {addableResults.map((m) => {
                    const d = m.development;
                    const isOpen = addExpanded.has(d.id);
                    const allAvailableIds = m.matchedUnits.filter((u) => u.status === "available").map((u) => u.id);
                    const checkedUnits = addUnitOverrides.get(d.id);
                    return (
                      <Fragment key={d.id}>
                        <tr className="hover:bg-[#F8F9FA]">
                          <td className="px-3 py-2"><input type="checkbox" checked={addSelected.has(d.id)} onChange={() => toggleAddDev(d.id)} className="h-4 w-4 rounded border-[#D1D5DB] text-[#1B4B43]" /></td>
                          <td className="px-3 py-2">{d.mainImage ? <img src={d.mainImage} alt="" className="w-12 h-9 object-cover rounded" /> : <div className="w-12 h-9 rounded bg-[#F3F4F6]" />}</td>
                          <td className="px-3 py-2 font-medium text-[#111827]">{d.publicName}</td>
                          <td className="px-3 py-2 text-[#6B7280]">{[d.district || d.town, d.area].filter(Boolean).join(" · ") || "—"}</td>
                          <td className="px-3 py-2 text-[#6B7280]">{fmtPrice(d.priceFrom)}</td>
                          <td className="px-3 py-2 text-right"><span className="inline-block rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: scoreBg(m.score), color: scoreColor(m.score) }}>{m.score}%</span></td>
                          <td className="px-3 py-2 text-center"><button type="button" onClick={() => toggleAddExpand(d.id)} className="text-[#6B7280] hover:text-[#111827]">{isOpen ? "▾" : "▸"}</button></td>
                        </tr>
                        {isOpen && (
                          <tr>
                            <td colSpan={7} className="px-4 py-3 bg-[#FAFAFA]">
                              {addSelected.has(d.id) && (
                                <input
                                  value={addComments.get(d.id) ?? ""}
                                  onChange={(e) => setAddComments((prev) => new Map(prev).set(d.id, e.target.value))}
                                  placeholder="Personal note shown on this card (optional)"
                                  className={`${field} w-full mb-3`}
                                />
                              )}
                              {m.matchedUnits.length === 0 ? (
                                <p className="text-xs text-[#9CA3AF]">No individual unit data matched these filters — the whole project&apos;s available units will show.</p>
                              ) : (
                                <table className="w-full text-xs">
                                  <thead className="text-[#9CA3AF] text-left"><tr><th className="py-1 w-6"></th><th className="py-1">Ref</th><th className="py-1">Type</th><th className="py-1">Beds</th><th className="py-1">Area</th><th className="py-1">Price</th><th className="py-1">Status</th></tr></thead>
                                  <tbody>
                                    {m.matchedUnits.map((u) => {
                                      const checked = checkedUnits ? checkedUnits.has(u.id) : true;
                                      return (
                                        <tr key={u.id} className="border-t border-[#E5E7EB]">
                                          <td className="py-1"><input type="checkbox" disabled={u.status !== "available"} checked={checked} onChange={() => toggleAddUnit(d.id, u.id, allAvailableIds)} className="h-3.5 w-3.5 rounded border-[#D1D5DB] text-[#1B4B43]" /></td>
                                          <td className="py-1">{u.ref || u.label || "—"}</td>
                                          <td className="py-1">{u.type || "—"}</td>
                                          <td className="py-1">{u.beds || "—"}</td>
                                          <td className="py-1">{u.areaBuilt || "—"}</td>
                                          <td className="py-1">{fmtPrice(u.price)}</td>
                                          <td className="py-1 capitalize">{u.status}</td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {addSelected.size > 0 && (
              <button type="button" onClick={confirmAddSelected} className="rounded-md bg-[#1B4B43] text-white text-sm font-medium px-4 py-2 hover:bg-[#142E2D]">
                Add {addSelected.size} propert{addSelected.size === 1 ? "y" : "ies"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ---- D) SAVE ---- */}
      <div className="sticky bottom-0 z-10 bg-white border border-[#E5E7EB] rounded-lg shadow-lg p-4 flex items-center gap-3">
        {saveError && <p className="text-sm text-[#DC2626]">{saveError}</p>}
        <button type="button" onClick={() => save()} disabled={saving} className="ml-auto rounded-md bg-[#1B4B43] text-white text-sm font-medium px-5 py-2 hover:bg-[#142E2D] disabled:bg-[#D1D5DB]">
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>

      {/* ---- SAVE CONFIRMATION ---- */}
      {confirmation && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6" onClick={() => setConfirmation(null)}>
          <div className="bg-white rounded-lg p-6 max-w-md w-full space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-[#111827]">Changes saved</h3>
            <p className="text-xs text-[#6B7280]">No automatic message was sent to the client. Use the button below to notify them yourself, if you&apos;d like.</p>
            <p className="text-sm break-all text-[#111827]">{confirmation.url}</p>
            <div className="flex gap-2 flex-wrap">
              <button type="button" onClick={() => navigator.clipboard.writeText(confirmation.url)} className="rounded-md border border-[#E5E7EB] text-sm px-3 py-1.5 hover:bg-[#F8F9FA]">Copy link</button>
              {confirmation.whatsappUrl && (
                <a href={confirmation.whatsappUrl} target="_blank" rel="noopener noreferrer" className="rounded-md bg-[#25D366] text-white text-sm px-3 py-1.5 hover:opacity-90">Share via WhatsApp</a>
              )}
              <button type="button" onClick={() => setConfirmation(null)} className="ml-auto text-sm text-[#6B7280] hover:text-[#111827]">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
