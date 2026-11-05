"use server";
/**
 * Partner pipeline (2026-11-05): the partner works his own FIX client — stage, log, follow-up,
 * viewing date and client details. Every action guards itself with requirePartner({ active: true })
 * and builds the actor from the session; the claim id from the form is only a pointer, checked by
 * the pipeline actions (src/lib/partner/pipeline/actions.ts). Errors come back as pipeline.err.* keys.
 */
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { PartnerActor } from "@/lib/crm/leadActor";
import { isLeadStatus, LOST_REASONS, type LeadStatusValue, type LostReasonValue } from "@/lib/crm/leadStatus";
import { CALL_OUTCOMES, LOGGABLE_TYPES, type CallOutcome, type LoggableInteractionType } from "@/lib/crm/logRule";
import { partnerLimits as L } from "@/lib/partner/limits";
import {
  editPartnerClient, logPartnerInteraction, movePartnerLead, setPartnerFollowUp, setPartnerViewingDate,
} from "@/lib/partner/pipeline/actions";
import { DEAL_ALERT_STAGES } from "@/lib/partner/pipeline/dealAlert";
import { sendDealAlert } from "@/lib/partner/pipeline/dealAlertSend";
import { pipelineErrorKey } from "@/lib/partner/pipeline/errors";
import { editRawFromForm, portalDateTime, wholeEuros } from "@/lib/partner/pipeline/forms";
import { requirePartner, type PartnerSessionInfo } from "@/lib/partner/session";
import type { PipelineState } from "./formState";

const DAY_MS = 86_400_000;
const FOLLOW_UP_MAX_DAYS = 730;

// The partner user has no name of his own: the partner's name is what the timeline shows.
function actorOf(me: PartnerSessionInfo): PartnerActor {
  const name = `${me.partner.firstName} ${me.partner.lastName}`.trim() || me.partner.company?.trim() || me.user.email;
  return { partnerUserId: me.user.id, partnerId: me.partner.id, userName: name };
}

const str = (v: FormDataEntryValue | null): string => (typeof v === "string" ? v.trim() : "");

function claimIdOf(fd: FormData): string | null {
  const id = str(fd.get("claimId"));
  return id && id.length <= 64 ? id : null;
}

function refresh(claimId: string) {
  revalidatePath("/partner-portal/pipeline");
  revalidatePath(`/partner-portal/pipeline/${claimId}`);
}

const fail = (error: string, field?: string): PipelineState => ({ error: pipelineErrorKey(error), ...(field ? { field } : {}) });

// One gate for every action: session, rate limit, claim id.
async function begin(fd: FormData): Promise<{ actor: PartnerActor; claimId: string } | { error: PipelineState }> {
  const me = await requirePartner({ active: true });
  if (!L.pipeline.hit(me.partner.id)) return { error: { error: "pipeline.err.rateLimited" } };
  const claimId = claimIdOf(fd);
  if (!claimId) return { error: fail("NOT_IN_PIPELINE") };
  return { actor: actorOf(me), claimId };
}

export async function movePipelineAction(_prev: PipelineState, fd: FormData): Promise<PipelineState> {
  const g = await begin(fd);
  if ("error" in g) return g.error;
  const { actor, claimId } = g;
  const toRaw = str(fd.get("to"));
  if (!isLeadStatus(toRaw)) return { error: "pipeline.err.stage", field: "to" };
  const to: LeadStatusValue = toRaw;

  const input: Parameters<typeof movePartnerLead>[3] = { confirmCancel: str(fd.get("confirmCancel")) === "1" };
  if (to === "LOST") {
    const reason = str(fd.get("lostReason"));
    if (!(LOST_REASONS as readonly string[]).includes(reason)) return { error: "pipeline.err.lostReason", field: "lostReason", need: "lostReason" };
    input.lostReason = reason as LostReasonValue;
  }
  if (to === "VIEWING_SCHEDULED") {
    const at = portalDateTime(fd.get("viewingAt"));
    if (at) input.viewingScheduledAt = at;
  }
  if ((DEAL_ALERT_STAGES as readonly string[]).includes(to)) {
    const developmentId = str(fd.get("dealProject"));
    const unit = str(fd.get("dealUnit"));
    const priceRaw = str(fd.get("dealPrice"));
    if (developmentId || unit || priceRaw) {
      input.deal = { developmentId: developmentId.slice(0, 64), unitLabel: unit.slice(0, 80) || null, price: wholeEuros(fd.get("dealPrice")) };
    }
  }

  // The status before the move, only to decide whether the manager hears about a new RESERVED/CLOSED.
  const before = await prisma.partnerClaim.findFirst({
    where: { id: claimId, partnerId: actor.partnerId },
    select: { leadId: true, lead: { select: { status: true } } },
  });
  const res = await movePartnerLead(actor, claimId, to, input);
  if ("error" in res) {
    const key = pipelineErrorKey(res.error);
    const field = res.need === "deal" ? (key === "pipeline.err.price" ? "dealPrice" : key === "pipeline.err.project" ? "dealProject" : undefined)
      : res.need === "lostReason" ? "lostReason"
        : key === "pipeline.err.viewingDate" ? "viewingAt" : undefined;
    return {
      error: key, ...(field ? { field } : {}), ...(res.need ? { need: res.need } : {}),
      ...(res.cancelCount != null ? { vars: { n: String(res.cancelCount) } } : {}),
    };
  }
  if (before && before.lead?.status !== to && (DEAL_ALERT_STAGES as readonly string[]).includes(to)) {
    await sendDealAlert(actor, before.leadId, to);
  }
  refresh(claimId);
  return { ok: true };
}

