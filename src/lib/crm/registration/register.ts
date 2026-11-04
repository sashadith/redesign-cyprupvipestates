import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendOfficeEmail } from "@/lib/sendEmail";
import { createOpenWaClient } from "@/lib/openwa/client";
import { readOpenWaConfig } from "@/lib/openwa/config";
import { chatIdFor } from "@/lib/openwa/phoneMatch";
import { nicosiaDayStart } from "@/lib/openwa/sendGuards";
import { countWhatsAppSentToday } from "@/lib/openwa/sentToday";
import { buildRegistrationMessage, checkEditedText, formatBudget, isGroupChatId, isRegistrable, maskPhone, parseBudgetInput, type RegChannel } from "./core";

// Developer client registration (spec 2026-10-27, §7). One click registers the
// lead with several developers: one message per developer, sent one by one, a
// failure for one never stops the rest. The message is built here, server-side,
// from the lead record. The operator may reword it in the preview; an edited
// text is re-checked here (checkEditedText) so the client's full phone or email
// still cannot leave.

export type Actor = { userId: string; userName: string };
export type RegisterPick = { developerAccountId: string; developmentIds: string[] };
export type RegDeveloper = {
  id: string; name: string; contactPerson: string | null; registrationChannel: RegChannel;
  registrationEmailTo: string[]; registrationEmailCc: string[]; registrationWhatsApp: string[];
  registrationWhatsAppGroupId?: string | null; registrationWhatsAppGroupName?: string | null;
};
export type RegLead = { id: string; firstName: string; lastName: string | null; phone: string | null; email: string | null };
export type RegDevelopment = { id: string; publicName: string; developerAccountId: string };
export type RegisterOutcome = { developerAccountId: string; developerName: string; result: "sent" | "failed" | "already"; error?: string };
export type PlannedMessage = {
  developerAccountId: string; developerName: string; channel: "EMAIL" | "WHATSAPP";
  // targets are what the transport gets (address, number or group chat id);
  // labels are how each one is shown to people (a group by its name).
  targets: string[]; labels: string[]; cc: string[]; subject: string; text: string; developmentIds: string[];
};
export type RegisterResult = { ok: true; outcomes: RegisterOutcome[] } | { ok: false; error: string };

export type RegisterDeps = {
  loadLead(id: string): Promise<RegLead | null>;
  loadDevelopers(ids: string[]): Promise<RegDeveloper[]>;
  loadDevelopments(ids: string[]): Promise<RegDevelopment[]>;
  claimRecord(i: { leadId: string; developerAccountId: string; developmentIds: string[]; channel: "EMAIL" | "WHATSAPP"; sentById: string }): Promise<{ id: string } | "already">;
  sendEmail(m: { to: string[]; cc: string[]; subject: string; text: string }): Promise<{ messageId: string }>;
  sendWhatsApp(target: string, text: string): Promise<void>;
  countWhatsAppToday(): Promise<number>;
  dailyCap: number;
  recordSent(i: {
    registrationId: string; leadId: string; actor: Actor; subject: string | null; text: string; messageId: string | null;
    channel: "email" | "whatsapp"; to: string[]; cc: string[]; partialError: string | null; edited: boolean;
  }): Promise<void>;
  recordFailed(registrationId: string, error: string): Promise<void>;
  // Fallback when recordSent keeps failing after a successful send: SENT, sentAt now, note in sendError.
  markSentUnrecorded(registrationId: string, note: string): Promise<void>;
};

export const BUDGET_ERROR = "Budget must be a whole number in euros.";
export const CAP_REACHED = "daily WhatsApp limit reached";

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 300);

