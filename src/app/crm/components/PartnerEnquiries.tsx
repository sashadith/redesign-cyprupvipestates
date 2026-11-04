import Link from "next/link";
import type { PartnerEnquiryRow } from "@/lib/crm/partnerEnquiries";

// Server component: website partner enquiries not yet registered on the portal.
export function PartnerEnquiries({ rows }: { rows: PartnerEnquiryRow[] }) {
  return (
    <section className="crm-panel crm-pt-enq" aria-labelledby="pt-enq-title">
      <div className="crm-pt-bot-head">
        <h2 id="pt-enq-title">Enquiries ({rows.length})</h2>
        <span className="crm-pt-bot-count">Website partner requests without a portal account · open one to reply, mark it Lost when done</span>
      </div>
      {rows.length === 0 ? (
        <p className="crm-muted">No open partner enquiries.</p>
      ) : (
        <div className="crm-in-tablewrap">
          <table className="crm-in-table">
            <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Country</th><th>Received</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td><Link href={`/crm/leads/${r.id}`}>{r.name}</Link></td>
                  <td>{r.email ?? "—"}</td>
                  <td>{r.phone ?? "—"}</td>
                  <td>{r.country ?? "—"}</td>
                  <td>{r.received}</td>
                  <td>{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
