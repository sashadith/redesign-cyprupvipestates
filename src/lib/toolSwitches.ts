import { prisma } from "@/lib/prisma";

// Admin on/off switches for optional internal tools (2026-11-05). The operator
// wanted to switch SEO Advisor and Page Power off without a deploy. A missing
// row reads as ON: both tools ran unconditionally before the switch existed,
// and a fresh database must not silently lose them.
//
// What OFF means, per tool:
//   seo_advisor — the Sunday cron skips the run (no Claude call), the daily
//                 digest sends no advisor summary, the Action Center shows no
//                 advisor items.
//   page_power  — the Action Center shows no Page Power items, the advisor
//                 payload carries no pagePower block, the admin screen
//                 computes nothing.
export const TOOL_KEYS = ["seo_advisor", "page_power"] as const;
export type ToolKey = (typeof TOOL_KEYS)[number];

export const TOOL_LABEL: Record<ToolKey, string> = {
  seo_advisor: "SEO Advisor",
  page_power: "Page Power",
};

export function isToolKey(v: string): v is ToolKey {
  return (TOOL_KEYS as readonly string[]).includes(v);
}

export type ToolSwitchState = { enabled: boolean; updatedAt: Date | null; updatedByName: string | null };

export async function getToolSwitch(key: ToolKey): Promise<ToolSwitchState> {
  const row = await prisma.toolSwitch.findUnique({ where: { key } });
  return { enabled: row?.enabled ?? true, updatedAt: row?.updatedAt ?? null, updatedByName: row?.updatedByName ?? null };
}

export async function isToolEnabled(key: ToolKey): Promise<boolean> {
  return (await getToolSwitch(key)).enabled;
}
