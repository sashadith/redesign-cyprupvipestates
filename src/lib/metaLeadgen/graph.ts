// Minimal Graph API client for Meta Lead Ads (docs/META-LEADGEN.md). Every
// call is cache: "no-store" — Next 14's fetch cache silently served stale
// responses to a server-side poller once already (August).
import type { MetaFieldDatum } from "./mapFields";

const GRAPH_VERSION = process.env.META_GRAPH_API_VERSION || "v23.0";
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;
const TIMEOUT_MS = 15_000;

export const LEAD_FIELDS = "id,created_time,field_data,form_id,ad_id,ad_name,adset_name,campaign_name,is_organic";

export type MetaLead = {
  id: string;
  created_time: string;
  field_data: MetaFieldDatum[];
  form_id?: string;
  ad_id?: string;
  ad_name?: string;
  adset_name?: string;
  campaign_name?: string;
  is_organic?: boolean;
};

export type MetaForm = { id: string; name: string; locale?: string; status?: string };

export class MetaConfigError extends Error {}

/** Token expired/revoked (190) or missing permission (10, 200–299): nothing
 *  will import until a human fixes it, so callers alert on this separately. */
export class MetaTokenError extends Error {
  constructor(message: string, readonly code: number) {
    super(message);
  }
}

export class MetaGraphError extends Error {
  constructor(message: string, readonly code: number | null) {
    super(message);
  }
}

export function isTokenErrorCode(code: number | null | undefined): boolean {
  return code === 190 || code === 10 || (typeof code === "number" && code >= 200 && code <= 299);
}

export function metaConfig(): { token: string; pageId: string } {
  const token = process.env.META_PAGE_ACCESS_TOKEN;
  const pageId = process.env.META_PAGE_ID;
  if (!token || !pageId) throw new MetaConfigError("META_PAGE_ACCESS_TOKEN / META_PAGE_ID not set");
  return { token, pageId };
}

async function graphGet<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
  const body = (await res.json().catch(() => null)) as { error?: { code?: number; message?: string } } | null;
  if (!res.ok || body?.error) {
    const code = body?.error?.code ?? null;
    const msg = `Graph ${res.status}: ${body?.error?.message ?? "no error body"} (code ${code ?? "?"})`;
    if (isTokenErrorCode(code)) throw new MetaTokenError(msg, code!);
    throw new MetaGraphError(msg, code);
  }
  return body as T;
}

function withToken(path: string, params: Record<string, string>, token: string): string {
  const qs = new URLSearchParams({ ...params, access_token: token });
  return `${GRAPH}/${path}?${qs}`;
}

/** Follows paging.next until exhausted (the next URL already carries the token). */
async function graphList<T>(firstUrl: string): Promise<T[]> {
  const out: T[] = [];
  let url: string | undefined = firstUrl;
  for (let page = 0; url && page < 100; page++) {
    const body: { data?: T[]; paging?: { next?: string } } = await graphGet(url);
    out.push(...(body.data ?? []));
    url = body.paging?.next;
  }
  return out;
}

export async function fetchLead(leadgenId: string): Promise<MetaLead> {
  const { token } = metaConfig();
  return graphGet<MetaLead>(withToken(leadgenId, { fields: LEAD_FIELDS }, token));
}

const formCache = new Map<string, MetaForm>();

export async function fetchForm(formId: string): Promise<MetaForm> {
  const hit = formCache.get(formId);
  if (hit) return hit;
  const { token } = metaConfig();
  const form = await graphGet<MetaForm>(withToken(formId, { fields: "id,name,locale,status" }, token));
  formCache.set(formId, form);
  return form;
}

export async function listForms(): Promise<MetaForm[]> {
  const { token, pageId } = metaConfig();
  const forms = await graphList<MetaForm>(withToken(`${pageId}/leadgen_forms`, { fields: "id,name,locale,status", limit: "100" }, token));
  for (const f of forms) formCache.set(f.id, f);
  return forms;
}

export async function listLeadsSince(formId: string, since: Date): Promise<MetaLead[]> {
  const { token } = metaConfig();
  const filtering = JSON.stringify([{ field: "time_created", operator: "GREATER_THAN", value: Math.floor(since.getTime() / 1000) }]);
  return graphList<MetaLead>(withToken(`${formId}/leads`, { fields: LEAD_FIELDS, filtering, limit: "100" }, token));
}

const DEFAULT_HOURS = 48;
const MAX_HOURS = 90 * 24; // Meta keeps lead data for 90 days

/** The poller's look-back window. Default 48 h; a one-off catch-up run (the
 *  first run after setup) may pass up to 2160 h. Junk falls back to 48. */
export function parseSinceHours(v: string | null): number {
  const n = Number(v);
  if (!v || !Number.isFinite(n) || n <= 0) return DEFAULT_HOURS;
  return Math.min(Math.ceil(n), MAX_HOURS);
}
