"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCrmUser } from "@/lib/crm/session";
import { presentationGuard } from "@/lib/crm/presentations/guard";
import {
  cleanPresentationInput, createPresentation, savePresentationEdit, revokePresentation,
  extendPresentation, deletePresentation, presentationLeadId,
} from "@/lib/crm/presentations/core";
import { listPresentationLocationOptions, type LocationOptions } from "@/lib/crm/presentations/locations";
import { buildEditorItems, type EditorItem } from "@/lib/crm/presentations/editorItems";
import { favoritesSeedFromRows, type FavoritesSeed } from "@/lib/crm/presentations/favoritesSeed";
import { matchDevelopmentsForLead, type MatchFilters, type DevelopmentMatch } from "@/lib/crm/matching";

// Client presentations in the new CRM. Middleware does not protect server
// actions: every export checks the session and presentationGuard itself, and
// returns { error } instead of throwing to the client.

export type EditPayload = {
  presentation: {
    id: string; leadId: string; locale: string; greetingName: string; personalNote: string;
    advisorId: string; expiresAt: string; criteria: MatchFilters | null;
  };
  items: EditorItem[];
  /** Development ids the client hearted, so removing one can ask first. */
  favoritedIds: string[];
};

const NOT_FOUND = "Lead not found.";
const NOT_SIGNED_IN = "Not signed in.";

function validId(v: unknown): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= 64;
}

async function guardedLead(leadId: unknown, op: "edit" | "delete" = "edit") {
  const user = await getCrmUser();
  if (!user) return { user: null, lead: null, error: NOT_SIGNED_IN };
  const lead = validId(leadId)
    ? await prisma.lead.findFirst({
        where: { id: leadId, deletedAt: null },
        select: { id: true, assignedToId: true, workedByPartner: true, budgetMin: true, budgetMax: true, propertyTypeInterest: true },
      })
    : null;
  return { user, lead, error: presentationGuard(user, lead, op) };
}

async function guardedPresentation(id: unknown, op: "edit" | "delete") {
  const user = await getCrmUser();
  if (!user) return { user: null, owner: null, error: NOT_SIGNED_IN };
  const found = validId(id) ? await presentationLeadId(id) : null;
  // A soft-deleted lead's selections are as gone as the lead itself.
  const owner = found && !found.leadDeleted ? found : null;
  const lead = owner ? { assignedToId: owner.assignedToId, workedByPartner: owner.workedByPartner } : null;
  return { user, owner, error: presentationGuard(user, lead, op) };
}

// Same origin rule as the old route: the actual request, so links are right
// for whichever domain the operator is on.
function requestOrigin(): string {
  const h = headers();
  const proto = h.get("x-forwarded-proto") || "https";
  const host = h.get("host");
  return host ? `${proto}://${host}` : "https://cyprusvipestates.com";
}

export async function matchAction(leadId: string, filters: MatchFilters): Promise<DevelopmentMatch[] | { error: string }> {
  const { lead, error } = await guardedLead(leadId);
  if (error || !lead) return { error: error ?? NOT_FOUND };
  return matchDevelopmentsForLead(lead, filters);
}

// Silent auto-save of the matching panel's filters; no revalidatePath on
// purpose (fires on every filter change, a refetch would disturb the editing).
export async function saveFiltersAction(leadId: string, filters: MatchFilters): Promise<{ ok: true } | { error: string }> {
  const { lead, error } = await guardedLead(leadId);
  if (error || !lead) return { error: error ?? NOT_FOUND };
  await prisma.lead.update({ where: { id: lead.id }, data: { lastMatchFilters: JSON.parse(JSON.stringify(filters ?? {})) } });
  return { ok: true };
}

export async function locationsAction(): Promise<LocationOptions | { error: string }> {
  if (!(await getCrmUser())) return { error: NOT_SIGNED_IN };
  return listPresentationLocationOptions();
}

export async function createPresentationAction(leadId: string, body: unknown) {
  const { user, lead, error } = await guardedLead(leadId);
  if (error || !lead) return { error: error ?? NOT_FOUND };
  const cleaned = cleanPresentationInput(body, { defaultAdvisorId: user.id });
  if (!cleaned.ok) return { error: cleaned.error };
  const result = await createPresentation({ id: user.id, name: user.name }, lead.id, cleaned.input, requestOrigin());
  if ("error" in result) return { error: NOT_FOUND };
  revalidatePath(`/crm/leads/${lead.id}`);
  return result;
}

export async function loadPresentationForEditAction(id: string): Promise<EditPayload | { error: string }> {
  const { error } = await guardedPresentation(id, "edit");
  if (error) return { error };
  const p = await prisma.clientPresentation.findUnique({
    where: { id },
    include: { items: { orderBy: { sortIndex: "asc" } } },
  });
  if (!p) return { error: NOT_FOUND };
  const items = await buildEditorItems(p.items);
  return {
    presentation: {
      id: p.id, leadId: p.leadId, locale: p.locale, greetingName: p.greetingName,
      personalNote: p.personalNote ?? "", advisorId: p.advisorId ?? "",
      expiresAt: p.expiresAt ? p.expiresAt.toISOString().slice(0, 10) : "",
      criteria: (p.criteria as MatchFilters | null) ?? null,
    },
    items,
    favoritedIds: p.items.filter((i) => i.isFavorited).map((i) => i.developmentId),
  };
}

