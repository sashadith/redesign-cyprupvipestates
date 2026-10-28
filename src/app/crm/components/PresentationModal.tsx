"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import type { MatchingMapMarker } from "@/app/admin/(panel)/crm/[id]/MatchingMap";
import ComposeEmailModal from "@/app/admin/(panel)/crm/[id]/ComposeEmailModal";
import { PRESENTATION_EMAIL_TEMPLATE } from "@/lib/crm/presentationMessages";
import type { DevelopmentMatch, MatchFilters } from "@/lib/crm/matching";
import type { LocationOptions } from "@/lib/crm/presentations/locations";
import type { SentInfo } from "@/lib/crm/presentations/sentHistory";
import type { EditorItem } from "@/lib/crm/presentations/editorItems";
import { initialFilters } from "@/lib/crm/presentations/seedFilters";
import { PUBLIC_LOCALES, isPublicLocale } from "@/lib/locale";
import {
  createPresentationAction, loadPresentationForEditAction, locationsAction, matchAction, saveFiltersAction,
  savePresentationEditAction, sendPresentationEmailAction,
} from "../leads/presentationActions";
import {
  buildItems, confirmDiscard, droppedSelections, editorItemFromMatch, editPayloadItems, editSnapshot, emptyEditItems,
  hiddenSelections, isDirty, isEditDirty, mapRecord, overridesRecord, removeItemConfirm, type EditSnapshot, type ModalSnapshot,
} from "./presentationModalState";
import { PresentationFilters } from "./presentation/PresentationFilters";
import { PresentationResults } from "./presentation/PresentationResults";
import { PresentationCreated, type CreatedPresentation } from "./presentation/PresentationCreated";
import { PresentationSelection } from "./presentation/PresentationSelection";
import { PresentationSaved, type SavedPresentation } from "./presentation/PresentationSaved";

// Presentation modal on the lead cockpit. "New": the old CRM's Property
// Matching panel (src/app/admin/(panel)/crm/[id]/PropertyMatching.tsx) with the
// same matching, auto-select and snapshot rules, in the new CRM's styling.
// "Edit": the old edit page (.../presentations/[presentationId]/edit/
// PresentationEditor.tsx) — the current items first, the same matching panel
// below to add projects (no auto-select there).

// MapLibre touches window: client-only, like the old panel.
const MatchingMap = dynamic(() => import("@/app/admin/(panel)/crm/[id]/MatchingMap"), { ssr: false });

type Locale = (typeof PUBLIC_LOCALES)[number];

export type ModalLead = {
  id: string; firstName: string; budgetMin: number | null; budgetMax: number | null;
  propertyTypeInterest: string[]; languagePreference: string | null;
  phone: string | null; email: string | null; lastMatchFilters: unknown;
};
export type ModalUser = { id: string; name: string };
/** Starting point for "New from favorites": filters plus pre-ticked projects (names for when they are not in the results). */
export type PresentationSeed = { filters: MatchFilters; preselect: string[]; preselectNames?: Record<string, string> };
export type PresentationModalMode = { kind: "new"; seed?: PresentationSeed } | { kind: "edit"; presentationId: string };

// Just the name: the public page already builds "{time-of-day greeting}, {name}".
const suggestedGreeting = (_locale: Locale, firstName: string) => firstName;

const addTo = (s: Set<string>, id: string) => new Set(s).add(id);
const toggleIn = (s: Set<string>, id: string) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; };

