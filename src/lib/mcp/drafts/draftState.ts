// Pure decision for a send attempt (spec: "Draft → approve → send" state
// machine). The Prisma writes that follow each decision live in sendDraft.ts.
import { approvalCodesMatch } from "./approvalCode";

export const DRAFT_TTL_MS = 24 * 3_600_000;
export const MAX_CODE_ATTEMPTS = 5;
export const DRAFTS_PER_LEAD_PER_HOUR = 3;
export const DRAFTS_PER_USER_PER_DAY = 30;

export type DraftStatus = "PENDING" | "SENDING" | "SENT" | "SUPERSEDED" | "EXPIRED" | "LOCKED";
export type DraftSnapshot = { status: DraftStatus; failedAttempts: number; expiresAt: Date; approvalCode: string };

export type SendDecision =
  | { action: "send" }
  | { action: "expire"; message: string }
  | { action: "reject"; message: string }
  | { action: "wrong_code"; failedAttempts: number; lock: boolean; message: string };

const REJECT: Record<Exclude<DraftStatus, "PENDING">, string> = {
  SENDING: "This draft is already being sent.",
  SENT: "This draft was already sent.",
  SUPERSEDED: "This draft was superseded by a newer draft for the same lead — use the newest draft's code.",
  EXPIRED: "This draft expired — create a new draft.",
  LOCKED: "This draft is locked after too many wrong codes — create a new draft.",
};

export function evaluateSendAttempt(draft: DraftSnapshot, givenCode: string, now: Date = new Date()): SendDecision {
  if (draft.status !== "PENDING") return { action: "reject", message: REJECT[draft.status] };
  // A draft can still read PENDING here if the LOCKED write in sendDraft.ts
  // (a separate updateMany right after the failedAttempts increment) hasn't
  // landed yet — treat failedAttempts already at the cap the same as LOCKED
  // rather than letting a correct code slip through the race.
  if (draft.failedAttempts >= MAX_CODE_ATTEMPTS) return { action: "reject", message: REJECT.LOCKED };
  if (draft.expiresAt.getTime() < now.getTime()) return { action: "expire", message: "This draft expired — create a new draft." };
  if (!approvalCodesMatch(givenCode, draft.approvalCode)) {
    const failedAttempts = draft.failedAttempts + 1;
    const lock = failedAttempts >= MAX_CODE_ATTEMPTS;
    const left = MAX_CODE_ATTEMPTS - failedAttempts;
    return {
      action: "wrong_code", failedAttempts, lock,
      message: lock ? "Approval code not accepted — the draft is now locked; create a new draft." : `Approval code not accepted (${left} attempt${left === 1 ? "" : "s"} left).`,
    };
  }
  return { action: "send" };
}
