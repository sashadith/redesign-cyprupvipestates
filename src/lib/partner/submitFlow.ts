// Pure helpers for the partner client submission (partner portal phase 3b). No DB access:
// the server service (submitClient.ts) and the form action use these, the tests cover them.
import type { Prisma } from "@prisma/client";
import { escapeHtml } from "./mail";
import { parseBudgetField } from "./budgetField";
import type { SubmissionInput, SubmissionMode } from "./submission";

export { parseBudgetField };

type FormLike = { get(name: string): FormDataEntryValue | null; getAll(name: string): FormDataEntryValue[] };

const TEXT_FIELDS = [
  "firstName", "lastName", "email", "phone", "language", "mode", "projectsText", "contactMode", "repName", "repPhone", "comment",
] as const;

/**
 * FormData → the raw object validateSubmission expects. Budgets become JSON integers (or are
 * left out when empty), projectIds come from repeated form values, the consent checkbox becomes
 * a boolean. Only an unparsable budget is rejected here; everything else is validateSubmission's job.
 */
export function rawFromForm(fd: FormLike): { ok: true; raw: Record<string, unknown> } | { ok: false; field: string; code: string } {
  const raw: Record<string, unknown> = {};
  for (const k of TEXT_FIELDS) {
    const v = fd.get(k);
    if (typeof v === "string" && v !== "") raw[k] = v;
  }
  for (const k of ["budgetMin", "budgetMax"] as const) {
    const v = fd.get(k);
    const n = parseBudgetField(typeof v === "string" ? v : "");
    if (n === "invalid") return { ok: false, field: k, code: "err.budget" };
    if (n !== null) raw[k] = n;
  }
  const ids = fd.getAll("projectIds").filter((v): v is string => typeof v === "string" && v !== "");
  if (ids.length) raw.projectIds = ids;
  raw.consent = fd.get("consent") === "on";
  return { ok: true, raw };
}

export type SubmittingPartner = { id: string; company: string | null; firstName: string; lastName: string };

/** How the office sees the partner: company, else first + last name. */
export function partnerDisplayName(p: Pick<SubmittingPartner, "company" | "firstName" | "lastName">): string {
  return p.company?.trim() || `${p.firstName} ${p.lastName}`.trim();
}

export const modeLabel = (m: SubmissionMode) => (m === "FIX" ? "Fix" : "Handover");

export function clientDisplayName(input: Pick<SubmissionInput, "firstName" | "lastName">): string {
  return `${input.firstName} ${input.lastName ?? ""}`.trim();
}

/** SYSTEM timeline row / CREATED activity text (CRM copy: English). */
export function partnerSubmissionNote(partner: Pick<SubmittingPartner, "company" | "firstName" | "lastName">, mode: SubmissionMode): string {
  return `Submitted by partner ${partnerDisplayName(partner)} — ${modeLabel(mode)}`;
}

/** Lead.message: the partner's comment, then "Projects: …" (selected names + free text); null when both are empty. */
export function leadMessage(comment: string | null, projectNames: string[], projectsText: string | null): string | null {
  const projects = [...projectNames, ...(projectsText ? [projectsText] : [])].map((s) => s.trim()).filter(Boolean);
  const parts = [comment?.trim() || null, projects.length ? `Projects: ${projects.join(", ")}` : null].filter((s): s is string => !!s);
  return parts.length ? parts.join("\n\n") : null;
}

/**
 * Prisma create data for a new PARTNER lead. Same conventions as createLeadRecord (trimmed
 * names, lower-cased email, NEW, unassigned) — Fix leads are never pre-assigned either.
 */
export function leadDataFromSubmission(
  input: SubmissionInput,
  partner: Pick<SubmittingPartner, "id">,
  projectNames: string[],
): Prisma.LeadUncheckedCreateInput {
  return {
    firstName: input.firstName.trim(),
    lastName: (input.lastName ?? "").trim(),
    email: input.email?.trim().toLowerCase() || null,
    phone: input.phone?.trim() || null,
    languagePreference: input.language ?? null,
    budgetMin: input.budgetMin ?? null,
    budgetMax: input.budgetMax ?? null,
    message: leadMessage(input.comment, projectNames, input.projectsText),
    source: "PARTNER",
    status: "NEW",
    assignedToId: null,
    partnerId: partner.id,
    partnerMode: input.mode,
    contactMode: input.contactMode,
    contactRepName: input.repName,
    contactRepPhone: input.repPhone,
  };
}

/** PartnerClaim.submission: exactly what the partner typed, plus the chosen projects' names. */
export function claimSubmissionJson(input: SubmissionInput, projects: { id: string; name: string }[]): Prisma.InputJsonObject {
  return {
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    phone: input.phone,
    language: input.language,
    budgetMin: input.budgetMin,
    budgetMax: input.budgetMax,
    mode: input.mode,
    projectIds: input.projectIds,
    projects: projects.map((p) => ({ id: p.id, name: p.name })),
    projectsText: input.projectsText,
    contactMode: input.contactMode,
    repName: input.repName,
    repPhone: input.repPhone,
    comment: input.comment,
  };
}

/** Office Telegram notice (HTML parse mode → every value escaped). The lead link only for a new lead. */
export type PartnerClientNotice = { clientName: string; partnerName: string; mode: SubmissionMode; baseUrl?: string } & (
  | { outcome: "CREATED"; leadId: string }
  | { outcome: "REVIEW" }
);

export function buildPartnerClientNotice(n: PartnerClientNotice): string {
  const head = `Partner client: ${escapeHtml(n.clientName)} from ${escapeHtml(n.partnerName)} (${modeLabel(n.mode)})`;
  if (n.outcome === "CREATED") {
    const base = (n.baseUrl ?? "").replace(/\/+$/, "");
    return `${head} → ${escapeHtml(`${base}/crm/leads/${encodeURIComponent(n.leadId)}`)}`;
  }
  return `${head} → needs review in /crm/inbox`;
}
