import { prisma } from "@/lib/prisma";
import { canMark, undoTarget, type RegMark, type RegStatus } from "./core";
import type { Actor } from "./register";

// State changes of a developer registration (spec §6.2, §12.7). Every change
// writes a SYSTEM timeline row — that row is the audit trail, there is no
// history column. The update is conditional on the state we read, so two
// people clicking at once cannot both win.

export type MarkAction = RegMark | "UNDO";
// isOwner gates Fixed and its undo; it is checked against the row as loaded here,
// so a status change between the caller's read and this one cannot bypass it.
export type MarkInput = { registrationId: string; action: MarkAction; source: "manual" | "auto"; actor: Actor | null; evidence?: string; isOwner?: boolean };
export type MarkRow = { id: string; leadId: string; status: RegStatus; preliminaryAt: Date | null; developerName: string };
export type MarkDeps = {
  load(id: string): Promise<MarkRow | null>;
  apply(id: string, expectedFrom: RegStatus, to: RegStatus, fields: Record<string, unknown>): Promise<boolean>;
  logStatus(i: { leadId: string; registrationId: string; from: RegStatus; to: RegStatus; source: "manual" | "auto"; actor: Actor | null; body: string; evidence?: string }): Promise<void>;
  now(): Date;
};

const LABEL: Record<RegStatus, string> = { SENT: "Sent", PRELIMINARY: "Preliminary", FIXED: "Fixed", REJECTED: "Rejected", FAILED: "Failed" };

const PRELIM_CLEARED = { preliminaryAt: null, preliminarySource: null, preliminaryById: null };

// The fields a state owns; leaving that state by undo clears them.
function clearedOnLeave(from: RegStatus): Record<string, unknown> {
  if (from === "PRELIMINARY") return PRELIM_CLEARED;
  if (from === "FIXED") return { fixedAt: null, fixedById: null };
  if (from === "REJECTED") return { rejectedAt: null };
  return {};
}

export function statusBody(developerName: string, action: MarkAction, to: RegStatus, source: "manual" | "auto", evidence?: string): string {
  const what = action === "UNDO" ? `Undo → ${LABEL[to]}` : LABEL[to];
  const quote = evidence?.trim() ? ` — "${evidence.trim()}"` : "";
  return `Registration with ${developerName}: ${what} (${source})${quote}`;
}

export async function markRegistration(deps: MarkDeps, input: MarkInput): Promise<{ ok: true; status: RegStatus } | { ok: false; error: string }> {
  const row = await deps.load(input.registrationId);
  if (!row) return { ok: false, error: "Registration not found." };
  if (input.source === "auto" && !(input.action === "PRELIMINARY" && row.status === "SENT")) {
    return { ok: false, error: "Only a sent registration can be confirmed automatically." };
  }

  if ((input.action === "FIXED" || (input.action === "UNDO" && row.status === "FIXED")) && !input.isOwner) {
    return { ok: false, error: "Only the owner can set or undo a fixed registration." };
  }

  const now = deps.now();
  const by = input.actor?.userId ?? null;
  let to: RegStatus;
  let fields: Record<string, unknown>;
  if (input.action === "UNDO") {
    const target = undoTarget(row.status, row.preliminaryAt != null);
    if (!target) return { ok: false, error: "Nothing to undo." };
    to = target;
    fields = clearedOnLeave(row.status);
  } else {
    if (!canMark(row.status, input.action)) return { ok: false, error: `A ${LABEL[row.status].toLowerCase()} registration cannot be marked ${LABEL[input.action].toLowerCase()}.` };
    to = input.action;
    fields =
      to === "PRELIMINARY" ? { preliminaryAt: now, preliminarySource: input.source, preliminaryById: by }
      : to === "FIXED" ? { fixedAt: now, fixedById: by }
      : { rejectedAt: now };
  }

  if (!(await deps.apply(row.id, row.status, to, fields))) return { ok: false, error: "This registration changed meanwhile — reload." };
  await deps.logStatus({
    leadId: row.leadId, registrationId: row.id, from: row.status, to, source: input.source, actor: input.actor,
    body: statusBody(row.developerName, input.action, to, input.source, input.evidence), evidence: input.evidence,
  });
  return { ok: true, status: to };
}

export function realMarkDeps(): MarkDeps {
  return {
    async load(id) {
      const r = await prisma.developerRegistration.findUnique({
        where: { id },
        select: { id: true, leadId: true, status: true, preliminaryAt: true, developerAccount: { select: { name: true } } },
      });
      return r ? { id: r.id, leadId: r.leadId, status: r.status, preliminaryAt: r.preliminaryAt, developerName: r.developerAccount.name } : null;
    },
    async apply(id, expectedFrom, to, fields) {
      const n = await prisma.developerRegistration.updateMany({ where: { id, status: expectedFrom }, data: { ...fields, status: to } });
      return n.count === 1;
    },
    async logStatus(i) {
      await prisma.leadInteraction.create({
        data: {
          leadId: i.leadId, type: "SYSTEM", channel: "SYSTEM", direction: null, body: i.body,
          createdByUserId: i.actor?.userId ?? null, createdByName: i.actor?.userName ?? "system",
          metadata: { kind: "developer_registration_status", registrationId: i.registrationId, from: i.from, to: i.to, source: i.source, ...(i.evidence ? { evidence: i.evidence } : {}) },
        },
      });
    },
    now: () => new Date(),
  };
}
