"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { canMark, canResend, undoTarget, type RegStatus } from "@/lib/crm/registration/core";
import {
  markRegistrationAction, registrationOptionsAction, resendRegistrationAction, skipRegistrationDueAction, unskipRegistrationDueAction,
  type RegistrationOptions,
} from "../leads/registrationActions";
import { RegisterDialog } from "./RegisterDialog";
import { ManualRegistrationDialog } from "./ManualRegistrationDialog";
import { useToast } from "./Toast";

// Developer client registrations of one lead (spec 2026-10-27 §8). The server
// re-checks every permission; the buttons here only mirror what it allows.

export type RegistrationRow = {
  // channel NONE: recorded by hand ("Add manually"), nothing was sent.
  id: string; developerName: string; channel: "EMAIL" | "WHATSAPP" | "NONE"; status: RegStatus;
  sentAt: string | null; preliminaryAt: string | null; preliminarySource: string | null;
  fixedAt: string | null; sendError: string | null;
};

// A developer from the client's personal selections with no registration yet.
export type DueRow = { developerAccountId: string; developerName: string; registrable: boolean; developmentIds: string[]; projects: string[]; since: string };
export type SkippedDueRow = DueRow & { skippedAt: string; skippedByName: string | null; skipReason: string | null };

const STATUS_LABEL: Record<RegStatus, string> = { SENT: "Sent", PRELIMINARY: "Preliminary", FIXED: "Fixed", REJECTED: "Rejected", FAILED: "Failed" };

