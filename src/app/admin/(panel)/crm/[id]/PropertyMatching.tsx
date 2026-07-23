"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { matchLeadAction, saveMatchFiltersAction, type LocationOptions } from "./presentationActions";
import type { DevelopmentMatch, MatchFilters } from "@/lib/crm/matching";
import { normalizeRef } from "@/lib/unitRef";
import ComposeEmailModal from "./ComposeEmailModal";
import { PRESENTATION_EMAIL_TEMPLATE } from "@/lib/crm/presentationMessages";

type LeadBrief = {
  firstName: string;
  budgetMin: number | null;
  budgetMax: number | null;
  propertyTypeInterest: string[];
  languagePreference: string | null;
  phone: string | null;
  email: string | null;
  lastMatchFilters: MatchFilters | null;
};

const LOCALES = ["en", "de", "pl", "ru"] as const;
type Locale = (typeof LOCALES)[number];
const PROPERTY_TYPES = ["Apartment", "Villa", "Townhouse", "Penthouse"];
const BED_OPTIONS = [0, 1, 2, 3, 4, 5]; // 5 = "5+"

// Just the name — the public page (src/app/c/[token]/page.tsx) already builds
// the full salutation as "{time-of-day greeting}, {greetingName}". Prefixing a
// second salutation here as well produced a double greeting on the public page
// (e.g. RU "Добрый день, Здравствуйте, Екатерина" — "Good afternoon, Hello, Ekaterina").
const suggestedGreeting = (locale: Locale, firstName: string) => firstName;

const fmtPrice = (n: number | null) => (n == null ? "—" : `€${n.toLocaleString("en-US")}`);
const scoreColor = (s: number) => (s >= 80 ? "#166534" : s >= 60 ? "#92400E" : "#6B7280");
const scoreBg = (s: number) => (s >= 80 ? "#DCFCE7" : s >= 60 ? "#FEF3C7" : "#F3F4F6");

const field = "rounded-md border border-[#E5E7EB] px-2.5 py-1.5 text-sm focus:border-[#1B4B43] focus:outline-none";
const label = "block text-xs font-medium text-[#6B7280] mb-1";
const chip = (on: boolean) =>
  `rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${on ? "border-[#1B4B43] bg-[#1B4B43] text-white" : "border-[#E5E7EB] text-[#6B7280] hover:bg-[#F8F9FA]"}`;

