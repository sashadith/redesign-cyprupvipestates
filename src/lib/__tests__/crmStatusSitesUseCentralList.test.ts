import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LEAD_STATUSES } from "@/lib/crm/leadStatus";
import { LEAD_STATUSES as UPDATE_STATUSES } from "@/lib/crm/updateLeadStatus";
import { ACTIVE_LEAD_STATUSES } from "@/lib/actionCenter/rules/crm";

// Shared backend code reads the one central list.
const SHARED_FILES = [
  "src/lib/actionCenter/rules/crm.ts",
  "src/lib/crm/compose/leadState.ts",
  "src/lib/crm/createLead.ts",
  "src/lib/crm/updateLeadStatus.ts",
  "src/lib/mcp/tools/searchLeads.ts",
];

// The old admin CRM UI stays as it was until the cutover (operator, 2026-10-17):
// it keeps its own eight statuses and never offers RESERVED.
const OLD_CRM_FILES = [
  "src/app/admin/(panel)/crm/filters.ts",
  "src/app/admin/(panel)/crm/StatusPopover.tsx",
  "src/app/admin/(panel)/crm/create-lead-form.tsx",
  "src/app/admin/(panel)/crm/board/page.tsx",
  "src/app/admin/(panel)/page.tsx",
  "src/app/admin/actions.ts",
  "src/app/admin/status-badge.tsx",
];

test("shared code does not hard-code the status list", () => {
  for (const f of SHARED_FILES) {
    const src = readFileSync(f, "utf8");
    assert.equal(/\["NEW",\s*"CONTACTED"/.test(src), false, `${f} still has its own status array`);
  }
});

test("the old admin CRM UI is untouched and never offers RESERVED", () => {
  for (const f of OLD_CRM_FILES) {
    assert.equal(readFileSync(f, "utf8").includes("RESERVED"), false, `${f} mentions RESERVED`);
  }
});

test("re-exported lists are the central list", () => {
  assert.deepEqual([...UPDATE_STATUSES], [...LEAD_STATUSES]);
  assert.ok((ACTIVE_LEAD_STATUSES as readonly string[]).includes("RESERVED"));
});
