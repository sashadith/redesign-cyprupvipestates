import { prisma } from "@/lib/prisma";
import { randomToken, sha256Hex, verifyPkce } from "./crypto";

export const ACCESS_TTL_MS = 8 * 3_600_000;
export const REFRESH_TTL_MS = 90 * 86_400_000;

export type TokenPair = { accessToken: string; refreshToken: string; expiresIn: number };
export type GrantError = { error: "invalid_grant" | "invalid_client" | "invalid_request"; description: string };

const invalidGrant = (description: string): GrantError => ({ error: "invalid_grant", description });

async function issuePair(input: { familyId: string; clientId: string; userId: string; issuedHost: string; refreshExpiresAt: Date }): Promise<TokenPair> {
  const accessToken = randomToken(32);
  const refreshToken = randomToken(32);
  await prisma.mcpToken.create({
    data: {
      familyId: input.familyId,
      accessTokenHash: sha256Hex(accessToken),
      refreshTokenHash: sha256Hex(refreshToken),
      clientId: input.clientId,
      userId: input.userId,
      issuedHost: input.issuedHost,
      expiresAt: new Date(Date.now() + ACCESS_TTL_MS),
      refreshExpiresAt: input.refreshExpiresAt,
    },
  });
  return { accessToken, refreshToken, expiresIn: Math.floor(ACCESS_TTL_MS / 1000) };
}

export async function revokeFamily(familyId: string): Promise<void> {
  await prisma.mcpToken.updateMany({ where: { familyId, revokedAt: null }, data: { revokedAt: new Date() } });
}

// RFC 6749 §4.1.3 + RFC 7636 §4.6. The code is consumed atomically: two
// concurrent exchanges of the same code cannot both succeed, and a replay of
// an already-used code revokes whatever was issued from it (§4.1.2).
export async function exchangeAuthorizationCode(
  input: { code: string; codeVerifier: string; clientId: string; redirectUri: string },
  issuedHost: string,
): Promise<TokenPair | GrantError> {
  const codeHash = sha256Hex(input.code);
  const row = await prisma.mcpAuthCode.findUnique({ where: { codeHash } });
  if (!row) return invalidGrant("Unknown authorization code.");
  if (row.usedAt) {
    // Replay: burn every token family that came out of this code.
    await prisma.mcpToken.updateMany({ where: { familyId: row.id, revokedAt: null }, data: { revokedAt: new Date() } });
    return invalidGrant("Authorization code already used.");
  }
  if (row.clientId !== input.clientId) return invalidGrant("client_id does not match the authorization code.");
  if (row.redirectUri !== input.redirectUri) return invalidGrant("redirect_uri does not match the authorization code.");
  if (row.expiresAt.getTime() < Date.now()) return invalidGrant("Authorization code expired.");
  if (!verifyPkce(input.codeVerifier, row.codeChallenge)) return invalidGrant("PKCE verification failed.");
  const claimed = await prisma.mcpAuthCode.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
  if (claimed.count !== 1) return invalidGrant("Authorization code already used.");
  // familyId = the auth code's id: one family per consent, rotated on refresh.
  return issuePair({ familyId: row.id, clientId: row.clientId, userId: row.userId, issuedHost, refreshExpiresAt: new Date(Date.now() + REFRESH_TTL_MS) });
}

// Rotation: the presented refresh token is revoked and a new pair issued in
// the same family. Presenting an already-rotated (revoked) refresh token is
// treated as theft — the whole family is revoked.
export async function refreshTokens(input: { refreshToken: string; clientId: string }, issuedHost: string): Promise<TokenPair | GrantError> {
  const row = await prisma.mcpToken.findUnique({ where: { refreshTokenHash: sha256Hex(input.refreshToken) } });
  if (!row) return invalidGrant("Unknown refresh token.");
  if (row.clientId !== input.clientId) return invalidGrant("client_id does not match the refresh token.");
  if (row.revokedAt) {
    await revokeFamily(row.familyId);
    return invalidGrant("Refresh token has been revoked.");
  }
  if (row.refreshExpiresAt.getTime() < Date.now()) return invalidGrant("Refresh token expired.");
  const user = await prisma.user.findUnique({ where: { id: row.userId }, select: { isActive: true } });
  if (!user?.isActive) return invalidGrant("User is no longer active.");
  const claimed = await prisma.mcpToken.updateMany({ where: { id: row.id, revokedAt: null }, data: { revokedAt: new Date() } });
  if (claimed.count !== 1) return invalidGrant("Refresh token already rotated.");
  return issuePair({ familyId: row.familyId, clientId: row.clientId, userId: row.userId, issuedHost, refreshExpiresAt: row.refreshExpiresAt });
}

// Called on every /api/mcp request. lastUsedAt is written at most once a
// minute per token so a burst of tool calls is not a burst of UPDATEs.
export async function verifyAccessToken(token: string) {
  if (!token) return null;
  const row = await prisma.mcpToken.findUnique({
    where: { accessTokenHash: sha256Hex(token) },
    select: { id: true, userId: true, clientId: true, expiresAt: true, revokedAt: true, lastUsedAt: true, user: { select: { isActive: true, name: true } } },
  });
  if (!row || row.revokedAt || row.expiresAt.getTime() < Date.now() || !row.user.isActive) return null;
  if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > 60_000) {
    await prisma.mcpToken.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  }
  return { tokenId: row.id, userId: row.userId, userName: row.user.name, clientId: row.clientId, expiresAt: row.expiresAt };
}