export default function PropertyMatching({
  leadId, lead, locations, currentUser, users, sendPresentationEmailAction,
}: {
  leadId: string;
  lead: LeadBrief;
  locations: LocationOptions;
  currentUser: { id: string; name: string } | null;
  users: { id: string; name: string }[];
  sendPresentationEmailAction: (opts: { subject: string; body: string; leadReacted?: boolean; presentationToken?: string }) => Promise<{ ok?: string; error?: string }>;
}) {
  const initialLocale: Locale = (LOCALES as readonly string[]).includes(lead.languagePreference ?? "") ? (lead.languagePreference as Locale) : "en";

  // Last-used filters (auto-saved per lead, see saveMatchFiltersAction below)
  // win over the generic lead-profile defaults, so reopening a lead shows
  // exactly what was last searched for rather than resetting every time.
  const [filters, setFilters] = useState<MatchFilters>({
    budgetMin: lead.budgetMin, budgetMax: lead.budgetMax,
    bedrooms: [], districts: [], areas: [], propertyTypes: lead.propertyTypeInterest ?? [],
    includeReady: false, onlyAvailable: true,
    ...(lead.lastMatchFilters ?? {}),
  });
  // Areas offered below the District select — union of areas across every
  // currently-selected district (PART 6).
  const availableAreas = useMemo(() => {
    const set = new Set<string>();
    for (const d of filters.districts ?? []) for (const a of locations.areasByDistrict[d] ?? []) set.add(a);
    return Array.from(set).sort();
  }, [filters.districts, locations.areasByDistrict]);
  const [results, setResults] = useState<DevelopmentMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedDevs, setSelectedDevs] = useState<Set<string>>(new Set());
  // Developments the admin explicitly unchecked THIS session — a 100% match
  // auto-checks itself (see the results-driven effect below), but must not
  // fight an admin who deliberately unchecked it. Cleared on filter change,
  // since a new search is a fresh start.
  const [manuallyUnchecked, setManuallyUnchecked] = useState<Set<string>>(new Set());
  // Developments CURRENTLY checked because of the auto-check mechanism (not
  // because the admin clicked them) — lets the results-effect tell "auto" and
  // "manual" selections apart, so it can safely auto-*un*check one that drops
  // below 100% after a filter change without touching anything the admin
  // deliberately selected themselves. NOT cleared on filter change (unlike
  // manuallyUnchecked) — it must survive into the next results-effect run so
  // that run can see what to retract.
  const [autoSelected, setAutoSelected] = useState<Set<string>>(new Set());
  const [unitOverrides, setUnitOverrides] = useState<Map<string, Set<string>>>(new Map());
  const [comments, setComments] = useState<Map<string, string>>(new Map());

  const [greetingName, setGreetingName] = useState(suggestedGreeting(initialLocale, lead.firstName));
  const [greetingTouched, setGreetingTouched] = useState(false);
  const [personalNote, setPersonalNote] = useState("");
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [advisorId, setAdvisorId] = useState(currentUser?.id ?? "");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [generated, setGenerated] = useState<{ token: string; url: string; qrSvg: string; whatsappUrl: string | null } | null>(null);
  const [showComposeEmail, setShowComposeEmail] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runMatch = (f: MatchFilters) => {
    setLoading(true);
    matchLeadAction(leadId, f).then((r) => { setResults(r); setLoading(false); }).catch(() => setLoading(false));
  };
  useEffect(() => {
    setManuallyUnchecked(new Set()); // a new search is a fresh start — see PART 4
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      runMatch(filters);
      saveMatchFiltersAction(leadId, filters).catch(() => {}); // best-effort, silent
    }, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  // Auto-check every 100% match as soon as results (re)load — initial load AND
  // every filter change both flow through here, since both update `results` —
  // AND auto-*un*check anything that was auto-selected before but is no longer
  // a 100% match under the new results (e.g. the admin loosened/changed a
  // filter and this development dropped to 85%). A manual selection is never
  // touched either way, since it was never added to autoSelected in the first
  // place (see toggleDev). Deliberately excludes manuallyUnchecked/autoSelected
  // from deps: both are read via closure at the moment results change, not
  // re-triggered when the admin un/re-checks a box directly (toggleDev's job).
  useEffect(() => {
    if (!results.length) return;
    const hundredIds = new Set(results.filter((m) => m.score === 100).map((m) => m.development.id));
    setSelectedDevs((prev) => {
      const next = new Set(prev);
      autoSelected.forEach((id) => { if (!hundredIds.has(id)) next.delete(id); }); // fell below 100% — retract the auto-check
      hundredIds.forEach((id) => { if (!manuallyUnchecked.has(id)) next.add(id); }); // still (or newly) 100% — auto-check
      return next;
    });
    setAutoSelected(() => {
      const next = new Set<string>();
      hundredIds.forEach((id) => { if (!manuallyUnchecked.has(id)) next.add(id); });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results]);

  useEffect(() => {
    if (!greetingTouched) setGreetingName(suggestedGreeting(locale, lead.firstName));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  const toggleDev = (id: string) => {
    setSelectedDevs((prev) => {
      const n = new Set(prev);
      if (n.has(id)) {
        n.delete(id);
        setManuallyUnchecked((mu) => new Set(mu).add(id)); // don't let auto-check re-add this one
      } else {
        n.add(id);
        setManuallyUnchecked((mu) => { if (!mu.has(id)) return mu; const s = new Set(mu); s.delete(id); return s; });
      }
      return n;
    });
    // Either direction is a deliberate admin action — it's no longer "owned" by
    // the auto-check mechanism, so a later score drop must not auto-uncheck it.
    setAutoSelected((prev) => { if (!prev.has(id)) return prev; const s = new Set(prev); s.delete(id); return s; });
  };
  const toggleExpand = (id: string) => setExpanded((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleBed = (n: number) => setFilters((f) => ({ ...f, bedrooms: (f.bedrooms ?? []).includes(n) ? (f.bedrooms ?? []).filter((x) => x !== n) : [...(f.bedrooms ?? []), n] }));
  // Deselecting a district also drops any selected areas that only belonged to
  // it — they'd no longer be valid options once that district's areas vanish
  // from the Area select.
  const toggleDistrict = (d: string) =>
    setFilters((f) => {
      const districts = (f.districts ?? []).includes(d) ? (f.districts ?? []).filter((x) => x !== d) : [...(f.districts ?? []), d];
      const stillValid = new Set(districts.flatMap((dd) => locations.areasByDistrict[dd] ?? []));
      return { ...f, districts, areas: (f.areas ?? []).filter((a) => stillValid.has(a)) };
    });
  const toggleArea = (a: string) => setFilters((f) => ({ ...f, areas: (f.areas ?? []).includes(a) ? (f.areas ?? []).filter((x) => x !== a) : [...(f.areas ?? []), a] }));
  const toggleType = (t: string) => setFilters((f) => ({ ...f, propertyTypes: (f.propertyTypes ?? []).includes(t) ? (f.propertyTypes ?? []).filter((x) => x !== t) : [...(f.propertyTypes ?? []), t] }));

  const toggleUnit = (devId: string, unitId: string, allAvailableIds: string[]) => {
    setUnitOverrides((prev) => {
      const n = new Map(prev);
      const current = n.get(devId) ?? new Set(allAvailableIds); // start from "all" so unchecking narrows it
      const next = new Set(current);
      next.has(unitId) ? next.delete(unitId) : next.add(unitId);
      // If back to the full set, drop the override entirely → unitIds = null ("whole project").
      if (next.size === allAvailableIds.length && allAvailableIds.every((id) => next.has(id))) n.delete(devId);
      else n.set(devId, next);
      return n;
    });
  };

  const selectedCount = selectedDevs.size;
  const unitCount = useMemo(() => {
    let total = 0;
    for (const m of results) {
      if (!selectedDevs.has(m.development.id)) continue;
      const ov = unitOverrides.get(m.development.id);
      total += ov ? ov.size : m.development.unitsAvailable;
    }
    return total;
  }, [results, selectedDevs, unitOverrides]);

  // Split a unit-selection into stable normalized refs (survive feed re-syncs)
  // and, for units with no ref at all (manual units only — never wiped by a
  // sync), their UUIDs as a fallback identifier. See PART 1 in the task spec.
  function splitUnitSelection(developmentId: string, selectedIds: Set<string>) {
    const m = results.find((r) => r.development.id === developmentId);
    const publicName = m?.development.publicName || "";
    const refs: string[] = [];
    const idsWithoutRef: string[] = [];
    Array.from(selectedIds).forEach((id) => {
      const u = m?.matchedUnits.find((mu) => mu.id === id);
      if (u?.ref && u.ref.trim()) refs.push(normalizeRef(u.ref, publicName));
      else idsWithoutRef.push(id);
    });
    return { unitRefs: refs.length ? refs : null, unitIds: idsWithoutRef.length ? idsWithoutRef : null };
  }

  async function generate() {
    setGenerating(true); setGenError("");
    try {
      const items = Array.from(selectedDevs).map((developmentId, i) => {
        const ov = unitOverrides.get(developmentId);
        const { unitRefs, unitIds } = ov ? splitUnitSelection(developmentId, ov) : { unitRefs: null, unitIds: null };
        return {
          developmentId,
          unitRefs,
          unitIds,
          sortIndex: i,
          advisorComment: comments.get(developmentId) ?? "",
        };
      });
      const res = await fetch("/api/admin/presentations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId, greetingName, personalNote, advisorId, locale, items,
          // The full filter state, persisted as-is into ClientPresentation.criteria
          // — the "your preferences" chips render exclusively from this snapshot,
          // never from the lead's own profile fields (which may be empty/stale).
          criteria: filters,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate");
      setGenerated({ token: data.token, url: data.url, qrSvg: data.qrSvg, whatsappUrl: data.whatsappUrl });
    } catch (e: any) {
      setGenError(e.message || "Failed to generate");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 space-y-4">
      <h2 className="text-base font-semibold text-[#111827]">Property Matching</h2>

      {/* ---- FILTERS ---- */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-[#F8F9FA] rounded-md p-3 border border-[#E5E7EB]">
        <div>
          <label className={label}>Budget min</label>
          <input type="number" className={`${field} w-full`} value={filters.budgetMin ?? ""} onChange={(e) => setFilters((f) => ({ ...f, budgetMin: e.target.value ? Number(e.target.value) : null }))} />
        </div>
        <div>
          <label className={label}>Budget max</label>
          <input type="number" className={`${field} w-full`} value={filters.budgetMax ?? ""} onChange={(e) => setFilters((f) => ({ ...f, budgetMax: e.target.value ? Number(e.target.value) : null }))} />
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
            {locations.districts.length === 0 && <span className="text-xs text-[#9CA3AF]">No districts found</span>}
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
        <div className="flex items-end gap-4 lg:col-span-4">
          <label className="flex items-center gap-1.5 text-sm text-[#374151]">
            <input type="checkbox" checked={!!filters.includeReady} onChange={(e) => setFilters((f) => ({ ...f, includeReady: e.target.checked }))} className="h-4 w-4 rounded border-[#D1D5DB] text-[#1B4B43]" />
            Include ready (unpublished) projects
          </label>
          <label className="flex items-center gap-1.5 text-sm text-[#374151]">
            <input type="checkbox" checked={!!filters.onlyAvailable} onChange={(e) => setFilters((f) => ({ ...f, onlyAvailable: e.target.checked }))} className="h-4 w-4 rounded border-[#D1D5DB] text-[#1B4B43]" />
            Only with available units
          </label>
          {loading && <span className="text-xs text-[#9CA3AF] ml-auto">Matching…</span>}
        </div>
      </div>

      {/* ---- RESULTS ---- */}
      <div className="border border-[#E5E7EB] rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#F8F9FA] text-[#6B7280] text-left">
            <tr>
              <th className="px-3 py-2 w-8"></th>
              <th className="px-3 py-2 w-14"></th>
              <th className="px-3 py-2 font-medium">Project</th>
              <th className="px-3 py-2 font-medium">Location</th>
              <th className="px-3 py-2 font-medium">Price from</th>
              <th className="px-3 py-2 font-medium text-right">Available</th>
              <th className="px-3 py-2 font-medium text-right">Match</th>
              <th className="px-3 py-2 w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F3F4F6]">
            {results.length === 0 && !loading && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-[#9CA3AF]">No published developments match these filters.</td></tr>
            )}
            {results.map((m) => {
              const d = m.development;
              const isOpen = expanded.has(d.id);
              const allAvailableIds = m.matchedUnits.length ? m.matchedUnits.filter((u) => u.status === "available").map((u) => u.id) : [];
              const checkedUnits = unitOverrides.get(d.id);
              return (
                <Fragment key={d.id}>
                  <tr className="hover:bg-[#F8F9FA]">
                    <td className="px-3 py-2"><input type="checkbox" checked={selectedDevs.has(d.id)} onChange={() => toggleDev(d.id)} className="h-4 w-4 rounded border-[#D1D5DB] text-[#1B4B43]" /></td>
                    <td className="px-3 py-2">
                      {d.mainImage ? <img src={d.mainImage} alt="" className="w-12 h-9 object-cover rounded" /> : <div className="w-12 h-9 rounded bg-[#F3F4F6]" />}
                    </td>
                    <td className="px-3 py-2 font-medium text-[#111827]">{d.publicName}</td>
                    <td className="px-3 py-2 text-[#6B7280]">{[d.district || d.town, d.area].filter(Boolean).join(" · ") || "—"}</td>
                    <td className="px-3 py-2 text-[#6B7280]">{fmtPrice(d.priceFrom)}</td>
                    <td className="px-3 py-2 text-right text-[#6B7280]">{d.unitsAvailable}</td>
                    <td className="px-3 py-2 text-right">
                      <span className="inline-block rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: scoreBg(m.score), color: scoreColor(m.score) }}>{m.score}%</span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button type="button" onClick={() => toggleExpand(d.id)} className="text-[#6B7280] hover:text-[#111827]" title="Show units">{isOpen ? "▾" : "▸"}</button>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={8} className="px-4 py-3 bg-[#FAFAFA]">
                        {selectedDevs.has(d.id) && (
                          <input
                            value={comments.get(d.id) ?? ""}
                            onChange={(e) => setComments((prev) => new Map(prev).set(d.id, e.target.value))}
                            placeholder="Advisor's note for this property (optional, one line)"
                            className={`${field} w-full mb-3`}
                          />
                        )}
                        {m.matchedUnits.length === 0 ? (
                          <p className="text-xs text-[#9CA3AF]">No individual unit data matched these filters — the whole project&apos;s available units will show.</p>
                        ) : (
                          <table className="w-full text-xs">
                            <thead className="text-[#9CA3AF] text-left">
                              <tr><th className="py-1 w-6"></th><th className="py-1">Ref</th><th className="py-1">Type</th><th className="py-1">Beds</th><th className="py-1">Area</th><th className="py-1">Price</th><th className="py-1">Status</th></tr>
                            </thead>
                            <tbody>
                              {m.matchedUnits.map((u) => {
                                const checked = checkedUnits ? checkedUnits.has(u.id) : true;
                                return (
                                  <tr key={u.id} className="border-t border-[#E5E7EB]">
                                    <td className="py-1"><input type="checkbox" disabled={u.status !== "available"} checked={checked} onChange={() => toggleUnit(d.id, u.id, allAvailableIds)} className="h-3.5 w-3.5 rounded border-[#D1D5DB] text-[#1B4B43]" /></td>
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

      {/* ---- SELECTION BAR ---- */}
      {selectedCount > 0 && (
        <div className="sticky bottom-0 z-10 bg-white border border-[#E5E7EB] rounded-lg shadow-lg p-4 space-y-3">
          <div className="text-sm font-medium text-[#111827]">{selectedCount} project{selectedCount === 1 ? "" : "s"} / {unitCount} unit{unitCount === 1 ? "" : "s"} selected</div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className={label}>Greeting name</label>
              <input value={greetingName} onChange={(e) => { setGreetingName(e.target.value); setGreetingTouched(true); }} className={`${field} w-full`} />
            </div>
            <div>
              <label className={label}>Locale</label>
              <select value={locale} onChange={(e) => setLocale(e.target.value as Locale)} className={`${field} w-full`}>
                {LOCALES.map((l) => <option key={l} value={l}>{l.toUpperCase()}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2 lg:col-span-2">
              <label className={label}>Advisor</label>
              <select value={advisorId} onChange={(e) => setAdvisorId(e.target.value)} className={`${field} w-full`}>
                <option value="">—</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <label className={label}>Personal note (optional)</label>
              <textarea value={personalNote} onChange={(e) => setPersonalNote(e.target.value)} rows={2} className={`${field} w-full`} placeholder="A short message shown as a signed note on the client's page…" />
            </div>
          </div>
          {genError && <p className="text-sm text-[#DC2626]">{genError}</p>}
          <button type="button" onClick={generate} disabled={generating} className="w-full sm:w-auto rounded-md bg-[#1B4B43] text-white text-sm font-medium px-5 py-2 hover:bg-[#142E2D] disabled:bg-[#D1D5DB]">
            {generating ? "Generating…" : "Generate Client Presentation"}
          </button>
        </div>
      )}

      {/* ---- GENERATE RESULT MODAL ---- */}
      {generated && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6" onClick={() => setGenerated(null)}>
          <div className="bg-white rounded-lg p-6 max-w-md w-full space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-[#111827]">Presentation created</h3>
            <div className="flex items-center gap-3">
              <div className="w-28 h-28 shrink-0" dangerouslySetInnerHTML={{ __html: generated.qrSvg }} />
              <div className="min-w-0">
                <p className="text-xs text-[#6B7280] mb-1">Link</p>
                <p className="text-sm break-all text-[#111827]">{generated.url}</p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button type="button" onClick={() => navigator.clipboard.writeText(generated.url)} className="rounded-md border border-[#E5E7EB] text-sm px-3 py-1.5 hover:bg-[#F8F9FA]">Copy link</button>
              {generated.whatsappUrl && (
                <a href={generated.whatsappUrl} target="_blank" rel="noopener noreferrer" className="rounded-md bg-[#25D366] text-white text-sm px-3 py-1.5 hover:opacity-90">Share via WhatsApp</a>
              )}
              {lead.email && (
                <button type="button" onClick={() => setShowComposeEmail(true)} className="rounded-md border border-[#1B4B43] text-[#1B4B43] text-sm px-3 py-1.5 hover:bg-[#1B4B43]/5">
                  Send by email
                </button>
              )}
              <button type="button" onClick={() => setGenerated(null)} className="ml-auto text-sm text-[#6B7280] hover:text-[#111827]">Close</button>
            </div>
          </div>
        </div>
      )}

      {showComposeEmail && generated && lead.email && (() => {
        const t = PRESENTATION_EMAIL_TEMPLATE[locale](greetingName, generated.url);
        return (
          <ComposeEmailModal
            leadEmail={lead.email}
            initialSubject={t.subject}
            initialBody={t.body}
            presentationToken={generated.token}
            showLeadReacted={false}
            sendAction={sendPresentationEmailAction}
            onClose={() => setShowComposeEmail(false)}
          />
        );
      })()}
    </div>
  );
}
