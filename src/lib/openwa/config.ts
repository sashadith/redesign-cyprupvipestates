import { McpConfigError } from "@/lib/mcp/publicOrigin";

export type OpenWaConfig = { baseUrl: string; apiKey: string; sessionId: string; dailySendCap: number };

// Fail loud and name the variable: a half-configured connector that silently
// does nothing is worse than one that says which line is missing.
function required(env: NodeJS.ProcessEnv, key: string): string {
  const v = env[key]?.trim();
  if (!v) throw new McpConfigError(`${key} is not set.`);
  return v;
}

export function readOpenWaConfig(env: NodeJS.ProcessEnv = process.env): OpenWaConfig {
  const raw = required(env, "OPENWA_BASE_URL");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new McpConfigError(`OPENWA_BASE_URL is not an absolute URL: ${raw}`);
  }
  const capRaw = required(env, "OPENWA_DAILY_SEND_CAP");
  const dailySendCap = Number(capRaw);
  if (!Number.isInteger(dailySendCap) || dailySendCap < 1) {
    throw new McpConfigError(`OPENWA_DAILY_SEND_CAP must be a positive integer, got: ${capRaw}`);
  }
  return {
    baseUrl: url.origin,
    apiKey: required(env, "OPENWA_API_KEY"),
    sessionId: required(env, "OPENWA_SESSION_ID"),
    dailySendCap,
  };
}
