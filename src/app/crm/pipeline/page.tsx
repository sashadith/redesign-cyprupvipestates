import Link from "next/link";
import { requireCrmUser } from "@/lib/crm/session";
import { loadBoardLeads } from "@/lib/crm/pipelineQuery";
import { buildBoard, isBoardFilter, type BoardFilter } from "@/lib/crm/boardModel";
import { Board } from "../components/Board";

export const dynamic = "force-dynamic";

const FILTERS: { key: BoardFilter; label: string }[] = [
  { key: "all", label: "Everyone" }, { key: "mine", label: "Mine" }, { key: "stale", label: "Stale 7d+" },
];

export default async function PipelinePage({ searchParams }: { searchParams: { f?: string } }) {
  const user = await requireCrmUser();
  const filter: BoardFilter = isBoardFilter(searchParams.f) ? searchParams.f : "all";
  const now = new Date();
  const columns = buildBoard(await loadBoardLeads(user, filter, now), now);
  const count = columns.reduce((n, c) => n + c.cards.length, 0);
  return (
    <>
      <div className="crm-headrow">
        <div>
          <h1>Pipeline</h1>
          <p>{count} active {count === 1 ? "lead" : "leads"}</p>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {FILTERS.map((f) => (
            <Link key={f.key} href={f.key === "all" ? "/crm/pipeline" : `/crm/pipeline?f=${f.key}`} className={`crm-chip${filter === f.key ? " on" : ""}`}>{f.label}</Link>
          ))}
        </div>
      </div>
      <Board columns={columns} />
    </>
  );
}
