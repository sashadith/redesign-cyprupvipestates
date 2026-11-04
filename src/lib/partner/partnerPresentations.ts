// Partner-created presentations (partner portal phase 3e, Decision 7): pure glue between the portal's
// "New presentation" form, the effective claim rule and the ClientPresentation rows. No DB access.
import { SITE_URL } from "@/lib/seo";
import { activeSince, effectiveClaimState, type ClaimStateValue } from "./claimState";
import { submissionView, visibleName } from "./clientDto";
import { PARTNER_LOCALES, type PartnerLocale } from "./i18n";
import type { PresentationDraft } from "./presentationDraft";

export const PRESENTATION_TTL_DAYS = 30;
/** Bound for the client picker / allowed set (a partner rarely holds more live clients). */
export const PRESENTATION_CLIENT_SCAN = 500;
/** Bound for the /presentations list. */
export const PRESENTATION_LIST_CAP = 200;

export const presentationUrl = (token: string) => `${SITE_URL}/c/${token}`;

export type PresentationClaimRow = {
  id: string;
  leadId: string;
  state: string;
  createdAt: Date;
  reviewedAt: Date | null;
  submission: unknown;
  lead: { status: string; deletedAt: Date | null } | null;
};

export type PresentationClient = { claimId: string; leadId: string; name: string; firstName: string; language: string | null };

/**
 * The partner's effectively ACTIVE claims (claimState.ts rule) as picker options. `liveDealLeads` = leads
 * with a non-CANCELLED deal, `lastContact` = latest real contact per lead (any date).
 */
export function effectiveActiveClients(
  rows: PresentationClaimRow[],
  facts: { liveDealLeads: Set<string>; lastContact: Map<string, Date | null>; now: Date },
): PresentationClient[] {
  const out: PresentationClient[] = [];
  for (const r of rows) {
    const state = effectiveClaimState({
      state: r.state as ClaimStateValue,
      activeSince: activeSince(r),
      lastRealContactAt: facts.lastContact.get(r.leadId) ?? null,
      now: facts.now,
      leadDeleted: !r.lead || !!r.lead.deletedAt,
      leadStatus: r.lead?.status ?? null,
      hasLiveDeal: facts.liveDealLeads.has(r.leadId),
    });
    if (state !== "ACTIVE") continue;
    const sub = submissionView(r.submission);
    out.push({ claimId: r.id, leadId: r.leadId, name: visibleName(r), firstName: sub.firstName, language: sub.language });
  }
  return out;
}

/** The sets validatePresentationDraft checks against — built on the server only, never from the form. */
export function allowedPresentationSets(clients: { claimId: string }[], projects: { id: string }[]) {
  return { allowedClaimIds: new Set(clients.map((c) => c.claimId)), allowedProjectIds: new Set(projects.map((p) => p.id)) };
}

/** Default presentation language: the client's submitted language when the portal offers it, else the partner's. */
export function defaultPresentationLocale(clientLanguage: string | null, partnerLocale: PartnerLocale): PartnerLocale {
  return clientLanguage && (PARTNER_LOCALES as readonly string[]).includes(clientLanguage) ? (clientLanguage as PartnerLocale) : partnerLocale;
}

/** Raw form fields → the shape validatePresentationDraft takes (project ids in selection order, de-duplicated by the validator). */
export function draftFromForm(fd: { get(k: string): unknown; getAll(k: string): unknown[] }): Record<string, unknown> {
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  return {
    claimId: str(fd.get("claimId")),
    projectIds: fd.getAll("projectIds").map(str).filter(Boolean),
    greetingName: str(fd.get("greetingName")),
    personalNote: str(fd.get("personalNote")),
    locale: str(fd.get("locale")),
  };
}

/**
 * ClientPresentation + item rows for a validated draft. advisorId stays null: the page shows partner
 * branding. Items carry no unitRefs (column default null = all available units), in selection order.
 */
export function buildPresentationCreate(input: {
  draft: PresentationDraft;
  leadId: string;
  lead: { budgetMin: number | null; budgetMax: number | null };
  partnerId: string;
  token: string;
  now: Date;
}) {
  const { draft } = input;
  const criteria: { budgetMin?: number; budgetMax?: number } = {};
  if (input.lead.budgetMin != null) criteria.budgetMin = input.lead.budgetMin;
  if (input.lead.budgetMax != null) criteria.budgetMax = input.lead.budgetMax;
  return {
    presentation: {
      leadId: input.leadId,
      partnerId: input.partnerId,
      advisorId: null,
      token: input.token,
      locale: draft.locale,
      greetingName: draft.greetingName,
      personalNote: draft.personalNote || null,
      criteria,
      status: "active",
      expiresAt: new Date(input.now.getTime() + PRESENTATION_TTL_DAYS * 86_400_000),
    },
    items: draft.projectIds.map((developmentId, sortIndex) => ({ developmentId, sortIndex })),
  };
}

export type PresentationStatus = "active" | "expired" | "revoked";

export function presentationStatusOf(p: { status: string; expiresAt: Date | null }, now: Date): PresentationStatus {
  if (p.status === "revoked") return "revoked";
  if (p.status === "expired" || (p.expiresAt && p.expiresAt < now)) return "expired";
  return "active";
}

export type PresentationStats = { views: number; lastOpenedAt: Date | null; favorites: number };

/**
 * Per-presentation stats from two grouped queries: page-level views (developmentId null) grouped by
 * presentation (count + latest), and favourited items grouped by presentation (count).
 */
export function mergePresentationStats(
  ids: string[],
  viewGroups: { presentationId: string; count: number; last: Date | null }[],
  favoriteGroups: { presentationId: string; count: number }[],
): Map<string, PresentationStats> {
  const map = new Map<string, PresentationStats>(ids.map((id) => [id, { views: 0, lastOpenedAt: null, favorites: 0 }]));
  for (const g of viewGroups) {
    const s = map.get(g.presentationId);
    if (s) { s.views = g.count; s.lastOpenedAt = g.last; }
  }
  for (const g of favoriteGroups) {
    const s = map.get(g.presentationId);
    if (s) s.favorites = g.count;
  }
  return map;
}
