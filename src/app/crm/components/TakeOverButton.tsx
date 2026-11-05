"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { takeOverPartnerLeadAction } from "../partners/handoverActions";
import { useToast } from "./Toast";

// "Take over" for a partner-worked lead the partner can no longer work (protection lapsed or the
// partner is not active): used on the partner pipelines view and the lead cockpit. The server
// action checks the session and the right (admin, owner or the partner's manager) itself.

export function TakeOverButton({ leadId, client }: { leadId: string; client: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (busy) return;
    setBusy(true);
    setError(null);
    let res: Awaited<ReturnType<typeof takeOverPartnerLeadAction>>;
    try {
      res = await takeOverPartnerLeadAction(leadId);
    } catch {
      res = { error: "Could not save — check your connection and try again." };
    } finally {
      setBusy(false);
    }
    if ("error" in res) { setError(res.error); return; }
    toast.show(res.mine ? `${client} is yours now` : `${client} is now with ${res.ownerName}`);
    router.refresh();
  }

  return (
    <div className="crm-ckp-row">
      <button type="button" className="crm-btn" disabled={busy} onClick={() => void run()}>{busy ? "Taking over…" : "Take over"}</button>
      {error && <p className="crm-ck-error" role="alert">{error}</p>}
      {toast.node}
    </div>
  );
}
