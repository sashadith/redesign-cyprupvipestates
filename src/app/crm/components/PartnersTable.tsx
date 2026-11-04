"use client";
import { useState, useTransition } from "react";
import type { PartnerType } from "@prisma/client";
import {
  approvePartnerAction, reactivatePartnerAction, revealBankDetailsAction, suspendPartnerAction, updatePartnerTermsAction, updatePartnerVatIdAction, updatePartnerVatModeAction,
} from "../partners/actions";
import { setPartnerTierAction } from "../partners/tierActions";
import { VAT_MODES, type PartnerBankView, type VatModeValue } from "@/lib/crm/payoutRules";
import type { BankDetails } from "@/lib/partner/bank";
import { deriveVatMode } from "@/lib/partner/vat";
import { useToast } from "./Toast";

export type PartnerRow = {
  id: string; status: "PENDING" | "ACTIVE" | "SUSPENDED"; type: PartnerType; name: string; company: string | null; country: string; language: string;
  email: string; verified: boolean; registered: string; agreement: string | null;
  handoverShare: string; fixShare: string; trustMode: boolean; refCode: string | null; managerUserId: string | null; managerName: string | null;
  vatMode: VatModeValue; vatModeManual: boolean; vatId: string | null; bank: PartnerBankView;
  /** A Telegram chat is linked (never the chat id). */
  telegramLinked: boolean;
  /** Tier badge text ("Silver (default)" when no tier is set) and closed deals of the last 12 months. */
  tierLabel: string;
  /** The stored tier key (null = default tier). */
  tierKey: string | null;
  closedDeals12m: number;
};

export type TierOption = { key: string; name: string; handoverShare: number; fixShare: number };

const VAT_LABEL: Record<VatModeValue, string> = { NONE: "No VAT", CY_VAT: "CY VAT 19%", REVERSE_CHARGE: "Reverse charge" };
const vatModeText = (r: Pick<PartnerRow, "vatMode" | "vatModeManual">) =>
  `${VAT_LABEL[r.vatMode]} (${r.vatModeManual ? "set manually" : "automatic"})`;
type VatChoice = VatModeValue | "AUTO";

// Record<PartnerType, …>: a new enum value fails the type check until it gets a label.
const TYPE_LABEL: Record<PartnerType, string> = {
  REAL_ESTATE: "Real estate", PRIVATE_BROKER: "Private broker", BANK: "Bank", INVESTMENT: "Investment", FAMILY_OFFICE: "Family office",
  TOURISM: "Tourism", DESIGN: "Interior & design", LEGAL: "Legal", OTHER: "Other",
};

