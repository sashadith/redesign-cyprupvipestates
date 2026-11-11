"use client";
/** Matched projects with their units, as in the CRM: tick a project, open it to narrow its units, name and note it. */
import type { DevelopmentMatch } from "@/lib/crm/matching";
import type { SentInfo } from "@/lib/crm/presentations/sentHistory";
import type { PartnerDict } from "@/lib/partner/i18n";
import { unitsToList } from "@/app/crm/components/presentationModalState";
import { fill } from "../forms";

export type Fmt = { money: (n: number | null) => string; day: (d: Date) => string };

const scoreClass = (s: number) => (s >= 80 ? "hi" : s >= 60 ? "mid" : "lo");

export function sentText(t: PartnerDict, fmt: Fmt, s: SentInfo): string {
  const B = t.presBuilder;
  const date = fmt.day(new Date(s.lastSentAt));
  const parts = [s.times > 1 ? fill(B.sentTimes, { n: String(s.times), date }) : fill(B.sentOnce, { date })];
  if (s.views > 0) parts.push(fill(B.sentViews, { n: String(s.views) }));
  if (s.favorited) parts.push(`♥ ${B.sentFavorite}`);
  return parts.join(" · ");
}

export function unitStatus(t: PartnerDict, s: string): string {
  const B = t.presBuilder;
  return s === "available" ? B.statusAvailable : s === "reserved" ? B.statusReserved : s === "sold" ? B.statusSold : s;
}

