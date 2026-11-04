// Who should take a new lead (2026-10-18). Pure. Order: accepts leads and is
// active → speaks the lead's language → shares a specialty → fewest active
// leads. The reason string is shown to the operator next to the suggestion.

export type Candidate = { id: string; name: string; acceptsLeads: boolean; isActive: boolean; languages: string[]; specialties: string[]; activeLeads: number };
export type Suggestion = { userId: string; name: string; reason: string; languageMatch: boolean } | null;

const norm = (s: string) => s.trim().toLowerCase();

export function suggestOwner(lead: { language: string | null; specialtyKeys: string[] }, candidates: Candidate[]): Suggestion {
  const pool = candidates.filter((c) => c.isActive && c.acceptsLeads);
  if (!pool.length) return null;
  const lang = lead.language ? norm(lead.language) : null;
  const keys = new Set(lead.specialtyKeys.map(norm));
  const speakers = lang ? pool.filter((c) => c.languages.some((l) => norm(l) === lang)) : [];
  const languageMatch = speakers.length > 0;
  const shortlist = languageMatch ? speakers : pool;
  const specialtyOf = (c: Candidate) => c.specialties.find((s) => keys.has(norm(s))) ?? null;
  const ranked = [...shortlist].sort((a, b) => {
    const sa = specialtyOf(a) ? 0 : 1, sb = specialtyOf(b) ? 0 : 1;
    return sa - sb || a.activeLeads - b.activeLeads || a.name.localeCompare(b.name);
  });
  const best = ranked[0];
  const parts: string[] = [];
  if (lang) parts.push(languageMatch ? `speaks ${lang.toUpperCase()}` : `no ${lang.toUpperCase()} speaker`);
  const spec = specialtyOf(best);
  if (spec) parts.push(spec);
  parts.push(`${best.activeLeads} active`);
  return { userId: best.id, name: best.name, reason: parts.join(" · "), languageMatch };
}
