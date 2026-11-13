"use client";

import React from "react";
import dynamic from "next/dynamic";
import type { PropertyMapCard } from "./PropertyMap";
import { useWebGLSupport } from "@/lib/webgl";

// Leaflet touches window at import → load the map only on the client.
const PropertyMap = dynamic(() => import("./PropertyMap"), {
  ssr: false,
  loading: () => <div className="pp-map pp-map--loading" aria-hidden />,
});

export default function PropertyMapBlock({
  lat,
  lng,
  locale,
  card,
}: {
  lat: number;
  lng: number;
  locale?: string;
  card?: PropertyMapCard;
}) {
  // No WebGL → no map at all rather than a 500px empty box (see lib/webgl.ts).
  // The distances strip above still carries the location facts.
  const mapOk = useWebGLSupport();
  if (!mapOk) return null;
  return <PropertyMap lat={lat} lng={lng} locale={locale} card={card} />;
}
