import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { inventoryChanges, CHANGE_TYPES } from "@/lib/crm/inventoryChanges";
import { runTool } from "../toolWrapper";
import { contextFromAuthInfo } from "../context";
import { fmtDate } from "../format";

const Input = z.object({
  days: z.number().int().min(1).max(60).default(14),
  developmentIds: z.array(z.string().uuid()).max(20).optional().describe("e.g. the developmentIds from a lead's crm_match_properties result."),
  districts: z.array(z.string().min(1).max(60)).max(10).optional(),
  types: z.array(z.enum(CHANGE_TYPES)).optional(),
  limit: z.number().int().min(1).max(100).default(40),
});

export function registerInventoryChanges(server: McpServer) {
  server.registerTool(
    "crm_inventory_changes",
    {
      title: "What changed in the catalogue",
      description:
        "What changed in the published catalogue in the last N days — projects published, sold out, back on market, new units, availability moves (with a lastUnits flag), priceFrom moves, and per-unit reservations/sales/price changes. Use it to give a quiet lead a real reason to hear from us (pass the developmentIds from their crm_match_properties result) and to open the day. Dated events carry `at`; snapshot-based events carry `since` (changed between that date and now). Read `coverage.note` — price and unit-level history starts with the first nightly snapshot. Quote figures as returned.",
      inputSchema: Input,
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async (input, ctx) =>
      runTool("crm_inventory_changes", contextFromAuthInfo(ctx.http?.authInfo), null, async () => {
        const r = await inventoryChanges(input);
        return {
          window: { from: fmtDate(r.window.from), to: fmtDate(r.window.to), days: r.window.days },
          coverage: { snapshotBased: r.coverage.snapshotBased, oldestSnapshotAt: fmtDate(r.coverage.oldestSnapshotAt), note: r.coverage.note },
          total: r.total,
          returned: r.returned,
          events: r.events.map((e) => ({ ...e, at: fmtDate(e.at), since: fmtDate(e.since) })),
        };
      }),
  );
}