function TermsEditor({ row, managers }: { row: PartnerRow; managers: { id: string; name: string }[] }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [handover, setHandover] = useState(row.handoverShare);
  const [fix, setFix] = useState(row.fixShare);
  const [trust, setTrust] = useState(row.trustMode);
  const [manager, setManager] = useState(row.managerUserId ?? "");
  const save = () => start(async () => {
    const r = await updatePartnerTermsAction(row.id, { handoverShare: handover, fixShare: fix, trustMode: trust, managerUserId: manager || null });
    if ("error" in r) toast.show(r.error, "error"); else toast.show(r.notice ?? "Saved");
  });
  return (
    <fieldset disabled={pending} className="crm-pt-terms">
      <label><span>Handover share, %</span><input inputMode="decimal" value={handover} onChange={(e) => setHandover(e.target.value)} /></label>
      <label><span>Fix share, %</span><input inputMode="decimal" value={fix} onChange={(e) => setFix(e.target.value)} /></label>
      <label><span>Manager</span>
        <select value={manager} onChange={(e) => setManager(e.target.value)}>
          <option value="">None</option>
          {managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </label>
      <label className="crm-pt-check"><input type="checkbox" checked={trust} onChange={(e) => setTrust(e.target.checked)} /><span>Trust mode</span></label>
      <button type="button" className="crm-btn primary" onClick={save}>Save</button>
    </fieldset>
  );
}

/** Manual tier change: a tier sets exactly its shares (may lower them); "None" clears the tier and keeps the shares. */
function TierEditor({ row, tiers }: { row: PartnerRow; tiers: TierOption[] }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [choice, setChoice] = useState(row.tierKey ?? "");
  const picked = tiers.find((t) => t.key === choice) ?? null;
  const save = () => start(async () => {
    const r = await setPartnerTierAction(row.id, choice || null);
    if ("error" in r) toast.show(r.error, "error"); else toast.show(r.notice ?? "Saved");
  });
  return (
    <fieldset disabled={pending} className="crm-pt-terms">
      <label><span>Tier · now {row.tierLabel}</span>
        <select value={choice} onChange={(e) => setChoice(e.target.value)}>
          <option value="">None (default tier, shares unchanged)</option>
          {tiers.map((t) => <option key={t.key} value={t.key}>{t.name} (Handover {t.handoverShare}% · Fix {t.fixShare}%)</option>)}
        </select>
      </label>
      {picked && <span className="crm-muted">Sets the shares to exactly {picked.handoverShare}% / {picked.fixShare}% for new deals; an upgrade notifies the partner.</span>}
      <button type="button" className="crm-btn" onClick={save} disabled={choice === (row.tierKey ?? "")}>Set tier</button>
    </fieldset>
  );
}

function BankBadges({ bank }: { bank: PartnerBankView }) {
  return (
    <>
      {!bank.complete && <span className="crm-pill crm-pt-warn">{bank.state === "unreadable" ? "Bank details unreadable" : "Bank details incomplete"}</span>}
      {bank.pausedUntil && <span className="crm-pill crm-pt-warn">Payouts paused until {bank.pausedUntil}</span>}
    </>
  );
}

function BankPanel({ row, canReveal }: { row: PartnerRow; canReveal: boolean }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const initialVat: VatChoice = row.vatModeManual ? row.vatMode : "AUTO";
  const [vat, setVat] = useState<VatChoice>(initialVat);
  const [vatId, setVatId] = useState(row.vatId ?? "");
  // What "Automatic" resolves to now; lets the office re-apply it when the stored mode is stale.
  const autoMode = deriveVatMode({ country: row.country, vatId: row.vatId });
  // Full details live only in this component's state while shown; "Hide" drops them.
  const [revealed, setRevealed] = useState<BankDetails | null>(null);
  const b = row.bank;
  const saveVat = () => start(async () => {
    const r = await updatePartnerVatModeAction(row.id, vat);
    if ("error" in r) toast.show(r.error, "error"); else toast.show(r.notice ?? "Saved");
  });
  const saveVatId = () => start(async () => {
    const r = await updatePartnerVatIdAction(row.id, vatId);
    if ("error" in r) toast.show(r.error, "error"); else toast.show(r.notice ?? "Saved");
  });
  const reveal = () => start(async () => {
    const r = await revealBankDetailsAction(row.id);
    if ("error" in r) toast.show(r.error, "error"); else setRevealed(r.details);
  });
  const fields: [string, string | null][] = revealed
    ? [["Account holder", revealed.holder], ["IBAN", revealed.iban], ["BIC", revealed.bic], ["Billing name", revealed.billingName], ["Billing address", revealed.billingAddress], ["VAT ID", revealed.vatId]]
    : [["Account holder", b.holder], ["IBAN", b.ibanMasked], ["BIC", b.bic], ["Billing name", b.billingName], ["Billing address", b.billingAddress], ["VAT ID", b.vatId]];
  return (
    <section className="crm-pt-bank" aria-label={`Bank and billing details of ${row.name}`}>
      <div className="crm-pt-bankhead">
        <b>Bank &amp; billing</b>
        <BankBadges bank={b} />
      </div>
      {b.state === "none" ? (
        <p className="crm-muted">The partner has not entered bank details yet.</p>
      ) : b.state === "unreadable" ? (
        <p className="crm-warn">Stored bank details could not be decrypted.</p>
      ) : (
        <dl className="crm-pt-bankdl">
          {fields.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v ?? <span className="crm-muted">—</span>}</dd></div>)}
        </dl>
      )}
      <div className="crm-pt-bankactions">
        <fieldset disabled={pending} className="crm-pt-terms crm-pt-vat">
          <label><span>VAT number</span>
            <input value={vatId} onChange={(e) => setVatId(e.target.value)} maxLength={40} spellCheck={false} autoComplete="off" placeholder={`e.g. ${row.country === "GR" ? "EL" : row.country}123456789`} />
          </label>
          <button type="button" className="crm-btn" onClick={saveVatId} disabled={vatId.trim() === (row.vatId ?? "")}>Save VAT number</button>
        </fieldset>
        <fieldset disabled={pending} className="crm-pt-terms crm-pt-vat">
          <label><span>VAT on credit notes · now {vatModeText(row)}</span>
            <select value={vat} onChange={(e) => setVat(e.target.value as VatChoice)}>
              <option value="AUTO">Automatic: {VAT_LABEL[autoMode]} (from country and VAT number)</option>
              {VAT_MODES.map((m) => <option key={m} value={m}>{VAT_LABEL[m]} (set manually)</option>)}
            </select>
          </label>
          <button type="button" className="crm-btn" onClick={saveVat} disabled={vat === initialVat && !(vat === "AUTO" && autoMode !== row.vatMode)}>Save VAT mode</button>
        </fieldset>
        {canReveal && b.state === "ok" && (
          revealed
            ? <button type="button" className="crm-btn" onClick={() => setRevealed(null)}>Hide</button>
            : <button type="button" className="crm-btn quiet" disabled={pending} onClick={reveal} title="Shows the full IBAN once; the view is logged">Reveal</button>
        )}
      </div>
    </section>
  );
}