export function planMessages(
  lead: RegLead, devs: RegDeveloper[], devts: RegDevelopment[], picks: RegisterPick[],
  budget: { min: number | null; max: number | null }, staffName: string,
): { ok: true; plans: PlannedMessage[] } | { ok: false; error: string } {
  const phone = maskPhone(lead.phone);
  if (!phone.ok) return { ok: false, error: phone.reason };

  // Projects imply their developer; several picks of one developer merge into one message.
  const byDev = new Map<string, Set<string>>();
  const devtById = new Map(devts.map((d) => [d.id, d]));
  for (const p of picks) {
    const set = byDev.get(p.developerAccountId) ?? new Set<string>();
    for (const id of p.developmentIds) {
      const d = devtById.get(id);
      if (!d) return { ok: false, error: "A picked project no longer exists." };
      if (d.developerAccountId !== p.developerAccountId) return { ok: false, error: "A picked project belongs to another developer." };
      set.add(id);
    }
    byDev.set(p.developerAccountId, set);
  }
  if (byDev.size === 0) return { ok: false, error: "Pick at least one developer or project." };

  const devById = new Map(devs.map((d) => [d.id, d]));
  const clientName = `${lead.firstName} ${lead.lastName ?? ""}`.trim();
  // The name is the only free text in the message: refuse it empty, or when it
  // carries what looks like contact data (anti-goal: no full phone, no email).
  if (!clientName) return { ok: false, error: "The lead has no name." };
  if (clientName.includes("@") || /\d{6}/.test(clientName.replace(/[\s\-().]/g, ""))) {
    return { ok: false, error: "The lead's name contains contact data — fix the name first." };
  }
  const budgetText = formatBudget(budget.min, budget.max);
  const plans: PlannedMessage[] = [];
  for (const [devId, ids] of Array.from(byDev)) {
    const dev = devById.get(devId);
    if (!dev) return { ok: false, error: "A picked developer no longer exists." };
    if (!isRegistrable(dev)) return { ok: false, error: `${dev.name} has no registration channel set.` };
    const developmentIds = Array.from(ids);
    const email = dev.registrationChannel === "EMAIL";
    const group = !email && dev.registrationWhatsAppGroupId
      ? [{ target: dev.registrationWhatsAppGroupId, label: `WhatsApp group "${dev.registrationWhatsAppGroupName ?? dev.registrationWhatsAppGroupId}"` }]
      : [];
    // Plural when several people read the same message: more than one address
    // on the email, or a group chat. WhatsApp numbers each get a private chat.
    const plural = email ? dev.registrationEmailTo.length + dev.registrationEmailCc.length > 1 : group.length > 0;
    const msg = buildRegistrationMessage({
      clientName, maskedPhone: phone.masked,
      projects: developmentIds.map((id) => devtById.get(id)!.publicName),
      budget: budgetText, contactPerson: dev.contactPerson, staffName, plural,
    });
    const targets = email ? dev.registrationEmailTo : [...dev.registrationWhatsApp, ...group.map((g) => g.target)];
    plans.push({
      developerAccountId: dev.id, developerName: dev.name, channel: email ? "EMAIL" : "WHATSAPP",
      targets, labels: email ? targets : [...dev.registrationWhatsApp, ...group.map((g) => g.label)],
      cc: email ? dev.registrationEmailCc : [],
      subject: msg.subject, text: msg.text, developmentIds,
    });
  }
  return { ok: true, plans };
}

export async function prepareRegistration(
  deps: Pick<RegisterDeps, "loadLead" | "loadDevelopers" | "loadDevelopments">,
  input: { leadId: string; picks: RegisterPick[]; budgetMin: unknown; budgetMax: unknown; staffName: string },
): Promise<{ ok: true; plans: PlannedMessage[]; lead: RegLead } | { ok: false; error: string }> {
  const min = parseBudgetInput(input.budgetMin);
  const max = parseBudgetInput(input.budgetMax);
  if (!min.ok || !max.ok) return { ok: false, error: BUDGET_ERROR };
  const lead = await deps.loadLead(input.leadId);
  if (!lead) return { ok: false, error: "Lead not found." };
  const devIds = Array.from(new Set(input.picks.map((p) => p.developerAccountId)));
  const devtIds = Array.from(new Set(input.picks.flatMap((p) => p.developmentIds)));
  const [devs, devts] = await Promise.all([deps.loadDevelopers(devIds), deps.loadDevelopments(devtIds)]);
  const planned = planMessages(lead, devs, devts, input.picks, { min: min.value, max: max.value }, input.staffName);
  return planned.ok ? { ...planned, lead } : planned;
}

// A transport timeout means delivery is unknown, not "failed": say so, so
// nobody resends blindly.
function sendErrorText(e: unknown): string {
  const t = errText(e);
  return /timed out/i.test(t) ? `${t} — it may have been delivered; check with the developer before resending` : t;
}

// After the transport reported success the registration is SENT, whatever the
// bookkeeping does: a FAILED here would invite a resend and a second message to
// the developer. One retry, then a bare status fallback with an honest note.
async function recordSuccess(deps: RegisterDeps, i: Parameters<RegisterDeps["recordSent"]>[0]): Promise<string | undefined> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await deps.recordSent(i);
      return undefined;
    } catch (e) {
      console.error(`registration: recordSent failed (attempt ${attempt + 1})`, e);
    }
  }
  const note = "Sent, but not recorded on the timeline — do not resend";
  await deps.markSentUnrecorded(i.registrationId, note).catch((e) => console.error("registration: markSentUnrecorded failed", e));
  return note;
}

