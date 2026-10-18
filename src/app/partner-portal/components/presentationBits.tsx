import Link from "next/link";
import { fmt, type PartnerDict, type PartnerLocale } from "@/lib/partner/i18n";
import { presentationPreviewUrl } from "@/lib/partner/presentationBranding";
import type { MyPresentation } from "@/lib/partner/scope";
import { CopyLink } from "./forms";
import { Chip, dateFmt } from "./portalBits";
import { RevokeButton } from "./presentationForms";

/** Phase 3e: the partner's own presentations (list page and client detail). */
export function PresentationTable({ t, locale, items, showClient = true }: {
  t: PartnerDict; locale: PartnerLocale; items: MyPresentation[]; showClient?: boolean;
}) {
  const P = t.presentations;
  const date = dateFmt(locale);
  const status = { active: P.statusActive, expired: P.statusExpired, revoked: P.statusRevoked } as const;
  const tone = { active: "stage", expired: "closed", revoked: "lost" } as const;
  return (
    <table className="pp-table pp-pres-table">
      <thead>
        <tr>
          <th scope="col">{showClient ? P.colClient : P.colCreated}</th>
          <th scope="col">{P.colStatus}</th>
          <th scope="col">{P.colViews}</th>
          <th scope="col">{P.colExpires}</th>
        </tr>
      </thead>
      <tbody>
        {items.map((p) => (
          <tr key={p.id}>
            <th scope="row">
              {showClient ? (
                <>
                  {p.claimId ? <Link href={`/clients/${encodeURIComponent(p.claimId)}`}>{p.clientName || "—"}</Link> : p.clientName || "—"}
                  <span className="pp-cell-sub">{date.format(p.createdAt)}</span>
                </>
              ) : (
                date.format(p.createdAt)
              )}
              {p.status === "active" && <CopyLink value={p.url} copyLabel={P.copyLink} copiedLabel={P.copied} />}
            </th>
            <td data-label={P.colStatus}>
              <Chip label={status[p.status]} tone={tone[p.status]} />
              {p.status === "active" && (
                <span className="pp-pres-actions">
                  <a href={presentationPreviewUrl(p.url)} target="_blank" rel="noopener noreferrer" className="pp-linkbtn">{P.open}</a>
                  <RevokeButton id={p.id} label={P.revoke} confirmText={P.revokeConfirm} />
                </span>
              )}
            </td>
            <td data-label={P.colViews}>
              {p.stats ? (
                <>
                  {p.stats.views && p.stats.lastOpenedAt
                    ? fmt(P.opened, { n: p.stats.views, date: date.format(p.stats.lastOpenedAt) })
                    : <span className="pp-muted">{P.notOpened}</span>}
                  <span className="pp-cell-sub">{P.favorites}: {p.stats.favorites}</span>
                </>
              ) : (
                <span className="pp-muted">—</span>
              )}
            </td>
            <td data-label={P.colExpires}>{p.expiresAt ? date.format(p.expiresAt) : "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
