"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, Popup, useMap, maplibregl } from "@/app/components/map/MapLibre";
import { MapCard, pinMarkup, POI_CATS, PoiLayers } from "@/app/preview-projects/ProjectsMap";
import { projectsStrings } from "@/app/[lang]/projects/projectsI18n";
import "@/app/preview-projects/projects.css";

/* Property matching map (operator, 2026-10-20): ONLY the projects currently
   ticked in the matching table, as pins, with the LIFE NEARBY layer the public
   map has. Hovering a pin shows the same card as the live /projects map (image,
   price, name, place, G/W navigation); clicking the card opens the public
   project page in a new tab so the admin never loses the matching state.
   Built from the same parts as the client presentation map (PresentationMap). */

export type MatchingMapMarker = {
  id: string; lat: number; lng: number; title: string;
  image: string | null; price: number | null; city: string | null; href: string | null;
};

function FitToMarkers({ markers }: { markers: MatchingMapMarker[] }) {
  const map = useMap();
  // Refit whenever the SET of pins changes (a project ticked or unticked).
  const key = markers.map((m) => m.id).sort().join(",");
  useEffect(() => {
    if (!map || !markers.length) return;
    const fit = () => {
      if (markers.length === 1) {
        map.jumpTo({ center: [markers[0].lng, markers[0].lat], zoom: 13 });
      } else {
        const pts = markers.map((m) => [m.lng, m.lat] as [number, number]);
        const b = new maplibregl.LngLatBounds(pts[0], pts[0]);
        for (const p of pts) b.extend(p);
        map.fitBounds(b, { padding: 56, maxZoom: 13, animate: false });
      }
    };
    const raf = requestAnimationFrame(fit);
    const t = setTimeout(fit, 300);
    return () => { cancelAnimationFrame(raf); clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key]);
  return null;
}

export default function MatchingMap({ markers }: { markers: MatchingMapMarker[] }) {
  const s = useMemo(() => projectsStrings("en"), []);
  const [poiActive, setPoiActive] = useState<Set<string>>(new Set());
  const [poiState, setPoiState] = useState<"idle" | "loading" | "zoom">("idle");
  const togglePoi = (k: string) =>
    setPoiActive((prev) => { const next = new Set(prev); next.has(k) ? next.delete(k) : next.add(k); return next; });

  // hover = temporary preview; a click pins the card until a click elsewhere.
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
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

  useEffect(() => {
    if (!selectedId) return;
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && t.closest(".maplibregl-marker, .maplibregl-popup, .px-poi")) return;
      setSelectedId(null);
      setHoveredId(null);
    };
    document.addEventListener("click", onDocClick, true);
    return () => document.removeEventListener("click", onDocClick, true);
  }, [selectedId]);

  // A pin that was unticked must not keep its card open.
  useEffect(() => {
    if (selectedId && !markers.some((m) => m.id === selectedId)) setSelectedId(null);
    if (hoveredId && !markers.some((m) => m.id === hoveredId)) setHoveredId(null);
  }, [markers, selectedId, hoveredId]);

  if (markers.length === 0) return null;
  const pin = pinMarkup(true);

  return (
    <div className="px-mapwrap" style={{ height: 460, borderRadius: 8, overflow: "hidden" }}>
      <MapContainer
        center={[markers[0].lng, markers[0].lat]}
        zoom={10}
        minZoom={7}
        className="px-maplibre"
        style={{ height: "100%", width: "100%" }}
      >
        {markers.map((m) => (
          <Marker
            key={m.id}
            lngLat={[m.lng, m.lat]}
            className={pin.className}
            html={pin.html}
            onClick={() => setSelectedId(m.id)}
            onMouseEnter={() => { cancelHide(); if (!selectedRef.current) setHoveredId(m.id); }}
            onMouseLeave={() => { if (!selectedRef.current) scheduleHide(); }}
          />
        ))}

        {active && (
          <Popup
            className="px-pop px-pop--nav"
            lngLat={[active.lng, active.lat]}
            closeButton={false}
            closeOnClick={false}
            onMouseEnter={cancelHide}
            onMouseLeave={scheduleHide}
          >
            <MapCard
              href={active.href ?? undefined}
              newTab
              image={active.image}
              title={active.title}
              price={active.price}
              city={active.city}
              lat={active.lat}
              lng={active.lng}
              locale="en"
              s={s}
            />
          </Popup>
        )}

        <PoiLayers active={poiActive} onState={setPoiState} />
        <FitToMarkers markers={markers} />
      </MapContainer>
      <div className="px-poi" role="group">
        <span className="px-poi__heading">Life nearby</span>
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