async function sendOne(deps: RegisterDeps, plan: PlannedMessage, lead: RegLead, actor: Actor, sentSoFar: { whatsapp: number }, edited: boolean): Promise<RegisterOutcome> {
  const base = { developerAccountId: plan.developerAccountId, developerName: plan.developerName };
  let registrationId: string;
  try {
    const claim = await deps.claimRecord({ leadId: lead.id, developerAccountId: plan.developerAccountId, developmentIds: plan.developmentIds, channel: plan.channel, sentById: actor.userId });
    if (claim === "already") return { ...base, result: "already" };
    registrationId = claim.id;
  } catch (e) {
    console.error("registration: claim failed", e);
    return { ...base, result: "failed", error: "Could not save the registration — nothing was sent." };
  }

  const fail = async (error: string): Promise<RegisterOutcome> => {
    await deps.recordFailed(registrationId, error).catch((err) => console.error("registration: recordFailed failed", err));
    return { ...base, result: "failed", error };
  };
  const sent = (warning: string | undefined): RegisterOutcome => ({ ...base, result: "sent", ...(warning ? { error: warning } : {}) });

  if (plan.channel === "EMAIL") {
    let messageId: string;
    try {
      ({ messageId } = await deps.sendEmail({ to: plan.targets, cc: plan.cc, subject: plan.subject, text: plan.text }));
    } catch (e) {
      return fail(sendErrorText(e));
    }
    return sent(await recordSuccess(deps, { registrationId, leadId: lead.id, actor, subject: plan.subject, text: plan.text, messageId, channel: "email", to: plan.targets, cc: plan.cc, partialError: null, edited }));
  }

  const reached: string[] = [];
  const failures: string[] = [];
  let already: number;
  try {
    already = await deps.countWhatsAppToday();
  } catch (e) {
    return fail(`could not check the daily WhatsApp limit: ${errText(e)}`);
  }
  for (let i = 0; i < plan.targets.length; i++) {
    const label = plan.labels[i] ?? plan.targets[i];
    if (already + sentSoFar.whatsapp >= deps.dailyCap) { failures.push(`${label}: ${CAP_REACHED}`); continue; }
    try {
      await deps.sendWhatsApp(plan.targets[i], plan.text);
      reached.push(label);
      sentSoFar.whatsapp++;
    } catch (e) {
      failures.push(`${label}: ${sendErrorText(e)}`);
    }
  }
  if (reached.length === 0) {
    return fail(failures.every((f) => f.endsWith(CAP_REACHED)) ? CAP_REACHED : failures.join("; ") || "nothing sent");
  }
  const partialError = failures.length ? failures.join("; ") : null;
  const warning = await recordSuccess(deps, { registrationId, leadId: lead.id, actor, subject: null, text: plan.text, messageId: null, channel: "whatsapp", to: reached, cc: [], partialError, edited });
  return sent(warning ?? partialError ?? undefined);
}

export async function registerLead(
  deps: RegisterDeps,
  // texts: the operator's edited message per developer id; absent = the generated one.
  input: { leadId: string; picks: RegisterPick[]; budgetMin: unknown; budgetMax: unknown; actor: Actor; texts?: Record<string, unknown> },
): Promise<RegisterResult> {
  try {
    const prepared = await prepareRegistration(deps, { ...input, staffName: input.actor.userName });
    if (!prepared.ok) return prepared;
    // Every edited text is checked before anything is sent.
    const edited = new Set<string>();
    for (const plan of prepared.plans) {
      const raw = input.texts?.[plan.developerAccountId];
      if (raw === undefined) continue;
      const c = checkEditedText(raw, prepared.lead);
      if (!c.ok) return { ok: false, error: `${plan.developerName}: ${c.error}` };
      if (c.text !== plan.text) { plan.text = c.text; edited.add(plan.developerAccountId); }
    }
    const outcomes: RegisterOutcome[] = [];
    const sentSoFar = { whatsapp: 0 };
    // sendOne never throws; one developer's trouble never hides another's result.
    for (const plan of prepared.plans) outcomes.push(await sendOne(deps, plan, prepared.lead, input.actor, sentSoFar, edited.has(plan.developerAccountId)));
    return { ok: true, outcomes };
  } catch (e) {
    console.error("registration: registerLead failed", e);
    return { ok: false, error: "Registration failed — please try again." };
  }
}

