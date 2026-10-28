import { ToolError } from "@/lib/mcp/toolWrapper";
import { readOpenWaConfig } from "./config";
import type { RawMessage } from "./shapeMessages";

export type WaGroup = { id: string; name: string; participants: number | null };

// Only well-formed rows; the gateway's other fields are dropped.
export function shapeGroups(body: unknown): WaGroup[] {
  const rows = Array.isArray(body) ? body : Array.isArray((body as { data?: unknown } | null)?.data) ? (body as { data: unknown[] }).data : [];
  return rows.flatMap((r) => {
    const g = r as { id?: unknown; name?: unknown; participantsCount?: unknown };
    if (typeof g.id !== "string" || !g.id.endsWith("@g.us")) return [];
    const name = typeof g.name === "string" && g.name.trim() ? g.name.trim() : g.id;
    return [{ id: g.id, name, participants: typeof g.participantsCount === "number" ? g.participantsCount : null }];
  });
}

export type OpenWaClient = {
  fetchThread(chatId: string, limit: number): Promise<RawMessage[]>;
  sendText(chatId: string, text: string): Promise<void>;
  /** Groups the session is a member of (id "…@g.us", name, member count). */
  listGroups(): Promise<WaGroup[]>;
  /** The configured session's status as the gateway reports it. */
  getSession(): Promise<{ status: string; lastError: string | null }>;
  /** POST /start — relaunches the browser with the saved credentials (no QR). */
  startSession(): Promise<void>;
};

// The only module that knows the OpenWA API key. Runs against 127.0.0.1 on the
// same VPS, so no TLS and no public hop; the /mcp nginx gate is irrelevant here.
export function createOpenWaClient(deps: { fetch?: typeof fetch; env?: NodeJS.ProcessEnv } = {}): OpenWaClient {
  const cfg = readOpenWaConfig(deps.env ?? process.env);
  const doFetch = deps.fetch ?? fetch;
  const base = `${cfg.baseUrl}/api/sessions/${encodeURIComponent(cfg.sessionId)}`;
  const headers = { "X-API-Key": cfg.apiKey, "Content-Type": "application/json" };

  // The response body can echo request data; only the status is surfaced.
  // A gateway that accepts the connection and then hangs (the "bridge never
  // attached" state can look like that) must not hang the health cron with it.
  async function call(url: string, init?: RequestInit, timeoutMs = 15_000): Promise<unknown> {
    let res: Response;
    try {
      res = await doFetch(url, { ...init, headers, signal: AbortSignal.timeout(timeoutMs) });
    } catch {
      throw new ToolError("internal", "WhatsApp gateway unreachable.");
    }
    if (!res.ok) throw new ToolError("internal", `WhatsApp gateway returned HTTP ${res.status}.`);
    return res.json().catch(() => null);
  }

  return {
    async fetchThread(chatId, limit) {
      // deep=true reaches into WhatsApp's own history and can take a while.
      const body = await call(`${base}/messages/${chatId}/history?limit=${limit}&deep=true`, undefined, 30_000);
      return Array.isArray(body) ? (body as RawMessage[]) : [];
    },
    async sendText(chatId, text) {
      await call(`${base}/messages/send-text`, { method: "POST", body: JSON.stringify({ chatId, text }) });
    },
    async listGroups() {
      return shapeGroups(await call(`${base}/groups?limit=1000`, undefined, 30_000));
    },
    async getSession() {
      const body = (await call(base)) as { status?: unknown; lastError?: unknown } | null;
      return {
        status: typeof body?.status === "string" ? body.status : "unknown",
        lastError: typeof body?.lastError === "string" ? body.lastError : null,
      };
    },
    async startSession() {
      // Start waits for the browser to come up; the readiness deadline is ~90 s.
      await call(`${base}/start`, { method: "POST" }, 45_000);
    },
  };
}