function Row({ row, managers, canReveal, tiers }: { row: PartnerRow; managers: { id: string; name: string }[]; canReveal: boolean; tiers: TierOption[] }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const run = (fn: (id: string) => Promise<{ ok: true; notice?: string } | { error: string }>) => {
    if (pending) return;
    start(async () => {
      const r = await fn(row.id);
      if ("error" in r) toast.show(r.error, "error"); else toast.show(r.notice ?? "Done");
    });
  };
  return (
    <li className="crm-panel crm-pt-row" aria-busy={pending}>
      <div className="crm-pt-main">
        <div className="crm-pt-who">
          <b>{row.name}</b>
          {row.company && <span>{row.company}</span>}
          <span>{TYPE_LABEL[row.type]} · {row.country} · {row.language.toUpperCase()}</span>
          <span>VAT no. {row.vatId ?? "none"}</span>
        </div>
        <div className="crm-pt-mail">
          <span>{row.email}</span>
          <span className={`crm-pill${row.verified ? " crm-pt-ok" : ""}`}>{row.verified ? "Verified" : "Not verified"}</span>
          {row.telegramLinked && <span className="crm-pill crm-pt-ok" title="Telegram linked">Telegram</span>}
        </div>
        <div className="crm-pt-meta">
          <span>Registered {row.registered}</span>
          <span>Agreement {row.agreement ?? "none"}</span>
        </div>
        {row.status !== "PENDING" && (
          <div className="crm-pt-meta">
            <span className="crm-pt-badges">
              <span className="crm-pill crm-pt-tier" title="Partner tier">{row.tierLabel}</span>
              <span className="crm-pill" title="Closed deals in the last 12 months">{row.closedDeals12m} closed / 12 mo</span>
            </span>
            <span>Handover {row.handoverShare}% · Fix {row.fixShare}%</span>
            <span>Trust: {row.trustMode ? "on" : "off"} · Manager: {row.managerName ?? "none"}</span>
            <span>Ref: {row.refCode ?? "none"} · VAT: {vatModeText(row)}</span>
            <span className="crm-pt-badges"><BankBadges bank={row.bank} /></span>
          </div>
        )}
        <div className="crm-pt-actions">
          {row.status === "PENDING" && <button type="button" className="crm-btn primary" disabled={pending || !row.verified} title={row.verified ? undefined : "Email not verified yet"} onClick={() => run(approvePartnerAction)}>Approve</button>}
          {row.status === "ACTIVE" && <button type="button" className="crm-btn danger" disabled={pending} onClick={() => run(suspendPartnerAction)}>Suspend</button>}
          {row.status === "SUSPENDED" && <button type="button" className="crm-btn primary" disabled={pending} onClick={() => run(reactivatePartnerAction)}>Reactivate</button>}
          <button type="button" className="crm-btn" aria-expanded={open} onClick={() => setOpen((o) => !o)}>{open ? "Hide details" : "Terms & bank"}</button>
        </div>
      </div>
      {/* Keyed on the stored terms: after a tier change (revalidated row) the share inputs start from the new values. */}
      {open && <TermsEditor key={`${row.handoverShare}|${row.fixShare}|${row.trustMode}|${row.managerUserId ?? ""}`} row={row} managers={managers} />}
      {open && row.status !== "PENDING" && tiers.length > 0 && <TierEditor key={row.tierKey ?? ""} row={row} tiers={tiers} />}
      {/* Keyed on the stored VAT state: after a save (revalidated row) the inputs start from the new values. */}
      {open && <BankPanel key={`${row.vatId ?? ""}|${row.vatMode}|${row.vatModeManual}`} row={row} canReveal={canReveal} />}
    </li>
  );
}

export function PartnersTable({ rows, managers, canReveal, tiers }: {
  rows: PartnerRow[]; managers: { id: string; name: string }[]; canReveal: boolean; tiers: TierOption[];
}) {
  const toast = useToast();
  if (rows.length === 0) return <p className="crm-pt-empty">No partners here.</p>;
  return (
    <>
      <ul className="crm-pt">{rows.map((r) => <Row key={r.id} row={r} managers={managers} canReveal={canReveal} tiers={tiers} />)}</ul>
      {toast.node}
    </>
  );
}
