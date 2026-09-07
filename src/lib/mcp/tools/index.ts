import type { McpServer } from "@modelcontextprotocol/server";
import { registerWorklist } from "./worklist";

export function registerReadTools(server: McpServer): void {
  registerWorklist(server);
}
