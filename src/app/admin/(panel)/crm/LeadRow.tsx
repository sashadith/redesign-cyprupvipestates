"use client";

import { useState } from "react";
import Link from "next/link";
import { StatusBadge } from "@/app/admin/status-badge";
import { COUNTRY_NAME_BY_CODE, countryCodeToFlagEmoji } from "@/lib/countries";
import DeleteLeadButton from "./DeleteLeadButton";
import StatusChangeForm from "./StatusChangeForm";
import { toggleLeadHotAction, updateLeadStatusFromForm } from "../../actions";
import { BAND_STYLE, LAST_CONTACT_LABEL, money, type ColorBand, type LeadRowData } from "./leadListShared";

// 2026-08-11 — the client boundary for the lead-list table (page.tsx stays a
// server component). Two pieces of local state live here: the Hot flame is
// a one-click form (no state needed, see toggleLeadHotAction), and the
// status cell can expand a second <tr> below it holding the full
// StatusChangeForm — the SAME component the detail page uses, not a
// cut-down copy, so a status change from the table can never skip the
// viewing-date field or the contact-capture row that COMMUNICATING/
// VIEWING_SCHEDULED/OFFER require there (point 3 of the 2026-08-11 spec:
// "sonst hätte ich zwei Wege... von denen einer die Wahrheit nicht
// erfasst"). Collapsed by default — showing every row's full form at once
// was the "too cramped" failure mode being avoided, not horizontal width.
export default function LeadRow({
  lead: l, band, muted, contactImplyingStatuses,
}: {
  lead: LeadRowData;
  band: { band: ColorBand; reason: string } | null;
  muted?: boolean;
  contactImplyingStatuses: readonly string[];
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr className={`hover:bg-[#F8F9FA] ${muted ? "bg-[#FAFAFA] text-[#9CA3AF]" : ""}`}>
        <td className={`pl-3 pr-4 py-2.5 border-l-4 ${band ? BAND_STYLE[band.band].border : "border-l-transparent"}`}>
          <div className="flex items-center gap-2">
            {band && (
              <span className={`w-2 h-2 rounded-full shrink-0 ${BAND_STYLE[band.band].dot}`} title={band.reason} aria-label={band.reason} role="img" />
            )}
            <Link href={`/admin/crm/${l.id}`} className={`font-medium hover:underline ${muted ? "" : "text-[#1B4B43]"}`}>{l.firstName} {l.lastName}</Link>
          </div>
        </td>
        <td className="px-4 py-2.5 text-center" title={l.hotAt ? `Hot since ${new Date(l.hotAt).toLocaleDateString("en-GB")} — click to un-hot` : "Mark as hot"}>
          <form action={toggleLeadHotAction} className="inline">
            <input type="hidden" name="id" value={l.id} />
            <button type="submit" className="text-base leading-none hover:opacity-70">
              {l.hotAt ? "🔥" : <span className="text-[#D1D5DB]">◦</span>}
            </button>
          </form>
        </td>
        <td className={`px-4 py-2.5 ${muted ? "" : "text-[#6B7280]"}`}>
          {l.interactions[0] ? (
            <>
              {new Date(l.interactions[0].occurredAt).toLocaleDateString("en-GB")}
              <br />
              <span className="text-xs text-[#9CA3AF]">{LAST_CONTACT_LABEL[l.interactions[0].type]}</span>
            </>
          ) : (
            "—"
          )}
        </td>
        <td className={`px-4 py-2.5 ${muted ? "" : "text-[#6B7280]"}`}>{money(l.budgetMax)}</td>
        <td className="px-4 py-2.5">
          <div className="flex items-center gap-2">
            <StatusBadge status={l.status} />
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-xs text-[#1B4B43] hover:underline shrink-0"
            >
              {expanded ? "Cancel" : "Change ▾"}
            </button>
          </div>
        </td>
        <td className="px-4 py-2.5 text-center text-base" title={l.countryOfResidence ? COUNTRY_NAME_BY_CODE[l.countryOfResidence] ?? l.countryOfResidence : undefined}>
          {l.countryOfResidence ? countryCodeToFlagEmoji(l.countryOfResidence) : ""}
        </td>
        <td className={`px-4 py-2.5 ${muted ? "" : "text-[#6B7280]"}`}>{l.assignedTo?.name ?? "—"}</td>
        <td className="px-4 py-2.5 text-xs">
          <div title="Received (site locale at intake)">{l.sourceLocale ? l.sourceLocale.toUpperCase() : "—"}</div>
          <div className="text-[#9CA3AF]" title="Preferred (editable)">{l.languagePreference ? l.languagePreference.toUpperCase() : "—"}</div>
        </td>
        <td className="px-4 py-2.5 text-right"><DeleteLeadButton id={l.id} /></td>
      </tr>
      {expanded && (
        <tr className={muted ? "bg-[#FAFAFA]" : "bg-[#F8F9FA]"}>
          <td colSpan={9} className="px-4 py-3 border-t border-[#E5E7EB]">
            <StatusChangeForm
              leadId={l.id}
              currentStatus={l.status}
              viewingScheduledAt={l.viewingScheduledAt ? l.viewingScheduledAt.toISOString() : null}
              hasEmail={!!l.email}
              hasPhone={!!l.phone}
              contactImplyingStatuses={contactImplyingStatuses}
              action={updateLeadStatusFromForm}
              onSubmit={() => setExpanded(false)}
            />
          </td>
        </tr>
      )}
    </>
  );
}
