import { auth } from "@/auth";
import { TOOL_LABEL, type ToolKey, type ToolSwitchState } from "@/lib/toolSwitches";
import ToolSwitchToggle from "./ToolSwitchToggle";

const OFF_EFFECT: Record<ToolKey, string> = {
  seo_advisor: "When off: the Sunday run is skipped (no Claude call), no advisor summary in the Telegram digest, no advisor items in the Action Center.",
  page_power: "When off: nothing is computed here, no Page Power items in the Action Center, and the SEO Advisor gets no Page Power data.",
};

/** The on/off card at the top of the SEO Advisor and Page Power screens. The
 *  page passes the state it already read, so the switch and what the page
 *  renders below it cannot disagree. */
export default async function ToolSwitchCard({ toolKey, state }: { toolKey: ToolKey; state: ToolSwitchState }) {
  const session = await auth();
  const canEdit = (session?.user as { role?: string } | undefined)?.role === "ADMIN";
  return (
    <ToolSwitchToggle
      toolKey={toolKey}
      label={TOOL_LABEL[toolKey]}
      enabled={state.enabled}
      canEdit={canEdit}
      offEffect={OFF_EFFECT[toolKey]}
      updatedAt={state.updatedAt?.toISOString() ?? null}
      updatedByName={state.updatedByName}
    />
  );
}
