"use server";
/**
 * Partner presentation builder (2026-11-11): the CRM's matching, create and edit flow for partners.
 * Every action re-reads the partner session and the partner's own effectively ACTIVE clients and
 * published projects on the server; nothing from the browser is trusted beyond membership in them.
 * Errors are partner dictionary keys ("err.*").
 */
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { matchDevelopmentsForLead, type DevelopmentMatch, type MatchFilters } from "@/lib/crm/matching";
import { listPresentationLocationOptions, type LocationOptions } from "@/lib/crm/presentations/locations";
import { buildEditorItems, type EditorItem } from "@/lib/crm/presentations/editorItems";
import { favoritesSeedFromRows, type FavoritesSeed } from "@/lib/crm/presentations/favoritesSeed";
import { editSummary, type PresentationItemInput } from "@/lib/crm/presentations/core";
import { sentHistory, type SentInfo } from "@/lib/crm/presentations/sentHistory";
import { uniquePresentationToken } from "@/lib/crm/presentationToken";
import { writePartnerAudit } from "@/lib/partner/audit";
import { submissionView } from "@/lib/partner/clientDto";
import { PARTNER_LOCALES, type PartnerLocale } from "@/lib/partner/i18n";
import { partnerLimits as L } from "@/lib/partner/limits";
import { PRESENTATION_TTL_DAYS, presentationUrl } from "@/lib/partner/partnerPresentations";
import {
  canEditPartnerPresentation, expiryFromInput, parsePartnerFilters, toPartnerMatch, validatePartnerItems, type DevUnits,
} from "@/lib/partner/presentationBuilder";
import { GREETING_NAME_MAX, PERSONAL_NOTE_MAX } from "@/lib/partner/presentationDraft";
import { myPresentationClients, myProjects } from "@/lib/partner/scope";
import { requirePartner } from "@/lib/partner/session";

type Err = { error: string; field?: string };
const err = (error: string, field?: string): Err => (field ? { error, field } : { error });
const validId = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 64;

// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u001f\u007f]/;
// eslint-disable-next-line no-control-regex
const CONTROL_EXCEPT_NEWLINE_RE = /[\u0000-\u0009\u000b-\u001f\u007f]/;

async function scope() {
  const me = await requirePartner({ active: true });
  const [clients, mine] = await Promise.all([myPresentationClients(me.partner.id), myProjects(me.partner.id)]);
  return { me, clients, allowed: new Set(mine.projects.map((p) => p.id)), names: new Map(mine.projects.map((p) => [p.id, p.name])) };
}

async function presentationsOfLead(partnerId: string, leadId: string) {
  return prisma.clientPresentation.findMany({
    where: { partnerId, leadId },
    select: {
      id: true, createdAt: true,
      items: { select: { developmentId: true, isFavorited: true } },
      views: { where: { developmentId: { not: null } }, select: { developmentId: true } },
    },
  });
}

/** "Sent before" marks: only this partner's own presentations to this client. */
async function partnerSent(partnerId: string, leadId: string, excludeId?: string): Promise<Record<string, SentInfo>> {
  const rows = await presentationsOfLead(partnerId, leadId);
  return sentHistory(rows.map((r) => {
    const views = new Map<string, number>();
    for (const v of r.views) if (v.developmentId) views.set(v.developmentId, (views.get(v.developmentId) ?? 0) + 1);
    return {
      id: r.id, createdAt: r.createdAt,
      items: r.items.map((i) => ({ developmentId: i.developmentId, isFavorited: i.isFavorited, views: views.get(i.developmentId) ?? 0 })),
    };
  }), excludeId);
}

export type BuilderContext = {
  filters: MatchFilters;
  sent: Record<string, SentInfo>;
  email: string | null;
  phone: string | null;
  firstName: string;
  signer: string;
};

async function contextFor(me: { partner: { id: string } }, claimId: string, leadId: string, excludeId?: string): Promise<BuilderContext | Err> {
  const [lead, claim, partner, sent] = await Promise.all([
    prisma.lead.findUnique({ where: { id: leadId }, select: { budgetMin: true, budgetMax: true } }),
    prisma.partnerClaim.findUnique({ where: { id: claimId }, select: { submission: true } }),
    prisma.partner.findUnique({ where: { id: me.partner.id }, select: { brandName: true, firstName: true, lastName: true } }),
    partnerSent(me.partner.id, leadId, excludeId),
  ]);
  if (!lead || !claim) return err("err.presentationClient", "claimId");
  const sub = submissionView(claim.submission);
  const signer = partner?.brandName?.trim() || `${partner?.firstName ?? ""} ${partner?.lastName ?? ""}`.trim();
  return {
    // Budget only: the property-type interest on the lead is our advisor's, partners never submit it.
    filters: parsePartnerFilters({ budgetMin: lead.budgetMin, budgetMax: lead.budgetMax, onlyAvailable: true }),
    sent, email: sub.email, phone: sub.phone, firstName: sub.firstName, signer,
  };
}

