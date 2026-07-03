"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import { useRouter, useSearchParams } from "next/navigation";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-gesture-handling/dist/leaflet-gesture-handling.css";
import "leaflet-gesture-handling";
import { topDistances, type MapMarker } from "./ProjectsExplorer";
import { projectsStrings, type ProjectsStrings } from "@/app/[lang]/projects/projectsI18n";

const CYPRUS_CENTER: [number, number] = [34.85, 32.95];
const CYPRUS_BOUNDS = L.latLngBounds([34.45, 32.1], [35.15, 34.1]);

const fmtPrice = (p: number | null, s: ProjectsStrings) =>
  p == null ? s.priceOnRequest : `€${p.toLocaleString(s.numLocale)}`;

const pinIcon = (active: boolean, variant = 0) =>
  L.divIcon({
    // the CVE skyline-in-a-diamond emblem; idle pins carry a glow-stagger class
    // (g0..g5) so they twinkle out of sync
    className: `px-pin${active ? " is-active" : ` px-pin--g${variant}`}`,
    html: `<img class="px-pin__mark" src="/img/cve-mark.png" alt="" draggable="false" />`,
    iconSize: active ? [38, 48] : [28, 36],
    iconAnchor: active ? [19, 24] : [14, 18],
    popupAnchor: active ? [0, -26] : [0, -20],
  });

// Stable singleton icons — reusing the same instances means react-leaflet only
// calls marker.setIcon() on the one marker whose active state actually changed,
// instead of re-creating every icon on each render (the flicker source). Idle
// pins come in 6 glow-stagger variants; each marker picks one deterministically
// by id hash, so the gems shimmer independently rather than all in lockstep.
const PIN_GLOW = 6;
const PIN_VARIANTS = Array.from({ length: PIN_GLOW }, (_, v) => pinIcon(false, v));
const PIN_ACTIVE = pinIcon(true);
const pinFor = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return PIN_VARIANTS[Math.abs(h) % PIN_GLOW];
};

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
      debounce((b: L.LatLngBounds) => {
        if (!userMoved.current) return;
        userMoved.current = false;
        const ne = b.getNorthEast();
        const sw = b.getSouthWest();
        const next = { north: String(round(ne.lat)), east: String(round(ne.lng)), south: String(round(sw.lat)), west: String(round(sw.lng)) };
        if (sp.get("north") === next.north && sp.get("east") === next.east && sp.get("south") === next.south && sp.get("west") === next.west) return;
        const p = new URLSearchParams(sp.toString());
        Object.entries(next).forEach(([k, v]) => p.set(k, v));
        p.delete("page");
        router.replace(`?${p.toString()}`, { scroll: false });
      }, 500),
    [router, sp],
  );

  useEffect(() => {
    const onStart = () => (userMoved.current = true);
    const onEnd = () => push(map.getBounds());
    map.on("dragstart zoomstart", onStart);
    map.on("moveend zoomend", onEnd);
    return () => {
      map.off("dragstart zoomstart", onStart);
      map.off("moveend zoomend", onEnd);
    };
  }, [map, push]);

  return null;
}

/* Frame the current filtered result set on open — the SAME markers the mini-map
   preview shows — so opening the full map stays on the filter-set area instead of
   resetting to the whole island. (The server filters markers to the visible bbox,
   so fitting the markers also restores a previously-panned view.) Falls back to a
   pinned bbox / the whole island only when there are no results to frame.

   CRITICAL: the overlay fades in and its map is a flex child, so on the first
   frame the container can report a 0/small size (esp. Safari) — fitBounds would
   then pick a very low zoom (the whole island). So we always invalidateSize()
   first and fit AFTER the layout settles: once on the next frame and again after
   the fade completes. Runs once per open (the overlay unmounts on close), so it
   never fights the user's own pans. */
function FitBounds({ markers }: { markers: MapMarker[] }) {
  const map = useMap();
  const sp = useSearchParams();
  const markersRef = useRef(markers);
  markersRef.current = markers;
  useEffect(() => {
    let stop = false;
    const fit = () => {
      if (stop) return;
      map.invalidateSize(); // sync the map to its real (possibly just-settled) size
      // Guard: never fit while the container is still collapsed — a tiny height
      // makes fitBounds choose a whole-island zoom. Wait for a real size instead.
      if (map.getSize().y < 120) return;
      const pts = markersRef.current.map((m) => [m.lat, m.lng]) as [number, number][];
      if (pts.length > 0) {
        map.fitBounds(L.latLngBounds(pts), { animate: false, maxZoom: 13, padding: [40, 40] });
      } else {
        const N = sp.get("north"), S = sp.get("south"), E = sp.get("east"), W = sp.get("west");
        if (N != null && S != null && E != null && W != null) {
          map.fitBounds(L.latLngBounds([+S, +W], [+N, +E]), { animate: false });
        } else {
          map.fitBounds(CYPRUS_BOUNDS, { animate: false });
        }
      }
    };
    // Fit as soon as the map has a real size: on the next frame, at a few settle
    // points (covers the 0.25s fade), and whenever Leaflet reports a size change.
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
  }, []);
  return null;
}

