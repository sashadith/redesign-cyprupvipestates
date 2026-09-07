import type { AuthInfo } from "@modelcontextprotocol/server";

export type McpCallContext = { userId: string; userName: string; tokenId: string };

// withMcpAuth (src/app/api/mcp/route.ts) puts the verified token's user into
// AuthInfo.extra; tools read it back through ctx.http?.authInfo.
export function contextFromAuthInfo(authInfo: AuthInfo | undefined): McpCallContext | null {
  const x = authInfo?.extra as Partial<McpCallContext> | undefined;
  if (!x?.userId || !x.tokenId) return null;
  return { userId: x.userId, userName: x.userName ?? "admin", tokenId: x.tokenId };
}
