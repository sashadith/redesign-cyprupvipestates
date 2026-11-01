import { createHash } from "node:crypto";
import { isbot } from "isbot";
import { isTrackingHost } from "@/lib/trackingHost";
import { marketingConsentFrom } from "@/lib/attribution";

/* Meta Conversions API — the server-side copy of the browser's Lead and
 * Contact events (2026-11-01).
 *
 * Why at all: the pixel only fires for visitors who accepted the banner, and
 * even then an ad blocker or Safari's tracking prevention drops a share of
 * them. The server copy closes that second gap. It does NOT widen the first:
 * no marketing consent, no server event — the same rule as the browser.
 *
 * Deduplication is what makes this safe. Meta merges a browser event and a
 * server event when both carry the same event_name and event_id, so the id is
 * generated ONCE in the browser (newMetaEventId), passed to fbq as `eventID`
 * and posted to our API alongside the form. A request without a well-formed id
 * sends nothing: an undeduplicable server event would count every lead twice.
 *
 * Never throws and never delays a form by more than TIMEOUT_MS — a lead that
 * is already in the CRM must not fail because Graph API is slow. Failures log
 * a greppable META_CAPI_FAILED line and are otherwise silent. */

const PIXEL_ID = "1238429281352397";
// Pinned, not "latest": an unannounced version bump is how integrations break.
const GRAPH_VERSION = "v23.0";
const TIMEOUT_MS = 3000;

export type CapiEventName = "Lead" | "Contact";

/** The id prefix each event must carry — matches newMetaEventId(). */
const PREFIX: Record<CapiEventName, string> = { Lead: "lead", Contact: "contact" };

/** Only ids our own generator produces: prefix, base36 time, base36 randomness. */
export function validEventId(name: CapiEventName, id: unknown): id is string {
  return typeof id === "string" && id.length <= 40 && new RegExp(`^${PREFIX[name]}-[0-9a-z]+-[0-9a-z]+$`).test(id);
}

export const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

/** Meta's normalisation: trimmed, lowercase. */
export function normalizeEmail(v: unknown): string | null {
  const s = String(v ?? "").trim().toLowerCase();
  return s.includes("@") ? s : null;
}

/** Meta's normalisation: digits only, country code included, no "+" or leading zeros.
 *  Callers pass the E.164 number the lead route already validated. */
export function normalizePhone(v: unknown): string | null {
  const s = String(v ?? "").trim();
  if (!s.startsWith("+")) return null; // without a country code the hash matches nobody
  const digits = s.replace(/\D/g, "").replace(/^0+/, "");
  return digits.length >= 7 ? digits : null;
}

/** One cookie out of a raw Cookie header (still percent-encoded). */
export function cookieFrom(header: string | null | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim() || null;
  }
  return null;
}

export function clientIpFrom(headers: Headers): string | null {
  const xff = headers.get("x-forwarded-for");
  const ip = xff ? xff.split(",")[0].trim() : headers.get("x-real-ip")?.trim();
  return ip || null;
}

export interface CapiConfig { token: string; testEventCode: string | null }

/** Configured only with a token AND the same switch that loads the browser pixel. */
export function capiConfig(env: Record<string, string | undefined> = process.env): CapiConfig | null {
  const token = env.META_CAPI_TOKEN?.trim();
  if (!token || env.NEXT_PUBLIC_META_PIXEL_ENABLED !== "1") return null;
  return { token, testEventCode: env.META_CAPI_TEST_EVENT_CODE?.trim() || null };
}

export interface CapiRequestContext {
  consent: boolean;
  bot: boolean;
  fbp: string | null;
  fbc: string | null;
  ip: string | null;
  userAgent: string | null;
}

export function capiContextFrom(req: Request): CapiRequestContext {
  const cookie = req.headers.get("cookie");
  const ua = req.headers.get("user-agent");
  return {
    consent: marketingConsentFrom(cookieFrom(cookie, "cookieConsent")),
    bot: !ua || isbot(ua),
    fbp: cookieFrom(cookie, "_fbp"),
    fbc: cookieFrom(cookie, "_fbc"),
    ip: clientIpFrom(req.headers),
    userAgent: ua,
  };
}