export async function partnerBuilderContextAction(claimId: string): Promise<BuilderContext | Err> {
  const { me, clients } = await scope();
  const client = clients.find((c) => c.claimId === claimId);
  if (!client) return err("err.presentationClient", "claimId");
  return contextFor(me, client.claimId, client.leadId);
}

export async function partnerMatchAction(claimId: string, filters: unknown): Promise<DevelopmentMatch[] | Err> {
  const { me, clients, allowed } = await scope();
  if (!L.presentationMatch.hit(me.partner.id)) return err("err.rateLimited");
  const client = clients.find((c) => c.claimId === claimId);
  if (!client) return err("err.presentationClient", "claimId");
  const lead = await prisma.lead.findUnique({ where: { id: client.leadId }, select: { budgetMin: true, budgetMax: true } });
  if (!lead) return err("err.presentationClient", "claimId");
  const f = parsePartnerFilters(filters);
  const matches = await matchDevelopmentsForLead({ budgetMin: lead.budgetMin, budgetMax: lead.budgetMax, propertyTypeInterest: [] }, f);
  return matches.map((m) => toPartnerMatch(m, allowed)).filter((m): m is DevelopmentMatch => m !== null);
}

export async function partnerLocationsAction(): Promise<LocationOptions | Err> {
  await requirePartner({ active: true });
  return listPresentationLocationOptions({ publishedOnly: true });
}

async function devUnits(ids: string[]): Promise<Map<string, DevUnits>> {
  const rows = await prisma.development.findMany({
    where: { id: { in: ids }, publishStatus: "published" },
    select: { id: true, publicName: true, override: { select: { alias: true } }, units: { select: { id: true, ref: true, status: true } } },
  });
  // Same name normalizeRef got on the builder side (the matcher's alias-or-public name).
  return new Map(rows.map((r) => [r.id, { name: r.override?.alias || r.publicName, units: r.units }]));
}

function itemIds(raw: unknown): string[] {
  return Array.isArray(raw)
    ? raw.map((it) => (it && typeof it === "object" ? (it as Record<string, unknown>).developmentId : null)).filter(validId).slice(0, 50)
    : [];
}

type General = { greetingName: string; personalNote: string | null; locale: PartnerLocale };

function general(b: Record<string, unknown>): General | Err {
  const greetingName = typeof b.greetingName === "string" ? b.greetingName.trim() : "";
  if (!greetingName || greetingName.length > GREETING_NAME_MAX || CONTROL_RE.test(greetingName)) return err("err.greetingName", "greetingName");
  let personalNote: string | null = null;
  if (b.personalNote != null) {
    if (typeof b.personalNote !== "string") return err("err.personalNote", "personalNote");
    const n = b.personalNote.replace(/\r\n?/g, "\n").trim();
    if (n.length > PERSONAL_NOTE_MAX || CONTROL_EXCEPT_NEWLINE_RE.test(n)) return err("err.personalNote", "personalNote");
    personalNote = n || null;
  }
  const locale = typeof b.locale === "string" && (PARTNER_LOCALES as readonly string[]).includes(b.locale) ? (b.locale as PartnerLocale) : null;
  if (!locale) return err("err.language", "locale");
  return { greetingName, personalNote, locale };
}

/** The CRM's deprecated mirror columns, derived from the criteria snapshot as createPresentation does. */
function legacyFilterColumns(c: MatchFilters) {
  return { filterBedrooms: c.bedrooms ?? [], filterLocations: (c.areas?.length ? c.areas : c.districts) ?? [] };
}

const prismaItem = (it: PresentationItemInput) => ({
  developmentId: it.developmentId,
  unitRefs: it.unitRefs ?? undefined,
  unitIds: it.unitIds ?? undefined,
  sortIndex: it.sortIndex ?? 0,
  aliasName: it.aliasName || null,
  advisorComment: it.advisorComment || null,
});

