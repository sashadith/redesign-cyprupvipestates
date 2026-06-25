// Shared anti-spam primitives for the public lead-capture endpoints.
// One source of truth for allowed hosts + the common guard sequence, so the
// /api/leads, /api/email, /api/roi-calculator and /api/monday-newsletter routes
// stay consistent (previously each redefined these helpers — audit item L2).
import { NextResponse } from "next/server";

export const ALLOWED_HOSTS = new Set([
  "cyprusvipestates.com",
  "www.cyprusvipestates.com",
  "72.60.89.239", // staging VPS — remove after cutover
  "localhost",
]);

export function safeUrl(raw: string): URL | null {
  try { return new URL(raw); } catch { return null; }
}

export function allowedHost(raw: string): boolean {
  const u = safeUrl(raw);
  return !!u && ALLOWED_HOSTS.has(u.hostname);
}

export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  return xff ? xff.split(",")[0].trim() : req.headers.get("x-real-ip")?.trim() || "unknown";
}

export function escapeHtml(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Per-key sliding-window rate limiter. Each caller gets its own backing map.
// NOTE: in-memory and per-instance — resets on redeploy and is not shared across
// PM2 workers (audit item L5). Adequate for the current single-instance deploy.
export type RateLimiter = (key: string, limit?: number, windowMs?: number) => boolean;
export function makeRateLimiter(): RateLimiter {
  const map = new Map<string, number[]>();
  return (key, limit = 5, windowMs = 60_000) => {
    const now = Date.now();
    const ts = (map.get(key) || []).filter((t) => now - t < windowMs);
    ts.push(now);
    map.set(key, ts);
    return ts.length > limit;
  };
}

// Silent block — always HTTP 200 so bots learn nothing. The reason is exposed only
// outside production (handy for debugging staging without training scrapers).
export function blocked(reason: string, extra?: Record<string, any>) {
  const debug = process.env.NODE_ENV !== "production";
  return NextResponse.json(debug ? { ok: false, blocked: reason, ...extra } : { ok: false }, { status: 200 });
}

// Entry-level checks shared by every public lead endpoint: user-agent, JSON content-type,
// referer/origin allow-list, and per-IP rate limit. Returns a NextResponse to short-circuit,
// or null to continue. `ipLimiter` is the caller's own makeRateLimiter() instance.
export function guardRequest(request: Request, ipLimiter: RateLimiter): NextResponse | null {
  const ua = request.headers.get("user-agent") || "";
  const ipKey = clientIp(request) === "unknown" ? `unknown:${ua || "ua"}` : clientIp(request);
  if (!ua) return blocked("ua");
  if (!(request.headers.get("content-type") || "").includes("application/json")) return blocked("content_type");
  const referer = request.headers.get("referer") || "";
  const origin = request.headers.get("origin") || "";
  if (!referer || !allowedHost(referer)) return blocked("bad_referer");
  if (origin && !allowedHost(origin)) return blocked("bad_origin");
  if (ipLimiter(ipKey)) return blocked("rate_limit");
  return null;
}

// Honeypot (`fax`/`company`) + submission-timing window (1.5s–2h). Returns a block
// reason, or null when the signals look human.
export function spamSignal(body: any): string | null {
  if (String(body?.fax ?? body?.company ?? "").trim().length > 0) return "honeypot";
  const started = Number(body?.formStartTime);
  const elapsed = Date.now() - started;
  if (!Number.isFinite(started) || started <= 0 || elapsed < 1500 || elapsed > 2 * 60 * 60 * 1000) return "timing";
  return null;
}