const NICOSIA = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Nicosia", day: "2-digit", month: "2-digit", year: "2-digit" });
function ddmmyy(iso: string): string {
  const p = Object.fromEntries(NICOSIA.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.day}.${p.month}.${p.year}`;
}

function dateLine(r: RegistrationRow): string {
  const parts: string[] = [];
  if (r.channel === "NONE") {
    if (r.sentAt) parts.push(`Registered ${ddmmyy(r.sentAt)}, added manually`);
    if (r.fixedAt) parts.push(`Fixed ${ddmmyy(r.fixedAt)}`);
    return parts.join(" · ");
  }
  if (r.sentAt) parts.push(`Sent ${ddmmyy(r.sentAt)}`);
  else if (r.status === "SENT") parts.push("Sending… (if this stays, mark rejected and resend)");
  if (r.preliminaryAt) parts.push(`Preliminary ${ddmmyy(r.preliminaryAt)}${r.preliminarySource ? ` (${r.preliminarySource})` : ""}`);
  if (r.fixedAt) parts.push(`Fixed ${ddmmyy(r.fixedAt)}`);
  return parts.join(" · ");
}

type Mark = "PRELIMINARY" | "FIXED" | "REJECTED" | "UNDO";

export function CockpitRegistrations({ leadId, canEdit, isOwner, rows, due, isAdmin, autoRegister }: {
  leadId: string; canEdit: boolean; isOwner: boolean; rows: RegistrationRow[];
  due: { open: DueRow[]; skipped: SkippedDueRow[] }; isAdmin: boolean; autoRegister: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [options, setOptions] = useState<RegistrationOptions | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [initial, setInitial] = useState<{ developerIds: string[]; projectIds: string[] } | undefined>(undefined);
  const [skipping, setSkipping] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [autoDone, setAutoDone] = useState(false);

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

  const openRegister = (picks?: DueRow[]) => {
    setInitial(picks ? { developerIds: picks.map((p) => p.developerAccountId), projectIds: picks.flatMap((p) => p.developmentIds) } : undefined);
    setOpen(true);
  };

  async function skip(devId: string) {
    if (busy) return;
    setBusy(devId);
    try {
      const r = await skipRegistrationDueAction(leadId, devId, reason);
      if (r.ok) { setSkipping(null); setReason(""); router.refresh(); }
      else toast.show(r.error, "error");
    } catch {
      toast.show("Could not save — check your connection and try again.", "error");
    } finally {
      setBusy(null);
    }
  }

  async function unskip(devId: string) {
    if (busy) return;
    setBusy(devId);
    try {
      const r = await unskipRegistrationDueAction(leadId, devId);
      if (r.ok) router.refresh();
      else toast.show(r.error, "error");
    } catch {
      toast.show("Could not save — check your connection and try again.", "error");
    } finally {
      setBusy(null);
    }
  }

  // Why "Register" is unavailable, if it is.
  let blocked: string | null = null;
  if (optionsError) blocked = optionsError;
  else if (options && !options.phone.ok) blocked = options.phone.reason;
  else if (options && !options.developers.some((d) => d.registrable)) blocked = "No developer has a registration channel set yet (admin › developer page).";
  const dueReady = due.open.filter((d) => d.registrable);

  // From Today ("?register=due"): open the dialog once with every registrable due developer.
  useEffect(() => {
    if (autoRegister && !autoDone && options && !blocked && dueReady.length) { setAutoDone(true); openRegister(dueReady); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRegister, autoDone, options, blocked]);

  return (
    <section className="crm-panel crm-ck-regs" aria-labelledby="crm-ck-regs-h">
      <div className="crm-ck-sechead">
        <h2 id="crm-ck-regs-h">Developer registrations</h2>
        {canEdit && (
          <span className="crm-ck-regactions">
            {/* Needs no phone or channel: nothing is sent. */}
            <button type="button" className="crm-btn" disabled={!options} title="Record a registration made outside the CRM" onClick={() => setManualOpen(true)}>Add manually</button>
            <button
              type="button" className="crm-btn" disabled={!options || !!blocked}
              title={blocked ?? undefined} onClick={() => openRegister()}
            >Register</button>
          </span>
        )}
      </div>
      {canEdit && blocked && <p className="crm-ck-regblocked">{blocked}</p>}
      {due.open.length > 0 && (
        <div className="crm-ck-due" role="region" aria-label="Developers from personal selections">
          <div className="crm-ck-duehead">
            <div>
              <b>Developers from personal selections</b>
              <p>Please register the client asap.</p>
            </div>
            {canEdit && dueReady.length > 1 && (
              <button type="button" className="crm-btn primary" disabled={!options || !!blocked} title={blocked ?? undefined} onClick={() => openRegister(dueReady)}>Register all ({dueReady.length})</button>
            )}
          </div>
          <ul>
            {due.open.map((d) => (
              <li key={d.developerAccountId}>
                <div className="crm-ck-duerow">
                  <span className="who"><b>{d.developerName}</b><span className="proj">{d.projects.join(", ")} · since {ddmmyy(d.since)}</span></span>
                  {canEdit && (
                    <span className="crm-ck-duebtns">
                      {d.registrable ? (
                        <button type="button" className="crm-btn primary" disabled={!options || !!blocked} title={blocked ?? undefined} onClick={() => openRegister([d])}>Register</button>
                      ) : (
                        <em className="crm-muted">
                          no registration channel set{isAdmin && <> · <a href={`/admin/developments/developers/${d.developerAccountId}`}>set it</a></>}
                        </em>
                      )}
                      <button type="button" className="crm-linkbtn" disabled={busy === d.developerAccountId} onClick={() => { setSkipping(skipping === d.developerAccountId ? null : d.developerAccountId); setReason(""); }}>Skip</button>
                    </span>
                  )}
                </div>
                {skipping === d.developerAccountId && (
                  <form className="crm-ck-dueskip" onSubmit={(e) => { e.preventDefault(); void skip(d.developerAccountId); }}>
                    <input
                      autoFocus maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)}
                      placeholder="Why not? e.g. client already registered by another agent" aria-label={`Reason for skipping ${d.developerName}`}
                    />
                    <button type="submit" className="crm-btn" disabled={busy === d.developerAccountId || !reason.trim()}>Skip</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {due.skipped.length > 0 && (
        <details className="crm-ck-dueskipped">
          <summary>Skipped ({due.skipped.length})</summary>
          <ul>
            {due.skipped.map((d) => (
              <li key={d.developerAccountId}>
                <span><b>{d.developerName}</b> — {d.skipReason}{d.skippedByName ? ` (${d.skippedByName}, ${ddmmyy(d.skippedAt)})` : ""}</span>
                {canEdit && <button type="button" className="crm-linkbtn" disabled={busy === d.developerAccountId} onClick={() => void unskip(d.developerAccountId)}>Undo</button>}
              </li>
            ))}
          </ul>
        </details>
      )}
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
                    <span className="crm-ck-regch" title={r.channel === "EMAIL" ? "Email" : r.channel === "WHATSAPP" ? "WhatsApp" : "Added manually"}>{r.channel === "EMAIL" ? "✉" : r.channel === "WHATSAPP" ? "WA" : "manual"}</span>
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
          leadId={leadId} options={options} initial={initial}
          onClose={() => setOpen(false)}
          onSent={() => { router.refresh(); void loadOptions(); }}
        />
      )}
      {canEdit && options && manualOpen && (
        <ManualRegistrationDialog
          leadId={leadId} options={options} isOwner={isOwner}
          onClose={() => setManualOpen(false)}
          onSaved={() => { toast.show("Registration saved."); router.refresh(); void loadOptions(); }}
        />
      )}
      {toast.node}
    </section>
  );
}
