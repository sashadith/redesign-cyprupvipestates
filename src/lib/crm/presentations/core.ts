// Shared server logic for client presentations (personal property selections),
// used by both the old admin CRM routes and the new CRM. Callers do their own
// auth and pass an Actor; the link origin is a parameter because it must come
// from the incoming request (never a hardcoded production URL).
import QRCode from "qrcode";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { uniquePresentationToken } from "@/lib/crm/presentationToken";
import { WHATSAPP_MSG, WHATSAPP_UPDATED_MSG } from "@/lib/crm/presentationMessages";
import { waLink } from "@/lib/crm/waFormat";
import { applyFollowUpCadence } from "@/lib/crm/followUpCadence";
import { isPublicLocale, type Locale } from "@/lib/locale";

export type Actor = { id: string | null; name: string };

export type PresentationItemInput = {
  developmentId: string;
  unitRefs?: string[] | null;
  unitIds?: string[] | null;
  sortIndex?: number;
  advisorComment?: string | null;
  aliasName?: string | null;
};

export type PresentationInput = {
  items: PresentationItemInput[];
  locale: Locale;
  greetingName: string;
  personalNote: string | null;
  advisorId: string | null;
  criteria: Record<string, unknown> | undefined;
  expiresAt?: Date | null;
};

const DAY_MS = 86_400_000;

// Prisma "record to update/delete does not exist". Anything else (DB outage,
// etc.) must propagate so callers fail loudly as they did before.
export function isRecordNotFound(e: unknown): boolean {
  return !!e && typeof e === "object" && (e as { code?: unknown }).code === "P2025";
}

function trimmedOrNull(v: string | null | undefined, max: number): string | null {
  return (v ?? "").trim().slice(0, max) || null;
}
const cleanAlias = (v: string | null | undefined) => trimmedOrNull(v, 120);
const cleanComment = (v: string | null | undefined) => trimmedOrNull(v, 300);

export function cleanPresentationInput(
  body: unknown,
  opts: { defaultAdvisorId: string | null },
): { ok: true; input: PresentationInput } | { ok: false; error: string } {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, any>;
  const rawItems: any[] = Array.isArray(b.items) ? b.items : [];
  if (rawItems.length === 0) return { ok: false, error: "At least one item is required" };

  const items: PresentationItemInput[] = rawItems.map((it, i) => ({
    developmentId: String(it?.developmentId ?? ""),
    unitRefs: it?.unitRefs && it.unitRefs.length ? it.unitRefs : null,
    // Only ever populated for units with no ref at all (manual units) —
    // see src/lib/unitRef.ts.
    unitIds: it?.unitIds && it.unitIds.length ? it.unitIds : null,
    sortIndex: it?.sortIndex ?? i,
    advisorComment: cleanComment(it?.advisorComment == null ? null : String(it.advisorComment)),
    aliasName: cleanAlias(it?.aliasName == null ? null : String(it.aliasName)),
  }));

  const expiresAt = b.expiresAt ? new Date(String(b.expiresAt)) : null;
  return {
    ok: true,
    input: {
      items,
      locale: isPublicLocale(b.locale) ? b.locale : "en",
      greetingName: String(b.greetingName ?? "").trim().slice(0, 120) || "there",
      personalNote: String(b.personalNote ?? "").trim().slice(0, 2000) || null,
      advisorId: b.advisorId ? String(b.advisorId) : opts.defaultAdvisorId,
      criteria: b.criteria && typeof b.criteria === "object" ? JSON.parse(JSON.stringify(b.criteria)) : undefined,
      expiresAt: expiresAt && !isNaN(expiresAt.getTime()) ? expiresAt : null,
    },
  };
}

export function editSummary(
  existing: { developmentId: string; aliasName: string | null; advisorComment: string | null }[],
  incoming: PresentationItemInput[],
): { toRemoveDevIds: string[]; added: number; removed: number; summary: string } {
  const existingByDevId = new Map(existing.map((e) => [e.developmentId, e]));
  const incomingDevIds = new Set(incoming.map((it) => it.developmentId));
  const toRemoveDevIds = existing.filter((e) => !incomingDevIds.has(e.developmentId)).map((e) => e.developmentId);
  let added = 0;
  let aliasChanged = 0;
  let commentChanged = 0;
  for (const it of incoming) {
    const ex = existingByDevId.get(it.developmentId);
    if (!ex) { added++; continue; }
    const aliasName = cleanAlias(it.aliasName);
    const advisorComment = cleanComment(it.advisorComment);
    if ((ex.aliasName || null) !== aliasName) aliasChanged++;
    if ((ex.advisorComment || null) !== advisorComment) commentChanged++;
  }
  const removed = toRemoveDevIds.length;
  const parts: string[] = [];
  if (added) parts.push(`${added} added`);
  if (removed) parts.push(`${removed} removed`);
  if (aliasChanged) parts.push(`${aliasChanged} alias changed`);
  if (commentChanged) parts.push(`${commentChanged} comment changed`);
  return { toRemoveDevIds, added, removed, summary: parts.length ? parts.join(", ") : "details updated" };
}

