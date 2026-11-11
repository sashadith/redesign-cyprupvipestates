"use client";
/** Edit mode, "In this presentation": order, name for the client, note, unit picks, remove (as the CRM's PresentationSelection). */
import type { EditorItem } from "@/lib/crm/presentations/editorItems";
import { selectionPriceFrom } from "@/lib/crm/selectionPriceFrom";
import type { PartnerDict } from "@/lib/partner/i18n";
import { fill } from "../forms";
import { UnitTable, placeLine, type Fmt } from "./BuilderResults";

export function BuilderSelection({ t, fmt, items, favorited, expanded, onToggleExpand, onMove, onAlias, onComment, onToggleUnit, onRemove }: {
  t: PartnerDict; fmt: Fmt; items: EditorItem[]; favorited: ReadonlySet<string>; expanded: ReadonlySet<string>;
  onToggleExpand: (id: string) => void; onMove: (index: number, dir: -1 | 1) => void;
  onAlias: (id: string, v: string) => void; onComment: (id: string, v: string) => void;
  onToggleUnit: (id: string, unitId: string) => void; onRemove: (it: EditorItem) => void;
}) {
  const B = t.presBuilder;
  if (items.length === 0) return <p className="pp-pb-empty pp-muted">{B.emptySelection}</p>;
  return (
    <ul className="pp-pb-results pp-pb-sel">
      {items.map((it, i) => {
        const isOpen = expanded.has(it.developmentId);
        const available = it.units.filter((u) => u.status === "available").length;
        const place = placeLine(it.district || it.town, it.area);
        return (
          <li key={it.developmentId}>
            <div className="pp-pb-row">
              <span className="pp-pb-order">
                <button type="button" aria-label={`${B.moveUp}: ${it.publicName}`} title={B.moveUp} disabled={i === 0} onClick={() => onMove(i, -1)}>▲</button>
                <button type="button" aria-label={`${B.moveDown}: ${it.publicName}`} title={B.moveDown} disabled={i === items.length - 1} onClick={() => onMove(i, 1)}>▼</button>
              </span>
              {it.mainImage
                // eslint-disable-next-line @next/next/no-img-element -- small mirrored thumbnail
                ? <img src={it.mainImage} alt="" className="pp-pb-thumb" loading="lazy" />
                : <span className="pp-pb-thumb" aria-hidden="true" />}
              <div className="pp-pb-main">
                <div className="pp-pb-name">
                  {favorited.has(it.developmentId) && <span className="pp-pb-fav" title={B.sentFavorite}>♥ </span>}
                  <b>{it.publicName}</b>
                  {it.isNew && <span className="pp-pb-new">{B.newBadge}</span>}
                </div>
                <div className="pp-pb-meta">
                  <span>{place || "—"}</span>
                  <span>{fill(B.from, { price: fmt.money(selectionPriceFrom(it.units, it.checkedUnitIds, it.priceFrom)) })}</span>
                  {it.units.length > 0 && <span>{fill(B.unitsPicked, { n: String(it.checkedUnitIds.length), total: String(it.units.length) })}</span>}
                </div>
                {it.units.length > 0 && available === 0 && <div className="pp-pb-sent">{B.soldOut}</div>}
              </div>
              <button type="button" className="pp-pb-expand" aria-expanded={isOpen} onClick={() => onToggleExpand(it.developmentId)}>
                {isOpen ? B.hideUnits : B.showUnits}
              </button>
              <button type="button" className="pp-pb-remove" aria-label={`${B.remove}: ${it.publicName}`} title={B.remove} onClick={() => onRemove(it)}>×</button>
            </div>
            <div className="pp-pb-units">
              <div className="pp-pb-fields">
                <label>{B.alias}
                  <input value={it.aliasName} maxLength={120} placeholder={it.publicName} onChange={(e) => onAlias(it.developmentId, e.target.value)} />
                </label>
                <label>{B.note}
                  <input value={it.advisorComment} maxLength={300} placeholder={B.notePlaceholder} onChange={(e) => onComment(it.developmentId, e.target.value)} />
                </label>
              </div>
              {isOpen && (it.units.length === 0
                ? <p className="pp-muted pp-small">{B.noUnitData}</p>
                : <UnitTable t={t} fmt={fmt} units={it.units} isChecked={(id) => it.checkedUnitIds.includes(id)} onToggle={(id) => onToggleUnit(it.developmentId, id)} />)}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