const SEND_TIMEOUT_MS = 30_000;
function withTimeout<T>(p: Promise<T>, what: string): Promise<T> {
  let t: ReturnType<typeof setTimeout>;
  return Promise.race([p, new Promise<never>((_, rej) => { t = setTimeout(() => rej(new Error(`${what} timed out`)), SEND_TIMEOUT_MS); })]).finally(() => clearTimeout(t));
}

const CLEARED = {
  sentAt: null, sendError: null, outboundInteractionId: null,
  preliminaryAt: null, preliminarySource: null, preliminaryById: null,
  fixedAt: null, fixedById: null, rejectedAt: null, reminderSentAt: null,
};

export function realRegisterDeps(): RegisterDeps {
  return {
    loadLead: (id) => prisma.lead.findFirst({ where: { id, deletedAt: null }, select: { id: true, firstName: true, lastName: true, phone: true, email: true } }),
    loadDevelopers: (ids) => prisma.developerAccount.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, contactPerson: true, registrationChannel: true, registrationEmailTo: true, registrationEmailCc: true, registrationWhatsApp: true, registrationWhatsAppGroupId: true, registrationWhatsAppGroupName: true },
    }),
    loadDevelopments: (ids) => prisma.development.findMany({ where: { id: { in: ids } }, select: { id: true, publicName: true, developerAccountId: true } }),
    async claimRecord(i) {
      try {
        const row = await prisma.developerRegistration.create({
          data: { leadId: i.leadId, developerAccountId: i.developerAccountId, developmentIds: i.developmentIds, channel: i.channel, status: "SENT", sentById: i.sentById },
          select: { id: true },
        });
        return row;
      } catch (e) {
        if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
        const existing = await prisma.developerRegistration.findUnique({
          where: { leadId_developerAccountId: { leadId: i.leadId, developerAccountId: i.developerAccountId } },
          select: { id: true },
        });
        if (!existing) return "already";
        // Resend: only a FAILED or REJECTED row may be claimed again, atomically.
        const n = await prisma.developerRegistration.updateMany({
          where: { id: existing.id, status: { in: ["FAILED", "REJECTED"] } },
          data: { ...CLEARED, status: "SENT", sentById: i.sentById, channel: i.channel, developmentIds: i.developmentIds },
        });
        return n.count === 1 ? existing : "already";
      }
    },
    sendEmail: (m) => withTimeout(sendOfficeEmail(m), "Email"),
    sendWhatsApp: (target, text) => {
      const chatId = isGroupChatId(target) ? target : chatIdFor(target);
      if (!chatId) return Promise.reject(new Error("unusable number"));
      return withTimeout(createOpenWaClient().sendText(chatId, text), "WhatsApp");
    },
    countWhatsAppToday: () => countWhatsAppSentToday(nicosiaDayStart(new Date())),
    dailyCap: readOpenWaConfigSafe(),
    async recordSent(i) {
      await prisma.$transaction(async (tx) => {
        const row = await tx.leadInteraction.create({
          data: {
            leadId: i.leadId, type: "SYSTEM", channel: "SYSTEM", direction: null,
            subject: i.subject, body: i.text, messageId: i.messageId,
            createdByUserId: i.actor.userId, createdByName: i.actor.userName,
            metadata: { kind: "developer_registration", registrationId: i.registrationId, channel: i.channel, to: i.to, cc: i.cc, ...(i.edited ? { edited: true } : {}) },
          },
          select: { id: true },
        });
        await tx.developerRegistration.update({
          where: { id: i.registrationId },
          data: { sentAt: new Date(), outboundInteractionId: row.id, sendError: i.partialError },
        });
      });
    },
    async markSentUnrecorded(id, note) {
      await prisma.developerRegistration.update({ where: { id }, data: { status: "SENT", sentAt: new Date(), sendError: note } });
    },
    async recordFailed(id, error) {
      await prisma.developerRegistration.update({ where: { id }, data: { status: "FAILED", sendError: error } });
    },
  };
}

// An unconfigured gateway (local dev) is not "the limit": the cap stays open
// and the send itself fails with the gateway's own error, recorded as FAILED.
function readOpenWaConfigSafe(): number {
  try {
    return readOpenWaConfig().dailySendCap;
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}
