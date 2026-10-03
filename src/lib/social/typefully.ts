// Typefully API client — READ-ONLY by construction.
//
// The platform only ever WATCHES Typefully: a weekly Claude routine writes
// "planned" drafts there, and a planned draft never publishes until Sascha
// confirms it in Typefully itself. This module therefore has exactly one
// operation, a GET of the draft list. There is no create/edit/schedule/delete
// helper here, and none may be added — the platform must never change anything
// in Typefully (2026-10-03 brief). src/lib/__tests__/socialMonitor.test.ts
// asserts every request this client makes is a GET.
//
// API: https://typefully.com/docs/api — v2, Bearer auth,
//   GET /v2/social-sets/{id}/drafts?status=&limit=&offset=
//   → { results, count, limit, offset, next, previous }
// `status` takes a single value, so one call per status.

export const TYPEFULLY_SOCIAL_SET_ID = 339303;
const API_BASE = "https://api.typefully.com";
const PAGE_SIZE = 50; // the API's maximum
const MAX_PAGES = 10; // 500 drafts per status — far above anything a weekly routine produces
const TIMEOUT_MS = 10_000;
export const CACHE_TTL_MS = 5 * 60_000;

export type DraftStatus = "draft" | "scheduled" | "planned" | "published" | "error" | "publishing";

export type TypefullyDraft = {
  id: number;
  status: string;
  scheduled_date: string | null;
  draft_title?: string | null;
  preview?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  // x_post_enabled, linkedin_post_enabled, … — read generically, see platformsOf().
  [key: string]: unknown;
};

/* A failure is its own result, never an empty list: "the API answered 401" and
   "there is nothing to confirm" must not look alike anywhere downstream. */
export type DraftListResult =
  | { ok: true; drafts: TypefullyDraft[]; truncated: boolean }
  | { ok: false; status: number | null; message: string };

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export type TypefullyClientOptions = {
  apiKey?: () => string | undefined;
  fetchImpl?: FetchLike;
  now?: () => number;
  socialSetId?: number;
};

export function createTypefullyClient(opts: TypefullyClientOptions = {}) {
  const apiKey = opts.apiKey ?? (() => process.env.TYPEFULLY_API_KEY);
  const fetchImpl: FetchLike = opts.fetchImpl ?? ((url, init) => fetch(url, init));
  const now = opts.now ?? Date.now;
  const socialSetId = opts.socialSetId ?? TYPEFULLY_SOCIAL_SET_ID;
  // Per process (each pm2 worker keeps its own) and successes only: a failure
  // is re-tried on the next load, so a fixed outage clears within one request.
  const cache = new Map<DraftStatus, { at: number; value: DraftListResult }>();

  async function fetchStatus(status: DraftStatus, key: string): Promise<DraftListResult> {
    const drafts: TypefullyDraft[] = [];
    for (let page = 0; page < MAX_PAGES; page++) {
      const url = `${API_BASE}/v2/social-sets/${socialSetId}/drafts?status=${status}&limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`;
      let res: Response;
      try {
        res = await fetchImpl(url, {
          method: "GET",
          headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
          // Never let Next.js' fetch cache hold an API answer: it once replayed
          // a stale 401 for weeks. The 5-minute memo above is the only cache.
          cache: "no-store",
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch (e) {
        return { ok: false, status: null, message: `request failed: ${e instanceof Error ? e.message : String(e)}` };
      }
      if (res.status !== 200) {
        const body = await res.text().catch(() => "");
        let message = body.slice(0, 200);
        try { message = (JSON.parse(body) as { error?: { message?: string } }).error?.message || message; } catch { /* not JSON */ }
        return { ok: false, status: res.status, message: message || `HTTP ${res.status}` };
      }
      let json: { results?: unknown; next?: unknown };
      try { json = await res.json(); } catch { return { ok: false, status: 200, message: "response was not JSON" }; }
      if (!Array.isArray(json.results)) return { ok: false, status: 200, message: "response had no results array" };
      drafts.push(...(json.results as TypefullyDraft[]));
      if (json.results.length < PAGE_SIZE || !json.next) return { ok: true, drafts, truncated: false };
    }
    return { ok: true, drafts, truncated: true };
  }

  return {
    async listDrafts(status: DraftStatus): Promise<DraftListResult> {
      const key = apiKey()?.trim();
      if (!key) return { ok: false, status: null, message: "TYPEFULLY_API_KEY is not set" };
      const hit = cache.get(status);
      if (hit && now() - hit.at < CACHE_TTL_MS) return hit.value;
      const value = await fetchStatus(status, key);
      if (value.ok) cache.set(status, { at: now(), value });
      return value;
    },
  };
}

export const typefully = createTypefullyClient();
