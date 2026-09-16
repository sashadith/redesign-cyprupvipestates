import { ToolError } from "@/lib/mcp/toolWrapper";
import { readOpenWaConfig } from "./config";
import type { RawMessage } from "./shapeMessages";

export type OpenWaClient = {
  fetchThread(chatId: string, limit: number): Promise<RawMessage[]>;
  sendText(chatId: string, text: string): Promise<void>;
};

// The only module that knows the OpenWA API key. Runs against 127.0.0.1 on the
// same VPS, so no TLS and no public hop; the /mcp nginx gate is irrelevant here.
export function createOpenWaClient(deps: { fetch?: typeof fetch; env?: NodeJS.ProcessEnv } = {}): OpenWaClient {
  const cfg = readOpenWaConfig(deps.env ?? process.env);
  const doFetch = deps.fetch ?? fetch;
  const base = `${cfg.baseUrl}/api/sessions/${encodeURIComponent(cfg.sessionId)}`;
  const headers = { "X-API-Key": cfg.apiKey, "Content-Type": "application/json" };

  // The response body can echo request data; only the status is surfaced.
  async function call(url: string, init?: RequestInit): Promise<unknown> {
    let res: Response;
    try {
      res = await doFetch(url, { ...init, headers });
    } catch {
      throw new ToolError("internal", "WhatsApp gateway unreachable.");
    }
    if (!res.ok) throw new ToolError("internal", `WhatsApp gateway returned HTTP ${res.status}.`);
    return res.json().catch(() => null);
  }

  return {
    async fetchThread(chatId, limit) {
      const body = await call(`${base}/messages/${chatId}/history?limit=${limit}&deep=true`);
      return Array.isArray(body) ? (body as RawMessage[]) : [];
    },
    async sendText(chatId, text) {
      await call(`${base}/messages/send-text`, { method: "POST", body: JSON.stringify({ chatId, text }) });
    },
  };
}
