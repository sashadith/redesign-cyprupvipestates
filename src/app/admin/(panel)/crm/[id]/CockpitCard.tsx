import Link from "next/link";
import { StatusBadge } from "@/app/admin/status-badge";
import { formatWaPhone } from "@/lib/crm/waFormat";

// The Lead Cockpit's hero card (Phase 1 of 4, 2026-07-23; consolidated in the
// correction batch, 2026-07-23) — a single glance-able summary that now
// absorbs everything the old page.tsx's separate "Lead details" <dl> and
// "Status" box used to show. Email/Phone/Assigned-to are shown once, as the
// contact row / assignee cluster below — not repeated in the detail groups.

const LOCALE_LABEL: Record<string, string> = { en: "EN", de: "DE", pl: "PL", ru: "RU" };

const CHANNEL_LABEL: Record<string, string> = { EMAIL: "Email", WHATSAPP: "WhatsApp", PHONE: "Phone" };

const STATUSES = ["NEW", "QUALIFIED", "CONTACTED", "VIEWING_SCHEDULED", "OFFER", "CLOSED", "LOST"];
const MAX_AUTO_FOLLOWUPS = 3;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

function timeAgo(date: Date): string {
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

const DIRECTION_LABEL: Record<string, string> = { INBOUND: "inbound", OUTBOUND: "outbound" };

export type LastContact = { occurredAt: Date; direction: string | null; channel: string | null } | null;

export type PresentationSummary = {
  sentAt: Date;
  viewCount: number;
  favoritedCount: number;
  lastViewedAt: Date | null;
} | null;

// Same "only render if there's a value" helper page.tsx's old <dl> used —
// moved here since the detail groups now live in this component. No
// per-row divider (walkthrough-2 feedback: these now sit in a grid, not a
// single-column list, so a border-b would only underline individual cells
// rather than a full "row").
const field = (label: string, value: any) =>
  value ? (
    <div className="py-1">
      <dt className="text-xs text-[#6B7280]">{label}</dt>
      <dd className="text-sm mt-0.5 break-words">{Array.isArray(value) ? value.join(", ") : String(value)}</dd>
    </div>
  ) : null;

// pageSource/referrer are populated from the public lead-intake form/API —
// effectively attacker-controlled input, not something the browser is
// guaranteed to have set safely (a direct POST to /api/leads can put
// anything in these fields). Only ever render as a clickable link when the
// value parses as a real http(s) URL; a `javascript:`/other-scheme value
// (or plain garbage) is shown as inert text instead, closing off stored-XSS
// via an admin clicking the link.
function safeHttpUrl(value: string): string | null {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

// "Page" (the visited page URL) gets a compact "Open ↗" link — the full URL
// is usually long/uninformative as text (typically already the site itself),
// so a button-style action reads better than the raw path.
const urlField = (label: string, url: string | null) => {
  if (!url) return null;
  const safe = safeHttpUrl(url);
  return (
    <div className="py-1">
      <dt className="text-xs text-[#6B7280]">{label}</dt>
      <dd className="text-sm mt-0.5">
        {safe ? (
          <a
            href={safe}
            target="_blank"
            rel="noopener noreferrer"
            title={safe}
            className="inline-flex items-center gap-1 text-[#1B4B43] hover:underline"
          >
            Open <span aria-hidden>↗</span>
          </a>
        ) : (
          <span className="break-words text-[#6B7280]" title={url}>{url}</span>
        )}
      </dd>
    </div>
  );
};

// "Referrer" instead shows the hostname as clickable text (e.g. "www.google.com")
// — the domain itself is the useful signal here, unlike Page's own URL. Same
// safeHttpUrl gate as urlField: a non-http(s) value never becomes a link.
const hostLinkField = (label: string, url: string | null) => {
  if (!url) return null;
  const safe = safeHttpUrl(url);
  if (!safe) {
    return (
      <div className="py-1">
        <dt className="text-xs text-[#6B7280]">{label}</dt>
        <dd className="text-sm mt-0.5 break-words text-[#6B7280]" title={url}>{url}</dd>
      </div>
    );
  }
  const hostname = new URL(safe).hostname;
  return (
    <div className="py-1">
      <dt className="text-xs text-[#6B7280]">{label}</dt>
      <dd className="text-sm mt-0.5">
        <a href={safe} target="_blank" rel="noopener noreferrer" title={safe} className="text-[#1B4B43] hover:underline break-words">
          {hostname}
        </a>
      </dd>
    </div>
  );
};

const groupLabel = (text: string) => (
  <h3 className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide mt-4 mb-1 first:mt-0">{text}</h3>
);

const groupGrid = "grid sm:grid-cols-2 lg:grid-cols-3 gap-x-4";

export default function CockpitCard({
  lead,
  users,
  lastContact,
  presentationSummary,
  assignAction,
  saveFollowUpAction,
  resetFollowUpAction,
  setStatusAction,
}: {
  lead: {
    id: string;
    firstName: string;
    lastName: string;
    status: string;
    languagePreference: string | null;
    nationality: string | null;
    source: string;
    phone: string | null;
    email: string;
    preferredChannel: string | null;
    nextFollowUpAt: Date | null;
    autoFollowUpCount: number;
    assignedTo: { id: string; name: string } | null;
    // Absorbed from the old "Lead details" block:
    budgetMin: number | null;
    budgetMax: number | null;
    timeline: string | null;
    financing: string | null;
    propertyTypeInterest: string[];
    projectInterestTitle: string | null;
    message: string | null;
    notes: string | null;
    pageSource: string | null;
    utm: string;
    clickId: string;
    referrer: string | null;
    createdAt: Date;
    telegramNotified: boolean;
    emailNotified: boolean;
  };
  users: { id: string; name: string }[];
  lastContact: LastContact;
  presentationSummary: PresentationSummary;
  assignAction: (formData: FormData) => void;
  saveFollowUpAction: (formData: FormData) => void;
  resetFollowUpAction: (formData: FormData) => void;
  setStatusAction: (formData: FormData) => void;
}) {
  return (
    <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold">{lead.firstName} {lead.lastName}</h1>
          <StatusBadge status={lead.status} />
          {lead.languagePreference && (
            <span className="inline-flex items-center rounded-full border border-[#E5E7EB] px-2 py-0.5 text-xs font-medium text-[#374151]">
              {LOCALE_LABEL[lead.languagePreference] ?? lead.languagePreference.toUpperCase()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/admin/crm/${lead.id}/edit`} className="text-sm text-[#1B4B43] hover:underline">Edit details</Link>
        </div>
      </div>

      {/* Status — prominent and editable right in the header, replacing the
          old standalone "Status" box further down the page. */}
      <form action={setStatusAction} className="flex flex-wrap items-center gap-2 mt-2">
        <select name="status" defaultValue={lead.status} className="rounded-md border border-[#E5E7EB] px-2 py-1 text-sm">
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
        </select>
        <input name="reason" placeholder="Reason / note (optional)" className="rounded-md border border-[#E5E7EB] px-2 py-1 text-sm flex-1 min-w-[160px]" />
        <button className="rounded-md bg-[#1B4B43] text-white text-xs px-3 py-1.5 hover:bg-[#142E2D]">Save status</button>
      </form>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 text-sm">
        {lead.phone && <a href={`tel:${lead.phone}`} className="text-[#1B4B43] hover:underline">{lead.phone}</a>}
        <a href={`mailto:${lead.email}`} className="text-[#1B4B43] hover:underline">{lead.email}</a>
        {lead.nationality && <span className="text-xs text-[#6B7280]">{lead.nationality}</span>}
        {lead.preferredChannel && (
          <span className="inline-flex items-center rounded-full bg-[#F3F4F6] px-2 py-0.5 text-xs font-medium text-[#374151]">
            Prefers {CHANNEL_LABEL[lead.preferredChannel] ?? lead.preferredChannel}
          </span>
        )}
        <span className="ml-auto flex items-center gap-2 text-xs text-[#6B7280]">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1B4B43] text-[10px] font-semibold text-white" title={lead.assignedTo?.name ?? "Unassigned"}>
            {lead.assignedTo ? initials(lead.assignedTo.name) : "—"}
          </span>
          <form action={assignAction} className="flex items-center gap-1">
            <select
              name="assignedToId"
              defaultValue={lead.assignedTo?.id ?? ""}
              className="rounded-md border border-[#E5E7EB] px-1.5 py-1 text-xs"
            >
              <option value="">Unassigned</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <button className="rounded-md border border-[#E5E7EB] px-1.5 py-1 text-xs hover:bg-[#F8F9FA]">Save</button>
          </form>
        </span>
      </div>

      <div className="grid sm:grid-cols-3 gap-3 mt-4">
        <div className="rounded-md bg-[#F8F9FA] p-3">
          <div className="text-[11px] text-[#9CA3AF]">Last contact</div>
          <div className="text-sm mt-0.5">
            {lastContact
              ? `${timeAgo(lastContact.occurredAt)}${lastContact.direction ? ` · ${DIRECTION_LABEL[lastContact.direction] ?? lastContact.direction}` : ""}${lastContact.channel && lastContact.channel !== "SYSTEM" ? ` · ${CHANNEL_LABEL[lastContact.channel] ?? lastContact.channel}` : ""}`
              : "No contact recorded yet"}
          </div>
        </div>
        <div className="rounded-md bg-[#F8F9FA] p-3">
          <div className="text-[11px] text-[#9CA3AF]">Presentation</div>
          <div className="text-sm mt-0.5">
            {presentationSummary ? (
              <>
                sent {timeAgo(presentationSummary.sentAt)}
                {" · "}
                <span className="text-[#C29A5E] font-medium">{presentationSummary.viewCount}</span> view{presentationSummary.viewCount === 1 ? "" : "s"}
                {" · "}
                <span className="text-[#C29A5E] font-medium">{presentationSummary.favoritedCount}</span> favorite{presentationSummary.favoritedCount === 1 ? "" : "s"}
                {presentationSummary.lastViewedAt && <><br />last opened {timeAgo(presentationSummary.lastViewedAt)}</>}
              </>
            ) : (
              "Not sent yet"
            )}
          </div>
        </div>
        <div className="rounded-md bg-[#F8F9FA] p-3">
          <div className="text-[11px] text-[#9CA3AF]">Next follow-up</div>
          <form action={saveFollowUpAction} className="flex items-center gap-1 mt-0.5">
            <input
              type="date"
              name="nextFollowUpAt"
              defaultValue={lead.nextFollowUpAt ? lead.nextFollowUpAt.toISOString().slice(0, 10) : ""}
              className="rounded-md border border-[#E5E7EB] px-1.5 py-1 text-sm flex-1 min-w-0"
            />
            <button className="rounded-md border border-[#E5E7EB] px-1.5 py-1 text-xs hover:bg-white">Save</button>
          </form>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[11px] text-[#9CA3AF]">Auto follow-up {lead.autoFollowUpCount}/{MAX_AUTO_FOLLOWUPS}</span>
            <form action={resetFollowUpAction}>
              <button className="text-[11px] text-[#1B4B43] hover:underline" title="Start a fresh chain of 3 automatic follow-ups">Reset</button>
            </form>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap sm:flex-nowrap gap-2 mt-4">
        <a
          href={`mailto:${lead.email}`}
          className="flex-1 sm:flex-none text-center rounded-md border border-[#1B4B43] text-[#1B4B43] text-sm px-4 py-2 hover:bg-[#1B4B43]/5"
        >
          Email
        </a>
        {lead.phone && (
          <a
            href={`https://wa.me/${formatWaPhone(lead.phone)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 sm:flex-none text-center rounded-md border border-[#1B4B43] text-[#1B4B43] text-sm px-4 py-2 hover:bg-[#1B4B43]/5"
          >
            WhatsApp
          </a>
        )}
        <button
          type="button"
          disabled
          title="Coming in Phase 2"
          className="flex-1 sm:flex-none rounded-md border border-[#E5E7EB] text-[#9CA3AF] text-sm px-4 py-2 cursor-not-allowed"
        >
          Generate reply
        </button>
      </div>

      {/* Absorbed detail groups — was page.tsx's standalone "Lead details" <dl>.
          Each group is its own responsive grid (walkthrough-2 feedback: was a
          long single-column list, now 2-3 columns depending on width). */}
      <dl className="mt-5 pt-4 border-t border-[#E5E7EB]">
        {groupLabel("Qualification")}
        <div className={groupGrid}>
          {field("Budget", lead.budgetMin || lead.budgetMax ? `€${lead.budgetMin ?? "?"} – €${lead.budgetMax ?? "?"}` : null)}
          {field("Timeline", lead.timeline)}
          {field("Financing", lead.financing)}
          {field("Property interest", lead.propertyTypeInterest)}
          {field("Internal note (intake)", lead.notes)}
          {field("Project interest", lead.projectInterestTitle)}
          {field("Message", lead.message)}
        </div>

        {groupLabel("Acquisition")}
        <div className={groupGrid}>
          {field("Source", lead.source.replace(/_/g, " "))}
          {urlField("Page", lead.pageSource)}
          {field("UTM", lead.utm)}
          {field("Click ID", lead.clickId)}
          {hostLinkField("Referrer", lead.referrer)}
          {field("Received", new Date(lead.createdAt).toLocaleString("en-GB"))}
          {field("Notified", `Telegram: ${lead.telegramNotified ? "✓" : "—"}  ·  Email: ${lead.emailNotified ? "✓" : "—"}`)}
        </div>
      </dl>
    </div>
  );
}
