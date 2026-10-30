"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { BoardColumn, BoardCard } from "@/lib/crm/boardModel";
import { FUNNEL_STATUSES, SIDE_STATUSES, STATUS_LABEL, type LeadStatusValue } from "@/lib/crm/leadStatus";
import { useMoveFlow, type MoveRequest } from "./useMoveFlow";
import { useToast } from "./Toast";
import { TemperatureDot } from "./TemperatureDot";

const eur = (n: number) => "€" + n.toLocaleString("en-US");
const MENU_TARGETS: LeadStatusValue[] = [...FUNNEL_STATUSES, "KEEP_CONTACT", "LOST"];

type DragProps = {
  onDragStart: (id: string) => void; onDragEnd: () => void; onKeyMove: (id: string, dir: 1 | -1) => void;
  onMenu: (id: string, to: LeadStatusValue) => void; popId: string | null;
};

export function CardView({ card, drag: dragAll }: { card: BoardCard; drag?: DragProps }) {
  // Cards the user may not edit (canEditLead on the server) cannot be moved at all.
  const drag = card.canEdit ? dragAll : undefined;
  const [menu, setMenu] = useState(false);
  // Desktop: open upward when the card sits in the lower half of the viewport.
  const [up, setUp] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const moveBtn = useRef<HTMLButtonElement>(null);

  function toggleMenu() {
    if (!menu) {
      const r = moveBtn.current?.getBoundingClientRect();
      setUp(!!r && r.top > window.innerHeight / 2);
    }
    setMenu((m) => !m);
  }

  // Close the menu on an outside click or Escape.
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) setMenu(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setMenu(false); moveBtn.current?.focus(); } };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [menu]);

  return (
    <div
      ref={wrap}
      className={`crm-cardwrap${menu ? " menu-open" : ""}`}
      // Keyboard focus leaving the card closes the menu. A null relatedTarget
      // (a click on a non-focusable spot, or Safari's unfocused buttons) is left
      // to the outside-pointerdown handler, so a click on an item still lands.
      onBlur={(e) => { if (menu && e.relatedTarget && !e.currentTarget.contains(e.relatedTarget as Node)) setMenu(false); }}
    >
      <a
        className={`crm-card s-${card.status}${card.urgency ? ` u-${card.urgency.level}` : ""}${drag?.popId === card.id ? " pop" : ""}`}
        href={`/crm/leads/${card.id}`}
        data-id={card.id}
        draggable={!!drag}
        aria-keyshortcuts={drag ? "ArrowLeft ArrowRight" : undefined}
        onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", card.id); e.currentTarget.classList.add("drag"); drag?.onDragStart(card.id); }}
        onDragEnd={(e) => { e.currentTarget.classList.remove("drag"); drag?.onDragEnd(); }}
        onKeyDown={(e) => {
          if (!drag || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
          if (e.key === "ArrowRight") { e.preventDefault(); drag.onKeyMove(card.id, 1); }
          if (e.key === "ArrowLeft") { e.preventDefault(); drag.onKeyMove(card.id, -1); }
        }}
      >
        <div className="c-top"><b>{card.temperature && <TemperatureDot temperature={card.temperature} />}{card.name}</b>{card.lang && <span className="lang">{card.lang}</span>}</div>
        {card.project && <div className="c-proj">{card.project}</div>}
        <div className="c-meta">
          <span className={`src${card.isPartner ? " partner" : ""}`}>{card.sourceLabel}</span>
          <span className={`age${card.stale && !card.urgency ? " warn" : ""}`}>{card.ageLabel}</span>
          {card.ownerInitials
            ? <span className="av" title={card.ownerName ?? undefined}>{card.ownerInitials}</span>
            : <span className="av none" title="Unassigned">—</span>}
        </div>
        {card.urgency && (
          <div className="c-urg"><span className={`urg ${card.urgency.level}`} title={card.urgency.reason}>{card.urgency.label}</span></div>
        )}
        {card.dealValue != null && (
          <div className="c-deal"><span>{eur(card.dealValue)}</span>{card.dealCommission != null && <span className="comm">{card.status === "CLOSED" ? "Earned" : "Exp."} {eur(card.dealCommission)}</span>}</div>
        )}
      </a>
      {drag && (
        <>
          <button ref={moveBtn} type="button" className="crm-move" aria-expanded={menu} aria-label={`Move ${card.name}`} onClick={toggleMenu}>Move</button>
          {menu && (
            <div className={`crm-menu${up ? " up" : ""}`} aria-label={`Move ${card.name} to`}>
              <div className="sheet-title">Move {card.name} to…</div>
              {MENU_TARGETS.filter((s) => s !== card.status).map((s, i) => (
                <button type="button" key={s} className={`s-${s}`} autoFocus={i === 0} onClick={() => { setMenu(false); drag.onMenu(card.id, s); }}>
                  <span className="dot" />{STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

type BoardMove = MoveRequest & { refocus: boolean };

// Stable default: a fresh [] per render would re-run the reset effect forever.
const NO_SIDE: BoardColumn[] = [];
const isSide = (s: LeadStatusValue) => (SIDE_STATUSES as readonly string[]).includes(s);

// `side` = Keep contact + Lost (buildSide). They share one state with the funnel
// columns, so a move between a list and a column is the same move as between columns.
export function Board({ columns: funnel, side = NO_SIDE, sideTotal = 0 }: { columns: BoardColumn[]; side?: BoardColumn[]; sideTotal?: number }) {
  const router = useRouter();
  const toast = useToast();
  const initial = useMemo(() => [...funnel, ...side], [funnel, side]);
  const [columns, setColumns] = useState(initial);
  const [open, setOpen] = useState<LeadStatusValue | null>(null);
  const [popId, setPopId] = useState<string | null>(null);
  const dragId = useRef<string | null>(null);
  // Always the latest board, so a move snapshots what is on screen right now
  // rather than what an older render closed over.
  const colsRef = useRef(columns);
  colsRef.current = columns;
  const popTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setColumns(initial), [initial]);
  useEffect(() => () => { if (popTimer.current) clearTimeout(popTimer.current); }, []);

  const find = (id: string) => colsRef.current.flatMap((c) => c.cards).find((c) => c.id === id);

  // Cards remount when they change column, so keyboard/menu focus is put back by hand.
  function focusCard(id: string) {
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`.crm-card[data-id="${CSS.escape(id)}"]`)?.focus());
  }

  // Put one card back where it was (column and position), leaving every other
  // card as it is now: a failed move must not undo moves that succeeded meanwhile.
  function restoreCard(card: BoardCard, index: number) {
    setColumns((cols) => cols.map((c) => {
      const rest = c.cards.filter((x) => x.id !== card.id);
      if (c.status !== card.status) return rest.length === c.cards.length ? c : { ...c, cards: rest };
      const i = Math.min(index, rest.length);
      return { ...c, cards: [...rest.slice(0, i), card, ...rest.slice(i)] };
    }));
  }

  function moveLocal(id: string, to: LeadStatusValue) {
    setColumns((cols) => {
      const card = cols.flatMap((c) => c.cards).find((c) => c.id === id);
      if (!card) return cols;
      return cols.map((c) => ({
        ...c,
        cards: c.status === to ? [{ ...card, status: to }, ...c.cards.filter((x) => x.id !== id)] : c.cards.filter((x) => x.id !== id),
      }));
    });
  }

  const flow = useMoveFlow<BoardMove>({
    canMove: ({ id }) => !!find(id)?.canEdit,
    apply: ({ id, to, refocus }) => {
      const card = find(id);
      if (!card) return;
      const index = colsRef.current.find((c) => c.status === card.status)?.cards.findIndex((c) => c.id === id) ?? 0;
      moveLocal(id, to);
      if (refocus) focusCard(id);
      return () => restoreCard(card, Math.max(0, index));
    },
    moved: ({ id, to, leadName, refocus }, afterDialog) => {
      setPopId(id);
      if (popTimer.current) clearTimeout(popTimer.current);
      popTimer.current = setTimeout(() => setPopId(null), 700);
      toast.show(`${leadName} → ${STATUS_LABEL[to]}`);
      // After a dialog round the card was inert behind the modal; focus it now.
      if (refocus || afterDialog) focusCard(id);
      router.refresh();
    },
    failed: ({ id, refocus }, error) => {
      toast.show(error, "error");
      if (refocus) focusCard(id);
    },
    dismissed: ({ id }) => focusCard(id),
  });

  // A move started from a card, menu or drop.
  function start(id: string, to: LeadStatusValue, refocus: boolean) {
    const card = find(id);
    if (!card) return;
    flow.start({ id, to, leadName: card.name, refocus });
  }

  const drag: DragProps = {
    onDragStart: (id) => { dragId.current = id; },
    onDragEnd: () => { dragId.current = null; },
    onKeyMove: (id, dir) => {
      const card = find(id);
      if (!card) return;
      const i = FUNNEL_STATUSES.indexOf(card.status as (typeof FUNNEL_STATUSES)[number]);
      const next = i >= 0 ? FUNNEL_STATUSES[i + dir] : undefined;
      if (next) start(id, next, true);
    },
    onMenu: (id, to) => start(id, to, true),
    popId,
  };

  const dropProps = (to: LeadStatusValue) => ({
    onDragOver: (e: React.DragEvent<HTMLElement>) => { if (!dragId.current) return; e.preventDefault(); e.dataTransfer.dropEffect = "move"; e.currentTarget.classList.add("over"); },
    onDragLeave: (e: React.DragEvent<HTMLElement>) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) e.currentTarget.classList.remove("over"); },
    onDrop: (e: React.DragEvent<HTMLElement>) => {
      e.preventDefault(); e.currentTarget.classList.remove("over");
      const id = dragId.current ?? e.dataTransfer.getData("text/plain");
      dragId.current = null;
      const card = id ? find(id) : undefined;
      if (card && card.status !== to) start(card.id, to, false);
    },
  });

  return (
    <>
      <div className="crm-boardwrap">
        <div className="crm-board">
          {columns.filter((c) => !isSide(c.status)).map((col) => (
            <section key={col.status} className={`crm-col s-${col.status}`} aria-label={col.label} {...dropProps(col.status)}>
              <div className="colh"><span className="dot" />{col.label}<span className="cnt">{col.cards.length}</span>{col.total > 0 && <span className="sum">€{Math.round(col.total / 1000)}k</span>}</div>
              {col.cards.map((c) => <CardView key={c.id} card={c} drag={drag} />)}
            </section>
          ))}
        </div>
      </div>
      <div className="crm-droprow">
        {columns.filter((c) => isSide(c.status)).map((col) => (
          <button
            key={col.status} type="button" className={`crm-drop s-${col.status}${open === col.status ? " on" : ""}`}
            aria-expanded={open === col.status} aria-controls="crm-sidelist"
            onClick={() => setOpen((o) => (o === col.status ? null : col.status))}
            {...dropProps(col.status)}
          >
            <span className="dot" />{col.label}<span className="cnt">{col.cards.length}</span>
          </button>
        ))}
      </div>
      {open && (() => {
        const col = columns.find((c) => c.status === open);
        if (!col) return null;
        return (
          <section id="crm-sidelist" className={`crm-sidelist s-${col.status}`} aria-label={col.label}>
            {col.cards.length === 0
              ? <p className="crm-empty">No leads in {col.label}.</p>
              : <div className="crm-sidegrid">{col.cards.map((c) => <CardView key={c.id} card={c} drag={drag} />)}</div>}
            {sideTotal > side.reduce((n, c) => n + c.cards.length, 0) && (
              <p className="crm-notice" role="status">Showing the most recently updated leads only.</p>
            )}
          </section>
        );
      })()}
      {flow.node}
      {toast.node}
    </>
  );
}