export function BuilderResults({
  t, fmt, results, loading, error, selected, expanded, showAll, unitOverrides, comments, aliases, sent,
  onToggleDev, onToggleExpand, onToggleShowAll, onToggleUnit, onComment, onAlias, onRetry, projectUrl,
}: {
  t: PartnerDict; fmt: Fmt; results: DevelopmentMatch[]; loading: boolean; error: string | null;
  selected: Set<string>; expanded: Set<string>; showAll: Set<string>;
  unitOverrides: Map<string, Set<string>>; comments: Map<string, string>; aliases: Map<string, string>; sent: Record<string, SentInfo>;
  onToggleDev: (id: string) => void; onToggleExpand: (id: string) => void; onToggleShowAll: (id: string) => void;
  onToggleUnit: (devId: string, unitId: string, defaultIds: string[]) => void;
  onComment: (devId: string, text: string) => void; onAlias: (devId: string, text: string) => void; onRetry: () => void;
  projectUrl: (slug: string | null) => string | null;
}) {
  const B = t.presBuilder;
  if (error) {
    return (
      <div className="pp-pb-empty" role="alert">
        <p className="pp-err">{error}</p>
        <button type="button" className="pp-btn pp-btn-ghost" onClick={onRetry}>{B.retry}</button>
      </div>
    );
  }
  if (results.length === 0) return <p className="pp-pb-empty pp-muted">{loading ? B.loading : B.none}</p>;
  return (
    <ul className={`pp-pb-results${loading ? " is-loading" : ""}`} aria-busy={loading}>
      {results.map((m) => {
        const d = m.development;
        const isOpen = expanded.has(d.id);
        const isSel = selected.has(d.id);
        const defaultIds = m.matchedUnits.filter((u) => u.status === "available").map((u) => u.id);
        const checked = unitOverrides.get(d.id);
        const showingAll = showAll.has(d.id);
        const list = unitsToList(m, showingAll, checked);
        const extra = m.allAvailableUnits.length - unitsToList(m, false, checked).length;
        const byId = new Map(m.allAvailableUnits.map((u) => [u.id, u] as const));
        const picked = checked ?? new Set(defaultIds);
        const prices = Array.from(picked).map((id) => byId.get(id)?.price).filter((p): p is number => p != null);
        const priceFrom = prices.length ? Math.min(...prices) : d.priceFrom;
        const place = [d.district || d.town, d.area].filter(Boolean).join(" · ");
        const s = sent[d.id];
        const url = projectUrl(d.slug);
        return (
          <li key={d.id} className={isSel ? "on" : undefined}>
            <div className="pp-pb-row">
              <input type="checkbox" checked={isSel} onChange={() => onToggleDev(d.id)} aria-label={`${B.include}: ${d.publicName}`} />
              {d.mainImage
                // eslint-disable-next-line @next/next/no-img-element -- small mirrored thumbnail
                ? <img src={d.mainImage} alt="" className="pp-pb-thumb" loading="lazy" />
                : <span className="pp-pb-thumb" aria-hidden="true" />}
              <div className="pp-pb-main">
                <div className="pp-pb-name">
                  {url ? <a href={url} target="_blank" rel="noopener noreferrer">{d.publicName}</a> : <b>{d.publicName}</b>}
                </div>
                <div className="pp-pb-meta">
                  <span>{place || "—"}</span>
                  <span>{fill(B.delivery, { date: d.completion || "—" })}</span>
                  <span>{fill(B.from, { price: fmt.money(priceFrom) })}</span>
                  <span>{fill(B.unitsMatching, { n: String(d.unitsAvailable) })}</span>
                </div>
                {s && <div className="pp-pb-sent">{sentText(t, fmt, s)}</div>}
              </div>
              <span className={`pp-pb-score ${scoreClass(m.score)}`} title={fill(B.match, { n: String(m.score) })}>{m.score}%</span>
              <button type="button" className="pp-pb-expand" aria-expanded={isOpen} onClick={() => onToggleExpand(d.id)}>
                {isOpen ? B.hideUnits : B.showUnits}
              </button>
            </div>
            {isOpen && (
              <div className="pp-pb-units">
                {isSel && (
                  <div className="pp-pb-fields">
                    <label>{B.alias}
                      <input value={aliases.get(d.id) ?? ""} maxLength={120} placeholder={d.publicName} onChange={(e) => onAlias(d.id, e.target.value)} />
                    </label>
                    <label>{B.note}
                      <input value={comments.get(d.id) ?? ""} maxLength={300} placeholder={B.notePlaceholder} onChange={(e) => onComment(d.id, e.target.value)} />
                    </label>
                  </div>
                )}
                {m.allAvailableUnits.length === 0 ? (
                  <p className="pp-muted pp-small">{B.noUnitData}</p>
                ) : (
                  <>
                    <UnitTable t={t} fmt={fmt} units={list} isChecked={(id) => (checked ? checked.has(id) : defaultIds.includes(id))}
                      onToggle={(id) => onToggleUnit(d.id, id, defaultIds)} />
                    {(showingAll || extra > 0) && (
                      <button type="button" className="pp-linkbtn" onClick={() => onToggleShowAll(d.id)}>
                        {showingAll ? B.showMatching : fill(B.showAll, { n: String(extra) })}
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function UnitTable({ t, fmt, units, isChecked, onToggle }: {
  t: PartnerDict; fmt: Fmt;
  units: { id: string; ref: string | null; label: string | null; type: string | null; beds: string | null; areaBuilt: string | null; price: number | null; status: string }[];
  isChecked: (id: string) => boolean; onToggle: (id: string) => void;
}) {
  const B = t.presBuilder;
  return (
    <div className="pp-pb-unitwrap">
      <table>
        <thead>
          <tr><th scope="col"><span className="pp-sr">{B.include}</span></th><th scope="col">{B.unitRef}</th><th scope="col">{B.unitType}</th>
            <th scope="col">{B.unitBeds}</th><th scope="col">{B.unitArea}</th><th scope="col">{B.unitPrice}</th><th scope="col">{B.unitStatus}</th></tr>
        </thead>
        <tbody>
          {units.map((u) => (
            <tr key={u.id}>
              <td><input type="checkbox" disabled={u.status !== "available"} checked={isChecked(u.id)} onChange={() => onToggle(u.id)}
                aria-label={`${B.unitRef} ${u.ref || u.label || ""}`} /></td>
              <td>{u.ref || u.label || "—"}</td>
              <td>{u.type || "—"}</td>
              <td>{u.beds || "—"}</td>
              <td>{u.areaBuilt || "—"}</td>
              <td>{fmt.money(u.price)}</td>
              <td>{unitStatus(t, u.status)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
