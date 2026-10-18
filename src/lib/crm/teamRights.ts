// Employee rights and owner-suggestion inputs for the /crm/team screen (2026-10-18). Pure.
import { LOCALES } from "@/lib/locale";

// The four working languages: every site locale except Hebrew (nobody on the team works in it).
export const TEAM_LANGUAGES = LOCALES.filter((l) => l !== "he") as Exclude<(typeof LOCALES)[number], "he">[];
export type TeamPatch = { canSeeColleagues?: boolean; canEditColleagues?: boolean; languages?: string[]; specialties?: string[]; acceptsLeads?: boolean };

const KEYS = new Set(["canSeeColleagues", "canEditColleagues", "languages", "specialties", "acceptsLeads"]);

export function normalizeRights(
  current: { canSeeColleagues: boolean; canEditColleagues: boolean },
  patch: { canSeeColleagues?: boolean; canEditColleagues?: boolean },
): { canSeeColleagues: boolean; canEditColleagues: boolean } {
  let see = patch.canSeeColleagues ?? current.canSeeColleagues;
  let edit = patch.canEditColleagues ?? current.canEditColleagues;
  if (patch.canEditColleagues === true) see = true;
  if (patch.canSeeColleagues === false) edit = false;
  if (!see) edit = false;
  return { canSeeColleagues: see, canEditColleagues: edit };
}

export function validateTeamPatch(raw: unknown): { ok: true; patch: TeamPatch } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, error: "Invalid input." };
  const patch: TeamPatch = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!KEYS.has(k)) return { ok: false, error: `Unknown field: ${k}` };
    if (k === "languages") {
      if (!Array.isArray(v) || v.some((x) => typeof x !== "string")) return { ok: false, error: "Languages must be a list." };
      const langs = (v as string[]).filter((l, i, a) => a.indexOf(l) === i);
      if (langs.some((l) => !(TEAM_LANGUAGES as readonly string[]).includes(l))) return { ok: false, error: "Unknown language." };
      patch.languages = langs;
    } else if (k === "specialties") {
      if (!Array.isArray(v) || v.some((x) => typeof x !== "string")) return { ok: false, error: "Specialties must be a list." };
      const seen = new Set<string>();
      const out: string[] = [];
      for (const s of (v as string[]).map((x) => x.trim()).filter(Boolean)) {
        if (s.length > 40) return { ok: false, error: "A specialty can be at most 40 characters." };
        if (seen.has(s.toLowerCase())) continue;
        seen.add(s.toLowerCase());
        out.push(s);
      }
      if (out.length > 10) return { ok: false, error: "At most 10 specialties." };
      patch.specialties = out;
    } else {
      if (typeof v !== "boolean") return { ok: false, error: `${k} must be true or false.` };
      (patch as Record<string, boolean>)[k] = v;
    }
  }
  return { ok: true, patch };
}
