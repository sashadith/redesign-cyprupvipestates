"use client";

// The /projects catalog map — and the shared source of the pin, POI layer and
// POI category list that the project detail map and the client presentation map
// reuse.
//
// Ported from Leaflet to MapLibre (2026-08): CARTO began stamping "API KEY
// REQUIRED" into every basemap tile served without a registered key, which
// watermarked every map on the site. The replacement is a vector style we own
// (components/map/cveMapStyle.ts) rendered by MapLibre, so the map's colours
// come from design-tokens.css instead of being a tinted third-party image.
//
// COORDINATE ORDER: Leaflet used [lat, lng]; MapLibre uses [lng, lat]. Marker
// data (MapMarker) still carries .lat/.lng, so every call site flips explicitly.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Supercluster from "supercluster";
import { MapContainer, Marker, Popup, useMap, maplibregl } from "@/app/components/map/MapLibre";
import { CYPRUS_BOUNDS, CYPRUS_CENTER } from "@/app/components/map/cveMapStyle";
import type { MapMarker } from "./ProjectsExplorer";
import { topDistances } from "./ProjectCard";
import { projectsStrings, type ProjectsStrings } from "@/app/[lang]/projects/projectsI18n";

const cyprusBounds = () => new maplibregl.LngLatBounds(CYPRUS_BOUNDS[0], CYPRUS_BOUNDS[1]);

const fmtPrice = (p: number | null, s: ProjectsStrings) =>
  p == null ? s.priceOnRequest : `€${p.toLocaleString(s.numLocale)}`;

const validMarkers = (items: MapMarker[]) =>
  (items || []).filter((m) => typeof m.lat === "number" && typeof m.lng === "number" && !Number.isNaN(m.lat) && !Number.isNaN(m.lng));