export interface CapiEventInput {
  eventName: CapiEventName;
  eventId: string;
  eventSourceUrl: string;
  ctx: CapiRequestContext;
  email?: string | null;
  phone?: string | null;
  customData?: Record<string, string | number>;
  eventTime?: number;
}

/**
 * Why a send would be refused, or null when it may go. A pure gate, so every
 * refusal reason is testable without a network.
 *
 * Off-production pages are refused unless a test event code is set: a test
 * code routes events to Events Manager's Test Events tab and keeps them out of
 * the dataset, which is exactly what a testbed run needs and nothing else does.
 */
export function capiRefusal(input: CapiEventInput, cfg: CapiConfig | null): string | null {
  if (!cfg) return "not_configured";
  if (!input.ctx.consent) return "no_consent";
  if (input.ctx.bot) return "bot";
  if (!validEventId(input.eventName, input.eventId)) return "no_event_id";
  let host: string | null = null;
  try { host = new URL(input.eventSourceUrl).hostname; } catch { return "bad_url"; }
  if (!isTrackingHost(host) && !cfg.testEventCode) return "not_production";
  return null;
}

/** The request body Graph API receives. Hashes here, so nothing raw leaves. */
export function buildCapiPayload(input: CapiEventInput, cfg: CapiConfig) {
  const userData: Record<string, unknown> = {};
  const em = normalizeEmail(input.email);
  const ph = normalizePhone(input.phone);
  if (em) userData.em = [sha256(em)];
  if (ph) userData.ph = [sha256(ph)];
  if (input.ctx.fbp) userData.fbp = input.ctx.fbp;
  if (input.ctx.fbc) userData.fbc = input.ctx.fbc;
  if (input.ctx.ip) userData.client_ip_address = input.ctx.ip;
  if (input.ctx.userAgent) userData.client_user_agent = input.ctx.userAgent;
  return {
    data: [{
      event_name: input.eventName,
      event_time: input.eventTime ?? Math.floor(Date.now() / 1000),
      event_id: input.eventId,
      event_source_url: input.eventSourceUrl,
      action_source: "website",
      user_data: userData,
      ...(input.customData ? { custom_data: input.customData } : {}),
    }],
    ...(cfg.testEventCode ? { test_event_code: cfg.testEventCode } : {}),
  };
}

// Overridable so a testbed run can capture the request instead of sending it.
const endpoint = () =>
  (process.env.META_CAPI_ENDPOINT?.trim() || `https://graph.facebook.com/${GRAPH_VERSION}/${PIXEL_ID}/events`);

/** Send one event. Resolves true when Meta accepted it; never rejects. */
export async function sendCapiEvent(input: CapiEventInput, cfg: CapiConfig | null = capiConfig()): Promise<boolean> {
  const refusal = capiRefusal(input, cfg);
  if (refusal || !cfg) {
    if (refusal !== "not_configured" && refusal !== "no_consent") console.log(`META_CAPI_SKIPPED ${input.eventName} reason=${refusal}`);
    return false;
  }
  try {
    const res = await fetch(endpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.token}` },
      body: JSON.stringify(buildCapiPayload(input, cfg)),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      const text = (await res.text().catch(() => "")).slice(0, 300);
      console.error(`META_CAPI_FAILED ${input.eventName} id=${input.eventId} status=${res.status} ${text}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error(`META_CAPI_FAILED ${input.eventName} id=${input.eventId} ${(e as Error)?.name ?? "error"}`);
    return false;
  }
}

/** Lead after a successful save — the shape every lead route shares. */
export function sendLeadToMeta(req: Request, body: { metaEventId?: unknown }, lead: { email: string; phone: string; page: string; contentName?: string }) {
  return sendCapiEvent({
    eventName: "Lead",
    eventId: String(body.metaEventId ?? ""),
    eventSourceUrl: lead.page,
    ctx: capiContextFrom(req),
    email: lead.email,
    phone: lead.phone,
    ...(lead.contentName ? { customData: { content_name: lead.contentName } } : {}),
  });
}