class ClaimGone extends Error {}

export async function createPartnerPresentationAction(body: unknown): Promise<{ ok: true; id: string; url: string } | Err> {
  const { me, clients, allowed } = await scope();
  if (!L.presentation.hit(me.partner.id)) return err("err.rateLimited");
  const b = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const client = clients.find((c) => c.claimId === b.claimId);
  if (!client) return err("err.presentationClient", "claimId");
  const g = general(b);
  if ("error" in g) return g;
  const v = validatePartnerItems(b.items, { allowed, devs: await devUnits(itemIds(b.items)) });
  if (!v.ok) return err(v.code, "items");
  const criteria = parsePartnerFilters(b.criteria);
  const token = await uniquePresentationToken();
  const now = new Date();
  let id = "";
  try {
    await prisma.$transaction(async (tx) => {
      const claim = await tx.partnerClaim.findFirst({
        where: { id: client.claimId, partnerId: me.partner.id, leadId: client.leadId, state: "ACTIVE" }, select: { id: true },
      });
      if (!claim) throw new ClaimGone();
      const created = await tx.clientPresentation.create({
        data: {
          leadId: client.leadId, partnerId: me.partner.id, advisorId: null, token, status: "active",
          locale: g.locale, greetingName: g.greetingName, personalNote: g.personalNote,
          criteria: JSON.parse(JSON.stringify(criteria)), ...legacyFilterColumns(criteria),
          expiresAt: new Date(now.getTime() + PRESENTATION_TTL_DAYS * 86_400_000),
          items: { create: v.items.map(prismaItem) },
        },
        select: { id: true },
      });
      id = created.id;
      await writePartnerAudit(me.partner, me.user, "partner_presentation_created", {
        presentationId: created.id, claimId: client.claimId, projects: v.items.length,
        pickedUnits: v.items.reduce((n, it) => n + (it.unitRefs?.length ?? 0) + (it.unitIds?.length ?? 0), 0),
      }, tx);
    });
  } catch (e) {
    if (e instanceof ClaimGone) return err("err.presentationClient", "claimId");
    throw e;
  }
  revalidatePath("/partner-portal/presentations");
  return { ok: true, id, url: presentationUrl(token) };
}

async function ownPresentation(id: unknown) {
  const s = await scope();
  if (!validId(id)) return { ...s, p: null, client: null };
  const p = await prisma.clientPresentation.findUnique({
    where: { id },
    select: {
      id: true, leadId: true, partnerId: true, status: true, token: true, locale: true, greetingName: true, personalNote: true,
      expiresAt: true, criteria: true,
    },
  });
  const activeLeadIds = new Set(s.clients.map((c) => c.leadId));
  if (!p || !canEditPartnerPresentation(p, { partnerId: s.me.partner.id, activeLeadIds })) return { ...s, p: null, client: null };
  return { ...s, p, client: s.clients.find((c) => c.leadId === p.leadId) ?? null };
}

export type LoadedPresentation = {
  presentation: {
    id: string; claimId: string; clientName: string; locale: PartnerLocale; greetingName: string; personalNote: string;
    expiresAt: string; criteria: MatchFilters; url: string;
  };
  items: EditorItem[];
  favoritedIds: string[];
  context: BuilderContext;
};

const isoDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Nicosia", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

export async function loadPartnerPresentationAction(id: string): Promise<LoadedPresentation | Err> {
  const { me, p, client, allowed, names } = await ownPresentation(id);
  if (!p || !client) return err("err.presentationNotFound");
  const stored = await prisma.clientPresentationItem.findMany({ where: { presentationId: p.id }, orderBy: { sortIndex: "asc" } });
  const ctx = await contextFor(me, client.claimId, client.leadId, p.id);
  if ("error" in ctx) return ctx;
  // Items of projects no longer offered to the partner (unpublished since) are dropped from the editor.
  const items = (await buildEditorItems(stored.filter((s) => allowed.has(s.developmentId))))
    .map((it) => ({ ...it, publicName: names.get(it.developmentId) ?? it.publicName }));
  return {
    presentation: {
      id: p.id, claimId: client.claimId, clientName: client.name,
      locale: (PARTNER_LOCALES as readonly string[]).includes(p.locale) ? (p.locale as PartnerLocale) : "en",
      greetingName: p.greetingName, personalNote: p.personalNote ?? "",
      expiresAt: p.expiresAt ? isoDay(p.expiresAt) : "",
      criteria: parsePartnerFilters(p.criteria), url: presentationUrl(p.token),
    },
    items,
    favoritedIds: stored.filter((s) => s.isFavorited).map((s) => s.developmentId),
    context: ctx,
  };
}

