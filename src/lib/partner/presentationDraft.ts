// "New presentation" form of the partner portal (phase 3e, Decision 7). Pure validation; the caller
// passes the partner's own effectively ACTIVE claim ids and the project ids it may offer (myProjects).
import { PARTNER_LOCALES, type PartnerLocale } from "./i18n";

export const MAX_PRESENTATION_PROJECTS = 12;
export const GREETING_NAME_MAX = 60;
export const PERSONAL_NOTE_MAX = 600;

export type PresentationDraft = {
  claimId: string;
  projectIds: string[];
  greetingName: string;
  personalNote: string;
  locale: PartnerLocale;
};
export type PresentationDraftResult = { ok: true; data: PresentationDraft } | { ok: false; field: string; code: string };

export const PRESENTATION_DRAFT_ERROR_CODES = [
  "err.invalid", "err.unknownField", "err.presentationClient", "err.presentationProjects",
  "err.greetingName", "err.personalNote", "err.language",
] as const;

const ALLOWED = new Set(["claimId", "projectIds", "greetingName", "personalNote", "locale"]);
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u001f\u007f]/;
// eslint-disable-next-line no-control-regex
const CONTROL_EXCEPT_NEWLINE_RE = /[\u0000-\u0009\u000b-\u001f\u007f]/;

const fail = (field: string, code: string): PresentationDraftResult => ({ ok: false, field, code });

export function validatePresentationDraft(
  raw: unknown,
  ctx: { allowedClaimIds: Set<string>; allowedProjectIds: Set<string> },
): PresentationDraftResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fail("_", "err.invalid");
  const r = raw as Record<string, unknown>;
  for (const k of Object.keys(r)) if (!ALLOWED.has(k)) return fail(k, "err.unknownField");

  const claimId = typeof r.claimId === "string" ? r.claimId.trim() : "";
  if (!claimId || !ctx.allowedClaimIds.has(claimId)) return fail("claimId", "err.presentationClient");

  const ids = r.projectIds;
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > MAX_PRESENTATION_PROJECTS) return fail("projectIds", "err.presentationProjects");
  const projectIds: string[] = [];
  for (const id of ids) {
    if (typeof id !== "string" || !ctx.allowedProjectIds.has(id) || projectIds.includes(id)) return fail("projectIds", "err.presentationProjects");
    projectIds.push(id);
  }

  const greetingName = typeof r.greetingName === "string" ? r.greetingName.trim() : "";
  if (!greetingName || greetingName.length > GREETING_NAME_MAX || CONTROL_RE.test(greetingName)) return fail("greetingName", "err.greetingName");

  let personalNote = "";
  if (r.personalNote !== undefined && r.personalNote !== null) {
    if (typeof r.personalNote !== "string") return fail("personalNote", "err.personalNote");
    personalNote = r.personalNote.replace(/\r\n?/g, "\n").trim();
    if (personalNote.length > PERSONAL_NOTE_MAX || CONTROL_EXCEPT_NEWLINE_RE.test(personalNote)) return fail("personalNote", "err.personalNote");
  }

  const locale = typeof r.locale === "string" ? r.locale : "";
  if (!(PARTNER_LOCALES as readonly string[]).includes(locale)) return fail("locale", "err.language");

  return { ok: true, data: { claimId, projectIds, greetingName, personalNote, locale: locale as PartnerLocale } };
}