/* ---------------- POIs (OpenStreetMap via Overpass) ---------------- */
type PoiCat = { key: string; label: string; color: string; filter: string; test: (t: any) => boolean };
const POI_CATS: PoiCat[] = [
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

// Local POI dataset (public/poi/cyprus.json) — generated once from OSM/Overpass
// by scripts/import-pois.cjs. Fetched a single time per session from our own
// server, then filtered in memory, so toggling/panning is instant (no per-click
// network round-trip to Overpass).
type LocalPoi = { lat: number; lng: number; name: string; cat: string; id: string };
let POI_DATA: LocalPoi[] | null = null;
let POI_LOADING: Promise<LocalPoi[]> | null = null;
function loadLocalPois(): Promise<LocalPoi[]> {
  if (POI_DATA) return Promise.resolve(POI_DATA);
  if (!POI_LOADING) {
    POI_LOADING = fetch("/poi/cyprus.json")
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

// Reuse one icon instance per colour (7 categories) so POI markers don't churn.
const POI_ICON_CACHE: Record<string, L.DivIcon> = {};
const poiIcon = (color: string) =>
  (POI_ICON_CACHE[color] ??= L.divIcon({
    className: "px-poi-pin",
    // expose the colour as --c so the CSS can build a same-colour glow halo
    html: `<span style="--c:${color}"></span>`,
    iconSize: [10, 10],
    iconAnchor: [5, 5],
  }));

/* Renders POIs from the local dataset for the visible area (zoom ≥ 11). Data is
   loaded once from our own server and filtered in memory, so toggling categories
   and panning is instant — no Overpass round-trip per click. */
function PoiLayers({ active, onState }: { active: Set<string>; onState: (s: "idle" | "loading" | "zoom") => void }) {
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
    const onMove = debounce(refresh, 150);
    map.on("moveend", onMove);
    return () => { map.off("moveend", onMove); };
  }, [map, refresh]);

  return (
    <>
      {poi.map((p) => (
        <Marker key={p.id} position={[p.lat, p.lng]} icon={poiIcon(p.color)}>
          {p.name && (
            <Tooltip direction="top" offset={[0, -6]} className="px-poi-tip">
              {p.name}
            </Tooltip>
          )}
        </Marker>
      ))}
    </>
  );
}

// Gesture-handling hint text per site locale (EN / DE / PL / RU). The plugin
// falls back to its device-language built-ins only if a locale is missing all
// three keys — so we always supply all three, and default to EN ourselves.
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

/* Enable leaflet-gesture-handling on the interactive overlay map: desktop wheel
   zoom only with Ctrl/Cmd (otherwise the page scrolls), two-finger pan/zoom on
   touch (one finger scrolls the page). The plugin renders its own hint, whose
   text we set from the SITE locale (not the device language). Its init hook is
   registered by the side-effect `import "leaflet-gesture-handling"` at the top
   of this file, so `map.gestureHandling` exists by the time this runs. */
function GestureZoom({ locale }: { locale: string }) {
  const map = useMap();
  useEffect(() => {
    const opts = map.options as unknown as { gestureHandlingOptions?: Record<string, unknown> };
    opts.gestureHandlingOptions = {
      ...(opts.gestureHandlingOptions ?? {}),
      text: GESTURE_TEXT[locale] ?? GESTURE_TEXT.en,
    };
    const gh = (map as unknown as { gestureHandling?: { enable: () => void; disable: () => void } }).gestureHandling;
    if (!gh) return;
    // re-enable so the plugin re-reads the (localized) text on locale change
    gh.disable();
    gh.enable();
  }, [map, locale]);
  return null;
}

/* The overlay map mounts inside a modal that just became visible. Leaflet sizes
   its container at init, so a deferred invalidateSize() (now + after the modal's
   fade) guarantees correct dimensions and tile layout, especially on mobile. */
function InvalidateOnOpen() {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    const t = setTimeout(() => map.invalidateSize(), 300);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

/* Fit the static mini-map to its markers, and re-fit whenever the filtered set
   changes so the preview always frames the currently-selected properties. */
function MiniFit({ markers }: { markers: MapMarker[] }) {
  const map = useMap();
  const first = useRef(true);
  const sig = markers.map((m) => m.id).join(",");
  useEffect(() => {
    const animate = !first.current;
    first.current = false;
    const pts = markers.map((m) => [m.lat, m.lng]) as [number, number][];
    if (pts.length === 0) {
      map.fitBounds(CYPRUS_BOUNDS, { animate });
      return;
    }
    map.fitBounds(L.latLngBounds(pts).pad(0.2), { animate, maxZoom: 11 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
  return null;
}

/* Static, non-interactive map preview — used as a teaser tile in the grid that
   opens the full map overlay on click. All interaction is disabled so the
   parent button captures the click. */
export function MiniMap({ markers }: { markers: MapMarker[] }) {
  const items = validMarkers(markers);
  return (
    <MapContainer
      center={CYPRUS_CENTER}
      zoom={8}
      className="px-leaflet px-leaflet--mini"
      style={{ height: "100%", width: "100%" }}
      dragging={false}
      scrollWheelZoom={false}
      doubleClickZoom={false}
      touchZoom={false}
      boxZoom={false}
      keyboard={false}
      zoomControl={false}
      attributionControl={false}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
        maxZoom={20}
      />
      <MarkerClusterGroup chunkedLoading showCoverageOnHover={false} maxClusterRadius={48} zoomToBoundsOnClick={false}>
        {items.map((m) => (
          <Marker key={m.id} position={[m.lat, m.lng]} icon={pinIcon(false)} interactive={false} />
        ))}
      </MarkerClusterGroup>
      <MiniFit markers={items} />
    </MapContainer>
  );
}

export default function ProjectsMap({
  markers,
  hoveredId,
  onHover,
  locale = "en",
  strings,
}: {
  markers: MapMarker[];
  hoveredId: string | null;
  onHover: (id: string | null) => void;
  locale?: string;
  strings?: ProjectsStrings;
}) {
  const s = strings ?? projectsStrings(locale);
  const items = validMarkers(markers);
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

  // Always-current selection, read inside marker hover handlers without relying
  // on closure freshness (prevents hover from fighting an active selection).
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;

  // Hover-intent bridge: leaving a marker doesn't close its preview instantly —
  // a short grace period lets the pointer travel across the gap onto the card,
  // whose own mouseenter cancels the close. So the card survives the trip and is
  // hoverable (clickable), instead of vanishing the moment you aim for it.
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
  // popup, or the POI control. Capture phase + class check is robust to Leaflet's
  // own propagation handling and fires for both mouse clicks and taps.
  useEffect(() => {
    if (!selectedId) return;
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && t.closest(".leaflet-marker-icon, .leaflet-popup, .px-poi")) return;
      // clear BOTH on deselect: hover was ignored while pinned, so hoveredId may
      // still hold the old marker — clearing it stops the popup reappearing.
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
    <div className="px-mapwrap">
      <MapContainer
        center={CYPRUS_CENTER}
        zoom={9}
        minZoom={8}
        scrollWheelZoom
        attributionControl={false}
        className="px-leaflet"
        style={{ height: "100%", width: "100%" }}
      >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        subdomains="abcd"
        maxZoom={20}
      />

      <MarkerClusterGroup chunkedLoading showCoverageOnHover={false} maxClusterRadius={48}>
        {items.map((m) => (
          <Marker
            key={m.id}
            position={[m.lat, m.lng]}
            icon={activeId === m.id ? PIN_ACTIVE : pinFor(m.id)}
            eventHandlers={{
              // Promote to pinned with a SINGLE state change. Deliberately do NOT
              // clear hover here: clearing the parent's hoveredId AND setting the
              // child's selectedId are two updates in two components and can yield
              // a one-frame `active === null` → the popup unmounts then remounts
              // (Leaflet replays its open/fade) = the flicker. selectedId wins via
              // `activeId` anyway, and the stale hover is cleared on deselect.
              click: () => setSelectedId(m.id),
              // hover preview only on hover-capable pointers AND only while
              // nothing is pinned — selection must never fight with hover
              ...(canHover
                ? {
                    mouseover: () => {
                      cancelHide();
                      if (!selectedRef.current) onHover(m.id);
                    },
                    mouseout: () => {
                      if (!selectedRef.current) scheduleHide();
                    },
                  }
                : {}),
            }}
          />
        ))}
      </MarkerClusterGroup>

      {/* one controlled popup: shows the hovered preview OR the pinned selection
          (selected wins). Leaflet's own auto-close is disabled — open/close is
          driven purely by React state. */}
      {active && (
        <Popup
          className="px-pop"
          position={[active.lat, active.lng]}
          closeButton={false}
          autoClose={false}
          closeOnClick={false}
          autoPan={false}
        >
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

      <GestureZoom locale={locale} />
      <InvalidateOnOpen />
      <BoundsSync />
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