function debounce<T extends (...a: any[]) => void>(fn: T, wait = 400) {
  let t: any;
  return (...args: Parameters<T>) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

/* Write the visible bbox to the URL only after a user pan/zoom → server re-filters. */
function BoundsSync() {
  const map = useMap();
  const router = useRouter();
  const sp = useSearchParams();
  const userMoved = useRef(false);
  const round = (n: number) => Number(n.toFixed(6));

  const push = useMemo(
    () =>
      debounce((b: maplibregl.LngLatBounds) => {
        if (!userMoved.current) return;
        userMoved.current = false;
        const next = {
          north: String(round(b.getNorth())),
          east: String(round(b.getEast())),
          south: String(round(b.getSouth())),
          west: String(round(b.getWest())),
        };
        if (sp.get("north") === next.north && sp.get("east") === next.east && sp.get("south") === next.south && sp.get("west") === next.west) return;
        const p = new URLSearchParams(sp.toString());
        Object.entries(next).forEach(([k, v]) => p.set(k, v));
        p.delete("page");
        router.replace(`?${p.toString()}`, { scroll: false });
      }, 500),
    [router, sp],
  );

  useEffect(() => {
    if (!map) return;
    const onStart = () => (userMoved.current = true);
    const onEnd = () => push(map.getBounds());
    map.on("dragstart", onStart);
    map.on("zoomstart", onStart);
    map.on("moveend", onEnd);
    return () => {
      map.off("dragstart", onStart);
      map.off("zoomstart", onStart);
      map.off("moveend", onEnd);
    };
  }, [map, push]);

  return null;
}

/* Frame the current filtered result set on open — the SAME markers the mini-map
   preview shows — so opening the full map stays on the filter-set area instead of
   resetting to the whole island. Falls back to a pinned bbox / the whole island
   only when there are no results to frame.

   CRITICAL (carried over from the Leaflet version): the overlay fades in and its
   map is a flex child, so on the first frame the container can report a 0/small
   size — fitBounds would then pick a very low zoom (the whole island). So we
   resize() first and fit AFTER the layout settles: on the next frame and again
   after the fade completes. Runs once per open (the overlay unmounts on close),
   so it never fights the user's own pans. */
function FitBounds({ markers }: { markers: MapMarker[] }) {
  const map = useMap();
  const sp = useSearchParams();
  const markersRef = useRef(markers);
  markersRef.current = markers;
  useEffect(() => {
    if (!map) return;
    let stop = false;
    const fit = () => {
      if (stop) return;
      // NB: do NOT call map.resize() here. This function is also subscribed to the
      // map's own "resize" event, and MapLibre's resize() fires that event
      // unconditionally — resize() → "resize" → fit() → resize() is infinite
      // recursion ("Maximum call stack size exceeded"). Leaflet's invalidateSize()
      // no-opped when the size was unchanged, which is why the original could do
      // both. MapContainer's ResizeObserver owns resizing now.
      // Guard: never fit while the container is still collapsed — a tiny height
      // makes fitBounds choose a whole-island zoom. Wait for a real size instead.
      if (map.getCanvas().clientHeight < 120) return;
      const pts = markersRef.current.map((m) => [m.lng, m.lat] as [number, number]);
      if (pts.length > 0) {
        const b = new maplibregl.LngLatBounds(pts[0], pts[0]);
        for (const p of pts) b.extend(p);
        map.fitBounds(b, { animate: false, maxZoom: 13, padding: 40 });
      } else {
        const N = sp.get("north"), S = sp.get("south"), E = sp.get("east"), W = sp.get("west");
        if (N != null && S != null && E != null && W != null) {
          map.fitBounds(new maplibregl.LngLatBounds([+W, +S], [+E, +N]), { animate: false });
        } else {
          map.fitBounds(cyprusBounds(), { animate: false });
        }
      }
    };
    const raf = requestAnimationFrame(fit);
    const timers = [120, 380, 700].map((ms) => setTimeout(fit, ms));
    map.on("resize", fit);
    const end = setTimeout(() => { stop = true; map.off("resize", fit); }, 900);
    return () => {
      stop = true;
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      clearTimeout(end);
      map.off("resize", fit);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);
  return null;
}

/* ---------------- POIs (local dataset, generated from OpenStreetMap) ---------------- */
type PoiCat = { key: string; label: string; color: string; filter: string; test: (t: any) => boolean };

export const POI_CATS: PoiCat[] = [
  // Private listed before Public so a private school is classified as private
  // (mutually-exclusive classification picks the first matching active cat).
  { key: "school_private", label: "Private School", color: "#A05CFF", filter: '["amenity"="school"]', test: (t) => t.amenity === "school" && (t["operator:type"] === "private" || t.fee === "yes") },
  { key: "school_public", label: "Public School", color: "#2E8BFF", filter: '["amenity"="school"]', test: (t) => t.amenity === "school" && t["operator:type"] !== "private" && t.fee !== "yes" },
  { key: "clinic", label: "Clinics", color: "#FF4D6D", filter: '["amenity"~"^(hospital|clinic|doctors)$"]', test: (t) => ["hospital", "clinic", "doctors"].includes(t.amenity) },
  { key: "supermarket", label: "Supermarkets", color: "#5B5BFF", filter: '["shop"="supermarket"]', test: (t) => t.shop === "supermarket" },
  { key: "pharmacy", label: "Pharmacies", color: "#22C55E", filter: '["amenity"="pharmacy"]', test: (t) => t.amenity === "pharmacy" },
  { key: "beach", label: "Beaches", color: "#22D3EE", filter: '["natural"="beach"]', test: (t) => t.natural === "beach" },
  { key: "restaurant", label: "Restaurants", color: "#E94BE0", filter: '["amenity"="restaurant"]', test: (t) => t.amenity === "restaurant" },
  { key: "golf", label: "Golf", color: "#15803D", filter: '["leisure"="golf_course"]', test: (t) => t.leisure === "golf_course" },
  { key: "airport", label: "Airport", color: "#FF5CA8", filter: '["aeroway"="aerodrome"]', test: (t) => t.aeroway === "aerodrome" },
];

type PoiItem = { id: string; lat: number; lng: number; name: string; color: string; cat: string };

// Local POI dataset — generated once from OSM/Overpass by scripts/import-pois.cjs.
// Fetched a single time per session from our own server, then filtered in memory,
// so toggling/panning is instant (no per-click network round-trip).
type LocalPoi = { lat: number; lng: number; name: string; cat: string; id: string };
let POI_DATA: LocalPoi[] | null = null;
let POI_LOADING: Promise<LocalPoi[]> | null = null;
function loadLocalPois(): Promise<LocalPoi[]> {
  if (POI_DATA) return Promise.resolve(POI_DATA);
  if (!POI_LOADING) {
    POI_LOADING = fetch("/uploads/projects/cyprus.json")
      .then((r) => (r.ok ? r.json() : { pois: [] }))
      .then((j) => {
        POI_DATA = ((j.pois as Array<{ lat: number; lng: number; n?: string; c: string }>) ?? []).map((p, i) => ({
          lat: p.lat, lng: p.lng, name: p.n ?? "", cat: p.c, id: `${p.c}-${i}`,
        }));
        return POI_DATA;
      })
      .catch(() => { POI_DATA = []; return POI_DATA; });
  }
  return POI_LOADING;
}

const POI_COLOR: Record<string, string> = Object.fromEntries(POI_CATS.map((c) => [c.key, c.color]));
const POI_RENDER_CAP = 1200; // safety cap on simultaneously-rendered markers

// A few categories get a dedicated icon instead of a dot (there aren't many).
const POI_SVG: Record<string, string> = {
  // golf = a flag planted on the putting green (hole)
  golf: `<svg viewBox="0 0 24 24" fill="none" stroke="var(--c)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V4l7 2.5L12 9"/><ellipse cx="12" cy="19.3" rx="6" ry="1.9" fill="var(--c)" stroke="none"/></svg>`,
  airport: `<svg viewBox="0 0 24 24" fill="var(--c)"><path d="M21 15.5 13.5 11V4.2a1.5 1.5 0 0 0-3 0V11L3 15.5V17l7.5-2.2V19l-2 1.4V22l3.5-1 3.5 1v-1.6L13.5 19v-4.2z"/></svg>`,
};

/** Marker markup for a POI. Author-controlled only — the colour comes from POI_CATS. */
const poiMarkup = (cat: string) =>
  POI_SVG[cat]
    ? { className: "px-poi-ic", html: `<span>${POI_SVG[cat]}</span>` }
    : { className: "px-poi-pin", html: `<span></span>` };

/* Renders POIs from the local dataset for the visible area (zoom ≥ 11). Data is
   loaded once from our own server and filtered in memory, so toggling categories
   and panning is instant. */
export function PoiLayers({ active, onState }: { active: Set<string>; onState: (s: "idle" | "loading" | "zoom") => void }) {
  const map = useMap();
  const [data, setData] = useState<LocalPoi[] | null>(POI_DATA);
  const [poi, setPoi] = useState<PoiItem[]>([]);
  const activeRef = useRef(active);
  activeRef.current = active;

  // load the local dataset once (module-level cache shared across instances)
  useEffect(() => {
    if (data) return;
    let alive = true;
    if (active.size > 0) onState("loading");
    loadLocalPois().then((d) => { if (alive) setData(d); });
    return () => { alive = false; };
  }, [data, active.size, onState]);

  // filter the in-memory dataset by active categories + the visible bbox
  const refresh = useCallback(() => {
    if (!map) return;
    const cur = activeRef.current;
    if (!data) { onState(cur.size ? "loading" : "idle"); return; }
    if (cur.size === 0) { setPoi([]); onState("idle"); return; }
    if (map.getZoom() < 11) { setPoi([]); onState("zoom"); return; }
    const b = map.getBounds();
    const s = b.getSouth(), n = b.getNorth(), w = b.getWest(), e = b.getEast();
    const out: PoiItem[] = [];
    for (const p of data) {
      if (!cur.has(p.cat)) continue;
      if (p.lat < s || p.lat > n || p.lng < w || p.lng > e) continue;
      out.push({ id: p.id, lat: p.lat, lng: p.lng, name: p.name, color: POI_COLOR[p.cat] ?? "#fff", cat: p.cat });
      if (out.length >= POI_RENDER_CAP) break;
    }
    setPoi(out);
    onState("idle");
  }, [data, map, onState]);

  // re-filter on category toggle and once the dataset has loaded
  useEffect(() => { refresh(); }, [active, refresh]);

  // re-filter on pan/zoom (light debounce; filtering is local/instant)
  useEffect(() => {
    if (!map) return;
    const onMove = debounce(refresh, 150);
    map.on("moveend", onMove);
    return () => { map.off("moveend", onMove); };
  }, [map, refresh]);

  return (
    <>
      {poi.map((p) => {
        const { className, html } = poiMarkup(p.cat);
        return (
          <Marker
            key={p.id}
            lngLat={[p.lng, p.lat]}
            className={className}
            html={html}
            vars={{ "--c": p.color }}
            // OSM-derived text goes through title (a property), never innerHTML.
            title={p.name || undefined}
          />
        );
      })}
    </>
  );
}

// Gesture-handling hint text per site locale (EN / DE / PL / RU). Leaflet needed
// the leaflet-gesture-handling plugin for this; MapLibre has cooperativeGestures
// built in and takes the strings through its `locale` option.
type GestureText = { touch: string; scroll: string; scrollMac: string };
const GESTURE_TEXT: Record<string, GestureText> = {
  en: {
    touch: "Use two fingers to move the map",
    scroll: "Use ctrl + scroll to zoom the map",
    scrollMac: "Use ⌘ + scroll to zoom the map",
  },
  de: {
    touch: "Bewege die Karte mit zwei Fingern",
    scroll: "Nutze Strg + Scrollen, um die Karte zu zoomen",
    scrollMac: "Nutze ⌘ + Scrollen, um die Karte zu zoomen",
  },
  pl: {
    touch: "Przesuń mapę dwoma palcami",
    scroll: "Użyj Ctrl + przewijanie, aby przybliżyć mapę",
    scrollMac: "Użyj ⌘ + przewijanie, aby przybliżyć mapę",
  },
  ru: {
    touch: "Перемещайте карту двумя пальцами",
    scroll: "Используйте Ctrl + прокрутку для масштабирования карты",
    scrollMac: "Используйте ⌘ + прокрутку для масштабирования карты",
  },
};

/** MapLibre `locale` overrides carrying our own gesture copy for the given site language. */
export function gestureLocale(locale: string): Record<string, string> {
  const t = GESTURE_TEXT[locale] ?? GESTURE_TEXT.en;
  return {
    "CooperativeGesturesHandler.WindowsHelpText": t.scroll,
    "CooperativeGesturesHandler.MacHelpText": t.scrollMac,
    "CooperativeGesturesHandler.MobileHelpText": t.touch,
  };
}

/* ---------------- project pins ---------------- */

// The CVE skyline-in-a-diamond emblem. Idle pins carry a glow-stagger class
// (g0..g5) so they flicker out of sync with each other.
const PIN_GLOW = 6;
const pinHtml = `<img class="px-pin__mark" src="/uploads/projects/cve-mark.png" alt="" draggable="false" />`;

/** Class + markup for a project pin, mirroring the old pinIcon() contract. */
export function pinMarkup(active: boolean, variant = 0) {
  return {
    className: `px-pin${active ? " is-active" : ` px-pin--g${variant}`}`,
    html: pinHtml,
  };
}

// Each marker picks a stagger variant deterministically by id hash, so the gems
// flicker independently rather than all in lockstep.
const variantFor = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h) % PIN_GLOW;
};

/* ---------------- clustering ---------------- */

// Leaflet had leaflet.markercluster; MapLibre's own clustering only renders GPU
// layers, which cannot carry our DOM pins (the glow is a CSS animation on an
// <img>). supercluster is the same index MapLibre uses internally — we drive it
// ourselves and render both clusters and single pins as DOM markers.
type ClusterPoint = { type: "Feature"; properties: { id: string }; geometry: { type: "Point"; coordinates: [number, number] } };

function useClusters(map: maplibregl.Map | null, items: MapMarker[], enabled: boolean) {
  const [view, setView] = useState<{ clusters: any[] }>({ clusters: [] });

  // Keyed on the id signature rather than array identity, so an equal-but-new
  // array (a parent re-render) does not rebuild the index.
  const sig = useMemo(() => items.map((m) => m.id).join(","), [items]);
  const index = useMemo(() => {
    if (!enabled) return null;
    const idx = new Supercluster({ radius: 48, maxZoom: 16 });
    idx.load(
      items.map<ClusterPoint>((m) => ({
        type: "Feature",
        properties: { id: m.id },
        geometry: { type: "Point", coordinates: [m.lng, m.lat] },
      })),
    );
    return idx;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, enabled]);

  const lastKey = useRef("");
  const recompute = useCallback(() => {
    if (!map || !index) return;
    const b = map.getBounds();
    const next = index.getClusters([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], Math.round(map.getZoom()));
    // Skip identical results so a moveend that changes nothing cannot feed a
    // render → effect → setState cycle.
    const key = next.map((c: any) => `${c.id ?? c.properties.id}:${c.properties.point_count ?? 1}`).join("|");
    if (key === lastKey.current) return;
    lastKey.current = key;
    setView({ clusters: next });
  }, [map, index]);

  useEffect(() => {
    if (!map) return;
    recompute();
    map.on("moveend", recompute);
    map.on("zoomend", recompute);
    return () => {
      map.off("moveend", recompute);
      map.off("zoomend", recompute);
    };
  }, [map, recompute]);

  return { clusters: view.clusters, index };
}

/* Fit the static mini-map to its markers, and re-fit whenever the filtered set
   changes so the preview always frames the currently-selected properties. */
function MiniFit({ markers }: { markers: MapMarker[] }) {
  const map = useMap();
  const first = useRef(true);
  const sig = markers.map((m) => m.id).join(",");
  useEffect(() => {
    if (!map) return;
    const animate = !first.current;
    first.current = false;
    const pts = markers.map((m) => [m.lng, m.lat] as [number, number]);
    if (pts.length === 0) {
      map.fitBounds(cyprusBounds(), { animate });
      return;
    }
    const b = new maplibregl.LngLatBounds(pts[0], pts[0]);
    for (const p of pts) b.extend(p);
    // The teaser frames the ISLAND, not just the markers. fitBounds on the
    // marker bounds alone runs them to the tile edge (projects cluster along the
    // south coast, so the frame ends up wider than tall and Cyprus gets clipped),
    // which reads as a crop rather than a map of Cyprus. So the frame is grown
    // around the markers' centre to a minimum span before fitting: a broad result
    // set shows essentially the whole island, a single-city one still centres on
    // that city but keeps enough coast around it to be recognisable.
    const sw = b.getSouthWest(), ne = b.getNorthEast();
    const cLng = (sw.lng + ne.lng) / 2, cLat = (sw.lat + ne.lat) / 2;
    // Cyprus spans about 2.33 deg lng (32.27–34.60) x 0.72 deg lat. Framing 2.9
    // x 1.05 puts the whole island in the tile with sea around it, so the teaser
    // reads as "Cyprus" at a glance. The 1.5x factor only takes over for a result
    // set wider than the island itself, which cannot happen here but keeps the
    // expression honest.
    const halfLng = Math.max((ne.lng - sw.lng) / 2 * 1.5, 2.9 / 2);
    const halfLat = Math.max((ne.lat - sw.lat) / 2 * 1.5, 1.05 / 2);
    const framed = new maplibregl.LngLatBounds(
      [cLng - halfLng, cLat - halfLat],
      [cLng + halfLng, cLat + halfLat],
    );
    map.fitBounds(framed, { animate, maxZoom: 9, padding: 12 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, map]);
  return null;
}

/* Static, non-interactive map preview — used as a teaser tile in the grid that
   opens the full map overlay on click. All interaction is disabled so the
   parent button captures the click. */
export function MiniMap({ markers }: { markers: MapMarker[] }) {
  const items = useMemo(() => validMarkers(markers), [markers]);
  return (
    <MapContainer
      center={CYPRUS_CENTER}
      zoom={8}
      interactive={false}
      className="px-maplibre px-maplibre--mini"
      style={{ height: "100%", width: "100%" }}
    >
      <MiniPins items={items} />
      <MiniFit markers={items} />
    </MapContainer>
  );
}

/* The teaser clusters too. The Leaflet version wrapped its pins in a
   MarkerClusterGroup; rendering all ~230 markers as separate DOM nodes in a
   small preview tile would be a needless cost on the listing page. */
function MiniPins({ items }: { items: MapMarker[] }) {
  const map = useMap();
  const { clusters } = useClusters(map, items, true);
  return (
    <>
      {clusters.map((c: any) => {
        const [lng, lat] = c.geometry.coordinates as [number, number];
        if (c.properties.cluster) {
          return <Marker key={`mc-${c.id}`} lngLat={[lng, lat]} className="px-cluster" html={`<span>${c.properties.point_count}</span>`} />;
        }
        const id = c.properties.id as string;
        const { className, html } = pinMarkup(false, variantFor(id));
        return <Marker key={id} lngLat={[lng, lat]} className={className} html={html} />;
      })}
    </>
  );
}

export default function ProjectsMap({
  markers,
  hoveredId,
  onHover,
  locale = "en",
  strings,
  // Writes the visible bbox to the URL for the /projects catalog's own
  // server-side bbox refetch (BoundsSync below). A caller embedding this map
  // for an already-fixed marker set (e.g. the developer page) has no bbox route
  // to refetch against — default true keeps every existing /projects usage
  // unchanged; pass false to skip the otherwise-inert URL writes.
  syncBoundsToUrl = true,
  // Extra class on the root .px-mapwrap div — e.g. "pp-map" to opt into the
  // project detail page's gold contour (.pp-map.px-mapwrap::before/::after).
  className = "",
  // Kept for call-site compatibility. The old "unified" / "layered" split chose
  // between two CARTO raster treatments (one baked-label layer vs. a separate
  // labels overlay plus a Sea-Deep tint pane). The vector style renders labels
  // itself in the house palette, so both callers now get the same — correct —
  // map and no CSS tinting is involved at all.
  tileStyle: _tileStyle = "unified",
}: {
  markers: MapMarker[];
  hoveredId: string | null;
  onHover: (id: string | null) => void;
  locale?: string;
  strings?: ProjectsStrings;
  syncBoundsToUrl?: boolean;
  className?: string;
  tileStyle?: "unified" | "layered";
}) {
  const s = strings ?? projectsStrings(locale);
  // MUST be memoised: ClusteredPins builds a supercluster index from this array
  // and subscribes an effect to it. A fresh array identity on every render would
  // rebuild the index, re-run the effect, set state and render again — an endless
  // loop that surfaces as "Maximum call stack size exceeded".
  const items = useMemo(() => validMarkers(markers), [markers]);
  const [poiActive, setPoiActive] = useState<Set<string>>(new Set());
  const [poiState, setPoiState] = useState<"idle" | "loading" | "zoom">("idle");
  // hover = temporary preview (desktop pointers only); selected = persistent pin
  // (click / tap). Selected always wins over hover.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [canHover] = useState(
    () => typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(hover: hover)").matches,
  );
  const activeId = selectedId ?? hoveredId;
  const active = activeId ? items.find((m) => m.id === activeId) ?? null : null;

  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;

  // Hover-intent bridge: leaving a marker doesn't close its preview instantly —
  // a short grace period lets the pointer travel across the gap onto the card,
  // whose own mouseenter cancels the close.
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelHide = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);
  const scheduleHide = useCallback(() => {
    cancelHide();
    hideTimer.current = setTimeout(() => {
      if (!selectedRef.current) onHover(null);
    }, 220);
  }, [cancelHide, onHover]);
  useEffect(() => cancelHide, [cancelHide]);

  // While something is pinned, close it on a click that isn't a marker, the open
  // popup, or the POI control. Capture phase + class check fires for both mouse
  // clicks and taps.
  useEffect(() => {
    if (!selectedId) return;
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && t.closest(".maplibregl-marker, .maplibregl-popup, .px-poi")) return;
      setSelectedId(null);
      onHover(null);
    };
    document.addEventListener("click", onDocClick, true);
    return () => document.removeEventListener("click", onDocClick, true);
  }, [selectedId, onHover]);

  const togglePoi = (k: string) =>
    setPoiActive((prev) => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });

  return (
    <div className={`px-mapwrap${className ? ` ${className}` : ""}`}>
      <MapContainer
        center={CYPRUS_CENTER}
        zoom={9}
        minZoom={8}
        cooperativeGestures
        locale={gestureLocale(locale)}
        className="px-maplibre"
        style={{ height: "100%", width: "100%" }}
      >
        <ClusteredPins
          items={items}
          activeId={activeId}
          canHover={canHover}
          onSelect={setSelectedId}
          onHover={onHover}
          selectedRef={selectedRef}
          cancelHide={cancelHide}
          scheduleHide={scheduleHide}
        />

        {/* one controlled popup: shows the hovered preview OR the pinned selection
            (selected wins). Open/close is driven purely by React state. */}
        {active && (
          <Popup className="px-pop" lngLat={[active.lng, active.lat]} closeButton={false} closeOnClick={false}>
            <a
              className="px-pop__card"
              href={active.href}
              onMouseEnter={canHover ? cancelHide : undefined}
              onMouseLeave={canHover ? scheduleHide : undefined}
            >
              {active.image && <img className="px-pop__img" src={active.image} alt={active.title} />}
              <span className="px-pop__body">
                <span className="px-pop__price">{fmtPrice(active.price, s)}</span>
                <span className="px-pop__title">{active.title}</span>
                {active.city && <span className="px-pop__city">{active.city}</span>}
                {topDistances(active.distances, s, 3).length > 0 && (
                  <span className="px-pop__dist">
                    {topDistances(active.distances, s, 3).map((x) => (
                      <span key={x.label}><i>{x.label}</i> {x.v}<small>{s.minShort}</small></span>
                    ))}
                  </span>
                )}
              </span>
            </a>
          </Popup>
        )}

        {syncBoundsToUrl && <BoundsSync />}
        <FitBounds markers={items} />
        <PoiLayers active={poiActive} onState={setPoiState} />
      </MapContainer>

      <div className="px-poi" role="group" aria-label={s.nearby}>
        <span className="px-poi__lead">{s.nearby}</span>
        {POI_CATS.map((c) => {
          const on = poiActive.has(c.key);
          return (
            <button
              key={c.key}
              type="button"
              className={`px-poi__chip${on ? " is-on" : ""}`}
              aria-pressed={on}
              onClick={() => togglePoi(c.key)}
              style={on ? { borderColor: c.color, boxShadow: `inset 0 0 0 1px ${c.color}55` } : undefined}
            >
              <span className="px-poi__dot" style={{ background: c.color }} />
              {s.poi[c.key as keyof ProjectsStrings["poi"]] ?? c.label}
            </button>
          );
        })}
        {poiActive.size > 0 && poiState === "zoom" && (
          <span className="px-poi__hint">{s.zoomToLoad}</span>
        )}
        {poiState === "loading" && <span className="px-poi__hint is-load">{s.loading}</span>}
      </div>
    </div>
  );
}

