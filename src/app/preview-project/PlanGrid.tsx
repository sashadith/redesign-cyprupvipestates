"use client";

import React, { useState } from "react";
import { atSize } from "./imageSize";
import Lightbox from "./Lightbox";

/* Grid of renders / floor plans that opens in the shared lightbox (thumbnail
   strip, keyboard nav) — no new tab, no white letterbox borders. */
export default function PlanGrid({ images }: { images: string[] }) {
  const imgs = images.filter(Boolean);
  const [open, setOpen] = useState<number | null>(null);
  if (imgs.length === 0) return null;

  return (
    <>
      <div className="pp-plans">
        {imgs.slice(0, 12).map((src, i) => (
          <button className="pp-plan" type="button" key={i} onClick={() => setOpen(i)} aria-label={`Enlarge image ${i + 1}`}>
            <img src={atSize(src, "medium")} alt={`Visualisation ${i + 1}`} loading="lazy" />
          </button>
        ))}
      </div>
      <Lightbox images={imgs} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />
    </>
  );
}
