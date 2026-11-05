import Link from "next/link";
import { LEAD_STATUSES, isLeadStatus, type LeadStatusValue } from "@/lib/crm/leadStatus";
import { listPipeline, type PipelineCard } from "@/lib/partner/pipeline/store";
import { requirePartner } from "@/lib/partner/session";
import { PipelineCardItem } from "../components/pipelineBits";
import { portalContext } from "../portalContext";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

// One column per stage plus "handed over"; a handed-over client sits there whatever its stage.
type Column = LeadStatusValue | "HANDED_OVER";
const COLUMNS: Column[] = [...LEAD_STATUSES, "HANDED_OVER"];
const columnOf = (c: PipelineCard): Column => (c.handedOver ? "HANDED_OVER" : c.status);
const parseColumn = (v: string | undefined): Column | null => (v === "HANDED_OVER" || isLeadStatus(v) ? (v as Column) : null);

/** Partner pipeline (2026-11-05): the partner's own FIX clients. Desktop: a board; phone: a list with a stage filter. */
export default async function PartnerPipeline({ searchParams }: { searchParams: SP }) {
  const me = await requirePartner({ active: true });
  const { t, locale } = await portalContext();
  const P = t.pipeline;
  const now = new Date();
  const cards = await listPipeline(me.partner.id, now);
  const filter = parseColumn(one(searchParams.stage));
  const label = (c: Column) => (c === "HANDED_OVER" ? P.handedOverColumn : P.stage[c]);
  const byColumn = new Map<Column, PipelineCard[]>(COLUMNS.map((c) => [c, []]));
  for (const c of cards) byColumn.get(columnOf(c))!.push(c);
  const listed = filter ? byColumn.get(filter)! : cards;

  return (
    <div className="pp-stack pp-stack-wide">
      <section className="pp-card pp-card-wide pp-card-full">
        <h1>{P.title}</h1>
        <p className="pp-muted">{P.intro}</p>
      </section>

      {cards.length === 0 ? (
        <section className="pp-panel"><p className="pp-muted">{P.empty}</p></section>
      ) : (
        <>
          <section className="pp-board" aria-label={P.title}>
            {COLUMNS.map((col) => {
              const items = byColumn.get(col)!;
              return (
                <div key={col} className="pp-board-col">
                  <h2 className="pp-board-head">{label(col)} <span className="pp-muted">{items.length}</span></h2>
                  {items.length ? (
                    <ul className="pp-pcards">{items.map((c) => <PipelineCardItem key={c.claimId} t={t} locale={locale} c={c} now={now} />)}</ul>
                  ) : (
                    <p className="pp-muted pp-small">{P.columnEmpty}</p>
                  )}
                </div>
              );
            })}
          </section>

          <section className="pp-plist">
            <nav className="pp-segment pp-plist-filter" aria-label={P.filterLabel}>
              <Link href="/pipeline" className="pp-segment-btn" aria-current={filter === null ? "true" : undefined}>
                {P.filterAll} <span className="pp-muted">{cards.length}</span>
              </Link>
              {COLUMNS.filter((c) => byColumn.get(c)!.length > 0 || c === filter).map((c) => (
                <Link key={c} href={`/pipeline?stage=${c}`} className="pp-segment-btn" aria-current={filter === c ? "true" : undefined}>
                  {label(c)} <span className="pp-muted">{byColumn.get(c)!.length}</span>
                </Link>
              ))}
            </nav>
            {listed.length ? (
              <ul className="pp-pcards">{listed.map((c) => <PipelineCardItem key={c.claimId} t={t} locale={locale} c={c} now={now} />)}</ul>
            ) : (
              <p className="pp-panel pp-muted">{P.columnEmpty}</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
