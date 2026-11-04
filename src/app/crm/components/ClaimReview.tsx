"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { OUTCOME_NOTE_MAX, type ReviewCard } from "@/lib/crm/partnerClaims";
import { acceptClaimAction, rejectClaimAction } from "../partners/claimActions";
import { adminDate as date, adminDateTime as when } from "@/lib/adminTime";
import { useToast } from "./Toast";

// "Partner claims" on /crm/inbox (managers, partner portal phase 3b): a partner submitted a
// client we already know. What they typed on the left, our lead on the right; Accept makes
// the partner's claim ACTIVE, Reject closes it. The partner only ever sees the outcome.


function Facts({ rows }: { rows: [string, string | null][] }) {
  return (
    <dl className="crm-ck-facts">
      {rows.filter(([, v]) => v).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
    </dl>
  );
}

function Card({ card, onDone }: { card: ReviewCard; onDone: (id: string, message: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function run(kind: "accept" | "reject") {
    if (busy) return;
    setBusy(true);
    setError(null);
    let res: { ok: true } | { error: string };
    try {
      res = kind === "accept" ? await acceptClaimAction(card.id) : await rejectClaimAction(card.id, note);
    } catch {
      res = { error: "Could not save — check your connection and try again." };
    } finally {
      setBusy(false);
    }
    if ("error" in res) { setError(res.error); return; }
    onDone(card.id, kind === "accept" ? `Claim accepted — ${card.partner} now holds this client` : "Claim rejected");
  }

  const s = card.submission;
  const l = card.lead;
  return (
    <article className="crm-panel crm-cr" id={`claim-${card.id}`} aria-labelledby={`claim-h-${card.id}`}>
      <header className="crm-cr-head">
        <h3 id={`claim-h-${card.id}`}>{card.partner}</h3>
        {card.partnerSuspended && <span className="crm-pill">Suspended</span>}
        <span className="crm-muted">submitted {when(card.submittedAt)}</span>
      </header>
      <div className="crm-cr-cols">
        <section aria-label="What the partner submitted">
          <h4>Partner submitted</h4>
          <Facts rows={[
            ["Name", s.name], ["Email", s.email], ["Phone", s.phone], ["Mode", s.mode], ["Contact", s.contactMode], ["Representative", s.rep],
            ["Projects", s.projects],
          ]} />
          {s.comment && <p className="crm-ck-text">{s.comment}</p>}
        </section>
        <section aria-label="Our existing lead">
          <h4>Our lead</h4>
          <Facts rows={[
            ["Name", l.name], ["Email", l.email], ["Phone", l.phone], ["Owner", l.owner ?? "Unassigned"], ["Stage", l.stage], ["Source", l.source],
            ["Created", date(l.createdAt)], ["Last contact", l.lastRealContact ? date(l.lastRealContact) : "No call, email or WhatsApp yet"],
          ]} />
          {l.trashed ? <p className="crm-ck-error">This lead is in the trash.</p> : <a href={`/crm/leads/${l.id}`}>Open lead →</a>}
        </section>
      </div>
      {card.others.length > 0 && (
        <div className="crm-cr-others">
          <h4>Other claims on this lead</h4>
          <ul>
            {card.others.map((o) => (
              <li key={o.id}>
                <b>{o.partner}</b> <span className="crm-pill">{o.state}</span> <span className="crm-muted">{o.mode} · {date(o.createdAt)}</span>
                {o.protection && <span className="crm-cr-prot">{o.protection}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="crm-cr-actions">
        <label className="crm-ck-field">
          <span>Internal note (optional, never shown to the partner)</span>
          <textarea value={note} rows={2} maxLength={OUTCOME_NOTE_MAX} onChange={(e) => setNote(e.target.value)} disabled={busy} />
        </label>
        {card.accept.note && <p className={card.accept.blocked ? "crm-ck-error" : "crm-muted"}>{card.accept.note}</p>}
        {error && <p className="crm-ck-error" role="alert">{error}</p>}
        <div className="crm-cr-buttons">
          <button type="button" className="crm-btn" disabled={busy} onClick={() => void run("reject")}>Reject</button>
          <button type="button" className="crm-btn primary" disabled={busy || card.accept.blocked} onClick={() => void run("accept")}>Accept</button>
        </div>
      </div>
    </article>
  );
}

export function ClaimReview({ cards, total }: { cards: ReviewCard[]; total: number }) {
  const router = useRouter();
  // One toast for the whole list: a card's own toast would unmount with the card.
  const toast = useToast();
  // Cards decided in this view disappear at once; the refreshed list confirms.
  const [done, setDone] = useState<ReadonlySet<string>>(new Set());
  const open = cards.filter((c) => !done.has(c.id));
  // The toast stays mounted after the last card is decided and the section is gone.
  if (!open.length) return <>{toast.node}</>;
  return (
    <section className="crm-cr-list" aria-labelledby="crm-cr-h" id="claims">
      <h2 id="crm-cr-h">Partner claims <span className="crm-muted">{total > cards.length ? `${total} to review, showing the oldest ${cards.length}` : `${total} to review`}</span></h2>
      <p className="crm-muted">A partner submitted a client we already know. Accept gives them the client; the partner only sees the outcome, never our lead.</p>
      {open.map((c) => (
        <Card key={c.id} card={c} onDone={(id, message) => { setDone((s) => new Set(s).add(id)); toast.show(message); router.refresh(); }} />
      ))}
      {toast.node}
    </section>
  );
}
