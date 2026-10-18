// Parse an operator-typed commission rate (2026-10-18). Pure.
// Accepts "10", "5.5", "5,5", "7.25 %"; the column is DECIMAL(5,2), so at most
// two decimals and a value in (0, 100].
export function parseRate(input: string): { ok: true; value: number } | { ok: false; error: string } {
  const s = input.trim().replace(/%$/, "").trim().replace(",", ".");
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(s)) return { ok: false, error: "Enter a percentage like 10 or 5.5 (max. 2 decimals)." };
  const value = Number(s);
  if (!(value > 0 && value <= 100)) return { ok: false, error: "The rate must be above 0 and at most 100 %." };
  return { ok: true, value };
}

// The Rates screen filter: a developer matches by its own name, an override's
// project name, or the name of any of its projects (so a project without an
// override can be found to add one). Case-insensitive; blank shows all.
type FilterableAccount = { name: string; overrides: { projectName: string }[]; projects: { name: string }[] };
export function filterRateAccounts<A extends FilterableAccount>(accounts: A[], query: string): A[] {
  const q = query.trim().toLowerCase();
  if (!q) return accounts;
  const hit = (s: string) => s.toLowerCase().includes(q);
  return accounts.filter((a) => hit(a.name) || a.overrides.some((o) => hit(o.projectName)) || a.projects.some((p) => hit(p.name)));
}
