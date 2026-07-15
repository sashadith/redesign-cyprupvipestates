"use client";

import React, { useState } from "react";
import { MapContainer, TileLayer, Marker, Pane } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-gesture-handling/dist/leaflet-gesture-handling.css";
import "leaflet-gesture-handling";
import { pinIcon, POI_CATS, PoiLayers, GestureZoom } from "@/app/preview-projects/ProjectsMap";
import { projectsStrings, type ProjectsStrings } from "@/app/[lang]/projects/projectsI18n";

/* Full-width map block for a SINGLE property: centred on the unit, the property
   marked with our glowing CVE emblem, plus the same nearby-POI toggles as the
   projects explorer. Reuses ProjectsMap's pin/POI/gesture parts + projects.css. */
export default function PropertyMap({
  lat,
  lng,
  locale = "de",
}: {
  lat: number;
  lng: number;
  locale?: string;
}) {
  const s: ProjectsStrings = projectsStrings(locale);
  const [poiActive, setPoiActive] = useState<Set<string>>(new Set());
  const [poiState, setPoiState] = useState<"idle" | "loading" | "zoom">("idle");
  const togglePoi = (k: string) =>
    setPoiActive((prev) => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });

  return (
    <div className="px-mapwrap pp-map">
      <MapContainer
        center={[lat, lng]}
        zoom={14}
        minZoom={9}
        scrollWheelZoom
        attributionControl={false}
        className="px-leaflet"
        style={{ height: "100%", width: "100%" }}
      >
        {/* label-free dark base → cleaner, tinted to Sea-Deep in CSS */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          subdomains="abcd"
          maxZoom={20}
          className="pp-map__base"
        />
        {/* labels (place + street names) — CartoDB renders them in the local
            language; English (Latin) labels would need a vector provider + key */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={20}
          className="pp-map__labels"
          pane="overlayPane"
        />
        {/* Sea-Deep wash over the tiles (below markers, so the emblem stays crisp) */}
        <Pane name="seatint" style={{ zIndex: 350 }}>
          <div className="pp-map__tint" />
        </Pane>
        {/* the property itself — our glowing emblem, prominent (active variant) */}
        <Marker position={[lat, lng]} icon={pinIcon(true)} />
        <GestureZoom locale={locale} />
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
        {poiActive.size > 0 && poiState === "zoom" && <span className="px-poi__hint">{s.zoomToLoad}</span>}
        {poiState === "loading" && <span className="px-poi__hint is-load">{s.loading}</span>}
      </div>
    </div>
  );
}
