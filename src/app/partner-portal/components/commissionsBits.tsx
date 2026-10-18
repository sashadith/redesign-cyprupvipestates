// Server-rendered pieces shared by the Commissions page and its printable report.
import { fmt, type PartnerDict, type PartnerLocale } from "@/lib/partner/i18n";
import type { CommissionRow, Period } from "@/lib/partner/commissions";
import { dateFmt, eurFmt } from "./portalBits";

const dayDate = (day: string) => new Date(`${day}T12:00:00Z`);

/** "1 Jan 2026 – 31 Dec 2026", "All time", or an open-ended range. */
export function periodLabel(t: PartnerDict, locale: PartnerLocale, p: Period): string {
  if (!p.from && !p.to) return t.commissions.periodAll;
  const date = dateFmt(locale);
  return fmt(t.commissions.periodRange, { from: p.from ? date.format(dayDate(p.from)) : "…", to: p.to ? date.format(dayDate(p.to)) : "…" });
}

export function CommissionsTable({ t, locale, rows, links }: { t: PartnerDict; locale: PartnerLocale; rows: CommissionRow[]; links: boolean }) {
  const C = t.commissions;
  const date = dateFmt(locale);
  const eur = eurFmt(locale);
  return (
    <table className="pp-table pp-comm-table">
      <thead>
        <tr>
          <th scope="col">{C.colClient}</th>
          <th scope="col">{C.colProject}</th>
          <th scope="col">{C.colPrice}</th>
          <th scope="col">{C.colCommission}</th>
          <th scope="col">{C.colStage}</th>
          <th scope="col">{C.colCreditNote}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.dealId} className={r.stage === "CANCELLED" ? "pp-comm-cancelled" : undefined}>
            <th scope="row">{r.client || "—"}</th>
            <td data-label={C.colProject}>
              {r.project ?? "—"}
              {r.unit && <span className="pp-cell-sub">{C.colUnit}: {r.unit}</span>}
            </td>
            <td data-label={C.colPrice}>{eur.format(r.price)}</td>
            <td data-label={C.colCommission}>
              {r.commission == null ? <span className="pp-muted">{C.calculating}</span> : <span className="pp-figure-sm">{eur.format(r.commission)}</span>}
            </td>
            <td data-label={C.colStage}>
              {t.commission[r.stage]}
              <span className="pp-cell-sub">{date.format(r.stageAt)}</span>
            </td>
            <td data-label={C.colCreditNote}>
              {r.creditNote ? (
                links ? (
                  <a href={`/commissions/credit-note/${encodeURIComponent(r.creditNote.id)}`} download>
                    {r.creditNote.number}
                    <span className="pp-sr"> — {C.downloadCreditNote}</span>
                  </a>
                ) : (
                  r.creditNote.number
                )
              ) : r.stage === "PAID_OUT" ? (
                <span className="pp-muted">{C.notIssued}</span>
              ) : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