// Writes the activity row and its mirrored timeline interaction.
async function logEvent(actor: Actor, leadId: string, legacyType: string, content: string) {
  await prisma.leadActivity.create({
    data: { leadId, type: legacyType, content, createdBy: actor.name, createdById: actor.id },
  });
  await prisma.leadInteraction.create({
    data: {
      leadId,
      type: "PRESENTATION_EVENT",
      channel: "SYSTEM",
      body: content,
      createdByUserId: actor.id,
      createdByName: actor.name,
      metadata: { legacyType },
    },
  });
}

function revalidateLead(leadId: string) {
  revalidatePath(`/admin/crm/${leadId}`);
  revalidatePath(`/crm/leads/${leadId}`);
}

export async function presentationLeadId(id: string): Promise<{ leadId: string; assignedToId: string | null; leadDeleted: boolean } | null> {
  const p = await prisma.clientPresentation.findUnique({
    where: { id },
    select: { leadId: true, lead: { select: { assignedToId: true, deletedAt: true } } },
  });
  return p ? { leadId: p.leadId, assignedToId: p.lead?.assignedToId ?? null, leadDeleted: !!p.lead?.deletedAt } : null;
}

export async function createPresentation(
  actor: Actor,
  leadId: string,
  input: PresentationInput,
  origin: string,
): Promise<{ id: string; token: string; url: string; qrSvg: string; whatsappUrl: string | null } | { error: "not_found" }> {
  const lead = await prisma.lead.findFirst({ where: { id: leadId, deletedAt: null }, select: { id: true, phone: true } });
  if (!lead) return { error: "not_found" };

  const { items, locale, greetingName, personalNote, advisorId } = input;
  const expiresAt = new Date(Date.now() + 30 * DAY_MS);
  // Snapshot of the matching-panel filters at generation time — the "your
  // preferences" chips on the public page render exclusively from `criteria`,
  // never from the lead's own profile fields. filterBedrooms/filterLocations
  // are deprecated (superseded by criteria) but still filled in, derived from
  // the same source, purely for backward-compat with anything still reading them.
  const criteria: any = input.criteria ?? {};
  const filterBedrooms: number[] = Array.isArray(criteria.bedrooms) ? criteria.bedrooms.map(Number).filter((n: number) => Number.isFinite(n)) : [];
  const filterLocations: string[] = (criteria.areas?.length ? criteria.areas : criteria.districts) ?? [];

  const token = await uniquePresentationToken();
  const presentation = await prisma.clientPresentation.create({
    data: {
      leadId, token, locale, greetingName, personalNote, advisorId, expiresAt, filterBedrooms, filterLocations, criteria,
      items: {
        create: items.map((it, i) => ({
          developmentId: it.developmentId,
          unitRefs: it.unitRefs && it.unitRefs.length ? it.unitRefs : undefined,
          unitIds: it.unitIds && it.unitIds.length ? it.unitIds : undefined,
          sortIndex: it.sortIndex ?? i,
          aliasName: cleanAlias(it.aliasName),
          advisorComment: cleanComment(it.advisorComment),
        })),
      },
    },
  });

  await logEvent(actor, leadId, "PRESENTATION_CREATED", `Presentation created (${items.length} propert${items.length === 1 ? "y" : "ies"})`);
  // A presentation being generated is the "sent" event for the auto-follow-up
  // cadence (src/lib/crm/followUpCadence.ts) — fires once here, regardless of
  // which channel(s) it's subsequently shared through.
  await applyFollowUpCadence(leadId, "presentation_sent");
  revalidatePath(`/crm/leads/${leadId}`);

  const url = `${origin}/c/${token}`;
  const qrSvg = await QRCode.toString(url, { type: "svg", margin: 1, color: { dark: "#081512", light: "#F5F1E8" } });
  const whatsappUrl = lead.phone
    ? waLink(lead.phone, (WHATSAPP_MSG[locale as keyof typeof WHATSAPP_MSG] ?? WHATSAPP_MSG.en)(greetingName, url))
    : null;
  return { id: presentation.id, token, url, qrSvg, whatsappUrl };
}

