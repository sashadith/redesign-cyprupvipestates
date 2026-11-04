"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { PartnerQualityRow } from "@/lib/crm/insights/partnerQuality";
import { comparePartnerRows, defaultSortDir, durationText, pctText, type PartnerSortKey, type SortDir } from "@/lib/crm/insights/pageModel";

const COLUMNS: { key: PartnerSortKey; label: string; num: boolean }[] = [
  { key: "name", label: "Partner", num: false },
  { key: "submitted", label: "Submitted", num: true },
  { key: "accepted", label: "Accepted", num: true },
  { key: "inReview", label: "In review", num: true },
  { key: "rejected", label: "Rejected", num: true },
  { key: "valid", label: "Valid", num: true },
  { key: "reachedViewing", label: "Viewing", num: true },
  { key: "closed", label: "Closed", num: true },
  { key: "conversionPct", label: "Conversion", num: true },
  { key: "medianResponseMin", label: "Median response", num: true },
];

export function PartnerQualityTable({ rows }: { rows: PartnerQualityRow[] }) {
  const [sort, setSort] = useState<{ key: PartnerSortKey; dir: SortDir }>({ key: "submitted", dir: "desc" });
  const sorted = useMemo(() => [...rows].sort(comparePartnerRows(sort.key, sort.dir)), [rows, sort]);

  if (rows.length === 0) return <p className="crm-notice">No active or suspended partners yet.</p>;
  const anyClaims = rows.some((r) => r.submitted > 0);

  const toggle = (key: PartnerSortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: defaultSortDir(key) }));

  return (
    <>
      {!anyClaims && <p className="crm-notice">No partner submitted a client in this period.</p>}
      <div className="crm-in-tablewrap">
        <table className="crm-in-table">
          <caption className="crm-in-sr">Partner quality for the selected period. Column headers sort the table.</caption>
          <thead>
            <tr>
              {COLUMNS.map((c) => {
                const on = sort.key === c.key;
                return (
                  <th key={c.key} scope="col" className={c.num ? "num" : undefined} aria-sort={on ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
                    <button type="button" className={`crm-in-sort${on ? " on" : ""}`} onClick={() => toggle(c.key)}>
                      {c.label}
                      <span aria-hidden="true" className="arrow">{on ? (sort.dir === "asc" ? "↑" : "↓") : "↕"}</span>
                    </button>
                  </th>
                );
              })}
              <th scope="col">Flags</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.partnerId}>
                <th scope="row">
                  <Link href={`/crm/partners?tab=${r.status === "SUSPENDED" ? "suspended" : "active"}`}>{r.name}</Link>
                  {r.status === "SUSPENDED" && <span className="crm-in-flag muted">Suspended</span>}
                </th>
                <td className="num">{r.submitted}</td>
                <td className="num">{r.accepted}</td>
                <td className="num">{r.inReview}</td>
                <td className="num">{r.rejected}</td>
                <td className="num">{r.valid}</td>
                <td className="num">{r.reachedViewing}</td>
                <td className="num">{r.closed}</td>
                <td className="num">{pctText(r.conversionPct)}</td>
                <td className="num">{durationText(r.medianResponseMin)}</td>
                <td>
                  <span className="crm-in-flags">
                    {r.topPartner && <span className="crm-in-flag top">Top partner</span>}
                    {r.lowQuality && <span className="crm-in-flag low">Low quality</span>}
                    {!r.topPartner && !r.lowQuality && <span className="crm-muted" aria-label="No flags">—</span>}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
