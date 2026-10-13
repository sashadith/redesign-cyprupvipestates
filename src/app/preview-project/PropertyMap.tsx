"use client";

import React, { useState } from "react";
import { MapContainer, Marker, Popup } from "@/app/components/map/MapLibre";
import { pinMarkup, POI_CATS, PoiLayers, gestureLocale, MapCard } from "@/app/preview-projects/ProjectsMap";
import { projectsStrings, type ProjectsStrings } from "@/app/[lang]/projects/projectsI18n";

/* Full-width map block for a SINGLE property: centred on the unit, the property
   marked with our glowing CVE emblem, plus the same nearby-POI toggles as the
   projects explorer. Reuses ProjectsMap's pin/POI parts + projects.css.

   Since the MapLibre port this is one vector style in the house palette instead
   of a label-free CARTO base + a separately-tinted label overlay + a Sea-Deep
   wash pane. Place and street names now render in English (name:en, falling back
   to name:latin) — the old raster labels were stuck in the local language, which
   the previous comment here noted would need "a vector provider + key". The
   vector provider turned out not to need a key. */
export type PropertyMapCard = { title: string; image?: string | null; price: number | null; city?: string | null };

export default function PropertyMap({
  lat,
  lng,
  locale = "de",
  card,
}: {
  lat: number;
  lng: number;
  locale?: string;
  /** The same card as on the projects map, hidden until the pin is clicked (no link: it
   *  would point at this very page). Each click on the pin toggles it. */
  card?: PropertyMapCard;
}) {
  const s: ProjectsStrings = projectsStrings(locale);
  const [poiActive, setPoiActive] = useState<Set<string>>(new Set());
  const [poiState, setPoiState] = useState<"idle" | "loading" | "zoom">("idle");
  const [cardOpen, setCardOpen] = useState(false);
  const togglePoi = (k: string) =>
    setPoiActive((prev) => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });

  const pin = pinMarkup(true);

  return (
    <div className="px-mapwrap pp-map">
      <MapContainer
        center={[lng, lat]}
        zoom={14}
        minZoom={9}
        cooperativeGestures
        locale={gestureLocale(locale)}
        className="px-maplibre"
        style={{ height: "100%", width: "100%" }}
      >
        {/* the property itself — our glowing emblem, prominent (active variant) */}
        <Marker
          lngLat={[lng, lat]}
          className={pin.className}
          html={pin.html}
          onClick={card ? () => setCardOpen((o) => !o) : undefined}
        />
        {card && cardOpen && (
          <Popup className="px-pop px-pop--nav" lngLat={[lng, lat]} closeButton={false} closeOnClick={false}>
            <MapCard {...card} lat={lat} lng={lng} locale={locale} s={s} />
          </Popup>
        )}
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
