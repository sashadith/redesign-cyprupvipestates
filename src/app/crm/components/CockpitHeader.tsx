import Link from "next/link";
import { STATUS_LABEL, LOST_REASON_LABEL, isLeadStatus, type LostReasonValue } from "@/lib/crm/leadStatus";
import { SOURCE_LABEL } from "@/lib/crm/boardModel";
import { ago } from "@/lib/crm/timeline";
import { adminDateTime } from "@/lib/adminTime";
import { TemperatureChip } from "./TemperatureDot";
import type { PublicTemperature } from "@/lib/crm/insights/temperatureWiring";
import { safeMailto, waDigits } from "@/lib/crm/contactLinks";

// Lead cockpit header and contact panel (CRM v2, 2026-10-18). Server-rendered.
// Everything the lead typed (name, message, contact details) is rendered as
// text; React escapes it.

export type CockpitLead = {
  id: string; name: string; email: string | null; phone: string | null; nationality: string | null; countryOfResidence: string | null;
  lang: string | null; budgetMin: number | null; budgetMax: number | null; timeline: string | null; financing: string | null;
  propertyTypes: string[]; message: string | null; notes: string | null; status: string; lostReason: string | null; source: string;
  ownerName: string | null; project: string | null; createdAt: Date;
  attribution: { label: string; value: string }[];
};

const eur = (n: number) => "€" + n.toLocaleString("en-US");
const TIMELINE_LABEL: Record<string, string> = {
  IMMEDIATE: "Immediately", THREE_MONTHS: "Within 3 months", SIX_MONTHS: "Within 6 months", ONE_YEAR: "Within a year",
  TWO_YEARS: "Within 2 years", JUST_LOOKING: "Just looking",
};
const FINANCING_LABEL: Record<string, string> = { CASH: "Cash", MORTGAGE: "Mortgage", UNDECIDED: "Undecided" };

function budget(min: number | null, max: number | null): string | null {
  if (min != null && max != null) return min === max ? eur(max) : `${eur(min)} – ${eur(max)}`;
  if (max != null) return `up to ${eur(max)}`;
  if (min != null) return `from ${eur(min)}`;
  return null;
}

export function CockpitHeader({ lead, now, temperature = null, actions = null }: { lead: CockpitLead; now: Date; temperature?: PublicTemperature | null; actions?: React.ReactNode }) {
  const statusLabel = isLeadStatus(lead.status) ? STATUS_LABEL[lead.status] : lead.status;
  const reason = lead.status === "LOST" && lead.lostReason ? LOST_REASON_LABEL[lead.lostReason as LostReasonValue] ?? lead.lostReason : null;
  return (
    <header className="crm-ck-head">
      <Link className="crm-ck-back" href="/crm/pipeline">← Pipeline</Link>
      <div className="crm-ck-title">
        <h1>{lead.name}</h1>
        {lead.lang && <span className="crm-ck-lang" title="Language">{lead.lang}</span>}
        {actions && <div className="crm-ck-actions">{actions}</div>}
      </div>
      <div className="crm-ck-chips">
        {temperature && <TemperatureChip temperature={temperature} />}
        <span className={`crm-ck-status s-${lead.status}`}><span className="dot" />{statusLabel}{reason && <span className="crm-muted"> · {reason}</span>}</span>
        <span className={`crm-ck-src${lead.source === "PARTNER" ? " partner" : ""}`}>{SOURCE_LABEL[lead.source] ?? lead.source}</span>
        <span className="crm-muted">{lead.ownerName ? <>Owner <b className="crm-ck-owner">{lead.ownerName}</b></> : "Unassigned"}</span>
        <span className="crm-muted">created <time dateTime={lead.createdAt.toISOString()} title={adminDateTime(lead.createdAt)}>{ago(lead.createdAt, now)}</time></span>
      </div>
    </header>
  );
}

export function CockpitContact({ lead }: { lead: CockpitLead }) {
  const wa = waDigits(lead.phone);
  const mailto = safeMailto(lead.email);
  const tel = lead.phone ? lead.phone.replace(/[^\d+]/g, "") : "";
  const facts: [string, string | null][] = [
    ["Interested in", lead.project],
    ["Budget", budget(lead.budgetMin, lead.budgetMax)],
    ["Timeline", lead.timeline ? TIMELINE_LABEL[lead.timeline] ?? lead.timeline : null],
    ["Financing", lead.financing ? FINANCING_LABEL[lead.financing] ?? lead.financing : null],
    ["Property types", lead.propertyTypes.length ? lead.propertyTypes.join(", ") : null],
    ["Nationality", lead.nationality],
    ["Lives in", lead.countryOfResidence],
  ];
  const shown = facts.filter(([, v]) => v);
  return (
    <section className="crm-panel crm-ck-contact" aria-labelledby="crm-ck-contact-h">
      <h2 id="crm-ck-contact-h">Contact</h2>
      <dl className="crm-ck-facts">
        {lead.phone && (
          <div>
            <dt>Phone</dt>
            <dd>
              <span className="crm-ck-copy">{lead.phone}</span>
              <span className="crm-ck-links">
                {tel && <a href={`tel:${tel}`}>Call</a>}
                {wa && <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>}
              </span>
            </dd>
          </div>
        )}
        {lead.email && (
          <div>
            <dt>Email</dt>
            <dd>
              <span className="crm-ck-copy">{lead.email}</span>
              {mailto && <span className="crm-ck-links"><a href={mailto}>Write</a></span>}
            </dd>
          </div>
        )}
        {!lead.phone && !lead.email && <div><dt>Contact</dt><dd className="crm-muted">No phone or email on file</dd></div>}
        {shown.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
      </dl>
      {lead.message && (
        <figure className="crm-ck-msg">
          <figcaption>Enquiry</figcaption>
          <blockquote>{lead.message}</blockquote>
        </figure>
      )}
      {lead.notes && (
        <figure className="crm-ck-msg">
          <figcaption>Notes</figcaption>
          <blockquote>{lead.notes}</blockquote>
        </figure>
      )}
      {lead.attribution.length > 0 && (
        <details className="crm-ck-attr">
          <summary>Attribution</summary>
          <dl className="crm-ck-facts">
            {lead.attribution.map((a) => <div key={a.label}><dt>{a.label}</dt><dd className="crm-ck-copy">{a.value}</dd></div>)}
          </dl>
        </details>
      )}
    </section>
  );
}
