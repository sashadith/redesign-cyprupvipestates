// What a deal is made of when someone enters it (2026-11-08). The developer and
// the project each come from our lists (an id) or are typed in (a name); a rate
// typed in overrides the one on file. Pure, so the tests pin it without a DB.

export type DealInput = {
  /** A project from our list. */
  developmentId?: string | null;
  /** A project typed in, when it is not in our list. */
  projectName?: string | null;
  /** A developer from our list (derived from the project when one is chosen). */
  developerAccountId?: string | null;
  /** A developer typed in, when it is not in our list. */
  developerName?: string | null;
  unitLabel: string | null;
  /** Whole euros. */
  price: number;
  /** Our commission rate in percent, typed in; overrides the rate on file. */
  ratePercent?: number | null;
};

export const DEAL_NAME_MAX = 120;
export const DEAL_UNIT_MAX = 40;
export const DEAL_PRICE_MAX = 100_000_000;
export const DEAL_RATE_MAX = 20;

const NEED = "Enter the deal: developer, project and price.";

const text = (v: unknown, max: number): string | null | undefined => {
  if (v == null) return null;
  if (typeof v !== "string") return undefined;
  const t = v.replace(/\s+/g, " ").trim();
  if (t.length > max) return undefined;
  return t || null;
};
const id = (v: unknown): string | null | undefined => {
  if (v == null || v === "") return null;
  return typeof v === "string" && v.length <= 64 ? v : undefined;
};

/** Checks untrusted input from the client. An id wins over a typed name for the same field. */
export function normalizeDealInput(raw: unknown): { ok: DealInput } | { error: string } {
  if (!raw || typeof raw !== "object") return { error: NEED };
  const r = raw as Record<string, unknown>;
  const developmentId = id(r.developmentId);
  const developerAccountId = id(r.developerAccountId);
  const projectName = text(r.projectName, DEAL_NAME_MAX);
  const developerName = text(r.developerName, DEAL_NAME_MAX);
  const unitLabel = text(r.unitLabel, DEAL_UNIT_MAX);
  if ([developmentId, developerAccountId, projectName, developerName, unitLabel].includes(undefined)) return { error: NEED };
  if (!developmentId && !projectName) return { error: "Choose a project or type its name." };
  if (!developmentId && !developerAccountId && !developerName) return { error: "Choose a developer or type its name." };
  const price = r.price;
  if (typeof price !== "number" || !Number.isInteger(price) || price <= 0 || price > DEAL_PRICE_MAX) return { error: "Enter a valid price in whole euros." };
  let ratePercent: number | null = null;
  if (r.ratePercent != null && r.ratePercent !== "") {
    const n = r.ratePercent;
    if (typeof n !== "number" || !Number.isFinite(n) || n <= 0 || n > DEAL_RATE_MAX || Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) {
      return { error: `Rate: a percentage above 0 and up to ${DEAL_RATE_MAX}, at most two decimals.` };
    }
    ratePercent = n;
  }
  return {
    ok: {
      developmentId: developmentId ?? null,
      projectName: developmentId ? null : projectName ?? null,
      developerAccountId: developerAccountId ?? null,
      developerName: developerAccountId ? null : developerName ?? null,
      unitLabel: unitLabel ?? null,
      price,
      ratePercent,
    },
  };
}

/** "12,5" / "12.5 %" -> 12.5; empty -> null; anything else -> NaN (the form shows an error). */
export function parseRateText(s: string): number | null {
  const t = s.replace(/%/g, "").replace(",", ".").trim();
  if (!t) return null;
  return /^\d{1,2}(\.\d{1,2})?$/.test(t) ? Number(t) : NaN;
}

export type ResolvedRate = { ratePercent: number | null; source: "PROJECT" | "DEVELOPER" | "MANUAL" | "MISSING" };

/** A typed rate wins; otherwise the rate on file (resolveRate's result) when the developer is ours. */
export function chooseDealRate(typed: number | null | undefined, onFile: ResolvedRate | null): ResolvedRate {
  if (typed != null) return { ratePercent: typed, source: "MANUAL" };
  return onFile ?? { ratePercent: null, source: "MISSING" };
}

/** The project label a deal shows everywhere: our project's name, else the typed one. */
export function dealProjectLabel(d: { development?: { publicName: string; override?: { alias: string | null } | null } | null; projectName?: string | null }): string | null {
  if (d.development) return d.development.override?.alias?.trim() || d.development.publicName;
  return d.projectName?.trim() || null;
}

/** The developer label: our account's name (direct or through the project), else the typed one. */
export function dealDeveloperLabel(d: { developerAccount?: { name: string } | null; development?: { developerAccount?: { name: string } | null } | null; developerName?: string | null }): string | null {
  return d.developerAccount?.name ?? d.development?.developerAccount?.name ?? (d.developerName?.trim() || null);
}