// "New from favorites": filters built from the projects the client hearted in
// this selection, with those projects pre-ticked.
export async function favoritesSeedAction(id: string): Promise<FavoritesSeed | { error: string }> {
  const { error } = await guardedPresentation(id, "edit");
  if (error) return { error };
  const items = await prisma.clientPresentationItem.findMany({
    where: { presentationId: id, isFavorited: true },
    orderBy: { sortIndex: "asc" },
    select: {
      development: {
        select: {
          id: true, publicName: true, district: true, town: true, area: true,
          override: { select: { district: true, town: true, area: true } },
          units: { select: { status: true, price: true, beds: true, type: true } },
        },
      },
    },
  });
  if (!items.length) return { error: "The client has not favorited anything in this selection." };
  return favoritesSeedFromRows(items.map((i) => i.development));
}

export async function savePresentationEditAction(id: string, body: unknown) {
  const { user, owner, error } = await guardedPresentation(id, "edit");
  if (error || !owner) return { error: error ?? NOT_FOUND };
  const cleaned = cleanPresentationInput(body, { defaultAdvisorId: null });
  if (!cleaned.ok) return { error: cleaned.error };
  const result = await savePresentationEdit({ id: user.id, name: user.name }, id, cleaned.input, requestOrigin());
  if ("error" in result) return { error: NOT_FOUND };
  revalidatePath(`/crm/leads/${owner.leadId}`);
  return result;
}

export async function revokePresentationAction(id: string): Promise<{ ok: true } | { error: string }> {
  const { user, owner, error } = await guardedPresentation(id, "edit");
  if (error || !owner) return { error: error ?? NOT_FOUND };
  const r = await revokePresentation({ id: user.id, name: user.name }, id);
  if (!r) return { error: NOT_FOUND };
  revalidatePath(`/crm/leads/${owner.leadId}`);
  return { ok: true };
}

export async function extendPresentationAction(id: string, days: 7 | 14 | 30): Promise<{ ok: true } | { error: string }> {
  const { user, owner, error } = await guardedPresentation(id, "edit");
  if (error || !owner) return { error: error ?? NOT_FOUND };
  if (days !== 7 && days !== 14 && days !== 30) return { error: "Extension must be 7, 14 or 30 days." };
  const cur = await prisma.clientPresentation.findUnique({ where: { id }, select: { status: true } });
  if (!cur) return { error: NOT_FOUND };
  if (cur.status === "revoked") return { error: "This selection was revoked and can't be extended." };
  const r = await extendPresentation({ id: user.id, name: user.name }, id, days);
  if (!r) return { error: NOT_FOUND };
  revalidatePath(`/crm/leads/${owner.leadId}`);
  return { ok: true };
}

export async function deletePresentationAction(id: string): Promise<{ ok: true } | { error: string }> {
  const { user, owner, error } = await guardedPresentation(id, "delete");
  if (error || !owner) return { error: error ?? NOT_FOUND };
  const r = await deletePresentation({ id: user.id, name: user.name }, id);
  if (!r) return { error: NOT_FOUND };
  revalidatePath(`/crm/leads/${owner.leadId}`);
  return { ok: true };
}

// ---------- Saved advisor notes (2026-11-03) ----------
// One line per project and advisor, prefilled into every later selection that
// advisor builds. Stored per signed-in user; no lead involved.

const NOTE_MAX = 300;

export async function loadAdvisorNotesAction(): Promise<Record<string, string> | { error: string }> {
  const user = await getCrmUser();
  if (!user) return { error: NOT_SIGNED_IN };
  const rows = await prisma.advisorProjectNote.findMany({ where: { userId: user.id }, select: { developmentId: true, text: true } });
  return Object.fromEntries(rows.map((r) => [r.developmentId, r.text]));
}

/** Saves the note as this advisor's default for the project; an empty note removes the saved one. */
export async function saveAdvisorNoteAction(developmentId: string, text: string): Promise<{ ok: true; text: string } | { error: string }> {
  const user = await getCrmUser();
  if (!user) return { error: NOT_SIGNED_IN };
  if (!validId(developmentId)) return { error: "Project not found." };
  const clean = String(text ?? "").replace(/\s+/g, " ").trim().slice(0, NOTE_MAX);
  if (!clean) {
    await prisma.advisorProjectNote.deleteMany({ where: { userId: user.id, developmentId } });
    return { ok: true, text: "" };
  }
  const dev = await prisma.development.findUnique({ where: { id: developmentId }, select: { id: true } });
  if (!dev) return { error: "Project not found." };
  await prisma.advisorProjectNote.upsert({
    where: { userId_developmentId: { userId: user.id, developmentId } },
    create: { userId: user.id, developmentId, text: clean },
    update: { text: clean },
  });
  return { ok: true, text: clean };
}
