import { test } from "node:test";
import assert from "node:assert/strict";
import { READ_TOOL_NAMES, WRITE_TOOL_NAMES } from "@/lib/mcp/toolNames";

const EXPECTED = [
  "crm_create_lead",
  "crm_delete_lead",
  "crm_draft_email",
  "crm_get_lead",
  "crm_get_playbook",
  "crm_get_project",
  "crm_inventory_changes",
  "crm_list_drafts",
  "crm_log_interaction",
  "crm_match_properties",
  "crm_restore_lead",
  "crm_search_leads",
  "crm_search_projects",
  "crm_send_email",
  "crm_update_lead",
  "crm_worklist",
];

test("READ_TOOL_NAMES + WRITE_TOOL_NAMES union is exactly the sixteen registered tools", () => {
  const union = [...READ_TOOL_NAMES, ...WRITE_TOOL_NAMES].slice().sort();
  assert.deepEqual(union, EXPECTED);
});

test("no tool name appears in both lists", () => {
  const overlap = READ_TOOL_NAMES.filter((n) => (WRITE_TOOL_NAMES as readonly string[]).includes(n));
  assert.deepEqual(overlap, []);
});
