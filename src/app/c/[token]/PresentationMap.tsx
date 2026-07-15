"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Pane, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-gesture-handling/dist/leaflet-gesture-handling.css";
import "leaflet-gesture-handling";
import { pinIcon, POI_CATS, PoiLayers, GestureZoom } from "@/app/preview-projects/ProjectsMap";
import { COPY, asPLocale } from "./copy";

/* Presentation map: reuses ProjectsMap's pin/POI/gesture parts (same recipe as
   PropertyMap.tsx) but plots MULTIPLE developments. Pins no longer carry a
   permanent name label (that read as clutter) — instead, hovering or clicking
   a pin shows the same small preview card used on the main Projects page
   (.px-pop / .px-pop__card, already in projects.css), and clicking THAT card
   scrolls the page to the matching property card below. No URL/bounds sync —
   this page has no filter state to persist. */

export type PresentationMarker = {
  id: string; lat: number; lng: number; name: string;
  image: string | null; price: number | null; currency: string; location: string | null;
};

const fmtPrice = (n: number | null, cur: string) => (n == null ? null : `${cur === "EUR" ? "€" : cur + " "}${n.toLocaleString("en-US")}`);

function FitToMarkers({ markers }: { markers: PresentationMarker[] }) {
  const map = useMap();
  useEffect(() => {
    if (!markers.length) return;
    const fit = () => {
      map.invalidateSize();
      if (markers.length === 1) map.setView([markers[0].lat, markers[0].lng], 14);
      else map.fitBounds(L.latLngBounds(markers.map((m) => [m.lat, m.lng] as [number, number])), { padding: [48, 48], maxZoom: 13 });
    };
    const raf = requestAnimationFrame(fit);
    const t = setTimeout(fit, 300);
    return () => { cancelAnimationFrame(raf); clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

export default function PresentationMap({
  markers, locale = "en", onSelect,
}: {
  markers: PresentationMarker[];
  locale?: string;
  onSelect: (id: string) => void;
}) {
  const copy = COPY[asPLocale(locale)];
  const [poiActive, setPoiActive] = useState<Set<string>>(new Set());
  const [poiState, setPoiState] = useState<"idle" | "loading" | "zoom">("idle");
  const togglePoi = (k: string) =>
    setPoiActive((prev) => { const next = new Set(prev); next.has(k) ? next.delete(k) : next.add(k); return next; });

  // hover = temporary preview (desktop pointers only); selected = persistent pin
  // (click/tap). Selected always wins over hover — same pattern as ProjectsMap.
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [canHover] = useState(() => typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(hover: hover)").matches);
  const activeId = selectedId ?? hoveredId;
  const active = activeId ? markers.find((m) => m.id === activeId) ?? null : null;

  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelHide = useCallback(() => { if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null; } }, []);
  const scheduleHide = useCallback(() => {
    cancelHide();
    hideTimer.current = setTimeout(() => { if (!selectedRef.current) setHoveredId(null); }, 220);
  }, [cancelHide]);
  useEffect(() => cancelHide, [cancelHide]);

  // Click outside a marker/popup/POI control clears a pinned selection.
  useEffect(() => {
    if (!selectedId) return;
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && t.closest(".leaflet-marker-icon, .leaflet-popup, .px-poi")) return;
      setSelectedId(null);
      setHoveredId(null);
    };
    document.addEventListener("click", onDocClick, true);
    return () => document.removeEventListener("click", onDocClick, true);
  }, [selectedId]);

  if (markers.length === 0) return null;

  return (
    <div className="px-mapwrap pp-map cp-map">
      <MapContainer center={[markers[0].lat, markers[0].lng]} zoom={10} minZoom={8} scrollWheelZoom attributionControl={false} className="px-leaflet" style={{ height: "100%", width: "100%" }}>
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>' subdomains="abcd" maxZoom={20} className="pp-map__base" />
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png" subdomains="abcd" maxZoom={20} className="pp-map__labels" pane="overlayPane" />
        <Pane name="seatint" style={{ zIndex: 350 }}><div className="pp-map__tint" /></Pane>
        {markers.map((m) => (
          <Marker
            key={m.id}
            position={[m.lat, m.lng]}
            icon={pinIcon(true)}
            eventHandlers={{
              click: () => setSelectedId(m.id),
              ...(canHover
                ? {
                    mouseover: () => { cancelHide(); if (!selectedRef.current) setHoveredId(m.id); },
                    mouseout: () => { if (!selectedRef.current) scheduleHide(); },
                  }
                : {}),
            }}
          />
        ))}

        {/* One controlled popup: shows the hovered preview OR the pinned
            selection (selected wins). Leaflet's own auto-close is disabled —
            open/close is driven purely by React state, same as ProjectsMap. */}
        {active && (
          <Popup className="px-pop" position={[active.lat, active.lng]} closeButton={false} autoClose={false} closeOnClick={false} autoPan={false}>
            <div
              className="px-pop__card"
              role="button"
              tabIndex={0}
              onMouseEnter={canHover ? cancelHide : undefined}
              onMouseLeave={canHover ? scheduleHide : undefined}
              onClick={() => { onSelect(active.id); setSelectedId(null); setHoveredId(null); }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(active.id); setSelectedId(null); setHoveredId(null); } }}
            >
              {active.image && <img className="px-pop__img" src={active.image} alt={active.name} />}
              <span className="px-pop__body">
                {fmtPrice(active.price, active.currency) && <span className="px-pop__price">{fmtPrice(active.price, active.currency)}</span>}
                <span className="px-pop__title">{active.name}</span>
                {active.location && <span className="px-pop__city">{active.location}</span>}
              </span>
            </div>
          </Popup>
        )}

        <GestureZoom locale={locale} />
        <PoiLayers active={poiActive} onState={setPoiState} />
        <FitToMarkers markers={markers} />
      </MapContainer>
      <div className="px-poi" role="group">
        <span className="px-poi__heading">{copy.lifeNearby}</span>
        {POI_CATS.map((c) => {
          const on = poiActive.has(c.key);
          return (
            <button key={c.key} type="button" className={`px-poi__chip${on ? " is-on" : ""}`} aria-pressed={on} onClick={() => togglePoi(c.key)} style={on ? { borderColor: c.color, boxShadow: `inset 0 0 0 1px ${c.color}55` } : undefined}>
              <span className="px-poi__dot" style={{ background: c.color }} />
              {c.label}
            </button>
          );
        })}
        {poiActive.size > 0 && poiState === "zoom" && <span className="px-poi__hint">Zoom in to see nearby places</span>}
      </div>
    </div>
  );
}
