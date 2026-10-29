"use client";
import type { EditorItem } from "@/lib/crm/presentations/editorItems";
import { selectionPriceFrom } from "@/lib/crm/selectionPriceFrom";

// "In this selection" of the edit modal: the projects already sent, with the
// old editor's per-item controls (PresentationEditor.tsx): order, alias,
// comment, unit picks, remove.

const fmtPrice = (n: number | null) => (n == null ? "—" : `€${n.toLocaleString("en-US")}`);

export function PresentationSelection({
  items, favorited, expanded, onToggleExpand, onMove, onAlias, onComment, onToggleUnit, onRemove,
}: {
  items: EditorItem[]; favorited: ReadonlySet<string>; expanded: ReadonlySet<string>;
  onToggleExpand: (id: string) => void; onMove: (index: number, dir: -1 | 1) => void;
  onAlias: (id: string, v: string) => void; onComment: (id: string, v: string) => void;
  onToggleUnit: (id: string, unitId: string) => void; onRemove: (it: EditorItem) => void;
}) {
  if (items.length === 0) {
    return <p className="crm-pres-empty crm-muted">No projects in this selection — add at least one below.</p>;
  }
  return (
    <ul className="crm-pres-results crm-pres-sel">
      {items.map((it, i) => {
        const isOpen = expanded.has(it.developmentId);
        const available = it.units.filter((u) => u.status === "available").length;
        const fav = favorited.has(it.developmentId);
        const place = [it.district || it.town, it.area].filter(Boolean).join(" · ");
        return (
          <li key={it.developmentId}>
            <div className="crm-pres-row crm-pres-selrow">
              <span className="crm-pres-order">
                <button type="button" aria-label={`Move ${it.publicName} up`} title="Move up" disabled={i === 0} onClick={() => onMove(i, -1)}>▲</button>
                <button type="button" aria-label={`Move ${it.publicName} down`} title="Move down" disabled={i === items.length - 1} onClick={() => onMove(i, 1)}>▼</button>
              </span>
              {it.mainImage
                // eslint-disable-next-line @next/next/no-img-element -- small CMS/vendor thumbnail, any host
                ? <img src={it.mainImage} alt="" className="crm-pres-thumb" loading="lazy" />
                : <span className="crm-pres-thumb" aria-hidden="true" />}
              <div className="crm-pres-main">
                <div className="crm-pres-name">
                  {fav && <span className="crm-pres-fav" title="The client favorited this project">♥ </span>}
                  <b>{it.publicName}</b>
                  {it.isNew && <span className="crm-pres-new">New</span>}
                </div>
                <div className="crm-pres-meta">
                  <span>{place || "—"}</span>
                  <span>from {fmtPrice(selectionPriceFrom(it.units, it.checkedUnitIds, it.priceFrom))}</span>
                </div>
                {it.units.length > 0 && available === 0 && (
                  <div className="crm-pres-sent">This development is sold out — consider removing it.</div>
                )}
              </div>
              <button type="button" className="crm-pres-expand" aria-expanded={isOpen} title="Show units" onClick={() => onToggleExpand(it.developmentId)}>
                {isOpen ? "▾" : "▸"} <span className="crm-pres-unitcount">{it.checkedUnitIds.length}/{it.units.length}</span>
              </button>
              <button type="button" className="crm-pres-remove" aria-label={`Remove ${it.publicName}`} title="Remove" onClick={() => onRemove(it)}>×</button>
            </div>
            <div className="crm-pres-units crm-pres-selfields">
              <label className="crm-pres-field">Name shown to the client
                <input value={it.aliasName} maxLength={120} placeholder={it.publicName} onChange={(e) => onAlias(it.developmentId, e.target.value)} />
              </label>
              <label className="crm-pres-field">Advisor&apos;s note
                <input value={it.advisorComment} maxLength={300} placeholder="Personal note shown on this card (optional)"
                  onChange={(e) => onComment(it.developmentId, e.target.value)} />
              </label>
              {isOpen && (it.units.length === 0 ? (
                <p className="crm-muted wide">No individual unit data for this project — the whole project&apos;s available units will show.</p>
              ) : (
                <div className="crm-pres-unitwrap wide">
                  <table>
                    <thead><tr><th aria-label="Include" /><th>Ref</th><th>Type</th><th>Beds</th><th>Area</th><th>Price</th><th>Status</th></tr></thead>
                    <tbody>
                      {it.units.map((u) => (
                        <tr key={u.id}>
                          <td><input type="checkbox" disabled={u.status !== "available"} checked={it.checkedUnitIds.includes(u.id)}
                            onChange={() => onToggleUnit(it.developmentId, u.id)} aria-label={`Unit ${u.ref || u.label || u.id}`} /></td>
                          <td>{u.ref || u.label || "—"}</td>
                          <td>{u.type || "—"}</td>
                          <td>{u.beds || "—"}</td>
                          <td>{u.areaBuilt || "—"}</td>
                          <td>{fmtPrice(u.price)}</td>
                          <td className="cap">{u.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
