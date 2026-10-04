// The "pairing window": the operator opens a 10-minute window from Connected
// apps before starting a connection in claude.ai; the consent page's Allow
// only works while that window is open in the SAME browser. This is the
// binding the Phase 1 review asked for — a phished /admin/mcp/authorize link
// fails unless the operator deliberately opened a window moments before.
// Stateless (signed cookie) so it works across both PM2 instances.
import { createHmac } from "node:crypto";
import { safeEqual } from "./crypto";
import { McpConfigError } from "../publicOrigin";

export const PAIRING_COOKIE = "mcp_pairing";
export const PAIRING_COOKIE_PATH = "/admin/mcp";
export const PAIRING_TTL_MS = 10 * 60_000;

function mac(userId: string, expiresAt: number, secret: string): string {
  return createHmac("sha256", secret).update(`${userId}.${expiresAt}`).digest("base64url");
}

export function createPairingToken(userId: string, secret: string, now = Date.now()): string {
  const expiresAt = now + PAIRING_TTL_MS;
  return `${expiresAt}.${mac(userId, expiresAt, secret)}`;
}

export function verifyPairingToken(token: string | undefined, userId: string, secret: string, now = Date.now()): boolean {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const expiresAt = Number(token.slice(0, dot));
  const given = token.slice(dot + 1);
  if (!Number.isFinite(expiresAt) || expiresAt <= now) return false;
  return safeEqual(given, mac(userId, expiresAt, secret));
}

export function pairingSecret(): string {
  const s = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!s) throw new McpConfigError("AUTH_SECRET is not set — the pairing window cannot be signed.");
  return s;
}
