// Auth + throttling for the public read-only blog API (/api/public/v1/*).
//
// Keys live in one env var so adding/revoking a consumer needs no code change:
//
//   BLOG_API_KEYS="portal-two:9f3c…64hex,partner-x:…"
//
// Each entry is "<label>:<secret>". The label is only used in logs/responses so
// a leaked key can be traced to its consumer; the secret is what the client
// sends in the `X-API-Key` header. Secrets shorter than 24 chars are ignored
// outright — a weak key on a public endpoint is worse than no endpoint.
import "server-only";
import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { makeRateLimiter } from "@/lib/antispam";

const MIN_KEY_LENGTH = 24;

export type ApiClient = { label: string };

type ParsedKey = { label: string; secret: string };

function parseConfiguredKeys(): ParsedKey[] {
  const raw = process.env.BLOG_API_KEYS ?? "";
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const sep = entry.indexOf(":");
      if (sep === -1) return { label: "unlabelled", secret: entry };
      return { label: entry.slice(0, sep).trim() || "unlabelled", secret: entry.slice(sep + 1).trim() };
    })
    .filter((k) => k.secret.length >= MIN_KEY_LENGTH);
}

/** Constant-time compare that never leaks length through an early return. */
function secretsMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) {
    // Still burn a comparison so timing doesn't reveal "wrong length".
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

// ─── Rate limiting ───────────────────────────────────────────────────────────
// Reuses the site's shared sliding-window limiter: in-memory, per instance,
// resets on redeploy. It exists to stop a runaway sync loop, not as a security
// control — the API key is what actually guards the endpoint.
const MAX_REQUESTS_PER_MINUTE = 120;
const limiter = makeRateLimiter();

export type AuthResult = { ok: true; client: ApiClient } | { ok: false; response: NextResponse };

/**
 * Authenticate a request against BLOG_API_KEYS and apply the per-key rate limit.
 * Returns either the identified client or the exact response to send back.
 */
export function authenticate(req: Request): AuthResult {
  const configured = parseConfiguredKeys();
  if (configured.length === 0) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "api_not_configured", message: "BLOG_API_KEYS is not set on this deployment." },
        { status: 503 },
      ),
    };
  }

  const presented =
    req.headers.get("x-api-key")?.trim() ||
    // Accept `Authorization: Bearer <key>` as well — some HTTP clients make
    // custom headers awkward, and both carry the same secret.
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    "";

  if (!presented) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "missing_api_key", message: "Send the key in an X-API-Key header." },
        { status: 401 },
      ),
    };
  }

  const match = configured.find((k) => secretsMatch(k.secret, presented));
  if (!match) {
    return {
      ok: false,
      response: NextResponse.json({ error: "invalid_api_key" }, { status: 401 }),
    };
  }

  if (limiter(match.label, MAX_REQUESTS_PER_MINUTE, 60_000)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "rate_limited", message: `Max ${MAX_REQUESTS_PER_MINUTE} requests/minute per key.` },
        { status: 429, headers: { "Retry-After": "60" } },
      ),
    };
  }

  return { ok: true, client: { label: match.label } };
}
