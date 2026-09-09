import Link from "next/link";
import { formatWaPhone } from "@/lib/crm/waFormat";
import GenerateReplyButton from "./GenerateReplyButton";
import BookingButton from "./BookingButton";
import StatusPopover from "../StatusPopover";
import { adminDateTime } from "@/lib/adminTime";
import { leadBudgetLabel, leadTimelineLabel, leadFinancingLabel } from "@/app/components/qualifierFields";
import { ActionIcon } from "../ActionIcons";
import QualificationEditor from "./QualificationEditor";
import { COUNTRY_NAME_BY_CODE, countryCodeToFlagEmoji } from "@/lib/countries";

// The Lead Cockpit's hero card (Phase 1 of 4, 2026-07-23; consolidated in the
// correction batch, 2026-07-23) — a single glance-able summary that now
// absorbs everything the old page.tsx's separate "Lead details" <dl> and
// "Status" box used to show. Email/Phone/Assigned-to are shown once, as the
// contact row / assignee cluster below — not repeated in the detail groups.

const LOCALE_LABEL: Record<string, string> = { en: "EN", de: "DE", pl: "PL", ru: "RU" };

const CHANNEL_LABEL: Record<string, string> = { EMAIL: "Email", WHATSAPP: "WhatsApp", PHONE: "Phone" };

/* The preferred channel gets its own colour, so the one fact that decides HOW
   you contact someone is readable at a glance instead of being a grey pill
   among grey pills.
   Light tints rather than the brand colours themselves: WhatsApp's #25D366
   carries white text at 1.98:1 and is unreadable. These measure 6.5 / 6.4 /
   5.5:1.
   Each also carries its channel icon — the status pill beside it can be
   yellow (Contacted) or blue (Communicating) too, so hue alone would not tell
   the two pills apart. */
const CHANNEL_STYLE: Record<string, { pill: string; icon: string }> = {
  WHATSAPP: { pill: "bg-[#DCFCE7] text-[#166534]", icon: "whatsapp" },
  EMAIL: { pill: "bg-[#FEF3C7] text-[#92400E]", icon: "email" },
  PHONE: { pill: "bg-[#DBEAFE] text-[#1D4ED8]", icon: "phone" },
};

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

/* Same shape as the secondary buttons on the leads list, so the two screens
   speak one language: quiet by default, filling in on hover, with a visible
   keyboard focus ring. */
const ACTION_BTN =
  "inline-flex items-center justify-center gap-1.5 rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-medium text-[#1B4B43] transition-colors " +
  "hover:bg-[#F3F6F5] hover:border-[#1B4B43] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1B4B43] focus-visible:ring-offset-2";
const ACTION_BTN_OFF =
  "inline-flex items-center justify-center gap-1.5 rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-medium text-[#9CA3AF] cursor-not-allowed";

const groupGrid = "grid sm:grid-cols-2 lg:grid-cols-3 gap-x-4";

/* Free text does not belong in a third of a row. A note runs to a paragraph or
   more, and in a narrow column it becomes a ribbon twenty words tall that
   pushes everything else off the screen. These span the whole grid and come
   last, after the short facts someone actually scans for. Long ones fold, so
   the block below them stays reachable without a page of scrolling. */
const FOLD_AT = 320;
const wideField = (label: string, value: any) => {
  if (!value) return null;
  const text = String(value);
  return (
    <div className="py-1 sm:col-span-2 lg:col-span-3">
      <dt className="text-xs text-[#6B7280]">{label}</dt>
      {text.length > FOLD_AT ? (
        <dd className="text-sm mt-0.5">
          <details className="group">
            <summary className="cursor-pointer list-none">
              <span className="block whitespace-pre-wrap break-words group-open:hidden">{text.slice(0, FOLD_AT).trimEnd()}…</span>
              <span className="mt-1 inline-block text-xs text-[#1B4B43] group-open:hidden">Show all</span>
              <span className="hidden text-xs text-[#1B4B43] group-open:inline">Show less</span>
            </summary>
            <span className="mt-1 block whitespace-pre-wrap break-words">{text}</span>
          </details>
        </dd>
      ) : (
        <dd className="text-sm mt-0.5 whitespace-pre-wrap break-words">{text}</dd>
      )}
    </div>
  );
};

