"use client";

import { useState } from "react";

/* Photos and floor plans in one strip, because that is how they are looked at:
   "what does it look like" and "how is it laid out" are one question asked
   twice. Plans keep their own label so a plan is never mistaken for a room.

   Some plans are PDFs (the Drive sync converts most, not all — see
   FloorPlansManager). A PDF cannot go in an <img>, so it gets a thumbnail that
   says so and opens in a new tab instead of entering the cycle. */

type Shot = { url: string; kind: "photo" | "plan" };

const isPdf = (u: string) => /\.pdf(\?|$)/i.test(u);

export default function Gallery({ shots }: { shots: Shot[] }) {
  const viewable = shots.filter((s) => !isPdf(s.url));
  const pdfs = shots.filter((s) => isPdf(s.url));
  const [i, setI] = useState(0);

  if (!viewable.length && !pdfs.length) {
    return <div className="ck__shot"><div className="ck__shotEmpty">No images yet</div></div>;
  }

  const current = viewable[Math.min(i, viewable.length - 1)];
  const step = () => setI((n) => (n + 1) % viewable.length);

  return (
    <div>
      {current ? (
        <button type="button" onClick={step} className="ck__shot" style={{ width: "100%", padding: 0, border: 0, cursor: viewable.length > 1 ? "pointer" : "default" }}
          aria-label={viewable.length > 1 ? "Show next image" : "Project image"}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={current.url} alt={current.kind === "plan" ? "Floor plan" : "Project photo"} loading="lazy" />
          <span className="ck__counter">{Math.min(i, viewable.length - 1) + 1} / {viewable.length}</span>
        </button>
      ) : (
        <div className="ck__shot"><div className="ck__shotEmpty">Plans are PDFs only</div></div>
      )}

      <div className="ck__thumbs">
        {viewable.map((s, n) => (
          <button key={s.url + n} type="button" className="ck__thumb" aria-current={n === i} onClick={() => setI(n)}
            title={s.kind === "plan" ? "Floor plan" : "Photo"}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s.url} alt="" loading="lazy" />
          </button>
        ))}
        {pdfs.map((s, n) => (
          <a key={s.url + n} href={s.url} target="_blank" rel="noopener noreferrer" className="ck__thumb" title="Floor plan (PDF)">
            <span className="ck__thumbPdf">PDF</span>
          </a>
        ))}
      </div>
    </div>
  );
}
