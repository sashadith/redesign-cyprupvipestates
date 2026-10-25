"use client";
import { useRef, useState } from "react";
import type { LeadStatusValue } from "@/lib/crm/leadStatus";
import type { MoveResult } from "@/lib/crm/moveLead";
import { moveLeadAction } from "../actions";
import { MoveDialog, type DialogNeed, type DialogAnswer } from "./MoveDialog";

// One lead move with its follow-up questions (deal, lost reason, cancel
// confirmation), shared by the pipeline board and the lead cockpit. The server
// says what it still needs; the dialog asks; every retry re-sends all answers
// given so far in this move, and a new move starts with none.

export type MoveRequest = { id: string; to: LeadStatusValue; leadName: string };

type Hooks<R extends MoveRequest> = {
  // Checked before every attempt, including retries from the dialog.
  canMove?: (req: R) => boolean;
  // Optimistic update; the returned function puts it back when the move does not go through.
  apply?: (req: R) => (() => void) | void;
  // afterDialog: at least one dialog round was answered (the page was inert behind the modal).
  moved: (req: R, afterDialog: boolean) => void;
  // A plain failure the dialog cannot fix.
  failed: (req: R, error: string) => void;
  // The dialog was cancelled or closed without moving.
  dismissed?: (req: R) => void;
};

type OpenDialog<R> = DialogNeed & { req: R };

export function useMoveFlow<R extends MoveRequest>(hooks: Hooks<R>) {
  const [dialog, setDialog] = useState<OpenDialog<R> | null>(null);
  const [busy, setBusy] = useState(false);
  // Answers given in earlier dialog rounds of the same move (e.g. a lost reason,
  // then a cancel confirmation): every retry re-sends all of them.
  const answers = useRef<DialogAnswer>({});
  const pending = useRef(new Set<string>());
  const h = useRef(hooks);
  h.current = hooks;

  async function attempt(req: R) {
    if ((h.current.canMove && !h.current.canMove(req)) || pending.current.has(req.id)) return;
    pending.current.add(req.id);
    setBusy(true);
    const answer = answers.current;
    const undo = h.current.apply?.(req);

    let res: MoveResult;
    try {
      res = await moveLeadAction(req.id, req.to, answer);
    } catch {
      res = { error: "The move did not go through. Check your connection and try again." };
    } finally {
      pending.current.delete(req.id);
      setBusy(false);
    }

    if ("ok" in res) {
      answers.current = {};
      setDialog(null);
      h.current.moved(req, Object.keys(answer).length > 0);
      return;
    }

    undo?.();
    if (res.need) {
      // Show the server's message only when it rejects an answer already given
      // for this same question (e.g. an unknown project), not on the first ask.
      const answered = (res.need === "deal" && !!answer.deal) || (res.need === "lostReason" && !!answer.lostReason) || (res.need === "confirmCancel" && !!answer.confirmCancel);
      setDialog({ req, need: res.need, leadName: req.leadName, to: req.to, cancelCount: res.cancelCount, error: answered ? res.error : undefined });
    } else {
      answers.current = {};
      setDialog(null);
      h.current.failed(req, res.error);
    }
  }

  // A new move: forget answers from any earlier move.
  function start(req: R) {
    if (dialog || pending.current.has(req.id)) return;
    answers.current = {};
    void attempt(req);
  }

  function closeDialog() {
    if (!dialog || busy) return;
    answers.current = {};
    setDialog(null);
    h.current.dismissed?.(dialog.req);
  }

  // The <dialog> was closed natively (e.g. the browser's close watcher on a
  // repeated Escape): always forget it, even mid-request, so no `dialog` state
  // can outlive the modal and block every further move. Ignores a close event
  // from a dialog that has already been replaced by the next question.
  const dialogRef = useRef(dialog);
  dialogRef.current = dialog;
  function dialogClosed(closed: OpenDialog<R>) {
    if (dialogRef.current !== closed) return;
    answers.current = {};
    setDialog(null);
    h.current.dismissed?.(closed.req);
  }

  const node = dialog && (
    <MoveDialog
      key={`${dialog.req.id}:${dialog.need}`}
      state={dialog}
      busy={busy}
      onCancel={closeDialog}
      onClosed={() => dialogClosed(dialog)}
      onSubmit={(a) => {
        answers.current = { ...answers.current, ...a };
        void attempt(dialog.req);
      }}
    />
  );

  return { start, busy, dialogOpen: dialog !== null, node };
}
