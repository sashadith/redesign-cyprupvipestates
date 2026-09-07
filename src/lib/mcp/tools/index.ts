import type { McpServer } from "@modelcontextprotocol/server";
import { registerWorklist } from "./worklist";
import { registerSearchLeads } from "./searchLeads";

export function registerReadTools(server: McpServer): void {
  registerWorklist(server);
  registerSearchLeads(server);
}
