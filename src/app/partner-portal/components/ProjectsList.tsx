"use client";
/** Projects page: client-side search over the partner's published projects and rates. */
import { useMemo, useState } from "react";
import type { PartnerDict, PartnerLocale } from "@/lib/partner/i18n";
import { fill } from "./forms";

export type ProjectRowView = {
  id: string;
  name: string;
  town: string | null;
  url: string | null;
  handoverRate: number | null;
  fixRate: number | null;
  ourRate: number | null;
};

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

type Props = { t: PartnerDict; locale: PartnerLocale; projects: ProjectRowView[]; trustMode: boolean };

export function ProjectsList({ t, locale, projects, trustMode }: Props) {
  const T = t.projectsPage;
  const [q, setQ] = useState("");
  const pct = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }), [locale]);
  const rate = (r: number | null) => (r == null ? T.onRequest : fill(T.pct, { rate: pct.format(r) }));
  const shown = useMemo(() => {
    const words = norm(q).split(/\s+/).filter(Boolean);
    if (!words.length) return projects;
    return projects.filter((p) => {
      const hay = norm(`${p.name} ${p.town ?? ""}`);
      return words.every((w) => hay.includes(w));
    });
  }, [q, projects]);

  return (
    <section className="pp-panel">
      <label className="pp-sr" htmlFor="projects-q">{T.search}</label>
      <input
        id="projects-q" className="pp-search" type="search" value={q} placeholder={T.search} maxLength={100}
        onChange={(e) => setQ(e.target.value)}
      />
      <p className="pp-small pp-muted" aria-live="polite">{fill(T.shown, { count: String(shown.length) })}</p>
      {shown.length === 0 ? (
        <p className="pp-muted">{projects.length ? T.none : t.submit.projectsNone}</p>
      ) : (
        <ul className="pp-projlist">
          {shown.map((p) => (
            <li key={p.id}>
              <div className="pp-projlist-head">
                {p.url ? (
                  <a href={p.url} target="_blank" rel="noopener noreferrer" className="pp-projlist-name">{p.name}</a>
                ) : (
                  <span className="pp-projlist-name">{p.name}</span>
                )}
                {p.town && <span className="pp-muted"> · {p.town}</span>}
              </div>
              <div className="pp-projlist-rates">
                <span>{t.submit.tabHandover}: <strong className="pp-figure-sm">{rate(p.handoverRate)}</strong></span>
                <span>{t.submit.tabFix}: <strong className="pp-figure-sm">{rate(p.fixRate)}</strong></span>
                {trustMode && <span>{T.ourRate}: <strong className="pp-figure-sm">{rate(p.ourRate)}</strong></span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
