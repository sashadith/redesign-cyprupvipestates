"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { syncLeadCommsAction } from "../leads/commSyncActions";
import { useToast } from "./Toast";

// Timeline header button: pulls the lead's WhatsApp thread and mail into the timeline now. The
// webhook and the mail poll do this on their own; this is for a gap (gateway offline, older chats).
export function CockpitSyncButton({ leadId }: { leadId: string }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const toast = useToast();

  async function run() {
    setBusy(true);
    try {
      const r = await syncLeadCommsAction(leadId);
      if ("error" in r) toast.show(r.error, "error");
      else {
        toast.show(r.message);
        router.refresh();
      }
    } catch {
      toast.show("Sync failed — check your connection and try again.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className="crm-btn" disabled={busy} onClick={() => void run()} title="Fetch WhatsApp and email for this lead">
      {busy ? "Syncing…" : "Sync"}
    </button>
  );
}