export async function savePresentationEdit(
  actor: Actor,
  id: string,
  input: PresentationInput,
  origin: string,
): Promise<{ leadId: string; url: string; whatsappUrl: string | null; summary: string } | { error: "not_found" }> {
  const existingPresentation = await prisma.clientPresentation.findUnique({
    where: { id },
    select: { id: true, leadId: true, token: true, lead: { select: { phone: true } } },
  });
  if (!existingPresentation) return { error: "not_found" };

  const { items, locale, greetingName, personalNote, advisorId, expiresAt, criteria } = input;
  const existingItems = await prisma.clientPresentationItem.findMany({ where: { presentationId: id } });
  const existingByDevId = new Map(existingItems.map((e) => [e.developmentId, e]));
  const { toRemoveDevIds, summary } = editSummary(existingItems, items);
  const removeSet = new Set(toRemoveDevIds);
  const toRemove = existingItems.filter((e) => removeSet.has(e.developmentId));

  await prisma.$transaction([
    ...(toRemove.length ? [prisma.clientPresentationItem.deleteMany({ where: { id: { in: toRemove.map((r) => r.id) } } })] : []),
    ...items.map((it, i) => {
      const ex = existingByDevId.get(it.developmentId);
      const aliasName = cleanAlias(it.aliasName);
      const advisorComment = cleanComment(it.advisorComment);
      const unitRefs = it.unitRefs && it.unitRefs.length ? it.unitRefs : null;
      const unitIds = it.unitIds && it.unitIds.length ? it.unitIds : null;
      const sortIndex = it.sortIndex ?? i;
      if (ex) {
        return prisma.clientPresentationItem.update({
          where: { id: ex.id },
          data: { aliasName, advisorComment, unitRefs: unitRefs ?? undefined, unitIds: unitIds ?? undefined, sortIndex },
        });
      }
      return prisma.clientPresentationItem.create({
        data: {
          presentationId: id, developmentId: it.developmentId,
          aliasName, advisorComment, unitRefs: unitRefs ?? undefined, unitIds: unitIds ?? undefined, sortIndex,
          isNew: true, newAddedAt: new Date(),
        },
      });
    }),
    // Every save re-snapshots the matching panel's current filter state so the
    // public page's "your preferences" chips always reflect it.
    prisma.clientPresentation.update({
      where: { id },
      data: { greetingName, locale, personalNote, advisorId, ...(expiresAt ? { expiresAt } : {}), ...(criteria !== undefined ? { criteria: criteria as any } : {}) },
    }),
  ]);

  await logEvent(actor, existingPresentation.leadId, "PRESENTATION_EDITED", `Presentation edited (${summary})`);
  revalidateLead(existingPresentation.leadId);

  const url = `${origin}/c/${existingPresentation.token}`;
  const phone = existingPresentation.lead.phone;
  const whatsappUrl = phone
    ? waLink(phone, (WHATSAPP_UPDATED_MSG[locale as keyof typeof WHATSAPP_UPDATED_MSG] ?? WHATSAPP_UPDATED_MSG.en)(url))
    : null;
  return { leadId: existingPresentation.leadId, url, whatsappUrl, summary };
}

export async function revokePresentation(actor: Actor, id: string): Promise<{ leadId: string } | null> {
  const p = await prisma.clientPresentation.update({ where: { id }, data: { status: "revoked" }, select: { leadId: true } }).catch((e) => { if (isRecordNotFound(e)) return null; throw e; });
  if (!p) return null;
  await logEvent(actor, p.leadId, "PRESENTATION_REVOKED", "Presentation revoked");
  revalidateLead(p.leadId);
  return { leadId: p.leadId };
}

export async function extendPresentation(actor: Actor, id: string, days: number): Promise<{ leadId: string } | null> {
  const current = await prisma.clientPresentation.findUnique({ where: { id }, select: { leadId: true, expiresAt: true } });
  if (!current) return null;
  const base = current.expiresAt && current.expiresAt > new Date() ? current.expiresAt : new Date();
  const expiresAt = new Date(base.getTime() + days * DAY_MS);
  await prisma.clientPresentation.update({ where: { id }, data: { expiresAt, status: "active" } });
  await logEvent(actor, current.leadId, "PRESENTATION_EXTENDED", `Presentation extended by ${days} days`);
  revalidateLead(current.leadId);
  return { leadId: current.leadId };
}

// Hard delete — items/views cascade via the schema's onDelete: Cascade.
export async function deletePresentation(actor: Actor, id: string): Promise<{ leadId: string } | null> {
  const p = await prisma.clientPresentation.delete({ where: { id }, select: { leadId: true } }).catch((e) => { if (isRecordNotFound(e)) return null; throw e; });
  if (!p) return null;
  await logEvent(actor, p.leadId, "PRESENTATION_DELETED", "Presentation deleted");
  revalidateLead(p.leadId);
  return { leadId: p.leadId };
}