export async function savePartnerPresentationAction(id: string, body: unknown): Promise<{ ok: true; url: string; summary: string } | Err> {
  const { me, p, client, allowed } = await ownPresentation(id);
  if (!p || !client) return err("err.presentationNotFound");
  if (!L.presentation.hit(me.partner.id)) return err("err.rateLimited");
  const b = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const g = general(b);
  if ("error" in g) return g;
  const now = new Date();
  let expiresAt: Date | null = null;
  if (typeof b.expiresAt === "string" && b.expiresAt && b.expiresAt !== (p.expiresAt ? isoDay(p.expiresAt) : "")) {
    expiresAt = expiryFromInput(b.expiresAt, now);
    if (!expiresAt) return err("err.presentationExpiry", "expiresAt");
  }
  const v = validatePartnerItems(b.items, { allowed, devs: await devUnits(itemIds(b.items)) });
  if (!v.ok) return err(v.code, "items");
  const criteria = parsePartnerFilters(b.criteria);
  const existing = await prisma.clientPresentationItem.findMany({ where: { presentationId: p.id } });
  const byDev = new Map(existing.map((e) => [e.developmentId, e]));
  const { toRemoveDevIds, summary } = editSummary(existing, v.items);
  const effectiveExpiry = expiresAt ?? p.expiresAt;
  try {
    await prisma.$transaction(async (tx) => {
      const claim = await tx.partnerClaim.findFirst({
        where: { id: client.claimId, partnerId: me.partner.id, leadId: client.leadId, state: "ACTIVE" }, select: { id: true },
      });
      if (!claim) throw new ClaimGone();
      if (toRemoveDevIds.length) await tx.clientPresentationItem.deleteMany({ where: { presentationId: p.id, developmentId: { in: toRemoveDevIds } } });
      for (const it of v.items) {
        const ex = byDev.get(it.developmentId);
        const data = prismaItem(it);
        if (ex) {
          await tx.clientPresentationItem.update({
            where: { id: ex.id },
            // DbNull = whole project again (all available units), as the public page reads it.
            data: { unitRefs: it.unitRefs ?? Prisma.DbNull, unitIds: it.unitIds ?? Prisma.DbNull, sortIndex: data.sortIndex, aliasName: data.aliasName, advisorComment: data.advisorComment },
          });
        } else {
          await tx.clientPresentationItem.create({ data: { ...data, presentationId: p.id, isNew: true, newAddedAt: now } });
        }
      }
      await tx.clientPresentation.update({
        where: { id: p.id },
        data: {
          locale: g.locale, greetingName: g.greetingName, personalNote: g.personalNote,
          criteria: JSON.parse(JSON.stringify(criteria)), ...legacyFilterColumns(criteria),
          ...(expiresAt ? { expiresAt } : {}),
          // A new future expiry brings an expired presentation back.
          ...(effectiveExpiry && effectiveExpiry > now ? { status: "active" } : {}),
        },
      });
      await writePartnerAudit(me.partner, me.user, "partner_presentation_edited", { presentationId: p.id, claimId: client.claimId, summary }, tx);
    });
  } catch (e) {
    if (e instanceof ClaimGone) return err("err.presentationClient", "claimId");
    throw e;
  }
  revalidatePath("/partner-portal/presentations");
  return { ok: true, url: presentationUrl(p.token), summary };
}

export async function partnerFavoritesSeedAction(id: string): Promise<(FavoritesSeed & { claimId: string }) | Err> {
  const { p, client, allowed, names } = await ownPresentation(id);
  if (!p || !client) return err("err.presentationNotFound");
  const items = await prisma.clientPresentationItem.findMany({
    where: { presentationId: p.id, isFavorited: true },
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
  const rows = items.map((i) => i.development).filter((d) => allowed.has(d.id));
  if (!rows.length) return err("err.presentationNoFavorites");
  const seed = favoritesSeedFromRows(rows);
  const preselectNames: Record<string, string> = {};
  for (const r of rows) preselectNames[r.id] = names.get(r.id) ?? r.publicName;
  return { ...seed, filters: parsePartnerFilters(seed.filters), preselectNames, claimId: client.claimId };
}
