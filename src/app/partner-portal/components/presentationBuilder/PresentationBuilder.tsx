"use client";
/**
 * Partner presentation builder (2026-11-11): the CRM's "New / Edit presentation" flow in the portal
 * (src/app/crm/components/PresentationModal.tsx) — filters, scored matches, auto-tick of 100 % matches,
 * unit picks, name and note per project, map of the selection, sent-before marks — with the same pure
 * helpers, so partner and CRM build identical presentations. The server re-checks everything.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import type { MatchingMapMarker } from "@/app/admin/(panel)/crm/[id]/MatchingMap";
import {
  buildItems, editPayloadItems, editorItemFromMatch, emptyEditItems, hiddenSelections, selectionMatches, sortResults, type ResultSort,
} from "@/app/crm/components/presentationModalState";
import type { DevelopmentMatch, MatchFilters } from "@/lib/crm/matching";
import type { EditorItem } from "@/lib/crm/presentations/editorItems";
import type { LocationOptions } from "@/lib/crm/presentations/locations";
import type { PartnerDict, PartnerLocale } from "@/lib/partner/i18n";
import {
  createPartnerPresentationAction, loadPartnerPresentationAction, partnerBuilderContextAction, partnerFavoritesSeedAction,
  partnerLocationsAction, partnerMatchAction, savePartnerPresentationAction, type BuilderContext, type ShareLinks,
} from "../../presentationBuilderActions";
import { LANG_OPTIONS, fill, say } from "../forms";
import { BuilderFilters } from "./BuilderFilters";
import { BuilderResults, type Fmt } from "./BuilderResults";
import { BuilderSelection } from "./BuilderSelection";
import { BuilderDone } from "./BuilderDone";

// MapLibre touches window: client-only.
const MatchingMap = dynamic(() => import("@/app/admin/(panel)/crm/[id]/MatchingMap"), { ssr: false });

// Mirrors MAX_PRESENTATION_PROJECTS / GREETING_NAME_MAX / PERSONAL_NOTE_MAX (the server re-checks).
const MAX_PROJECTS = 12;
const GREETING_MAX = 60;
const NOTE_MAX = 600;
const STORE = (claimId: string) => `pp-pres-filters:${claimId}`;

export type BuilderClient = { claimId: string; name: string; firstName: string; locale: PartnerLocale };
export type BuilderMode = { kind: "new"; claimId?: string } | { kind: "edit"; id: string } | { kind: "favorites"; id: string };

const toggleIn = (s: Set<string>, id: string) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; };
const dropFrom = <V,>(m: Map<string, V>, ids: string[]) => { const n = new Map(m); ids.forEach((id) => n.delete(id)); return n; };

function readStored(claimId: string): MatchFilters | null {
  try {
    const raw = window.localStorage.getItem(STORE(claimId));
    const v = raw ? JSON.parse(raw) : null;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as MatchFilters) : null;
  } catch { return null; }
}
function writeStored(claimId: string, f: MatchFilters) {
  try { window.localStorage.setItem(STORE(claimId), JSON.stringify(f)); } catch { /* private mode: not remembered */ }
}

