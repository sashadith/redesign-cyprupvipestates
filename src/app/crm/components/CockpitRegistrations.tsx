"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { canMark, canResend, undoTarget, type RegStatus } from "@/lib/crm/registration/core";
import {
  markRegistrationAction, registrationOptionsAction, resendRegistrationAction, type RegistrationOptions,
} from "../leads/registrationActions";
import { RegisterDialog } from "./RegisterDialog";
import { useToast } from "./Toast";

// Developer client registrations of one lead (spec 2026-10-27 §8). The server
// re-checks every permission; the buttons here only mirror what it allows.

export type RegistrationRow = {
  id: string; developerName: string; channel: "EMAIL" | "WHATSAPP"; status: RegStatus;
  sentAt: string | null; preliminaryAt: string | null; preliminarySource: string | null;
  fixedAt: string | null; sendError: string | null;
};

const STATUS_LABEL: Record<RegStatus, string> = { SENT: "Sent", PRELIMINARY: "Preliminary", FIXED: "Fixed", REJECTED: "Rejected", FAILED: "Failed" };

const NICOSIA = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Nicosia", day: "2-digit", month: "2-digit", year: "2-digit" });
function ddmmyy(iso: string): string {
  const p = Object.fromEntries(NICOSIA.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.day}.${p.month}.${p.year}`;
}

function dateLine(r: RegistrationRow): string {
  const parts: string[] = [];
  if (r.sentAt) parts.push(`Sent ${ddmmyy(r.sentAt)}`);
  if (r.preliminaryAt) parts.push(`Preliminary ${ddmmyy(r.preliminaryAt)}${r.preliminarySource ? ` (${r.preliminarySource})` : ""}`);
  if (r.fixedAt) parts.push(`Fixed ${ddmmyy(r.fixedAt)}`);
  return parts.join(" · ");
}

type Mark = "PRELIMINARY" | "FIXED" | "REJECTED" | "UNDO";

export function CockpitRegistrations({ leadId, canEdit, isOwner, rows }: { leadId: string; canEdit: boolean; isOwner: boolean; rows: RegistrationRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [options, setOptions] = useState<RegistrationOptions | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const loadOptions = useCallback(async () => {
    try {
      const r = await registrationOptionsAction(leadId);
      if ("error" in r) { setOptionsError(r.error); setOptions(null); }
      else { setOptions(r); setOptionsError(null); }
    } catch {
      setOptionsError("Could not load the developers — reload the page.");
    }
  }, [leadId]);

  useEffect(() => { if (canEdit) void loadOptions(); }, [canEdit, loadOptions, rows]);

  async function mark(id: string, action: Mark) {
    if (busy) return;
    setBusy(id);
    try {
      const r = await markRegistrationAction(id, action);
      if (r.ok) router.refresh();
      else toast.show(r.error, "error");
    } catch {
      toast.show("Could not update the registration — check your connection and try again.", "error");
    } finally {
      setBusy(null);
    }
  }

  async function resend(id: string) {
    if (busy) return;
    setBusy(id);
    try {
      const r = await resendRegistrationAction(id);
      if (!r.ok) toast.show(r.error, "error");
      else {
        const o = r.outcomes[0];
        if (o?.result === "failed") toast.show(`Resend failed: ${o.error ?? "unknown error"}`, "error");
        else if (o?.result === "already") toast.show("Already registered with this developer.", "error");
        else toast.show("Registration resent.");
      }
      router.refresh();
    } catch {
      toast.show("Could not resend — check your connection and try again.", "error");
    } finally {
      setBusy(null);
    }
  }

  // Why "Register" is unavailable, if it is.
  let blocked: string | null = null;
  if (optionsError) blocked = optionsError;
  else if (options && !options.phone.ok) blocked = options.phone.reason;
  else if (options && !options.developers.some((d) => d.registrable)) blocked = "No developer has a registration channel set yet (admin › developer page).";

  return (
    <section className="crm-panel crm-ck-regs" aria-labelledby="crm-ck-regs-h">
      <div className="crm-ck-sechead">
        <h2 id="crm-ck-regs-h">Developer registrations</h2>
        {canEdit && (
          <button
            type="button" className="crm-btn" disabled={!options || !!blocked}
            title={blocked ?? undefined} onClick={() => setOpen(true)}
          >Register</button>
        )}
      </div>
      {canEdit && blocked && <p className="crm-ck-regblocked">{blocked}</p>}
      {rows.length === 0 ? (
        <p className="crm-muted crm-ck-regempty">Not registered with any developer yet.</p>
      ) : (
        <ul className="crm-ck-reglist">
          {rows.map((r) => {
            const undo = undoTarget(r.status, !!r.preliminaryAt);
            const canUndo = canEdit && undo !== null && (r.status !== "FIXED" || isOwner);
            const btns: { label: string; run: () => void }[] = [];
            if (canEdit && canMark(r.status, "PRELIMINARY")) btns.push({ label: "Mark preliminary", run: () => void mark(r.id, "PRELIMINARY") });
            if (canEdit && isOwner && canMark(r.status, "FIXED")) btns.push({ label: "Mark fixed", run: () => void mark(r.id, "FIXED") });
            if (canEdit && canMark(r.status, "REJECTED")) btns.push({ label: "Mark rejected", run: () => void mark(r.id, "REJECTED") });
            if (canUndo) btns.push({ label: "Undo", run: () => void mark(r.id, "UNDO") });
            if (canEdit && canResend(r.status)) btns.push({ label: "Resend", run: () => void resend(r.id) });
            const dates = dateLine(r);
            return (
              <li key={r.id}>
                <div className="crm-ck-reghead">
                  <b>
                    {r.developerName}{" "}
                    <span className="crm-ck-regch" title={r.channel === "EMAIL" ? "Email" : "WhatsApp"}>{r.channel === "EMAIL" ? "✉" : "WA"}</span>
                  </b>
                  <span className={`crm-pill r-${r.status}`}>{STATUS_LABEL[r.status]}</span>
                </div>
                {dates && <p className="crm-ck-regdates">{dates}</p>}
                {r.sendError && <p className="crm-ck-regerr">{r.sendError}</p>}
                {btns.length > 0 && (
                  <div className="crm-ck-regbtns">
                    {btns.map((b) => (
                      <button key={b.label} type="button" className="crm-btn" disabled={busy === r.id} onClick={b.run}>{b.label}</button>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {canEdit && options && open && (
        <RegisterDialog
          leadId={leadId} options={options}
          onClose={() => setOpen(false)}
          onSent={() => { router.refresh(); void loadOptions(); }}
        />
      )}
      {toast.node}
    </section>
  );
}
