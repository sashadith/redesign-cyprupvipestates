"use client";
import type { BoardColumn, BoardCard } from "@/lib/crm/boardModel";

const eur = (n: number) => "€" + n.toLocaleString("en-US");

export function CardView({ card }: { card: BoardCard }) {
  return (
    <a className={`crm-card s-${card.status}`} href={`/admin/crm/${card.id}`} data-id={card.id}>
      <div className="c-top"><b>{card.name}</b>{card.lang && <span className="lang">{card.lang}</span>}</div>
      {card.project && <div className="c-proj">{card.project}</div>}
      <div className="c-meta">
        <span className={`src${card.isPartner ? " partner" : ""}`}>{card.sourceLabel}</span>
        <span className={`age${card.stale ? " warn" : ""}`}>{card.ageLabel}</span>
        {card.ownerInitials && <span className="av" title={card.ownerName ?? undefined}>{card.ownerInitials}</span>}
      </div>
      {card.dealValue != null && (
        <div className="c-deal"><span>{eur(card.dealValue)}</span>{card.dealCommission != null && <span className="comm">{card.status === "CLOSED" ? "Earned" : "Exp."} {eur(card.dealCommission)}</span>}</div>
      )}
    </a>
  );
}

export function Board({ columns }: { columns: BoardColumn[] }) {
  return (
    <div className="crm-boardwrap">
      <div className="crm-board">
        {columns.map((col) => (
          <section key={col.status} className={`crm-col s-${col.status}`} aria-label={col.label}>
            <div className="colh"><span className="dot" />{col.label}<span className="cnt">{col.cards.length}</span>{col.total > 0 && <span className="sum">€{Math.round(col.total / 1000)}k</span>}</div>
            {col.cards.map((c) => <CardView key={c.id} card={c} />)}
          </section>
        ))}
      </div>
    </div>
  );
}
