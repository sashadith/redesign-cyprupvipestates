import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LEAD_STATUSES } from "@/lib/crm/leadStatus";
import { LEAD_STATUSES as FILTER_STATUSES } from "@/app/admin/(panel)/crm/filters";
import { LEAD_STATUSES as UPDATE_STATUSES } from "@/lib/crm/updateLeadStatus";
import { ACTIVE_LEAD_STATUSES } from "@/lib/actionCenter/rules/crm";
import { STATUS_STYLES } from "@/app/admin/status-badge";

// No file may carry its own copy of the status array again.
const FILES = [
  "src/app/admin/(panel)/crm/filters.ts",
  "src/app/admin/(panel)/crm/StatusPopover.tsx",
  "src/app/admin/(panel)/crm/create-lead-form.tsx",
  "src/app/admin/(panel)/crm/board/page.tsx",
  "src/app/admin/(panel)/page.tsx",
  "src/app/admin/actions.ts",
  "src/lib/actionCenter/rules/crm.ts",
  "src/lib/crm/compose/leadState.ts",
  "src/lib/crm/createLead.ts",
  "src/lib/crm/updateLeadStatus.ts",
  "src/lib/mcp/tools/searchLeads.ts",
];

test("no file hard-codes the status list", () => {
  for (const f of FILES) {
    const src = readFileSync(f, "utf8");
    assert.equal(/\["NEW",\s*"CONTACTED"/.test(src), false, `${f} still has its own status array`);
  }
});

test("re-exported lists are the central list", () => {
  assert.deepEqual([...FILTER_STATUSES], [...LEAD_STATUSES]);
  assert.deepEqual([...UPDATE_STATUSES], [...LEAD_STATUSES]);
  assert.ok((ACTIVE_LEAD_STATUSES as readonly string[]).includes("RESERVED"));
});

test("every status has a badge style", () => {
  for (const s of LEAD_STATUSES) assert.ok(STATUS_STYLES[s], `missing style for ${s}`);
});
