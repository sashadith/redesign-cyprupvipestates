"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Lightbox from "@/app/preview-project/Lightbox";
import OverlayGallery from "./OverlayGallery";
import type { PLocale } from "./copy";
import { COPY } from "./copy";
import { splitDescriptionParagraphs } from "@/lib/text";
import { iconFor } from "@/app/preview-project/amenityIcons";
import DistancesStrip from "@/app/components/DistancesStrip/DistancesStrip";

export type OverlayUnit = {
  id: string; ref: string; label: string; type: string; beds: string; areaBuilt: string;
  price: number | null; currency: string; status: string;
};

export default function PropertyOverlay({
  open, onClose, publicName, gallery, description, amenities, units, distances, locale,
}: {
  open: boolean;
  onClose: () => void;
  publicName: string;
  gallery: string[];
  description: string;
  amenities: string[];
  units: OverlayUnit[];
  distances?: Record<string, number> | null;
  locale: PLocale;
}) {
  const c = COPY[locale];
  const [lbIndex, setLbIndex] = useState<number | null>(null);
  // Always-current lbIndex for the Escape handler below, kept OUT of the lock
  // effect's own dependency array — see the comment there for why.
  const lbIndexRef = useRef(lbIndex);
  lbIndexRef.current = lbIndex;

  // Same lock-the-page-while-open pattern as Lightbox.tsx: native scroll +
  // Lenis + Escape-to-close. Deliberately depends on [open, onClose] only —
  // NOT lbIndex. Previously lbIndex was in the deps, so opening/closing the
  // lightbox tore this effect down and rebuilt it every time, each time
  // re-capturing prevOverflow from the ALREADY-"hidden" state instead of the
  // true pre-lock value. The last rebuild (right before the overlay itself
  // closes) would then restore to "hidden" instead of "", permanently
  // breaking page scroll. Reading lbIndex via a ref keeps the Escape
  // behaviour correct without tearing the lock down on every lightbox toggle.
  useEffect(() => {
    if (!open) return;
    const lenis = (window as any).lenis;
    lenis?.stop();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && lbIndexRef.current === null) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      lenis?.start();
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="cp-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="cp-overlay__panel" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="cp-overlay__close" onClick={onClose} aria-label="Close">✕</button>

        <OverlayGallery gallery={gallery} alt={publicName} onOpen={setLbIndex} />

        <div className="cp-overlay__body">
          <h2 className="cp-overlay__title">{publicName}</h2>
          {description && splitDescriptionParagraphs(description).map((lines, i) => (
            <p key={i} className="cp-overlay__desc">
              {lines.map((line, j) => (
                <Fragment key={j}>
                  {line}
                  {j < lines.length - 1 && <br />}
                </Fragment>
              ))}
            </p>
          ))}

          {amenities.length > 0 && (
            <div className="cp-overlay__amenities">
              {amenities.map((a) => (
                <span key={a} className="cp-overlay__amenity">
                  <span className="cp-overlay__amenity-ic">{iconFor(a)}</span>
                  {a}
                </span>
              ))}
            </div>
          )}

          {distances && <DistancesStrip distances={distances} lang={locale} variant="compact" />}

          {units.length > 0 && (
            <div className="cp-overlay__units">
              <h3>{c.availableUnits}</h3>
              <table>
                <thead>
                  <tr>
                    <th>{c.unitsTable.ref}</th>
                    <th>{c.unitsTable.type}</th>
                    <th>{c.unitsTable.beds} / {c.unitsTable.area}</th>
                    <th>{c.unitsTable.price} / {c.unitsTable.status}</th>
                  </tr>
                </thead>
                <tbody>
                  {units.map((u) => (
                    <tr key={u.id}>
                      <td>{u.ref || u.label || "-"}</td>
                      <td>{u.type || "-"}</td>
                      <td>
                        <div className="cp-overlay__stack">
                          <span>{u.beds || "-"}</span>
                          <span className="cp-overlay__stack-sub">{u.areaBuilt || "-"}</span>
                        </div>
                      </td>
                      <td>
                        <div className="cp-overlay__stack">
                          <span>{u.price != null ? `€${u.price.toLocaleString("en-US")}` : "-"}</span>
                          <span className={`cp-unit-status cp-unit-status--${u.status}`}>{c.statusLabel[u.status] ?? u.status}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      <Lightbox images={gallery} index={lbIndex} onClose={() => setLbIndex(null)} onIndex={setLbIndex} alt={publicName} />
    </div>,
    document.body,
  );
}
