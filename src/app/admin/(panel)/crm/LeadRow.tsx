import Link from "next/link";
import { FaFire } from "react-icons/fa";
import { COUNTRY_NAME_BY_CODE, countryCodeToFlagEmoji } from "@/lib/countries";
import DeleteLeadButton from "./DeleteLeadButton";
import StatusPopover from "./StatusPopover";
import { toggleLeadHotAction } from "../../actions";
import { BAND_STYLE, LAST_CONTACT_LABEL, money, type ColorBand, type LeadRowData } from "./leadListShared";

// 2026-08-11 — a plain server component again: StatusPopover (client) owns
// all the interactivity (its portal-rendered popup needs no help from an
// ancestor client boundary), and the Hot flame is a one-click <form> that
// needs no client JS either. Nothing here holds local state anymore.
export default function LeadRow({
  lead: l, band, muted, contactImplyingStatuses,
}: {
  lead: LeadRowData;
  band: { band: ColorBand; reason: string } | null;
  muted?: boolean;
  contactImplyingStatuses: readonly string[];
}) {
  return (
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
        {/* 2026-08-11 — one SVG shape (FaFire, react-icons/fa — chosen after
            comparing IoFlame/FaFire/MdLocalFireDepartment/PiFireFill side by
            side on staging) for both states, so toggling never swaps to a
            differently-shaped glyph. FaFire is a true solid-fill glyph
            (fill=currentColor, no separate stroke), which is why a filled
            outline icon like lucide's Flame was dropped — it read thin and
            frayed once colored in. Off: light gray, deliberately lighter
            than the old #D1D5DB dot since a solid shape reads heavier than
            a thin outline did; hover hints gold. On: solid gold fill,
            matching the existing #C29A5E accent (see CockpitCard's view/
            favorite counts). Same size both states so nothing shifts on
            click. */}
        <form action={toggleLeadHotAction} className="inline-flex">
          <input type="hidden" name="id" value={l.id} />
          <button
            type="submit"
            className={`inline-flex leading-none transition-colors ${
              l.hotAt ? "text-[#C29A5E] hover:text-[#8E6B3D]" : "text-[#E5E7EB] hover:text-[#D9B978]"
            }`}
          >
            <FaFire size={18} />
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
        <StatusPopover
          leadId={l.id}
          currentStatus={l.status}
          viewingScheduledAt={l.viewingScheduledAt ? l.viewingScheduledAt.toISOString() : null}
          hasEmail={!!l.email}
          hasPhone={!!l.phone}
          contactImplyingStatuses={contactImplyingStatuses}
        />
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
  );
}
