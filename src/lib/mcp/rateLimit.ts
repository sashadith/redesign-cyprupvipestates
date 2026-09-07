import { makeRateLimiter } from "@/lib/antispam";

const limiter = makeRateLimiter();
export const TOOL_CALLS_PER_MINUTE = 120;

// true = over the limit (same convention as makeRateLimiter).
export function toolCallLimited(tokenId: string): boolean {
  return limiter(`mcp:${tokenId}`, TOOL_CALLS_PER_MINUTE, 60_000);
}
