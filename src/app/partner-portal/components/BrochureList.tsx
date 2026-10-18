"use client";
/** Materials page: client-side search over the brochure links (main-site project page + PDF). */
import { useMemo, useState } from "react";
import type { PartnerDict } from "@/lib/partner/i18n";
import type { BrochureRow } from "@/lib/partner/materials";
import { fill } from "./forms";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function BrochureList({ t, rows }: { t: PartnerDict; rows: BrochureRow[] }) {
  const M = t.materials;
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const words = norm(q).split(/\s+/).filter(Boolean);
    if (!words.length) return rows;
    return rows.filter((r) => {
      const hay = norm(`${r.name} ${r.town ?? ""}`);
      return words.every((w) => hay.includes(w));
    });
  }, [q, rows]);
  return (
    <>
      <label className="pp-sr" htmlFor="brochures-q">{M.search}</label>
      <input
        id="brochures-q" className="pp-search" type="search" value={q} placeholder={M.search} maxLength={100}
        onChange={(e) => setQ(e.target.value)}
      />
      <p className="pp-small pp-muted" aria-live="polite">{fill(M.shown, { count: String(shown.length) })}</p>
      {shown.length === 0 ? (
        <p className="pp-muted">{rows.length ? M.none : t.submit.projectsNone}</p>
      ) : (
        <ul className="pp-projlist">
          {shown.map((r) => (
            <li key={r.id}>
              <div className="pp-projlist-head">
                <span className="pp-projlist-name">{r.name}</span>
                {r.town && <span className="pp-muted"> · {r.town}</span>}
              </div>
              <div className="pp-projlist-rates">
                <a href={r.page} target="_blank" rel="noopener">{M.page}</a>
                <a href={r.pdf} target="_blank" rel="noopener">{M.pdf}</a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
