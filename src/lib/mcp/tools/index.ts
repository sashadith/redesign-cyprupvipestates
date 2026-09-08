import type { McpServer } from "@modelcontextprotocol/server";
import { registerWorklist } from "./worklist";
import { registerSearchLeads } from "./searchLeads";
import { registerGetLead } from "./getLead";
import { registerMatchProperties } from "./matchProperties";
import { registerGetProject } from "./getProject";
import { registerPlaybook } from "./playbook";
import { registerSearchProjects } from "./searchProjects";
import { registerInventoryChanges } from "./inventoryChanges";
import { registerLogInteraction } from "./logInteraction";
import { registerUpdateLead } from "./updateLead";
import { registerDraftEmail } from "./draftEmail";
import { registerSendEmail } from "./sendEmail";
import { registerListDrafts } from "./listDrafts";

export function registerReadTools(server: McpServer): void {
  registerWorklist(server);
  registerSearchLeads(server);
  registerGetLead(server);
  registerMatchProperties(server);
  registerGetProject(server);
  registerPlaybook(server);
  registerSearchProjects(server);
  registerInventoryChanges(server);
}

// Phase 2 — writes. Registered after the read tools; each one is attributed
// to the token user and tagged metadata.via = "mcp".
export function registerWriteTools(server: McpServer): void {
  registerLogInteraction(server);
  registerUpdateLead(server);
  registerDraftEmail(server);
  registerSendEmail(server);
  registerListDrafts(server);
}
