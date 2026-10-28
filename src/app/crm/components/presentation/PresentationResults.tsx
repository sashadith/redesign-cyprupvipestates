"use client";
import type { DevelopmentMatch } from "@/lib/crm/matching";
import { fmtRate, RATE_SOURCE_SHORT } from "@/lib/crm/rateFormat";
import { sentLabel, type SentInfo } from "@/lib/crm/presentations/sentHistory";

// Matched projects with their units, as in the old matching table: tick a
// project, open it to narrow its units (or add near-misses via "show all"),
// and leave a one-line note for the client.

const fmtPrice = (n: number | null) => (n == null ? "—" : `€${n.toLocaleString("en-US")}`);
const scoreClass = (s: number) => (s >= 80 ? "hi" : s >= 60 ? "mid" : "lo");

export function PresentationResults({
  results, loading, error, selected, expanded, showAll, unitOverrides, comments, sent,
  onToggleDev, onToggleExpand, onToggleShowAll, onToggleUnit, onComment, onRetry,
}: {
  results: DevelopmentMatch[]; loading: boolean; error: string | null;
  selected: Set<string>; expanded: Set<string>; showAll: Set<string>;
  unitOverrides: Map<string, Set<string>>; comments: Map<string, string>; sent: Record<string, SentInfo>;
  onToggleDev: (id: string) => void; onToggleExpand: (id: string) => void; onToggleShowAll: (id: string) => void;
  onToggleUnit: (devId: string, unitId: string, allAvailableIds: string[]) => void;
  onComment: (devId: string, text: string) => void; onRetry: () => void;
}) {
  if (error) {
    return (
      <div className="crm-pres-empty" role="alert">
        <p className="crm-dialog-error">{error}</p>
        <button type="button" className="crm-btn" onClick={onRetry}>Try again</button>
      </div>
    );
  }
  if (results.length === 0) {
    return <p className="crm-pres-empty crm-muted">{loading ? "Matching…" : "No published developments match these filters."}</p>;
  }
  return (
    <ul className={`crm-pres-results${loading ? " is-loading" : ""}`} aria-busy={loading}>
      {results.map((m) => {
        const d = m.development;
        const isOpen = expanded.has(d.id);
        const isSel = selected.has(d.id);
        // Default preselection = the EXACT matches; "show all" reveals every
        // available unit so a deliberate near-miss can be added by hand.
        const defaultCheckedIds = m.matchedUnits.filter((u) => u.status === "available").map((u) => u.id);
        const checkedUnits = unitOverrides.get(d.id);
        const showingAll = showAll.has(d.id);
        const unitsToShow = showingAll ? m.allAvailableUnits : m.matchedUnits;
        const extraCount = m.allAvailableUnits.length - m.matchedUnits.length;
        // "Price from" follows the selected units, not the stored project field.
        const unitById = new Map(m.allAvailableUnits.map((u) => [u.id, u] as const));
        const selectedIds = checkedUnits ?? new Set(defaultCheckedIds);
        const prices = Array.from(selectedIds).map((id) => unitById.get(id)?.price).filter((p): p is number => p != null);
        const priceFrom = prices.length ? Math.min(...prices) : null;
        const place = d.district || d.town || d.area;
        const s = sent[d.id];
        const rateTitle = d.commission.source === "PROJECT" ? "Project rate (overrides the developer default)"
          : d.commission.source === "DEVELOPER" ? "Developer default" : "No rate set for this developer or project";
        return (
          <li key={d.id} className={isSel ? "on" : undefined}>
            <div className="crm-pres-row">
              <input type="checkbox" checked={isSel} onChange={() => onToggleDev(d.id)} aria-label={`Include ${d.publicName}`} />
              {d.mainImage
                // eslint-disable-next-line @next/next/no-img-element -- small CMS/vendor thumbnail, any host
                ? <img src={d.mainImage} alt="" className="crm-pres-thumb" loading="lazy" />
                : <span className="crm-pres-thumb" aria-hidden="true" />}
              <div className="crm-pres-main">
                <div className="crm-pres-name">
                  {d.publishStatus === "published" && d.slug
                    ? <a href={`/projects/${d.slug}`} target="_blank" rel="noopener noreferrer">{d.publicName}</a>
                    : <b>{d.publicName}</b>}
                  {d.developer && <span className="crm-muted"> · {d.developer}</span>}
                </div>
                <div className="crm-pres-meta">
                  <span>{place ? `${place}${d.area && (d.district || d.town) ? ` · ${d.area}` : ""}` : "—"}</span>
                  <span>Delivery {d.completion || "—"}</span>
                  <span>from {fmtPrice(priceFrom)}</span>
                  <span title={rateTitle}>
                    {fmtRate(d.commission.ratePercent)}{d.commission.ratePercent != null && ` ${RATE_SOURCE_SHORT[d.commission.source]}`}
                  </span>
                  <span>{d.unitsAvailable} available</span>
                </div>
                {s && <div className="crm-pres-sent">{sentLabel(s)}</div>}
              </div>
              <span className={`crm-pres-score ${scoreClass(m.score)}`}>{m.score}%</span>
              <button type="button" className="crm-pres-expand" aria-expanded={isOpen} title="Show units" onClick={() => onToggleExpand(d.id)}>{isOpen ? "▾" : "▸"}</button>
            </div>
            {isOpen && (
              <div className="crm-pres-units">
                {isSel && (
                  <input className="crm-pres-comment" value={comments.get(d.id) ?? ""} maxLength={300}
                    onChange={(e) => onComment(d.id, e.target.value)}
                    placeholder="Advisor's note for this property (optional, one line)" aria-label={`Note for ${d.publicName}`} />
                )}
                {m.allAvailableUnits.length === 0 ? (
                  <p className="crm-muted">No individual unit data for this project — the whole project&apos;s available units will show.</p>
                ) : (
                  <>
                    {m.matchedUnits.length === 0 && <p className="crm-muted">No units match this filter exactly.</p>}
                    <div className="crm-pres-unitwrap">
                      <table>
                        <thead><tr><th aria-label="Include" /><th>Ref</th><th>Type</th><th>Beds</th><th>Area</th><th>Price</th><th>Status</th></tr></thead>
                        <tbody>
                          {unitsToShow.map((u) => {
                            const checked = checkedUnits ? checkedUnits.has(u.id) : defaultCheckedIds.includes(u.id);
                            return (
                              <tr key={u.id}>
                                <td><input type="checkbox" disabled={u.status !== "available"} checked={checked}
                                  onChange={() => onToggleUnit(d.id, u.id, defaultCheckedIds)} aria-label={`Unit ${u.ref || u.label || u.id}`} /></td>
                                <td>{u.ref || u.label || "—"}</td>
                                <td>{u.type || "—"}</td>
                                <td>{u.beds || "—"}</td>
                                <td>{u.areaBuilt || "—"}</td>
                                <td>{fmtPrice(u.price)}</td>
                                <td className="cap">{u.status}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {extraCount > 0 && (
                      <button type="button" className="crm-linkbtn" onClick={() => onToggleShowAll(d.id)}>
                        {showingAll ? "Show only matching units" : `Show all units (${extraCount} more)`}
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
