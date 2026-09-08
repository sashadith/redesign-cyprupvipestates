// Single list the consent page and the instructions show; the tools
// themselves are registered in src/lib/mcp/tools/index.ts.
export const READ_TOOL_NAMES = ["crm_worklist", "crm_search_leads", "crm_get_lead", "crm_match_properties", "crm_get_project", "crm_get_playbook", "crm_search_projects", "crm_inventory_changes"] as const;
export const WRITE_TOOL_NAMES = ["crm_log_interaction", "crm_update_lead", "crm_draft_email", "crm_send_email", "crm_list_drafts"] as const;
