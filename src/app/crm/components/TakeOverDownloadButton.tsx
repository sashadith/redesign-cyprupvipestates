"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { takeOverDownloadAction } from "../actions";
import { useToast } from "./Toast";

// "Take over as lead" for a download (guide or Private Collection briefing reader,
// 2026-11-07): Inbox -> Downloads and the lead cockpit. The server action checks the right.
export function TakeOverDownloadButton({ leadId, name }: { leadId: string; name: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function run() {
    if (busy) return;
    setBusy(true);
    let res: Awaited<ReturnType<typeof takeOverDownloadAction>>;
    try {
      res = await takeOverDownloadAction(leadId);
    } catch {
      res = { error: "Could not save — check your connection and try again." };
    } finally {
      setBusy(false);
    }
    if ("error" in res) { toast.show(res.error, "error"); return; }
    toast.show(`${name} is a lead now — find them in the inbox`);
    router.refresh();
  }

  return (
    <>
      <button type="button" className="crm-btn" disabled={busy} onClick={() => void run()}>{busy ? "Taking over…" : "Take over as lead"}</button>
      {toast.node}
    </>
  );
}