/** Pins + cluster bubbles for the current viewport. */
function ClusteredPins({
  items,
  activeId,
  canHover,
  onSelect,
  onHover,
  selectedRef,
  cancelHide,
  scheduleHide,
}: {
  items: MapMarker[];
  activeId: string | null;
  canHover: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  selectedRef: React.MutableRefObject<string | null>;
  cancelHide: () => void;
  scheduleHide: () => void;
}) {
  const map = useMap();
  const { clusters, index } = useClusters(map, items, true);
  const byId = useMemo(() => new Map(items.map((m) => [m.id, m])), [items]);

  return (
    <>
      {clusters.map((c: any) => {
        const [lng, lat] = c.geometry.coordinates as [number, number];
        if (c.properties.cluster) {
          const count = c.properties.point_count as number;
          return (
            <Marker
              key={`cl-${c.id}`}
              lngLat={[lng, lat]}
              className="px-cluster"
              html={`<span>${count}</span>`}
              onClick={() => {
                if (!map || !index) return;
                const z = Math.min(index.getClusterExpansionZoom(c.id as number), 16);
                map.easeTo({ center: [lng, lat], zoom: z, duration: 420 });
              }}
            />
          );
        }
        const m = byId.get(c.properties.id as string);
        if (!m) return null;
        const isActive = activeId === m.id;
        const { className, html } = pinMarkup(isActive, variantFor(m.id));
        return (
          <Marker
            key={m.id}
            lngLat={[m.lng, m.lat]}
            className={className}
            html={html}
            // Promote to pinned with a SINGLE state change. Deliberately do NOT
            // clear hover here: clearing hoveredId AND setting selectedId are two
            // updates in two components and can yield a one-frame `active === null`
            // → the popup unmounts then remounts. selectedId wins via activeId
            // anyway, and the stale hover is cleared on deselect.
            onClick={() => onSelect(m.id)}
            // hover preview only on hover-capable pointers AND only while nothing
            // is pinned — selection must never fight with hover
            onMouseEnter={canHover ? () => { cancelHide(); if (!selectedRef.current) onHover(m.id); } : undefined}
            onMouseLeave={canHover ? () => { if (!selectedRef.current) scheduleHide(); } : undefined}
          />
        );
      })}
    </>
  );
}
