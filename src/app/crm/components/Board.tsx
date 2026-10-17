"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { BoardColumn, BoardCard } from "@/lib/crm/boardModel";
import { FUNNEL_STATUSES, STATUS_LABEL, type LeadStatusValue } from "@/lib/crm/leadStatus";
import type { MoveResult } from "@/lib/crm/moveLead";
import { moveLeadAction } from "../actions";
import { MoveDialog, type DialogNeed, type DialogAnswer } from "./MoveDialog";
import { useToast } from "./Toast";

const eur = (n: number) => "€" + n.toLocaleString("en-US");
const MENU_TARGETS: LeadStatusValue[] = [...FUNNEL_STATUSES, "KEEP_CONTACT", "LOST"];

type DragProps = {
  onDragStart: (id: string) => void; onDragEnd: () => void; onKeyMove: (id: string, dir: 1 | -1) => void;
  onMenu: (id: string, to: LeadStatusValue) => void; popId: string | null;
};

export function CardView({ card, drag }: { card: BoardCard; drag?: DragProps }) {
  const [menu, setMenu] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const moveBtn = useRef<HTMLButtonElement>(null);

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
    <div ref={wrap} className={`crm-cardwrap${menu ? " menu-open" : ""}`}>
      <a
        className={`crm-card s-${card.status}${drag?.popId === card.id ? " pop" : ""}`}
        href={`/admin/crm/${card.id}`}
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
      {drag && (
        <>
          <button ref={moveBtn} type="button" className="crm-move" aria-haspopup="menu" aria-expanded={menu} aria-label={`Move ${card.name}`} onClick={() => setMenu((m) => !m)}>Move</button>
          {menu && (
            <div className="crm-menu" role="menu" aria-label={`Move ${card.name} to`}>
              {MENU_TARGETS.filter((s) => s !== card.status).map((s, i) => (
                <button type="button" role="menuitem" key={s} className={`s-${s}`} autoFocus={i === 0} onClick={() => { setMenu(false); drag.onMenu(card.id, s); }}>
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

type OpenDialog = DialogNeed & { id: string; refocus: boolean };

export function Board({ columns: initial }: { columns: BoardColumn[] }) {
  const router = useRouter();
  const toast = useToast();
  const [columns, setColumns] = useState(initial);
  const [dialog, setDialog] = useState<OpenDialog | null>(null);
  const [busy, setBusy] = useState(false);
  const [popId, setPopId] = useState<string | null>(null);
  const dragId = useRef<string | null>(null);
  // Answers given in earlier dialog rounds of the same move (e.g. a lost reason,
  // then a cancel confirmation): every retry re-sends all of them.
  const answers = useRef<DialogAnswer>({});
  // Always the latest board, so a move snapshots what is on screen right now
  // rather than what an older render closed over.
  const colsRef = useRef(columns);
  colsRef.current = columns;
  const pending = useRef(new Set<string>());
  const popTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setColumns(initial), [initial]);
  useEffect(() => () => { if (popTimer.current) clearTimeout(popTimer.current); }, []);

  const find = (id: string) => colsRef.current.flatMap((c) => c.cards).find((c) => c.id === id);

  // Cards remount when they change column, so keyboard/menu focus is put back by hand.
  function focusCard(id: string) {
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`.crm-card[data-id="${CSS.escape(id)}"]`)?.focus());
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

  async function attempt(id: string, to: LeadStatusValue, refocus: boolean) {
    const card = find(id);
    if (!card || pending.current.has(id)) return;
    pending.current.add(id);
    setBusy(true);
    const before = colsRef.current;
    const answer = answers.current;
    moveLocal(id, to);
    if (refocus) focusCard(id);

    let res: MoveResult;
    try {
      res = await moveLeadAction(id, to, answer);
    } catch {
      res = { error: "The move did not go through. Check your connection and try again." };
    } finally {
      pending.current.delete(id);
      setBusy(false);
    }

    if ("ok" in res) {
      answers.current = {};
      setDialog(null);
      setPopId(id);
      if (popTimer.current) clearTimeout(popTimer.current);
      popTimer.current = setTimeout(() => setPopId(null), 700);
      toast.show(`${card.name} → ${STATUS_LABEL[to]}`);
      // After a dialog round the card was inert behind the modal; focus it now.
      if (refocus || Object.keys(answer).length > 0) focusCard(id);
      router.refresh();
      return;
    }

    setColumns(before);
    if (res.need) {
      // Show the server's message only when it rejects an answer already given
      // for this same question (e.g. an unknown project), not on the first ask.
      const answered = (res.need === "deal" && !!answer.deal) || (res.need === "lostReason" && !!answer.lostReason) || (res.need === "confirmCancel" && !!answer.confirmCancel);
      setDialog({ id, refocus, need: res.need, leadName: card.name, to, cancelCount: res.cancelCount, error: answered ? res.error : undefined });
    } else {
      answers.current = {};
      setDialog(null);
      toast.show(res.error, "error");
      if (refocus) focusCard(id);
    }
  }

  // A move started from a card, menu or drop: forget answers from any earlier move.
  function start(id: string, to: LeadStatusValue, refocus: boolean) {
    if (dialog || pending.current.has(id)) return;
    answers.current = {};
    void attempt(id, to, refocus);
  }

  function closeDialog() {
    if (!dialog || busy) return;
    answers.current = {};
    setDialog(null);
    focusCard(dialog.id);
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
          {columns.map((col) => (
            <section key={col.status} className={`crm-col s-${col.status}`} aria-label={col.label} {...dropProps(col.status)}>
              <div className="colh"><span className="dot" />{col.label}<span className="cnt">{col.cards.length}</span>{col.total > 0 && <span className="sum">€{Math.round(col.total / 1000)}k</span>}</div>
              {col.cards.map((c) => <CardView key={c.id} card={c} drag={drag} />)}
            </section>
          ))}
        </div>
      </div>
      <div className="crm-droprow">
        <div className="crm-drop s-KEEP_CONTACT" {...dropProps("KEEP_CONTACT")}><span className="dot" />Keep contact</div>
        <div className="crm-drop s-LOST" {...dropProps("LOST")}><span className="dot" />Lost</div>
      </div>
      {dialog && (
        <MoveDialog
          key={`${dialog.id}:${dialog.need}`}
          state={dialog}
          busy={busy}
          onCancel={closeDialog}
          onSubmit={(a) => {
            answers.current = { ...answers.current, ...a };
            void attempt(dialog.id, dialog.to, dialog.refocus);
          }}
        />
      )}
      {toast.node}
    </>
  );
}
