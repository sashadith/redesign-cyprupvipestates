import Link from "next/link";
import { FaFire } from "react-icons/fa";
import { COUNTRY_NAME_BY_CODE, countryCodeToFlagEmoji } from "@/lib/countries";
import DeleteLeadButton from "./DeleteLeadButton";
import MoveLeadMenu from "./MoveLeadMenu";
import StatusPopover from "./StatusPopover";
import { toggleLeadHotAction } from "../../actions";
import { BAND_STYLE, LAST_CONTACT_LABEL, money, type ColorBand, type LeadRowData } from "./leadListShared";
import { adminDate } from "@/lib/adminTime";

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
      <td className="px-4 py-2.5 text-center" title={l.hotAt ? `Hot since ${adminDate(l.hotAt)} — click to un-hot` : "Mark as hot"}>
        {/* 2026-08-11 — one SVG shape (FaFire, react-icons/fa — chosen after
            comparing IoFlame/FaFire/MdLocalFireDepartment/PiFireFill side by
            side on staging) for both states, so toggling never swaps to a
            differently-shaped glyph. FaFire is a true solid-fill glyph
            (fill=currentColor, no separate stroke), which is why a filled
            outline icon like lucide's Flame was dropped — it read thin and
            frayed once colored in. Off: light gray, deliberately lighter
            than the old #D1D5DB dot since a solid shape reads heavier than
            a thin outline did; hover hints the on-colour.

            On: fire, not gold (2026-09-08). The gold #C29A5E is the brand
            accent and already carries "premium" all over the admin; a flame
            in it read as decoration rather than a state. #D2410A is the only
            place this hue appears, so it means exactly one thing, and it
            measures 4.67:1 on the row background — the old gold was 2.60:1
            and barely registered against white. Same size both states so
            nothing shifts on click. */}
        <form action={toggleLeadHotAction} className="inline-flex">
          <input type="hidden" name="id" value={l.id} />
          <button
            type="submit"
            className={`inline-flex leading-none transition-colors ${
              l.hotAt ? "text-[#D2410A] hover:text-[#9A2F06]" : "text-[#E5E7EB] hover:text-[#F0A184]"
            }`}
          >
            <FaFire size={18} />
          </button>
        </form>
      </td>
      <td className={`px-4 py-2.5 ${muted ? "" : "text-[#6B7280]"}`}>
        {l.interactions[0] ? (
          <>
            {adminDate(l.interactions[0].occurredAt)}
            <br />
            <span className="text-xs text-[#9CA3AF]">{LAST_CONTACT_LABEL[l.interactions[0].type]}</span>
          </>
        ) : (
          "—"
        )}
      </td>
      {/* tabular-nums + right aligned: amounts in a column only read as a column
          when their digits line up. */}
      <td className={`px-4 py-2.5 text-right tabular-nums ${muted ? "" : "text-[#6B7280]"}`}>{money(l.budgetMax)}</td>
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
      {/* Flag + the language to actually write in. The preferred language wins
          over the locale the lead arrived in; the title keeps both, since
          merging them into one cell would otherwise lose the distinction
          between "found us in EN" and "asked to be written to in DE". */}
      <td
        className="px-4 py-2.5 text-center"
        title={[
          l.countryOfResidence ? COUNTRY_NAME_BY_CODE[l.countryOfResidence] ?? l.countryOfResidence : null,
          l.sourceLocale ? `arrived in ${l.sourceLocale.toUpperCase()}` : null,
          l.languagePreference ? `prefers ${l.languagePreference.toUpperCase()}` : null,
        ].filter(Boolean).join(" · ") || undefined}
      >
        <span className="inline-flex items-center justify-center gap-1.5">
          <span className="text-base leading-none">{l.countryOfResidence ? countryCodeToFlagEmoji(l.countryOfResidence) : "—"}</span>
          <span className={`text-xs ${muted ? "" : "text-[#6B7280]"}`}>
            {(l.languagePreference ?? l.sourceLocale)?.toUpperCase() ?? "—"}
          </span>
        </span>
      </td>
      <td className={`px-4 py-2.5 ${muted ? "" : "text-[#6B7280]"}`}>{l.assignedTo?.name ?? "—"}</td>
      {/* Was the source/preferred language pair — both now live in the
          Country / Lang cell, so this column answers the question the header
          always seemed to promise: when did this lead reach us. */}
      <td className={`px-4 py-2.5 ${muted ? "" : "text-[#6B7280]"}`} title={`Received ${l.createdAt.toISOString()}`}>
        {adminDate(l.createdAt)}
      </td>
      <td className="px-4 py-2.5">
        <div className="flex items-center justify-end gap-2">
          <MoveLeadMenu id={l.id} source={l.source} />
          <DeleteLeadButton id={l.id} />
        </div>
      </td>
    </tr>
  );
}
