import Link from "next/link";
import { adminDate } from "@/lib/adminTime";
import type { DownloadRow } from "@/lib/crm/downloads";
import { TakeOverDownloadButton } from "./TakeOverDownloadButton";

// Inbox -> Downloads (2026-11-07): guide and Private Collection briefing readers. Not work:
// no owner, no reminders. "Take over as lead" moves one into the inbox. Server component.
export function DownloadsList({ rows, canTakeOver }: { rows: DownloadRow[]; canTakeOver: boolean }) {
  if (rows.length === 0) return <p className="crm-muted">No downloads yet.</p>;
  return (
    <div className="crm-in-tablewrap">
      <table className="crm-in-table crm-dl-table">
        <thead><tr><th>Name</th><th>Email</th><th>Lang</th><th>Downloaded</th><th>Received</th><th>Status</th>{canTakeOver && <th aria-label="Actions" />}</tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td><Link href={`/crm/leads/${r.id}`}>{r.name}</Link></td>
              <td>{r.email ?? "—"}</td>
              <td>{r.lang ?? "—"}</td>
              <td className="crm-dl-guide" title={r.guide ?? undefined}>{r.guide ?? "—"}</td>
              <td><time dateTime={r.createdAt}>{adminDate(new Date(r.createdAt))}</time></td>
              <td>{r.status}{r.owner ? <span className="crm-muted"> · {r.owner}</span> : null}</td>
              {canTakeOver && <td className="num"><TakeOverDownloadButton leadId={r.id} name={r.name} /></td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