export function PresentationModal({ mode, lead, sent, users, currentUser, onClose }: {
  mode: PresentationModalMode; lead: ModalLead; sent: Record<string, SentInfo>;
  users: ModalUser[]; currentUser: ModalUser | null; onClose: () => void;
}) {
  const router = useRouter();
  const dlg = useRef<HTMLDialogElement>(null);
  const downOnBackdrop = useRef(false);
  // Set right before an approved close; any other close (e.g. a browser close
  // request that could not be prevented) reopens the dialog instead.
  const closeApproved = useRef(false);
  const initialLocale: Locale = isPublicLocale(lead.languagePreference ?? "") ? (lead.languagePreference as Locale) : "en";
  const isEdit = mode.kind === "edit";
  const editId = mode.kind === "edit" ? mode.presentationId : null;
  const seed = mode.kind === "new" ? mode.seed : undefined;
  const preselect = seed?.preselect ?? [];

  // The last saved search wins over the lead profile; a seed wins over both.
  // Edit replaces this with the selection's own criteria once it has loaded.
  const [filters, setFilters] = useState<MatchFilters>(() => seed?.filters ?? initialFilters(lead));
  const [locations, setLocations] = useState<LocationOptions | null>(null);
  const [locationsError, setLocationsError] = useState<string | null>(null);
  const [results, setResults] = useState<DevelopmentMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedDevs, setSelectedDevs] = useState<Set<string>>(() => new Set(preselect));
  // Unticked by hand this search: a 100 % match must not re-tick itself.
  // Cleared on filter change, since a new search is a fresh start.
  const [manuallyUnchecked, setManuallyUnchecked] = useState<Set<string>>(new Set());
  // Ticked by the auto-check (not by hand), so a later score drop can untick
  // exactly those. Survives filter changes so the next results run sees it.
  const [autoSelected, setAutoSelected] = useState<Set<string>>(new Set());
  const [unitOverrides, setUnitOverrides] = useState<Map<string, Set<string>>>(new Map());
  const [comments, setComments] = useState<Map<string, string>>(new Map());
  const [showAllUnits, setShowAllUnits] = useState<Set<string>>(new Set());

  const [greetingName, setGreetingName] = useState(suggestedGreeting(initialLocale, lead.firstName));
  const [greetingTouched, setGreetingTouched] = useState(false);
  const [personalNote, setPersonalNote] = useState("");
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [advisorId, setAdvisorId] = useState(currentUser?.id ?? "");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [dropWarning, setDropWarning] = useState<string[] | null>(null);
  const [created, setCreated] = useState<CreatedPresentation | null>(null);
  const [showComposeEmail, setShowComposeEmail] = useState(false);

  // ---- Edit mode: the loaded selection ----
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadTry, setLoadTry] = useState(0);
  const [ready, setReady] = useState(!isEdit);
  const [items, setItems] = useState<EditorItem[]>([]);
  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(new Set());
  const [expiresAt, setExpiresAt] = useState("");
  const [itemsExpanded, setItemsExpanded] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<SavedPresentation | null>(null);
  const initialEdit = useRef<EditSnapshot | null>(null);

  const initialSnapshot = useRef<ModalSnapshot>({
    picked: preselect, unpicked: [], unitOverrides: {}, comments: {},
    greetingName: suggestedGreeting(initialLocale, lead.firstName), personalNote: "", locale: initialLocale, advisorId: currentUser?.id ?? "",
  });

  useEffect(() => { dlg.current?.showModal(); }, []);

  useEffect(() => {
    if (!editId) return;
    let live = true;
    setLoadError(null);
    loadPresentationForEditAction(editId)
      .then((r) => {
        if (!live) return;
        if ("error" in r) { setLoadError(r.error); return; }
        const p = r.presentation;
        const loc: Locale = isPublicLocale(p.locale) ? p.locale : "en";
        const general = { greetingName: p.greetingName, personalNote: p.personalNote, locale: loc, advisorId: p.advisorId, expiresAt: p.expiresAt };
        setItems(r.items);
        setFavoritedIds(new Set(r.favoritedIds));
        setGreetingName(general.greetingName); setGreetingTouched(true);
        setLocale(loc); setPersonalNote(general.personalNote); setAdvisorId(general.advisorId); setExpiresAt(general.expiresAt);
        // Same basis the selection was generated / last saved with; the lead's
        // own search only fills what older selections never stored.
        setFilters({ ...initialFilters(lead), ...(p.criteria ?? {}) });
        initialEdit.current = editSnapshot(r.items, general, [], new Map(), new Map());
        setReady(true);
      })
      .catch(() => { if (live) setLoadError("Could not load the selection — check your connection."); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId, loadTry]);

  useEffect(() => {
    let live = true;
    locationsAction()
      .then((r) => { if (!live) return; if ("error" in r) setLocationsError(r.error); else setLocations(r); })
      .catch(() => { if (live) setLocationsError("Could not load districts."); });
    return () => { live = false; };
  }, []);

  // Matching: debounced, newest response wins; filters auto-save on the lead.
  const seq = useRef(0);
  // Names of every project seen in results, for selections that later drop out
  // (seeded with the favorites' names, which may never show up in results).
  const knownNames = useRef(new Map<string, string>(Object.entries(seed?.preselectNames ?? {})));
  // Edit: the last match seen per project, so a ticked project can still be
  // added after the filters moved on.
  const knownMatches = useRef(new Map<string, DevelopmentMatch>());
  const runMatch = (f: MatchFilters) => {
    const my = ++seq.current;
    setLoading(true);
    matchAction(lead.id, f)
      .then((r) => {
        if (my !== seq.current) return;
        if (Array.isArray(r)) {
          r.forEach((m) => { knownNames.current.set(m.development.id, m.development.publicName); knownMatches.current.set(m.development.id, m); });
          setResults(r); setMatchError(null);
        } else { setResults([]); setMatchError(r.error); }
      })
      .catch(() => { if (my === seq.current) { setResults([]); setMatchError("Could not load matches — check your connection."); } })
      .finally(() => { if (my === seq.current) setLoading(false); });
  };
  useEffect(() => {
    if (!ready) return;
    setManuallyUnchecked(new Set());
    setLoading(true);
    const t = setTimeout(() => {
      runMatch(filters);
      // Editing an old selection must not overwrite the lead's last search;
      // its filters are saved on the selection itself (criteria) instead.
      if (!isEdit) saveFiltersAction(lead.id, filters).catch(() => {}); // best-effort, silent
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, ready]);

  // 100 % matches with at least one exactly matching unit tick themselves;
  // ones the auto-check ticked earlier untick when they drop below 100 %.
  // Hand picks are never touched (they are never in autoSelected).
  const hundredIds = useMemo(
    () => new Set(results.filter((m) => m.score === 100 && m.development.unitsAvailable > 0).map((m) => m.development.id)),
    [results],
  );
  useEffect(() => {
    // Edit adds projects by hand only, as the old edit page did.
    if (!results.length || isEdit) return;
    const auto = new Set<string>();
    hundredIds.forEach((id) => {
      if (manuallyUnchecked.has(id)) return;
      // Already ticked by hand: stays a hand pick, not owned by the auto-check.
      if (selectedDevs.has(id) && !autoSelected.has(id)) return;
      auto.add(id);
    });
    setSelectedDevs((prev) => {
      const next = new Set(prev);
      autoSelected.forEach((id) => { if (!hundredIds.has(id)) next.delete(id); });
      auto.forEach((id) => next.add(id));
      return next;
    });
    setAutoSelected(auto);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results]);

  useEffect(() => {
    if (!greetingTouched) setGreetingName(suggestedGreeting(locale, lead.firstName));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  const toggleDev = (id: string) => {
    const wasOn = selectedDevs.has(id);
    setSelectedDevs((prev) => toggleIn(prev, id));
    setManuallyUnchecked((mu) => {
      if (wasOn) return addTo(mu, id);
      if (!mu.has(id)) return mu;
      const s = new Set(mu); s.delete(id); return s;
    });
    // Either direction is deliberate: no longer owned by the auto-check.
    setAutoSelected((prev) => { if (!prev.has(id)) return prev; const s = new Set(prev); s.delete(id); return s; });
  };
  const toggleUnit = (devId: string, unitId: string, allAvailableIds: string[]) => {
    setUnitOverrides((prev) => {
      const n = new Map(prev);
      const next = new Set(n.get(devId) ?? new Set(allAvailableIds)); // start from "all" so unchecking narrows it
      if (next.has(unitId)) next.delete(unitId); else next.add(unitId);
      // Back to the full default set: drop the override.
      if (next.size === allAvailableIds.length && allAvailableIds.every((id) => next.has(id))) n.delete(devId);
      else n.set(devId, next);
      return n;
    });
  };

  const selectedIds = useMemo(() => Array.from(selectedDevs), [selectedDevs]);
  const selectedCount = selectedIds.length;
  // Edit: projects already in the selection are not offered again.
  const itemIds = useMemo(() => new Set(items.map((i) => i.developmentId)), [items]);
  const shownResults = useMemo(() => (isEdit ? results.filter((m) => !itemIds.has(m.development.id)) : results), [isEdit, results, itemIds]);
  const pendingCount = isEdit ? selectedIds.filter((id) => !itemIds.has(id)).length : 0;
  const mapMarkers = useMemo<MatchingMapMarker[]>(() => results
    .filter((m) => selectedDevs.has(m.development.id) && m.development.lat != null && m.development.lng != null)
    .map((m) => {
      const d = m.development;
      return {
        id: d.id, lat: d.lat as number, lng: d.lng as number, title: d.publicName, image: d.mainImage, price: d.priceFrom,
        city: [d.area, d.district || d.town].filter(Boolean).join(", ") || null,
        href: d.publishStatus === "published" && d.slug ? `/projects/${d.slug}` : null,
      };
    }), [results, selectedDevs]);
  const selectedWithoutPin = results.filter((m) => selectedDevs.has(m.development.id) && (m.development.lat == null || m.development.lng == null)).length;
  const unitCount = useMemo(() => {
    let total = 0;
    results.forEach((m) => {
      if (!selectedDevs.has(m.development.id)) return;
      const ov = unitOverrides.get(m.development.id);
      total += ov ? ov.size : m.development.unitsAvailable;
    });
    return total;
  }, [results, selectedDevs, unitOverrides]);

  // MapLibre sizes its canvas once and fits the pins at mount; inside the
  // dialog the column can still change width afterwards. Mount the map only
  // once its box has a real width, and remount it (refit) when the width
  // changes noticeably.
  const mapBox = useRef<HTMLDivElement | null>(null);
  const [mapWidth, setMapWidth] = useState(0);
  const hasPins = mapMarkers.length > 0;
  useEffect(() => {
    const el = mapBox.current;
    if (!hasPins || !el) { setMapWidth(0); return; }
    if (typeof ResizeObserver === "undefined") { setMapWidth(el.clientWidth); return; }
    let t: ReturnType<typeof setTimeout> | null = null;
    const ro = new ResizeObserver(() => {
      if (t) clearTimeout(t);
      t = setTimeout(() => setMapWidth(el.clientWidth), 120);
    });
    ro.observe(el);
    return () => { ro.disconnect(); if (t) clearTimeout(t); };
  }, [hasPins]);
  const mapKey = `w${Math.round(mapWidth / 40)}`;

  const dirty = isEdit
    ? !!initialEdit.current && isEditDirty(
      editSnapshot(items, { greetingName, personalNote, locale, advisorId, expiresAt }, selectedIds, unitOverrides, comments),
      initialEdit.current,
    )
    : isDirty({
      picked: selectedIds.filter((id) => !autoSelected.has(id)),
      unpicked: Array.from(manuallyUnchecked).filter((id) => hundredIds.has(id)),
      unitOverrides: overridesRecord(unitOverrides), comments: mapRecord(comments),
      greetingName, personalNote, locale, advisorId,
    }, initialSnapshot.current);

  const hidden = hiddenSelections(selectedIds, shownResults, knownNames.current);

  function closeNow() {
    closeApproved.current = true;
    dlg.current?.close();
  }
  function requestClose() {
    if (generating) return;
    if (showComposeEmail) { setShowComposeEmail(false); return; }
    // After create / save the selection is stored; nothing left to lose.
    if (created || saved || confirmDiscard(dirty, (m) => window.confirm(m))) closeNow();
  }
  function handleClosed() {
    if (closeApproved.current || created || saved) { onClose(); return; }
    try { dlg.current?.showModal(); } catch { onClose(); }
  }

  async function generate(force = false) {
    if (generating || loading) return;
    setGenError("");
    const dropped = droppedSelections(selectedIds, unitOverrides, results);
    if (dropped.length && !force) { setDropWarning(dropped); return; }
    setDropWarning(null);
    const items = buildItems(selectedIds, unitOverrides, comments, results);
    if (!items.length) { setGenError("Nothing left to send — every selected project has no matching unit."); return; }
    setGenerating(true);
    try {
      // criteria: the full filter state, snapshotted as the client's "your preferences".
      const r = await createPresentationAction(lead.id, { greetingName, personalNote, advisorId, locale, items, criteria: filters });
      if ("error" in r) { setGenError(r.error); return; }
      setCreated(r);
      router.refresh();
    } catch {
      setGenError("Could not create the presentation — check your connection and try again.");
    } finally {
      setGenerating(false);
    }
  }

  // ---- Edit: the selection's items ----
  const patchItem = (id: string, patch: Partial<EditorItem>) =>
    setItems((prev) => prev.map((it) => (it.developmentId === id ? { ...it, ...patch } : it)));
  function moveItem(index: number, dir: -1 | 1) {
    setItems((prev) => {
      const j = index + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = prev.slice();
      const t = next[index]; next[index] = next[j]; next[j] = t;
      return next;
    });
  }
  function toggleItemUnit(id: string, unitId: string) {
    setItems((prev) => prev.map((it) => {
      if (it.developmentId !== id) return it;
      const on = it.checkedUnitIds.includes(unitId);
      return { ...it, checkedUnitIds: on ? it.checkedUnitIds.filter((u) => u !== unitId) : it.checkedUnitIds.concat(unitId) };
    }));
  }
  function removeItem(it: EditorItem) {
    if (!removeItemConfirm(it, favoritedIds, (m) => window.confirm(m))) return;
    setItems((prev) => prev.filter((x) => x.developmentId !== it.developmentId));
  }
  /** Projects ticked in "Add projects", as selection items. */
  function pendingItems(): EditorItem[] {
    const out: EditorItem[] = [];
    selectedIds.forEach((id) => {
      const m = knownMatches.current.get(id);
      if (m && !itemIds.has(id)) out.push(editorItemFromMatch(m, unitOverrides.get(id), comments.get(id) ?? ""));
    });
    return out;
  }
  const dropFrom = <V,>(m: Map<string, V>, ids: string[]) => { const n = new Map(m); ids.forEach((id) => n.delete(id)); return n; };
  /** Moves the ticked projects up into "In this selection", where alias and units can be set. */
  function addPicked() {
    const add = pendingItems();
    if (!add.length) return;
    const ids = add.map((a) => a.developmentId);
    setItems((prev) => prev.concat(add));
    setSelectedDevs(new Set());
    setUnitOverrides((p) => dropFrom(p, ids));
    setComments((p) => dropFrom(p, ids));
  }

  async function saveEdit(force = false) {
    if (!editId || generating || !ready) return;
    if (pendingCount > 0 && loading) return;
    setGenError("");
    // Still-ticked projects count too: nothing ticked is silently lost.
    const all = items.concat(pendingItems());
    if (!all.length) { setGenError("At least one project is required."); return; }
    const empty = emptyEditItems(all);
    if (empty.length && !force) { setDropWarning(empty.map((e) => e.publicName)); return; }
    setDropWarning(null);
    const emptyIds = new Set(empty.map((e) => e.developmentId));
    const kept = all.filter((it) => !emptyIds.has(it.developmentId));
    if (!kept.length) { setGenError("Nothing left to save — every project has no unit selected."); return; }
    setGenerating(true);
    try {
      // criteria: the add panel's filters, re-snapshotted like the old edit page.
      const r = await savePresentationEditAction(editId, {
        greetingName, locale, personalNote, advisorId, expiresAt, items: editPayloadItems(kept), criteria: filters,
      });
      if ("error" in r) { setGenError(r.error); return; }
      setSaved({ url: r.url, whatsappUrl: r.whatsappUrl, summary: r.summary });
      router.refresh();
    } catch {
      setGenError("Could not save — check your connection and try again.");
    } finally {
      setGenerating(false);
    }
  }

  const status = loading ? "Matching…" : matchError ? null : `${shownResults.length} project${shownResults.length === 1 ? "" : "s"}`;

  return (
    <dialog
      ref={dlg} className="crm-dialog crm-pres-dialog" aria-labelledby="crm-pres-h"
      onClose={handleClosed}
      // Esc is handled on keydown so the native cancel never fires: Chromium
      // stops honouring preventDefault on a second cancel without activation.
      onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); requestClose(); } }}
      onCancel={(e) => { e.preventDefault(); requestClose(); }}
      onMouseDown={(e) => { downOnBackdrop.current = e.target === e.currentTarget; }}
      onClick={(e) => { if (e.target === e.currentTarget && downOnBackdrop.current) requestClose(); downOnBackdrop.current = false; }}
    >
      {created ? (
        <div className="crm-pres-body">
          <PresentationCreated created={created} hasEmail={!!lead.email} onEmail={() => setShowComposeEmail(true)} onClose={closeNow} />
        </div>
      ) : saved ? (
        <div className="crm-pres-body">
          <PresentationSaved saved={saved} onClose={closeNow} />
        </div>
      ) : isEdit && !ready ? (
        <div className="crm-pres-body">
          <div className="crm-pres-head">
            <h2 id="crm-pres-h">Edit presentation</h2>
          </div>
          <div className="crm-pres-scroll">
            {loadError ? (
              <div className="crm-pres-empty" role="alert">
                <p className="crm-dialog-error">{loadError}</p>
                <button type="button" className="crm-btn" onClick={() => setLoadTry((n) => n + 1)}>Try again</button>
              </div>
            ) : (
              <p className="crm-pres-empty crm-muted">Loading the selection…</p>
            )}
          </div>
          <div className="crm-pres-foot">
            <div className="crm-pres-footrow">
              <span className="crm-pres-count" />
              <button type="button" className="crm-btn" onClick={requestClose}>Close</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="crm-pres-body">
          <div className="crm-pres-head">
            <h2 id="crm-pres-h">{isEdit ? "Edit presentation" : "New presentation"}</h2>
            {seed && (
              <p className="crm-muted">
                Started from the client&apos;s favorites: {seed.preselect.length} project{seed.preselect.length === 1 ? "" : "s"} pre-ticked, filters set around them.
              </p>
            )}
          </div>
          <div className="crm-pres-scroll">
            {isEdit && (
              <section className="crm-pres-section" aria-labelledby="crm-pres-sel-h">
                <h3 id="crm-pres-sel-h" className="crm-pres-sectionh">In this selection <span className="crm-muted">({items.length})</span></h3>
                <PresentationSelection
                  items={items} favorited={favoritedIds} expanded={itemsExpanded}
                  onToggleExpand={(id) => setItemsExpanded((p) => toggleIn(p, id))} onMove={moveItem}
                  onAlias={(id, v) => patchItem(id, { aliasName: v })} onComment={(id, v) => patchItem(id, { advisorComment: v })}
                  onToggleUnit={toggleItemUnit} onRemove={removeItem}
                />
              </section>
            )}
            {isEdit && <h3 className="crm-pres-sectionh">Add projects</h3>}
            <PresentationFilters filters={filters} setFilters={setFilters} locations={locations} locationsError={locationsError} status={status} />
            <div className={`crm-pres-grid${mapMarkers.length ? " has-map" : ""}`}>
              <PresentationResults
                results={shownResults} loading={loading} error={matchError} selected={selectedDevs} expanded={expanded} showAll={showAllUnits}
                unitOverrides={unitOverrides} comments={comments} sent={sent}
                onToggleDev={toggleDev} onToggleExpand={(id) => setExpanded((p) => toggleIn(p, id))}
                onToggleShowAll={(id) => setShowAllUnits((p) => toggleIn(p, id))} onToggleUnit={toggleUnit}
                onComment={(id, text) => setComments((p) => new Map(p).set(id, text))} onRetry={() => runMatch(filters)}
              />
              {mapMarkers.length > 0 && (
                <div className="crm-pres-map" ref={mapBox}>
                  {mapWidth > 0 && <MatchingMap key={mapKey} markers={mapMarkers} />}
                  {selectedWithoutPin > 0 && (
                    <p className="crm-muted">{selectedWithoutPin} selected project{selectedWithoutPin === 1 ? " has" : "s have"} no map pin yet and {selectedWithoutPin === 1 ? "is" : "are"} not shown.</p>
                  )}
                </div>
              )}
            </div>
            {hidden.length > 0 && (
              <div className="crm-pres-hidden">
                <span>Also selected (not in current results):</span>
                {hidden.map((h) => (
                  <span key={h.id} className="crm-pres-hiddenitem">
                    {h.name}
                    <button type="button" aria-label={`Untick ${h.name}`} title="Untick" onClick={() => toggleDev(h.id)}>×</button>
                  </span>
                ))}
              </div>
            )}
            {isEdit && pendingCount > 0 && (
              <div className="crm-pres-addrow">
                <button type="button" className="crm-btn" onClick={addPicked}>
                  Add {pendingCount} project{pendingCount === 1 ? "" : "s"} to the selection
                </button>
                <span className="crm-muted">Ticked projects are also added when you save.</span>
              </div>
            )}
            {(isEdit || selectedCount > 0) && (
              <fieldset className={`crm-pres-details${isEdit ? " is-edit" : ""}`}>
                <legend>Presentation details</legend>
                <label className="crm-pres-field">Greeting name
                  <input value={greetingName} onChange={(e) => { setGreetingName(e.target.value); setGreetingTouched(true); }} />
                </label>
                <label className="crm-pres-field">Locale
                  <select value={locale} onChange={(e) => setLocale(e.target.value as Locale)}>
                    {PUBLIC_LOCALES.map((l) => <option key={l} value={l}>{l.toUpperCase()}</option>)}
                  </select>
                </label>
                <label className="crm-pres-field">Advisor
                  <select value={advisorId} onChange={(e) => setAdvisorId(e.target.value)}>
                    <option value="">—</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </label>
                {isEdit && (
                  <label className="crm-pres-field">Expires
                    <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
                  </label>
                )}
                <label className="crm-pres-field wide">Personal note (optional)
                  <textarea value={personalNote} onChange={(e) => setPersonalNote(e.target.value)} rows={2}
                    placeholder="A short message shown as a signed note on the client's page…" />
                </label>
              </fieldset>
            )}
          </div>
          <div className="crm-pres-foot">
            {dropWarning && (
              <div className="crm-pres-drop" role="alert">
                <p>
                  {dropWarning.length} project{dropWarning.length === 1 ? "" : "s"} {dropWarning.length === 1 ? "has" : "have"} no unit {isEdit ? "selected" : "matching your filter exactly"} — {dropWarning.length === 1 ? "it" : "they"} will be {isEdit ? "removed from" : "left out of"} this presentation:
                </p>
                <ul>{dropWarning.map((n) => <li key={n}>{n}</li>)}</ul>
                <div className="crm-pres-dropbtns">
                  {isEdit
                    ? <button type="button" className="crm-btn" onClick={() => void saveEdit(true)} disabled={generating}>Save anyway (removing these)</button>
                    : <button type="button" className="crm-btn" onClick={() => void generate(true)} disabled={generating || loading}>Generate anyway (excluding these)</button>}
                  <button type="button" className="crm-linkbtn" onClick={() => setDropWarning(null)}>Cancel — let me adjust</button>
                </div>
              </div>
            )}
            {genError && <p className="crm-dialog-error" role="alert">{genError}</p>}
            <div className="crm-pres-footrow">
              <span className="crm-pres-count">
                {isEdit
                  ? `${items.length} project${items.length === 1 ? "" : "s"} in the selection${pendingCount ? ` · ${pendingCount} to add` : ""}`
                  : selectedCount > 0
                    ? `${selectedCount} project${selectedCount === 1 ? "" : "s"} / ${unitCount} unit${unitCount === 1 ? "" : "s"} selected`
                    : <span className="crm-muted">Tick projects to build the selection.</span>}
              </span>
              <button type="button" className="crm-btn" onClick={requestClose} disabled={generating}>Cancel</button>
              {isEdit ? (
                <button type="button" className="crm-btn primary" onClick={() => void saveEdit()} disabled={generating || (pendingCount > 0 && loading)}
                  title={pendingCount > 0 && loading ? "Wait for the matching to finish" : undefined}>
                  {generating ? "Saving…" : "Save changes"}
                </button>
              ) : (
                <button type="button" className="crm-btn primary" onClick={() => void generate()} disabled={generating || loading || selectedCount === 0}
                  title={loading ? "Wait for the matching to finish" : undefined}>
                  {generating ? "Generating…" : "Generate Client Presentation"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {showComposeEmail && created && lead.email && (() => {
        const t = PRESENTATION_EMAIL_TEMPLATE[locale](greetingName, created.url);
        return (
          <ComposeEmailModal
            leadEmail={lead.email}
            initialSubject={t.subject}
            initialBody={t.body}
            presentationToken={created.token}
            showLeadReacted={false}
            sendAction={async (opts) => {
              try {
                const r = await sendPresentationEmailAction(lead.id, opts);
                if ("ok" in r) router.refresh();
                return r;
              } catch {
                return { error: "Could not send — check your connection and try again." };
              }
            }}
            onClose={() => setShowComposeEmail(false)}
          />
        );
      })()}
    </dialog>
  );
}
