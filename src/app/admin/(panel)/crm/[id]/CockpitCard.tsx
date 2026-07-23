import Link from "next/link";
import { StatusBadge } from "@/app/admin/status-badge";

// The Lead Cockpit's hero card (Phase 1 of 4, 2026-07-23) — a single glance-able
// summary that replaces the old bare name+badge header. Everything below this
// card (presentations, matching, the detail <dl>) is unchanged in function.

const LOCALE_LABEL: Record<string, string> = { en: "EN", de: "DE", pl: "PL", ru: "RU" };

const CHANNEL_LABEL: Record<string, string> = { EMAIL: "Email", WHATSAPP: "WhatsApp", PHONE: "Phone" };

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

export default function CockpitCard({
  lead,
  users,
  lastContact,
  presentationSummary,
  assignAction,
  saveFollowUpAction,
}: {
  lead: {
    id: string;
    firstName: string;
    lastName: string;
    status: string;
    languagePreference: string | null;
    source: string;
    phone: string | null;
    email: string;
    preferredChannel: string | null;
    nextFollowUpAt: Date | null;
    assignedTo: { id: string; name: string } | null;
  };
  users: { id: string; name: string }[];
  lastContact: LastContact;
  presentationSummary: PresentationSummary;
  assignAction: (formData: FormData) => void;
  saveFollowUpAction: (formData: FormData) => void;
}) {
  const waNumber = lead.phone?.replace(/[^\d+]/g, "");

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
          <span className="text-xs text-[#6B7280]">{lead.source.replace(/_/g, " ")}</span>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/admin/crm/${lead.id}/edit`} className="text-sm text-[#1B4B43] hover:underline">Edit details</Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 text-sm">
        {lead.phone && <a href={`tel:${lead.phone}`} className="text-[#1B4B43] hover:underline">{lead.phone}</a>}
        <a href={`mailto:${lead.email}`} className="text-[#1B4B43] hover:underline">{lead.email}</a>
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
        </div>
      </div>

      <div className="flex flex-wrap sm:flex-nowrap gap-2 mt-4">
        <a
          href={`mailto:${lead.email}`}
          className="flex-1 sm:flex-none text-center rounded-md border border-[#1B4B43] text-[#1B4B43] text-sm px-4 py-2 hover:bg-[#1B4B43]/5"
        >
          Email
        </a>
        {waNumber && (
          <a
            href={`https://wa.me/${waNumber.replace(/^\+/, "")}`}
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
    </div>
  );
}