export default function CockpitCard({
  lead,
  stageDays,
  users,
  lastContact,
  presentationSummary,
  assignAction,
  saveFollowUpAction,
  saveQualificationAction,
  resetFollowUpAction,
  contactImplyingStatuses,
}: {
  stageDays: number;
  lead: {
    id: string;
    firstName: string;
    lastName: string;
    status: string;
    languagePreference: string | null;
    nationality: string | null;
    countryOfResidence: string | null;
    source: string;
    phone: string | null;
    email: string | null;
    preferredChannel: string | null;
    nextFollowUpAt: Date | null;
    autoFollowUpCount: number;
    assignedTo: { id: string; name: string } | null;
    viewingScheduledAt: Date | null;
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
  /* Promise-typed, unlike its neighbours: QualificationEditor awaits it so it
     can close the editor only once the write has actually landed. */
  saveQualificationAction: (formData: FormData) => Promise<void>;
  resetFollowUpAction: (formData: FormData) => void;
  contactImplyingStatuses: readonly string[];
}) {
  return (
    <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold">{lead.firstName} {lead.lastName}</h1>
          <StatusPopover
            leadId={lead.id}
            currentStatus={lead.status}
            viewingScheduledAt={lead.viewingScheduledAt ? lead.viewingScheduledAt.toISOString() : null}
            hasEmail={!!lead.email}
            hasPhone={!!lead.phone}
            contactImplyingStatuses={contactImplyingStatuses}
          />
          {lead.languagePreference && (
            <span className="inline-flex items-center rounded-full border border-[#E5E7EB] px-2 py-0.5 text-xs font-medium text-[#374151]">
              {LOCALE_LABEL[lead.languagePreference] ?? lead.languagePreference.toUpperCase()}
            </span>
          )}
          {(lead.countryOfResidence || lead.nationality) && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E7EB] px-2 py-0.5 text-xs font-medium text-[#374151]"
              title={lead.countryOfResidence ? COUNTRY_NAME_BY_CODE[lead.countryOfResidence] ?? lead.countryOfResidence : undefined}
            >
              {lead.countryOfResidence && <span className="text-sm leading-none">{countryCodeToFlagEmoji(lead.countryOfResidence)}</span>}
              {lead.nationality ?? (lead.countryOfResidence ? COUNTRY_NAME_BY_CODE[lead.countryOfResidence] : null)}
            </span>
          )}
          {/* "0d" on its own said nothing. It is days in the current status, which
              is not the same as the lead's age — so it says which. */}
          <span className="text-xs text-[#9CA3AF]" title={`In ${lead.status.replace(/_/g, " ")} for ${stageDays} day${stageDays === 1 ? "" : "s"}`}>
            In status: {stageDays}d
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/admin/crm/${lead.id}/edit`} className="text-sm text-[#1B4B43] hover:underline">Edit details</Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 text-sm">
        {lead.phone && <a href={`tel:${lead.phone}`} className="text-[#1B4B43] hover:underline">{lead.phone}</a>}
        {lead.email && <a href={`mailto:${lead.email}`} className="text-[#1B4B43] hover:underline">{lead.email}</a>}
        {lead.preferredChannel && (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
              CHANNEL_STYLE[lead.preferredChannel]?.pill ?? "bg-[#F3F4F6] text-[#374151]"
            }`}
          >
            {CHANNEL_STYLE[lead.preferredChannel] && (
              <ActionIcon k={CHANNEL_STYLE[lead.preferredChannel].icon} size={12} />
            )}
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
          <div className="text-xs font-medium text-[#6B7280]">Last contact</div>
          <div className="text-sm mt-0.5">
            {lastContact
              ? `${timeAgo(lastContact.occurredAt)}${lastContact.direction ? ` · ${DIRECTION_LABEL[lastContact.direction] ?? lastContact.direction}` : ""}${lastContact.channel && lastContact.channel !== "SYSTEM" ? ` · ${CHANNEL_LABEL[lastContact.channel] ?? lastContact.channel}` : ""}`
              : "No contact recorded yet"}
          </div>
        </div>
        <div className="rounded-md bg-[#F8F9FA] p-3">
          <div className="text-xs font-medium text-[#6B7280]">Presentation</div>
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
          <div className="text-xs font-medium text-[#6B7280]">Next follow-up</div>
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
            <span className="text-xs font-medium text-[#6B7280]">Auto follow-up {lead.autoFollowUpCount}/{MAX_AUTO_FOLLOWUPS}</span>
            <form action={resetFollowUpAction}>
              <button className="text-[11px] text-[#1B4B43] hover:underline" title="Start a fresh chain of 3 automatic follow-ups">Reset</button>
            </form>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap sm:flex-nowrap gap-2 mt-4">
        {lead.email ? (
          <a
            href={`mailto:${lead.email}`}
            className={`flex-1 sm:flex-none ${ACTION_BTN}`}
          >
            <ActionIcon k="email" />
            Email
          </a>
        ) : (
          <span
            className={`flex-1 sm:flex-none ${ACTION_BTN_OFF}`}
            title="No email on file for this lead"
          >
            <ActionIcon k="email" />
            Email
          </span>
        )}
        {lead.phone && (
          <a
            href={`https://wa.me/${formatWaPhone(lead.phone)}`}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex-1 sm:flex-none ${ACTION_BTN}`}
          >
            <ActionIcon k="whatsapp" />
            WhatsApp
          </a>
        )}
        <GenerateReplyButton
          leadId={lead.id}
          leadEmail={lead.email}
          hasPhone={!!lead.phone}
          preferredChannel={lead.preferredChannel}
        />
        <BookingButton leadId={lead.id} />
      </div>

      {/* Absorbed detail groups — was page.tsx's standalone "Lead details" <dl>.
          Each group is its own responsive grid (walkthrough-2 feedback: was a
          long single-column list, now 2-3 columns depending on width). */}
      <dl className="mt-5 pt-4 border-t border-[#E5E7EB]">
        {groupLabel("Qualification")}
        <div className={groupGrid}>
          {/* The four fields that move during a conversation are editable in
              place; the rest of the block stays read-only. */}
          <QualificationEditor
            leadId={lead.id}
            budgetMin={lead.budgetMin}
            budgetMax={lead.budgetMax}
            timeline={lead.timeline}
            financing={lead.financing}
            propertyTypeInterest={lead.propertyTypeInterest ?? []}
            saveAction={saveQualificationAction}
          />
          {field("Project interest", lead.projectInterestTitle)}
          {wideField("Message", lead.message)}
          {wideField("Internal note (intake)", lead.notes)}
        </div>

        {groupLabel("Acquisition")}
        <div className={groupGrid}>
          {field("Source", lead.source.replace(/_/g, " "))}
          {urlField("Page", lead.pageSource)}
          {field("UTM", lead.utm)}
          {field("Click ID", lead.clickId)}
          {hostLinkField("Referrer", lead.referrer)}
          {field("Received", adminDateTime(lead.createdAt))}
          {field("Notified", `Telegram: ${lead.telegramNotified ? "✓" : "—"}  ·  Email: ${lead.emailNotified ? "✓" : "—"}`)}
        </div>
      </dl>
    </div>
  );
}