export async function viewingPipelineAction(_prev: PipelineState, fd: FormData): Promise<PipelineState> {
  const g = await begin(fd);
  if ("error" in g) return g.error;
  const at = portalDateTime(fd.get("viewingAt"));
  if (!at) return { error: "pipeline.err.date", field: "viewingAt" };
  const res = await setPartnerViewingDate(g.actor, g.claimId, at);
  if ("error" in res) return fail(res.error);
  refresh(g.claimId);
  return { ok: true };
}

export async function logPipelineAction(_prev: PipelineState, fd: FormData): Promise<PipelineState> {
  const g = await begin(fd);
  if ("error" in g) return g.error;
  const type = str(fd.get("type"));
  if (!(LOGGABLE_TYPES as readonly string[]).includes(type)) return { error: "pipeline.err.generic", field: "type" };
  const outcome = str(fd.get("callOutcome"));
  const whenRaw = str(fd.get("occurredAt"));
  const occurredAt = whenRaw ? portalDateTime(whenRaw) : null;
  if (whenRaw && !occurredAt) return { error: "pipeline.err.date", field: "occurredAt" };
  const res = await logPartnerInteraction(g.actor, g.claimId, {
    type: type as LoggableInteractionType,
    body: str(fd.get("body")).slice(0, 4000) || null,
    subject: type.startsWith("EMAIL_") ? str(fd.get("subject")).slice(0, 300) || null : null,
    ...(occurredAt ? { occurredAt } : {}),
    leadReacted: str(fd.get("leadReacted")) === "1",
    ...(type === "CALL" && (CALL_OUTCOMES as readonly string[]).includes(outcome) ? { callOutcome: outcome as CallOutcome } : {}),
  });
  if ("error" in res) {
    const key = pipelineErrorKey(res.error);
    return { error: key, ...(key === "pipeline.err.futureDate" ? { field: "occurredAt" } : key === "pipeline.err.messageRequired" ? { field: "body" } : {}) };
  }
  refresh(g.claimId);
  return { ok: true };
}

export async function followUpPipelineAction(_prev: PipelineState, fd: FormData): Promise<PipelineState> {
  const g = await begin(fd);
  if ("error" in g) return g.error;
  let at: Date | null = null;
  if (str(fd.get("clear")) !== "1") {
    at = portalDateTime(fd.get("at"));
    if (!at) return { error: "pipeline.err.date", field: "at" };
    const now = Date.now();
    // From a day back (a time earlier today is fine: "call back this morning") up to two years ahead.
    if (at.getTime() < now - DAY_MS || at.getTime() > now + FOLLOW_UP_MAX_DAYS * DAY_MS) return { error: "pipeline.err.followUpRange", field: "at" };
  }
  const res = await setPartnerFollowUp(g.actor, g.claimId, at);
  if ("error" in res) return fail(res.error);
  refresh(g.claimId);
  return { ok: true };
}

export async function editPipelineClientAction(_prev: PipelineState, fd: FormData): Promise<PipelineState> {
  const g = await begin(fd);
  if ("error" in g) return g.error;
  const res = await editPartnerClient(g.actor, g.claimId, editRawFromForm((k) => fd.get(k)));
  // A duplicate is not pinned to a field: the partner is never told which contact belongs to another lead.
  if ("error" in res) return fail(res.error, "field" in res ? res.field : undefined);
  refresh(g.claimId);
  return { ok: true, ...(res.changed ? {} : { unchanged: true }) };
}