export function PresentationBuilder({ t, locale: uiLocale, clients, mode, projectBase }: {
  t: PartnerDict; locale: PartnerLocale; clients: BuilderClient[]; mode: BuilderMode;
  /** Public project link prefix for the portal language ("https://cyprusvipestates.com/de/projects/"). */
  projectBase: string;
}) {
  const B = t.presBuilder;
  const P = t.presentations;
  const router = useRouter();
  const isEdit = mode.kind === "edit";
  const fmt: Fmt = useMemo(() => {
    const money = new Intl.NumberFormat(uiLocale, { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
    const day = new Intl.DateTimeFormat(uiLocale, { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Nicosia" });
    return { money: (n) => (n == null ? "—" : money.format(n)), day: (d) => day.format(d) };
  }, [uiLocale]);
  const projectUrl = (slug: string | null) => (slug ? `${projectBase}${encodeURIComponent(slug)}` : null);

  const [claimId, setClaimId] = useState(mode.kind === "new" ? mode.claimId ?? "" : "");
  const [ctx, setCtx] = useState<BuilderContext | null>(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadTry, setLoadTry] = useState(0);
  const [seedNote, setSeedNote] = useState(false);

  const [filters, setFilters] = useState<MatchFilters>({});
  const [locations, setLocations] = useState<LocationOptions | null>(null);
  const [locationsError, setLocationsError] = useState<string | null>(null);
  const [results, setResults] = useState<DevelopmentMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [sort, setSort] = useState<ResultSort>("match");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [manuallyUnchecked, setManuallyUnchecked] = useState<Set<string>>(new Set());
  const [autoSelected, setAutoSelected] = useState<Set<string>>(new Set());
  const [unitOverrides, setUnitOverrides] = useState<Map<string, Set<string>>>(new Map());
  const [comments, setComments] = useState<Map<string, string>>(new Map());
  const [aliases, setAliases] = useState<Map<string, string>>(new Map());
  const [capHit, setCapHit] = useState(false);

  const [greetingName, setGreetingName] = useState("");
  const [personalNote, setPersonalNote] = useState("");
  const [locale, setLocale] = useState<PartnerLocale>(uiLocale);
  const [expiresAt, setExpiresAt] = useState("");
  const [items, setItems] = useState<EditorItem[]>([]);
  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(new Set());
  const [itemsExpanded, setItemsExpanded] = useState<Set<string>>(new Set());
  const [editMeta, setEditMeta] = useState<{ id: string; clientName: string; url: string } | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ url: string; updated: boolean; share: ShareLinks } | null>(null);
  const dirty = useRef(false);

  const knownNames = useRef(new Map<string, string>());
  const knownMatches = useRef(new Map<string, DevelopmentMatch>());

  useEffect(() => {
    let live = true;
    partnerLocationsAction()
      .then((r) => { if (!live) return; if ("error" in r) setLocationsError(B.districtsError); else setLocations(r); })
      .catch(() => { if (live) setLocationsError(B.districtsError); });
    return () => { live = false; };
  }, [B.districtsError]);

  // Load: a new presentation starts when a client is picked; edit and favourites load their presentation.
  useEffect(() => {
    let live = true;
    setReady(false); setLoadError(null);
    const fail = (e: string) => { if (live) setLoadError(say(t, e)); };
    if (mode.kind === "edit") {
      loadPartnerPresentationAction(mode.id).then((r) => {
        if (!live) return;
        if ("error" in r) { fail(r.error); return; }
        const p = r.presentation;
        setClaimId(p.claimId); setCtx(r.context); setItems(r.items); setFavoritedIds(new Set(r.favoritedIds));
        setGreetingName(p.greetingName); setPersonalNote(p.personalNote); setLocale(p.locale); setExpiresAt(p.expiresAt);
        setFilters(p.criteria); setEditMeta({ id: p.id, clientName: p.clientName, url: p.url });
        setReady(true);
      }).catch(() => fail("err.generic"));
    } else if (mode.kind === "favorites") {
      partnerFavoritesSeedAction(mode.id).then(async (seed) => {
        if (!live) return;
        if ("error" in seed) { fail(seed.error); return; }
        const c = await partnerBuilderContextAction(seed.claimId);
        if (!live) return;
        if ("error" in c) { fail(c.error); return; }
        const client = clients.find((x) => x.claimId === seed.claimId);
        Object.entries(seed.preselectNames).forEach(([id, n]) => knownNames.current.set(id, n));
        setClaimId(seed.claimId); setCtx(c); setFilters(seed.filters);
        setSelected(new Set(seed.preselect.slice(0, MAX_PROJECTS)));
        setGreetingName((client?.firstName || c.firstName).slice(0, GREETING_MAX)); setLocale(client?.locale ?? uiLocale);
        setSeedNote(true); setReady(true);
      }).catch(() => fail("err.generic"));
    }
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode.kind, mode.kind === "new" ? "" : mode.id, loadTry]);

  function pickClient(id: string) {
    if (dirty.current && !window.confirm(B.discard)) return;
    dirty.current = false;
    setClaimId(id); setReady(false); setCtx(null); setResults([]); setSelected(new Set()); setManuallyUnchecked(new Set());
    setAutoSelected(new Set()); setUnitOverrides(new Map()); setComments(new Map()); setAliases(new Map()); setError(null);
    if (!id) return;
    const client = clients.find((c) => c.claimId === id);
    setGreetingName((client?.firstName ?? "").slice(0, GREETING_MAX));
    setLocale(client?.locale ?? uiLocale);
    partnerBuilderContextAction(id).then((c) => {
      if ("error" in c) { setLoadError(say(t, c.error)); return; }
      setCtx(c);
      setFilters({ ...c.filters, ...(readStored(id) ?? {}) });
      setReady(true);
    }).catch(() => setLoadError(say(t, "err.generic")));
  }
  useEffect(() => {
    if (mode.kind === "new" && mode.claimId && clients.some((c) => c.claimId === mode.claimId)) pickClient(mode.claimId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Matching: debounced, newest response wins; a new presentation remembers the filters per client.
  const seq = useRef(0);
  const runMatch = (f: MatchFilters) => {
    if (!claimId) return;
    const my = ++seq.current;
    setLoading(true);
    partnerMatchAction(claimId, f)
      .then((r) => {
        if (my !== seq.current) return;
        if (Array.isArray(r)) {
          r.forEach((m) => { knownNames.current.set(m.development.id, m.development.publicName); knownMatches.current.set(m.development.id, m); });
          setResults(r); setMatchError(null);
        } else { setResults([]); setMatchError(say(t, r.error)); }
      })
      .catch(() => { if (my === seq.current) { setResults([]); setMatchError(B.matchError); } })
      .finally(() => { if (my === seq.current) setLoading(false); });
  };
  useEffect(() => {
    if (!ready || !claimId) return;
    setLoading(true);
    const h = setTimeout(() => {
      runMatch(filters);
      if (mode.kind === "new") writeStored(claimId, filters);
    }, 350);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, ready, claimId]);

  const selectedIds = useMemo(() => Array.from(selected), [selected]);
  const itemIds = useMemo(() => new Set(items.map((i) => i.developmentId)), [items]);
  const shown = useMemo(() => (isEdit ? results.filter((m) => !itemIds.has(m.development.id)) : results), [isEdit, results, itemIds]);
  const districtSortable = (filters.districts ?? []).length !== 1;
  const effectiveSort: ResultSort = sort === "district" && !districtSortable ? "match" : sort;
  const sorted = useMemo(() => sortResults(shown, effectiveSort, unitOverrides), [shown, effectiveSort, unitOverrides]);
  const pendingIds = isEdit ? selectedIds.filter((id) => !itemIds.has(id)) : selectedIds;
  const total = (isEdit ? items.length : 0) + pendingIds.length;
  const room = MAX_PROJECTS - total;

  // 100 % matches with a matching unit tick themselves (new presentations only), within the 12-project cap.
  useEffect(() => {
    if (!results.length || isEdit) return;
    const hundred = new Set(results.filter((m) => m.score === 100 && m.development.unitsAvailable > 0).map((m) => m.development.id));
    const next = new Set(selected);
    autoSelected.forEach((id) => { if (!hundred.has(id)) next.delete(id); });
    const auto = new Set<string>();
    hundred.forEach((id) => {
      if (manuallyUnchecked.has(id)) return;
      if (selected.has(id) && !autoSelected.has(id)) return;
      if (!next.has(id) && next.size >= MAX_PROJECTS) return;
      next.add(id); auto.add(id);
    });
    setSelected(next);
    setAutoSelected(auto);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results]);

  const toggleDev = (id: string) => {
    const wasOn = selected.has(id);
    if (!wasOn && room <= 0) { setCapHit(true); return; }
    setCapHit(false);
    dirty.current = true;
    setSelected((p) => toggleIn(p, id));
    setManuallyUnchecked((mu) => { const s = new Set(mu); if (wasOn) s.add(id); else s.delete(id); return s; });
    setAutoSelected((p) => { if (!p.has(id)) return p; const s = new Set(p); s.delete(id); return s; });
  };
  const toggleUnit = (devId: string, unitId: string, defaultIds: string[]) => {
    dirty.current = true;
    setAutoSelected((p) => { if (!p.has(devId)) return p; const s = new Set(p); s.delete(devId); return s; });
    setUnitOverrides((prev) => {
      const n = new Map(prev);
      const next = new Set(n.get(devId) ?? new Set(defaultIds));
      if (next.has(unitId)) next.delete(unitId); else next.add(unitId);
      if (next.size === defaultIds.length && defaultIds.every((x) => next.has(x))) n.delete(devId); else n.set(devId, next);
      return n;
    });
  };

  const picked = useMemo(() => selectionMatches(selectedIds, results, knownMatches.current), [selectedIds, results]);
  const mapMarkers = useMemo<MatchingMapMarker[]>(() => {
    const fromMatches = picked.filter((m) => selected.has(m.development.id));
    const fromItems = isEdit ? items.map((it) => knownMatches.current.get(it.developmentId)).filter((m): m is DevelopmentMatch => !!m) : [];
    return fromMatches.concat(fromItems)
      .filter((m) => m.development.lat != null && m.development.lng != null)
      .map((m) => {
        const d = m.development;
        return {
          id: d.id, lat: d.lat as number, lng: d.lng as number, title: d.publicName, image: d.mainImage, price: d.priceFrom,
          city: [d.area, d.district || d.town].filter(Boolean).join(", ") || null, href: projectUrl(d.slug),
        };
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked, selected, items, isEdit]);
  const withoutPin = picked.filter((m) => selected.has(m.development.id) && (m.development.lat == null || m.development.lng == null)).length;
  const unitCount = picked.reduce((n, m) => n + (selected.has(m.development.id) ? unitOverrides.get(m.development.id)?.size ?? m.development.unitsAvailable : 0), 0);
  const hidden = hiddenSelections(selectedIds, shown, knownNames.current);

  // MapLibre sizes its canvas at mount: mount once the box has a width, remount when it changes a lot.
  const mapBox = useRef<HTMLDivElement | null>(null);
  const [mapWidth, setMapWidth] = useState(0);
  const hasPins = mapMarkers.length > 0;
  useEffect(() => {
    const el = mapBox.current;
    if (!hasPins || !el) { setMapWidth(0); return; }
    if (typeof ResizeObserver === "undefined") { setMapWidth(el.clientWidth); return; }
    let h: ReturnType<typeof setTimeout> | null = null;
    const ro = new ResizeObserver(() => { if (h) clearTimeout(h); h = setTimeout(() => setMapWidth(el.clientWidth), 120); });
    ro.observe(el);
    return () => { ro.disconnect(); if (h) clearTimeout(h); };
  }, [hasPins]);

  // ---- Edit: items ----
  const patchItem = (id: string, patch: Partial<EditorItem>) => { dirty.current = true; setItems((prev) => prev.map((it) => (it.developmentId === id ? { ...it, ...patch } : it))); };
  const moveItem = (i: number, dir: -1 | 1) => {
    dirty.current = true;
    setItems((prev) => { const j = i + dir; if (j < 0 || j >= prev.length) return prev; const n = prev.slice(); [n[i], n[j]] = [n[j], n[i]]; return n; });
  };
  const toggleItemUnit = (id: string, unitId: string) => patchItem(id, {
    checkedUnitIds: (() => { const it = items.find((x) => x.developmentId === id); if (!it) return []; return it.checkedUnitIds.includes(unitId) ? it.checkedUnitIds.filter((u) => u !== unitId) : it.checkedUnitIds.concat(unitId); })(),
  });
  const removeItem = (it: EditorItem) => {
    if (favoritedIds.has(it.developmentId) && !window.confirm(fill(B.removeFavorite, { name: it.aliasName.trim() || it.publicName }))) return;
    dirty.current = true;
    setItems((prev) => prev.filter((x) => x.developmentId !== it.developmentId));
  };
  function pendingItems(): EditorItem[] {
    return pendingIds.map((id) => {
      const m = knownMatches.current.get(id);
      if (!m) return null;
      const it = editorItemFromMatch(m, unitOverrides.get(id), comments.get(id) ?? "");
      return { ...it, aliasName: aliases.get(id) ?? "" };
    }).filter((x): x is EditorItem => !!x);
  }
  function addPicked() {
    const add = pendingItems();
    if (!add.length) return;
    const ids = add.map((a) => a.developmentId);
    setItems((prev) => prev.concat(add));
    setSelected(new Set()); setUnitOverrides((p) => dropFrom(p, ids)); setComments((p) => dropFrom(p, ids)); setAliases((p) => dropFrom(p, ids));
  }

  async function submit() {
    if (busy || loading) return;
    setError(null);
    if (!greetingName.trim()) { setError(say(t, "err.greetingName")); return; }
    setBusy(true);
    try {
      if (isEdit && editMeta) {
        const all = items.concat(pendingItems());
        const empty = new Set(emptyEditItems(all).map((e) => e.developmentId));
        const kept = all.filter((it) => !empty.has(it.developmentId));
        if (!kept.length) { setError(B.emptySelection); return; }
        const r = await savePartnerPresentationAction(editMeta.id, {
          items: editPayloadItems(kept), greetingName, personalNote, locale, expiresAt, criteria: filters,
        });
        if ("error" in r) { setError(say(t, r.error)); return; }
        dirty.current = false;
        setDone({ url: r.url, updated: true, share: r.share });
      } else {
        const base = buildItems(selectedIds, unitOverrides, comments, picked);
        if (!base.length) { setError(say(t, "err.presentationUnits")); return; }
        const itemsOut = base.map((it) => ({ ...it, aliasName: aliases.get(it.developmentId) ?? "" }));
        const r = await createPartnerPresentationAction({ claimId, items: itemsOut, greetingName, personalNote, locale, criteria: filters });
        if ("error" in r) { setError(say(t, r.error)); return; }
        dirty.current = false;
        setDone({ url: r.url, updated: false, share: r.share });
      }
      router.refresh();
    } catch {
      setError(say(t, "err.generic"));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return <BuilderDone t={t} url={done.url} updated={done.updated} share={done.share} onAgain={() => { window.location.href = "/presentations"; }} />;
  }

  const clientSelect = !isEdit && mode.kind !== "favorites" && (
    <label className="pp-field">
      <span className="pp-label">{P.client}</span>
      <select value={claimId} onChange={(e) => pickClient(e.target.value)}>
        <option value="" disabled>{P.clientPlaceholder}</option>
        {clients.map((c) => <option key={c.claimId} value={c.claimId}>{c.name || "—"}</option>)}
      </select>
    </label>
  );

  if (loadError) {
    return (
      <div className="pp-pb" role="alert">
        <p className="pp-err">{loadError}</p>
        {mode.kind !== "new" && <button type="button" className="pp-btn pp-btn-ghost" onClick={() => setLoadTry((n) => n + 1)}>{B.retry}</button>}
      </div>
    );
  }
  if (!clients.length && mode.kind === "new") return <p className="pp-alert pp-alert-neutral">{P.noClients}</p>;

  return (
    <div className="pp-pb">
      {editMeta && <p className="pp-muted">{P.client}: <b>{editMeta.clientName}</b></p>}
      {clientSelect}
      {seedNote && <p className="pp-muted pp-small">{B.fromFavoritesNote}</p>}
      {!claimId ? (
        mode.kind === "new" && <p className="pp-muted">{B.chooseClientFirst}</p>
      ) : !ready ? (
        <p className="pp-muted">{B.loading}</p>
      ) : (
        <>
          {isEdit && (
            <section className="pp-pb-section" aria-labelledby="pp-pb-sel-h">
              <h3 className="pp-h3" id="pp-pb-sel-h">{fill(B.inPresentation, { n: String(items.length) })}</h3>
              <BuilderSelection t={t} fmt={fmt} items={items} favorited={favoritedIds} expanded={itemsExpanded}
                onToggleExpand={(id) => setItemsExpanded((p) => toggleIn(p, id))} onMove={moveItem}
                onAlias={(id, v) => patchItem(id, { aliasName: v })} onComment={(id, v) => patchItem(id, { advisorComment: v })}
                onToggleUnit={toggleItemUnit} onRemove={removeItem} />
              <h3 className="pp-h3">{B.addProjects}</h3>
            </section>
          )}
          <BuilderFilters t={t} lang={uiLocale} filters={filters} setFilters={(fn) => { dirty.current = true; setFilters(fn); }} locations={locations} locationsError={locationsError} />
          <div className="pp-pb-bar">
            <span aria-live="polite">{loading ? B.loading : matchError ? "" : fill(B.count, { n: String(shown.length) })}</span>
            <label className="pp-pb-sort">{B.sort}
              <select value={effectiveSort} onChange={(e) => setSort(e.target.value as ResultSort)}>
                <option value="match">{B.sortMatch}</option>
                <option value="delivery">{B.sortDelivery}</option>
                <option value="price">{B.sortPrice}</option>
                {districtSortable && <option value="district">{B.sortDistrict}</option>}
                <option value="area">{B.sortArea}</option>
              </select>
            </label>
          </div>
          {capHit && <p className="pp-alert pp-alert-neutral" role="status">{B.capReached}</p>}
          <div className={`pp-pb-grid${hasPins ? " has-map" : ""}`}>
            <BuilderResults t={t} fmt={fmt} results={sorted} loading={loading} error={matchError} selected={selected} expanded={expanded} showAll={showAll}
              unitOverrides={unitOverrides} comments={comments} aliases={aliases} sent={ctx?.sent ?? {}}
              onToggleDev={toggleDev} onToggleExpand={(id) => setExpanded((p) => toggleIn(p, id))} onToggleShowAll={(id) => setShowAll((p) => toggleIn(p, id))}
              onToggleUnit={toggleUnit} onComment={(id, v) => { dirty.current = true; setComments((p) => new Map(p).set(id, v)); }}
              onAlias={(id, v) => { dirty.current = true; setAliases((p) => new Map(p).set(id, v)); }}
              onRetry={() => runMatch(filters)} projectUrl={projectUrl} />
            {hasPins && (
              <div className="pp-pb-map" ref={mapBox} aria-label={B.mapTitle}>
                {mapWidth > 0 && <MatchingMap key={`w${Math.round(mapWidth / 40)}`} markers={mapMarkers} lang={uiLocale} />}
                {withoutPin > 0 && <p className="pp-muted pp-small">{fill(B.mapNoPin, { n: String(withoutPin) })}</p>}
              </div>
            )}
          </div>
          {hidden.length > 0 && (
            <div className="pp-pb-hidden">
              <span>{B.hiddenSelected}</span>
              {hidden.map((h) => (
                <span key={h.id} className="pp-pb-hiddenitem">{h.name}
                  <button type="button" aria-label={`${B.untick}: ${h.name}`} title={B.untick} onClick={() => toggleDev(h.id)}>×</button>
                </span>
              ))}
            </div>
          )}
          {isEdit && pendingIds.length > 0 && (
            <div className="pp-pb-addrow">
              <button type="button" className="pp-btn pp-btn-ghost" onClick={addPicked}>{B.addProjects} ({pendingIds.length})</button>
            </div>
          )}

          <fieldset className="pp-fieldset pp-pb-details">
            <legend>{B.selectionTitle}</legend>
            <div className="pp-row">
              <label className="pp-field"><span className="pp-label">{P.greetingName}</span>
                <input value={greetingName} maxLength={GREETING_MAX} onChange={(e) => { dirty.current = true; setGreetingName(e.target.value); }} />
                <small className="pp-hint">{P.greetingNameHint}</small>
              </label>
              <label className="pp-field"><span className="pp-label">{P.language}</span>
                <select value={locale} onChange={(e) => { dirty.current = true; setLocale(e.target.value as PartnerLocale); }}>
                  {LANG_OPTIONS.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                </select>
              </label>
              {isEdit && (
                <label className="pp-field"><span className="pp-label">{B.expiresAt}</span>
                  <input type="date" value={expiresAt} onChange={(e) => { dirty.current = true; setExpiresAt(e.target.value); }} />
                  <small className="pp-hint">{B.expiresHint}</small>
                </label>
              )}
            </div>
            <label className="pp-field"><span className="pp-label">{P.personalNote}</span>
              <textarea rows={3} maxLength={NOTE_MAX} value={personalNote} onChange={(e) => { dirty.current = true; setPersonalNote(e.target.value); }} />
              <small className="pp-hint">{P.personalNoteHint}</small>
            </label>
            {!isEdit && <p className="pp-muted pp-small">{P.validity} {P.brandingHint}</p>}
          </fieldset>

          {error && <p className="pp-err" role="alert">{error}</p>}
          <div className="pp-pb-foot">
            <span className="pp-muted">
              {isEdit ? fill(B.inPresentation, { n: String(items.length + pendingIds.length) })
                : fill(B.selectionCount, { n: String(selectedIds.length), units: String(unitCount) })}
            </span>
            {isEdit && <a className="pp-btn pp-btn-ghost" href="/presentations">{B.cancel}</a>}
            <button type="button" className="pp-btn" onClick={() => void submit()}
              disabled={busy || loading || (isEdit ? items.length + pendingIds.length === 0 : selectedIds.length === 0)}>
              {busy ? (isEdit ? B.saving : B.creating) : isEdit ? B.save : P.create}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
