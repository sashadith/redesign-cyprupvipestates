"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  deletePresentationAction, extendPresentationAction, favoritesSeedAction, revokePresentationAction,
} from "../leads/presentationActions";
import { sentHistory, type SentInfo } from "@/lib/crm/presentations/sentHistory";
import { PresentationModal, type ModalLead, type ModalUser, type PresentationModalMode } from "./PresentationModal";
import { useToast } from "./Toast";

// A lead's client presentations (personal selections): status, engagement and
// per-project views. The server re-checks every permission; the buttons only
// mirror what it allows.

export type PresentationRowView = {
  id: string; token: string; effectiveStatus: "active" | "expired" | "revoked";
  createdAt: string; expiresAt: string | null;
  advisorName: string | null; partnerName: string | null;
  viewCount: number; uniqueDays: number; favoritedCount: number;
  items: { developmentId: string; name: string; isFavorited: boolean; views: number; durationSec: number }[];
};

/** SentInfo with the date as an ISO string, as it crosses the server/client boundary. */
export type SentInfoView = Omit<SentInfo, "lastSentAt"> & { lastSentAt: string };


const STATUS_LABEL = { active: "Active", expired: "Expired", revoked: "Revoked" } as const;

const NICOSIA = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Nicosia", day: "2-digit", month: "2-digit", year: "2-digit" });
function ddmmyy(iso: string): string {
  const p = Object.fromEntries(NICOSIA.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.day}.${p.month}.${p.year}`;
}
function mss(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function CockpitPresentations({ rows, canEdit, isOwner, lead, sent: sentView, users, currentUser }: {
  leadId: string; rows: PresentationRowView[]; canEdit: boolean; isOwner: boolean;
  lead: ModalLead; sent: Record<string, SentInfoView>; users: ModalUser[]; currentUser: ModalUser | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [modal, setModal] = useState<PresentationModalMode | null>(null);
  const [seeding, setSeeding] = useState<string | null>(null);
  const [extending, setExtending] = useState<string | null>(null);
  const sent = useMemo(() => {
    const out: Record<string, SentInfo> = {};
    Object.keys(sentView).forEach((k) => { out[k] = { ...sentView[k], lastSentAt: new Date(sentView[k].lastSentAt) }; });
    return out;
  }, [sentView]);

  // Editing one selection: its own projects are not "already sent" warnings.
  // Same history as the server's, minus this selection.
  const editSent = useMemo(() => {
    if (modal?.kind !== "edit") return null;
    return sentHistory(rows.map((r) => ({ id: r.id, createdAt: new Date(r.createdAt), items: r.items })), modal.presentationId);
  }, [modal, rows]);

  async function fromFavorites(id: string) {
    if (seeding) return;
    setSeeding(id);
    try {
      const r = await favoritesSeedAction(id);
      if ("error" in r) toast.show(r.error, "error");
      else setModal({ kind: "new", seed: r });
    } catch {
      toast.show("Could not load the favorites — check your connection and try again.", "error");
    } finally {
      setSeeding(null);
    }
  }

  async function run(id: string, fn: () => Promise<{ ok: true } | { error: string }>, done?: string) {
    if (busy) return;
    setBusy(id);
    try {
      const r = await fn();
      if ("error" in r) toast.show(r.error, "error");
      else { if (done) toast.show(done); router.refresh(); }
    } catch {
      toast.show("Could not save — check your connection and try again.", "error");
    } finally {
      setBusy(null);
    }
  }

  async function copy(token: string) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/c/${token}`);
      toast.show("Copied");
    } catch {
      toast.show("Could not copy the link.", "error");
    }
  }

  return (
    <section id="presentations" className="crm-panel crm-ck-pres" aria-labelledby="crm-ck-pres-h">
      <div className="crm-ck-sechead">
        <h2 id="crm-ck-pres-h">Client Presentations</h2>
        {canEdit && <button type="button" className="crm-btn" onClick={() => setModal({ kind: "new" })}>New</button>}
      </div>
      {rows.length === 0 ? (
        <p className="crm-muted crm-ck-presempty">No selections sent yet.</p>
      ) : (
        <ul className="crm-ck-preslist">
          {rows.map((r) => {
            const live = r.effectiveStatus !== "revoked";
            return (
              <li key={r.id}>
                <div className="crm-ck-preshead">
                  <b>{ddmmyy(r.createdAt)}</b>
                  <span className={`crm-pill p-${r.effectiveStatus}`}>{STATUS_LABEL[r.effectiveStatus]}</span>
                </div>
                <p className="crm-ck-presmeta">
                  {r.advisorName ?? (r.partnerName ? `by partner ${r.partnerName}` : "—")}
                  {r.expiresAt && r.effectiveStatus === "active" ? ` · until ${ddmmyy(r.expiresAt)}` : ""}
                </p>
                <p className="crm-ck-presstats">{r.viewCount} views · {r.uniqueDays} days · {r.favoritedCount} ♥</p>
                {r.items.length > 0 && (
                  <details className="crm-ck-presitems">
                    <summary>{r.items.length} {r.items.length === 1 ? "project" : "projects"}</summary>
                    <ul>
                      {r.items.map((i) => (
                        <li key={i.developmentId}>
                          <span>{i.isFavorited ? "♥ " : ""}{i.name}</span>
                          <span className="crm-muted">{i.views} views · {mss(i.durationSec)}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                <div className="crm-ck-presbtns">
                  <button type="button" className="crm-btn" onClick={() => void copy(r.token)}>Copy link</button>
                  <a className="crm-btn" href={`/c/${r.token}`} target="_blank" rel="noopener noreferrer">Open</a>
                  {canEdit && live && (
                    extending === r.id ? (
                      <span className="crm-ck-presext">
                        {([7, 14, 30] as const).map((d) => (
                          <button key={d} type="button" className="crm-btn" disabled={busy === r.id}
                            onClick={() => { setExtending(null); void run(r.id, () => extendPresentationAction(r.id, d), `Extended by ${d} days.`); }}>+{d} days</button>
                        ))}
                        <button type="button" className="crm-linkbtn" onClick={() => setExtending(null)}>Cancel</button>
                      </span>
                    ) : (
                      <button type="button" className="crm-btn" disabled={busy === r.id} onClick={() => setExtending(r.id)}>Extend</button>
                    )
                  )}
                  {canEdit && live && (
                    <button type="button" className="crm-btn" disabled={busy === r.id}
                      onClick={() => { if (window.confirm("Revoke this selection? The client's link stops working.")) void run(r.id, () => revokePresentationAction(r.id)); }}>Revoke</button>
                  )}
                  {canEdit && live && <button type="button" className="crm-btn" onClick={() => setModal({ kind: "edit", presentationId: r.id })}>Edit</button>}
                  {canEdit && (
                    <button type="button" className="crm-btn" disabled={r.favoritedCount === 0 || seeding !== null}
                      title={r.favoritedCount === 0 ? "The client has not favorited anything yet" : undefined}
                      onClick={() => void fromFavorites(r.id)}>{seeding === r.id ? "Loading…" : "New from favorites"}</button>
                  )}
                  {isOwner && (
                    <button type="button" className="crm-linkbtn" disabled={busy === r.id}
                      onClick={() => { if (window.confirm("Delete this selection and all its view tracking?")) void run(r.id, () => deletePresentationAction(r.id)); }}>Delete</button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {modal && (
        <PresentationModal mode={modal} lead={lead} sent={editSent ?? sent} users={users} currentUser={currentUser} onClose={() => setModal(null)} />
      )}
      {toast.node}
    </section>
  );
}
