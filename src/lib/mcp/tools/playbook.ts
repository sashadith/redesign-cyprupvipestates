import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { buildEmailClosing } from "@/lib/crm/compose/closing";
import { CONTACT_PHONE } from "@/lib/crm/compose/generate";
import { runTool } from "../toolWrapper";
import { contextFromAuthInfo } from "../context";

// Same on-disk read as loadPlaybook.ts (edits to the markdown take effect
// without a rebuild; see the comment there).
const PLAYBOOK_DIR = path.join(process.cwd(), "src/lib/crm/compose/playbook");
const FILES = ["voice.md", "by-language.md", "by-state.md", "call-offer.md", "psychology.md", "anti-slop.md", "examples.md"] as const;

export function registerPlaybook(server: McpServer) {
  server.registerTool(
    "crm_get_playbook",
    {
      title: "Get the messaging playbook",
      description: "The house rules for writing to leads: voice, per-language salutation rules (formal DE/PL), per-state guidance, when to offer a call, anti-slop rules and examples — plus the closing lines per language and the real contact phone. Read this before drafting any message.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async (_input, ctx) =>
      runTool("crm_get_playbook", contextFromAuthInfo(ctx.http?.authInfo), null, async () => {
        const sections = FILES.map((f) => {
          try {
            return { file: f, markdown: fs.readFileSync(path.join(PLAYBOOK_DIR, f), "utf8") };
          } catch {
            return { file: f, markdown: "" };
          }
        }).filter((s) => s.markdown);
        return {
          contactPhone: CONTACT_PHONE,
          closings: Object.fromEntries(["en", "de", "pl", "ru"].map((l) => [l, buildEmailClosing(l)])),
          sections,
        };
      }),
  );
}
