"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCrmUser } from "@/lib/crm/session";
import { canEditLead } from "@/lib/crm/access";
import { isRegistrable, maskPhone, type RegChannel, type RegMark } from "@/lib/crm/registration/core";
import {
  prepareRegistration, realRegisterDeps, registerLead,
  type PlannedMessage, type RegisterPick, type RegisterResult,
} from "@/lib/crm/registration/register";
import { markRegistration, realMarkDeps, type MarkAction } from "@/lib/crm/registration/mark";

// Developer client registration from the lead cockpit (spec 2026-10-27 §7.1,
// §8, §9). Middleware does not protect server actions: every export checks the
// session and canEditLead itself; Fixed and its undo additionally need the owner.

export type RegistrationOptions = {
  developers: { id: string; name: string; channel: RegChannel; registrable: boolean; alreadyRegistered: boolean }[];
  projects: { id: string; publicName: string; developerAccountId: string; registrable: boolean }[];
  phone: { ok: true; masked: string } | { ok: false; reason: string };
  budget: { min: number | null; max: number | null };
};

const NOT_FOUND = "Lead not found.";
const MAX_PICKS = 40;

async function editableLead(leadId: unknown) {
  const user = await requireCrmUser();
  if (typeof leadId !== "string" || !leadId || leadId.length > 64) return { user, lead: null };
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, deletedAt: null },
    select: { id: true, assignedToId: true, phone: true, budgetMin: true, budgetMax: true },
  });
  return { user, lead: lead && canEditLead(user, lead) ? lead : null };
}

// Only plain ids survive; anything else from the client is dropped.
function cleanPicks(raw: unknown): RegisterPick[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_PICKS) return null;
  const out: RegisterPick[] = [];
  for (const p of raw) {
    if (!p || typeof p !== "object") return null;
    const { developerAccountId, developmentIds } = p as Record<string, unknown>;
    if (typeof developerAccountId !== "string" || !developerAccountId || developerAccountId.length > 64) return null;
    const ids = Array.isArray(developmentIds) ? developmentIds : [];
    if (ids.length > MAX_PICKS || !ids.every((i) => typeof i === "string" && i.length > 0 && i.length <= 64)) return null;
    out.push({ developerAccountId, developmentIds: ids as string[] });
  }
  return out;
}

export async function registrationOptionsAction(leadId: string): Promise<RegistrationOptions | { error: string }> {
  const { lead } = await editableLead(leadId);
  if (!lead) return { error: NOT_FOUND };
  const [devs, projects, existing] = await Promise.all([
    prisma.developerAccount.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, registrationChannel: true, registrationEmailTo: true, registrationWhatsApp: true },
    }),
    prisma.development.findMany({ orderBy: { publicName: "asc" }, select: { id: true, publicName: true, developerAccountId: true } }),
    prisma.developerRegistration.findMany({ where: { leadId: lead.id }, select: { developerAccountId: true, status: true } }),
  ]);
  const taken = new Set(existing.filter((r) => r.status !== "FAILED" && r.status !== "REJECTED").map((r) => r.developerAccountId));
  const registrable = new Map(devs.map((d) => [d.id, isRegistrable(d)]));
  const phone = maskPhone(lead.phone);
  return {
    developers: devs.map((d) => ({ id: d.id, name: d.name, channel: d.registrationChannel, registrable: registrable.get(d.id)!, alreadyRegistered: taken.has(d.id) })),
    projects: projects.map((p) => ({ ...p, registrable: !!registrable.get(p.developerAccountId) && !taken.has(p.developerAccountId) })),
    phone: phone.ok ? { ok: true, masked: phone.masked } : { ok: false, reason: phone.reason },
    budget: { min: lead.budgetMin, max: lead.budgetMax },
  };
}

export async function previewRegistrationAction(leadId: string, picks: unknown, budgetMin: unknown, budgetMax: unknown): Promise<{ ok: true; plans: PlannedMessage[] } | { ok: false; error: string }> {
  const { user, lead } = await editableLead(leadId);
  if (!lead) return { ok: false, error: NOT_FOUND };
  const clean = cleanPicks(picks);
  if (!clean) return { ok: false, error: "Pick at least one developer or project." };
  const r = await prepareRegistration(realRegisterDeps(), { leadId: lead.id, picks: clean, budgetMin, budgetMax, staffName: user.name });
  return r.ok ? { ok: true, plans: r.plans } : r;
}

export async function registerLeadAction(leadId: string, picks: unknown, budgetMin: unknown, budgetMax: unknown): Promise<RegisterResult> {
  const { user, lead } = await editableLead(leadId);
  if (!lead) return { ok: false, error: NOT_FOUND };
  const clean = cleanPicks(picks);
  if (!clean) return { ok: false, error: "Pick at least one developer or project." };
  const r = await registerLead(realRegisterDeps(), { leadId: lead.id, picks: clean, budgetMin, budgetMax, actor: { userId: user.id, userName: user.name } });
  revalidatePath(`/crm/leads/${lead.id}`);
  return r;
}

// Resend from FAILED/REJECTED: the stored projects, the lead's current budget.
export async function resendRegistrationAction(registrationId: string): Promise<RegisterResult> {
  if (typeof registrationId !== "string" || !registrationId || registrationId.length > 64) return { ok: false, error: "Registration not found." };
  const reg = await prisma.developerRegistration.findUnique({ where: { id: registrationId }, select: { leadId: true, developerAccountId: true, developmentIds: true, status: true } });
  if (!reg) return { ok: false, error: "Registration not found." };
  const { user, lead } = await editableLead(reg.leadId);
  if (!lead) return { ok: false, error: NOT_FOUND };
  if (reg.status !== "FAILED" && reg.status !== "REJECTED") return { ok: false, error: "Only a failed or rejected registration can be resent." };
  // Projects deleted since the first send are dropped rather than blocking the resend.
  const still = await prisma.development.findMany({ where: { id: { in: reg.developmentIds }, developerAccountId: reg.developerAccountId }, select: { id: true } });
  const r = await registerLead(realRegisterDeps(), {
    leadId: lead.id, picks: [{ developerAccountId: reg.developerAccountId, developmentIds: still.map((d) => d.id) }],
    budgetMin: lead.budgetMin, budgetMax: lead.budgetMax, actor: { userId: user.id, userName: user.name },
  });
  revalidatePath(`/crm/leads/${lead.id}`);
  return r;
}

const ACTIONS: readonly MarkAction[] = ["PRELIMINARY", "FIXED", "REJECTED", "UNDO"];

export async function markRegistrationAction(registrationId: string, action: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (typeof registrationId !== "string" || !registrationId || registrationId.length > 64) return { ok: false, error: "Registration not found." };
  if (!(ACTIONS as readonly string[]).includes(action)) return { ok: false, error: "Unknown action." };
  const reg = await prisma.developerRegistration.findUnique({ where: { id: registrationId }, select: { leadId: true } });
  if (!reg) return { ok: false, error: "Registration not found." };
  const { user, lead } = await editableLead(reg.leadId);
  if (!lead) return { ok: false, error: NOT_FOUND };
  const r = await markRegistration(realMarkDeps(), {
    registrationId, action: action as RegMark | "UNDO", source: "manual",
    actor: { userId: user.id, userName: user.name }, isOwner: user.isOwner,
  });
  revalidatePath(`/crm/leads/${lead.id}`);
  return r.ok ? { ok: true } : r;
}
