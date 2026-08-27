"use client";

// A thin React layer over maplibre-gl, shaped like the react-leaflet API the
// map components were written against (MapContainer / useMap / Marker / Popup).
// Keeping the same shape means the ported components stay structurally the same
// — only the calls inside them change — instead of being rewritten around a
// different paradigm.
//
// Markers are real DOM elements, not GPU sprites: the project pin is an <img>
// with a CSS glow animation and the POI dots are CSS-shadow light points, so
// they must stay in the DOM to keep their styling (see projects.css).

import React, { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { CVE_MAP_STYLE } from "./cveMapStyle";

const MapCtx = createContext<maplibregl.Map | null>(null);

/** The live map instance, or null until it exists. Mirrors react-leaflet's useMap(). */
export function useMap(): maplibregl.Map | null {
  return useContext(MapCtx);
}

export type MapContainerProps = {
  center: [number, number]; // [lng, lat] — MapLibre order
  zoom: number;
  minZoom?: number;
  maxZoom?: number;
  /** false disables every interaction (used by the static mini-map teaser). */
  interactive?: boolean;
  /** Requires ctrl/⌘ + scroll to zoom; replaces the leaflet-gesture-handling plugin. */
  cooperativeGestures?: boolean;
  className?: string;
  style?: React.CSSProperties;
  /** MapLibre string overrides — we use it for the cooperative-gesture hint copy. */
  locale?: Record<string, string>;
  /** Zoom in/out buttons, styled like the LIFE NEARBY chips (projects.css). */
  showZoom?: boolean;
  children?: React.ReactNode;
};

export function MapContainer({
  center,
  zoom,
  minZoom,
  maxZoom,
  interactive = true,
  cooperativeGestures = false,
  className,
  style,
  locale,
  showZoom = true,
  children,
}: MapContainerProps) {
  const host = useRef<HTMLDivElement | null>(null);
  const [map, setMap] = useState<maplibregl.Map | null>(null);

  useLayoutEffect(() => {
    if (!host.current) return;
    const m = new maplibregl.Map({
      container: host.current,
      style: CVE_MAP_STYLE,
      center,
      zoom,
      minZoom,
      maxZoom,
      interactive,
      locale,
      // OpenStreetMap data is ODbL-licensed and requires attribution. The old
      // Leaflet setup hid the attribution control outright; MapLibre's compact
      // form is a small ⓘ disc that expands on click, which satisfies the licence
      // without competing with the map.
      attributionControl: { compact: true },
      // The pin/POI markers carry their own glow; MapLibre's default fade would
      // make them pop in late on pan. 0 keeps them in step with the tiles.
      fadeDuration: 0,
    });
    // Enabled after construction on purpose: switching it on inserts an overlay
    // element into the container, which would fire the ResizeObserver while the
    // map is still building itself.
    if (cooperativeGestures) {
      m.once("load", () => {
        try { m.cooperativeGestures?.enable(); } catch { /* handler unavailable */ }
      });
    }
    if (interactive && showZoom) {
      m.addControl(new maplibregl.NavigationControl({ showCompass: false, visualizePitch: false }), "bottom-right");
    }
    setMap(m);
    return () => {
      m.remove();
      setMap(null);
    };
    // Deliberately mount-only: later prop changes are applied by the child
    // components (FitBounds, MiniFit) rather than by re-creating the map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The map is often mounted inside a fading/flexing overlay, so its container
  // can report a collapsed size on the first frames. Leaflet needed an explicit
  // invalidateSize(); MapLibre needs resize() for the same reason.
  //
  // The dimension check is NOT an optimisation — it is required. map.resize()
  // resizes the canvas inside the observed element and fires a "resize" event,
  // which can re-trigger this observer; calling resize() unconditionally then
  // recurses until the stack blows ("Maximum call stack size exceeded").
  // Leaflet's invalidateSize() no-opped on an unchanged size, which is why the
  // original code could call it freely. This restores that property.
  useEffect(() => {
    if (!map || !host.current) return;
    let lastW = -1;
    let lastH = -1;
    let queued = 0;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (!r) return;
      const w = Math.round(r.width);
      const h = Math.round(r.height);
      if (w === lastW && h === lastH) return;
      lastW = w;
      lastH = h;
      // Deferred, and never more than one in flight: map.resize() mutates the
      // canvas inside the observed element, so calling it synchronously from the
      // observer can re-enter before the first call returns.
      if (queued) return;
      queued = requestAnimationFrame(() => {
        queued = 0;
        map.resize();
      });
    });
    ro.observe(host.current);
    return () => {
      if (queued) cancelAnimationFrame(queued);
      ro.disconnect();
    };
  }, [map]);

  return (
    <div ref={host} className={className} style={{ position: "relative", ...style }}>
      <MapCtx.Provider value={map}>{map ? children : null}</MapCtx.Provider>
    </div>
  );
}

export type MarkerProps = {
  lngLat: [number, number];
  /** Class on the marker's own element — carries the pin/POI styling. */
  className?: string;
  /**
   * Markup for the marker body (pin image, POI dot).
   *
   * TRUSTED INPUT ONLY — this is assigned with innerHTML. Every call site passes
   * an author-controlled constant from this repo (the pin <img>, the POI dot/SVG
   * with a colour from POI_CATS). Data-derived strings such as OSM place names
   * must go through `title`, which is set as a property and never parsed as HTML.
   */
  html?: string;
  /** CSS custom properties set on the element (POI dots pass their colour as --c). */
  vars?: Record<string, string>;
  anchor?: maplibregl.PositionAnchor;
  offset?: [number, number];
  onClick?: (e: MouseEvent) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  title?: string;
  /** Rendered into the marker element — used for popups anchored to a pin. */
  children?: React.ReactNode;
};

export function Marker({
  lngLat,
  className,
  html,
  vars,
  anchor = "center",
  offset,
  onClick,
  onMouseEnter,
  onMouseLeave,
  title,
  children,
}: MarkerProps) {
  const map = useMap();
  const [el] = useState(() => (typeof document === "undefined" ? null : document.createElement("div")));
  const markerRef = useRef<maplibregl.Marker | null>(null);

  useEffect(() => {
    if (!map || !el) return;
    const m = new maplibregl.Marker({ element: el, anchor, offset }).setLngLat(lngLat).addTo(map);
    markerRef.current = m;
    return () => {
      m.remove();
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, el]);

  // Position updates without tearing the marker down (keeps CSS animations running).
  useEffect(() => {
    markerRef.current?.setLngLat(lngLat);
  }, [lngLat[0], lngLat[1]]); // eslint-disable-line react-hooks/exhaustive-deps

  // MapLibre stamps its own classes (maplibregl-marker, …) onto the element when
  // the marker is added. Overwriting className would strip them — which silently
  // breaks anything selecting on `.maplibregl-marker`, e.g. the outside-click
  // handlers that keep a pinned popup open. So keep whatever MapLibre put there
  // and append ours.
  const baseClass = useRef<string | null>(null);
  useEffect(() => {
    if (!el) return;
    if (baseClass.current === null) baseClass.current = el.className;
    if (className !== undefined) {
      el.className = [baseClass.current, className].filter(Boolean).join(" ");
    }
    if (title !== undefined) el.title = title;
    if (html !== undefined) el.innerHTML = html;
    if (vars) for (const [k, v] of Object.entries(vars)) el.style.setProperty(k, v);
  }, [el, className, title, html, vars]);

  useEffect(() => {
    if (!el) return;
    const click = (e: MouseEvent) => { e.stopPropagation(); onClick?.(e); };
    const enter = () => onMouseEnter?.();
    const leave = () => onMouseLeave?.();
    if (onClick) el.addEventListener("click", click);
    if (onMouseEnter) el.addEventListener("mouseenter", enter);
    if (onMouseLeave) el.addEventListener("mouseleave", leave);
    return () => {
      el.removeEventListener("click", click);
      el.removeEventListener("mouseenter", enter);
      el.removeEventListener("mouseleave", leave);
    };
  }, [el, onClick, onMouseEnter, onMouseLeave]);

  if (!el || !children) return null;
  return createPortal(children, el);
}

export type PopupProps = {
  lngLat: [number, number];
  offset?: number | [number, number];
  className?: string;
  closeButton?: boolean;
  closeOnClick?: boolean;
  onClose?: () => void;
  /**
   * Pointer handlers for the popup body.
   *
   * These are attached natively rather than as React props on the children.
   * setDOMContent() hands our element to MapLibre, which relocates it into its
   * own popup DOM — React's delegated mouseenter/mouseleave synthesis does not
   * survive that move, so `onMouseEnter` written on a child inside the portal
   * silently never fires. That broke the hover bridge that keeps the preview
   * card open while the pointer travels from the pin onto the card.
   */
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  children: React.ReactNode;
};

export function Popup({
  lngLat,
  offset = 18,
  className,
  closeButton = false,
  closeOnClick = false,
  onClose,
  onMouseEnter,
  onMouseLeave,
  children,
}: PopupProps) {
  const map = useMap();
  const [el] = useState(() => (typeof document === "undefined" ? null : document.createElement("div")));
  const popupRef = useRef<maplibregl.Popup | null>(null);

  useEffect(() => {
    if (!map || !el) return;
    const p = new maplibregl.Popup({
      offset,
      className,
      closeButton,
      closeOnClick,
      maxWidth: "none",
      // Keeps the card fully on screen near the map edges, the way Leaflet's
      // autoPan did — without it a pin near the border opens a clipped popup.
      anchor: undefined,
    })
      .setLngLat(lngLat)
      .setDOMContent(el)
      .addTo(map);
    popupRef.current = p;
    if (onClose) p.on("close", onClose);
    return () => {
      p.remove();
      popupRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, el]);

  useEffect(() => {
    popupRef.current?.setLngLat(lngLat);
  }, [lngLat[0], lngLat[1]]); // eslint-disable-line react-hooks/exhaustive-deps

  // Attached to MapLibre's own popup element, not to our inner content div:
  // the element we hand to setDOMContent ends up nested inside
  // .maplibregl-popup-content, so a pointer entering the popup's padding would
  // not reach it. getElement() is the whole popup box, which is what the user
  // is aiming at when they move from the pin onto the card.
  useEffect(() => {
    const p = popupRef.current;
    const root = p?.getElement?.();
    if (!root) return;
    const enter = () => onMouseEnter?.();
    const leave = () => onMouseLeave?.();
    root.addEventListener("mouseenter", enter);
    root.addEventListener("mouseleave", leave);
    return () => {
      root.removeEventListener("mouseenter", enter);
      root.removeEventListener("mouseleave", leave);
    };
  }, [map, el, onMouseEnter, onMouseLeave]);

  if (!el) return null;
  return createPortal(children, el);
}

/** Bounds helper mirroring L.latLngBounds(points) for [lng, lat] pairs. */
export function boundsOf(points: [number, number][]): maplibregl.LngLatBounds | null {
  if (!points.length) return null;
  const b = new maplibregl.LngLatBounds(points[0], points[0]);
  for (const p of points) b.extend(p);
  return b;
}

export { maplibregl };

/** Re-exported so callers type against the same instance we bundle. */
export type MapLibreMap = maplibregl.Map;
