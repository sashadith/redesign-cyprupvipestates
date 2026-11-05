"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PARTNER_MESSAGE_MAX } from "@/lib/crm/partnerClaims";
import { sendPartnerMessageAction } from "../partners/claimActions";
import { setKeepFixAction } from "../partners/handoverActions";
import type { KeepFixView } from "@/lib/crm/handoverReview";
import { TAKE_OVER_REASON_LABEL, type TakeOverReason } from "@/lib/crm/handoverReviewRules";
import { TakeOverButton } from "./TakeOverButton";
import { adminDate as date, adminDateTime as when } from "@/lib/adminTime";
import { useToast } from "./Toast";

// Partner card on the lead cockpit (partner portal phase 3b, task 5): who holds the client,
// on what terms, how long the protection runs — and the one channel to write to the partner.

export type CockpitPartnerView = {
  leadId: string;
  card: {
    partner: string; type: string; status: string; mode: string; contactMode: string; rep: string | null;
    state: string; isActive: boolean; protection: string | null;
  } | null;
  inReview: { id: string; partner: string; submittedAt: string }[];
  messages: { id: string; author: string; partner: string; createdAt: string; body: string }[];
  canMessage: boolean;
  /** Managers only (canAssignLeads): the inbox review is theirs. */
  canReview: boolean;
  /** Set once a partner's handover request on this lead was accepted (partner pipeline, 2026-11-05). */
  keepFix: KeepFixView | null;
  /** Partner-worked, but the partner can no longer act (and the viewer may take it over): why. */
  takeOver: TakeOverReason | null;
};

// Keep FIX after a handover: on an early handover the client became Handover; the manager may
// give the partner the Fix share back (and take it away again) until a deal exists.
function KeepFix({ leadId, v }: { leadId: string; v: KeepFixView }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isFix = v.partnerMode === "FIX";
  // Only after an early handover: keep undoes the downgrade, un-keep restores it. Without one there is nothing to toggle.
  const action: boolean | null = v.downgrade ? !isFix : null;

  async function run(keep: boolean) {
    if (busy) return;
    setBusy(true);
    setError(null);
    let res: { ok: true } | { error: string };
    try {
      res = await setKeepFixAction(leadId, keep);
    } catch {
      res = { error: "Could not save — check your connection and try again." };
    } finally {
      setBusy(false);
    }
    if ("error" in res) { setError(res.error); return; }
    toast.show(keep ? "The partner keeps the Fix share — they will be notified" : "Back to Handover — the partner will be notified");
    router.refresh();
  }

  return (
    <div className="crm-ckp-review">
      <h3>Handover</h3>
      <p className="crm-muted">
        Accepted{v.acceptedBy ? ` by ${v.acceptedBy}` : ""}{v.acceptedAt ? ` on ${when(v.acceptedAt)}` : ""}.
        {" "}Commission: {isFix ? "Fix" : v.partnerMode === "HANDOVER" ? "Handover" : "not set"}
        {v.keepFix && v.keptBy ? ` (Fix kept by ${v.keptBy}${v.keptAt ? `, ${when(v.keptAt)}` : ""})` : ""}.
      </p>
      {v.hasLiveDeal ? (
        <p className="crm-muted">The deal already exists — its commission share is fixed.</p>
      ) : v.canChange && action !== null ? (
        <div className="crm-ckp-row">
          <span className="crm-muted">{action ? "Give the partner the Fix share for this client." : "Return the client to Handover."}</span>
          <button type="button" className="crm-btn" disabled={busy} onClick={() => void run(action)}>{action ? "Keep Fix" : "Back to Handover"}</button>
        </div>
      ) : null}
      {error && <p className="crm-ck-error" role="alert">{error}</p>}
      {toast.node}
    </div>
  );
}


function Composer({ leadId }: { leadId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = body.trim().length > 0 && body.trim().length <= PARTNER_MESSAGE_MAX;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !ready) return;
    setBusy(true);
    setError(null);
    let res: { ok: true } | { error: string };
    try {
      res = await sendPartnerMessageAction(leadId, body);
    } catch {
      res = { error: "Could not send — check your connection and try again." };
    } finally {
      setBusy(false);
    }
    if ("error" in res) { setError(res.error); return; }
    setBody("");
    toast.show("Message saved — the partner will be notified");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="crm-ckp-compose">
      <fieldset disabled={busy}>
        <label className="crm-ck-field">
          <span>Message to partner</span>
          <textarea value={body} rows={3} maxLength={PARTNER_MESSAGE_MAX} onChange={(e) => setBody(e.target.value)} aria-describedby={`crm-ckp-hint-${leadId}`} />
        </label>
        <p id={`crm-ckp-hint-${leadId}`} className="crm-ckp-hint">The partner sees this message in their portal and by email.</p>
        <div className="crm-ckp-row">
          <span className="crm-muted">{body.trim().length}/{PARTNER_MESSAGE_MAX}</span>
          <button type="submit" className="crm-btn primary" disabled={!ready}>{busy ? "Sending…" : "Send to partner"}</button>
        </div>
        {error && <p className="crm-ck-error" role="alert">{error}</p>}
      </fieldset>
      {toast.node}
    </form>
  );
}

export function CockpitPartner({ view }: { view: CockpitPartnerView }) {
  const c = view.card;
  return (
    <section className="crm-panel crm-ckp" aria-labelledby="crm-ckp-h">
      <h2 id="crm-ckp-h">Partner</h2>
      {c && (
        <dl className="crm-ck-facts">
          <div><dt>Partner</dt><dd><a href="/crm/partners">{c.partner}</a>{c.status === "SUSPENDED" && <span className="crm-pill">Suspended</span>}</dd></div>
          <div><dt>Type</dt><dd>{c.type}</dd></div>
          <div><dt>Mode</dt><dd>{c.mode}</dd></div>
          <div><dt>Contact</dt><dd>{c.contactMode}</dd></div>
          {c.rep && <div><dt>Representative</dt><dd>{c.rep}</dd></div>}
          <div><dt>Claim</dt><dd><span className={`crm-pill${c.isActive ? " crm-pt-ok" : ""}`}>{c.state}</span></dd></div>
          {c.protection && <div><dt>Protection</dt><dd>{c.protection}</dd></div>}
        </dl>
      )}
      {view.inReview.length > 0 && (
        <div className="crm-ckp-review">
          <h3>Claims in review</h3>
          <ul>
            {view.inReview.map((r) => (
              <li key={r.id}>
                <b>{r.partner}</b> <span className="crm-muted">{date(r.submittedAt)}</span>
                {view.canReview && <> <a href={`/crm/inbox#claim-${r.id}`}>Review in inbox →</a></>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {view.takeOver && (
        <div className="crm-ckp-review">
          <h3>Partner can no longer act</h3>
          <p className="crm-muted">{TAKE_OVER_REASON_LABEL[view.takeOver]}. The client stays read only until someone takes it over.</p>
          <TakeOverButton leadId={view.leadId} client="The client" />
        </div>
      )}
      {view.keepFix && <KeepFix leadId={view.leadId} v={view.keepFix} />}
      {view.canMessage && <Composer leadId={view.leadId} />}
      {view.messages.length > 0 && (
        <div className="crm-ckp-msgs">
          <h3>Messages to partner</h3>
          <ol>
            {view.messages.map((m) => (
              <li key={m.id}>
                <div className="crm-ck-itemhead"><span><b>{m.author}</b> to <b>{m.partner}</b></span><span className="crm-muted">{when(m.createdAt)}</span></div>
                <p className="crm-ck-text">{m.body}</p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
