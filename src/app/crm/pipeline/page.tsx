import Link from "next/link";
import { requireCrmUser } from "@/lib/crm/session";
import { BOARD_CAP, loadBoardLeads, loadSideLeads } from "@/lib/crm/pipelineQuery";
import { CLOSED_WINDOW_DAYS, buildBoard, buildSide, isBoardFilter, onlyUrgent, urgencyCounts, type BoardFilter } from "@/lib/crm/boardModel";
import { CreatedToast } from "../components/CreatedToast";
import { Board } from "../components/Board";

export const dynamic = "force-dynamic";

const FILTERS: { key: BoardFilter; label: string }[] = [
  { key: "all", label: "Everyone" }, { key: "mine", label: "Mine" }, { key: "due", label: "Needs action" }, { key: "stale", label: "Stale 7d+" },
];

export default async function PipelinePage({ searchParams }: { searchParams: { f?: string; trashed?: string } }) {
  const user = await requireCrmUser();
  const filter: BoardFilter = isBoardFilter(searchParams.f) ? searchParams.f : "all";
  const now = new Date();
  const [{ leads, total }, sideLeads] = await Promise.all([loadBoardLeads(user, filter, now), loadSideLeads(user, filter, now)]);
  const built = buildBoard(leads, now);
  const urgent = urgencyCounts(built);
  const columns = filter === "due" ? onlyUrgent(built) : built;
  const side = buildSide(sideLeads.leads, now);
  // The Closed column is a recent-sales window, not active work: counted apart.
  const sold = columns.find((c) => c.status === "CLOSED")?.cards.length ?? 0;
  const active = columns.reduce((n, c) => n + c.cards.length, 0) - sold;
  return (
    <>
      <CreatedToast show={searchParams.trashed === "1"} text="Lead moved to trash" />
      <div className="crm-headrow">
        <div>
          <h1>Pipeline</h1>
          <p>
            {active} active · {sold} sold ({CLOSED_WINDOW_DAYS} days)
            {urgent.overdue > 0 && <> · <span className="crm-urgcount overdue">{urgent.overdue} overdue</span></>}
            {urgent.now > 0 && <> · <span className="crm-urgcount now">{urgent.now} act now</span></>}
          </p>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {FILTERS.map((f) => (
            <Link key={f.key} href={f.key === "all" ? "/crm/pipeline" : `/crm/pipeline?f=${f.key}`} className={`crm-chip${filter === f.key ? " on" : ""}`}>{f.label}</Link>
          ))}
        </div>
      </div>
      {total > BOARD_CAP && (
        <p className="crm-notice" role="status">Showing the {BOARD_CAP} most recently updated of {total} leads.</p>
      )}
      <Board columns={columns} side={side} sideTotal={sideLeads.total} />
    </>
  );
}
