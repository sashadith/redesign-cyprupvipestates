// CRM rating seasons (phase 4b, Decision 6): season list with status, create / edit form, the full ranking
// of the selected season with partner names and points by kind, and the CSV export. Managers only.
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireCrmUser } from "@/lib/crm/session";
import { canAssignLeads } from "@/lib/crm/access";
import { cyprusDay } from "@/lib/partner/commissions";
import { PARTNER_LOCALES } from "@/lib/partner/i18n";
import { POINT_KINDS, DEFAULT_POINT_RULES } from "@/lib/partner/rating";
import { overlappingSeasons, seasonFormValues, seasonStatus, type SeasonStatus } from "@/lib/partner/ratingFlow";
import { crmSeasonRanking, loadSeasons } from "@/lib/partner/ratingStore";
import { RatingSeasonForm, type SeasonFormValues } from "../../components/RatingSeasonForm";
import { ToastProvider } from "../../components/Toast";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<SeasonStatus, string> = { upcoming: "Upcoming", active: "Active", ended: "Ended" };
const KIND_LABEL: Record<(typeof POINT_KINDS)[number], string> = { claim_accepted: "Accepted", viewing: "Viewing", reserved: "Reserved", closed: "Closed" };
const EMPTY: SeasonFormValues = {
  name: "", startsOn: "", endsOn: "",
  points: Object.fromEntries(POINT_KINDS.map((k) => [k, String(DEFAULT_POINT_RULES[k])])),
  prizes: Object.fromEntries(PARTNER_LOCALES.map((l) => [l, ""])),
};

export default async function RatingSeasonsPage({ searchParams }: { searchParams?: { season?: string; new?: string } }) {
  const user = await requireCrmUser();
  if (!canAssignLeads(user)) redirect("/crm/today");

  const now = new Date();
  const seasons = await loadSeasons();
  const selected = seasons.find((s) => s.id === searchParams?.season) ?? null;
  const creating = !selected && searchParams?.new === "1";
  const ranking = selected ? await crmSeasonRanking(selected.id) : [];

  return (
    <>
      <div className="crm-headrow">
        <div>
          <h1>Rating seasons</h1>
          <p>Seasons, point rules and prizes of the partner rating. Partners see other partners only anonymously.</p>
        </div>
        <div className="crm-pt-actions">
          <Link href="/crm/partners" className="crm-btn">Back to partners</Link>
          <Link href="/crm/partners/rating?new=1" className="crm-btn primary">New season</Link>
        </div>
      </div>

      <ToastProvider>
        <section className="crm-pt-tiers" aria-labelledby="rs-list-title">
          <div className="crm-pt-bot-head">
            <h2 id="rs-list-title">Seasons</h2>
            <span className="crm-pt-bot-count">Points are added by the daily job (03:30 UTC) until 3 days after a season ends</span>
          </div>
          {seasons.length === 0 ? (
            <p>No seasons yet.</p>
          ) : (
            <div className="crm-in-tablewrap">
              <table className="crm-in-table">
                <thead>
                  <tr><th scope="col">Season</th><th scope="col">Status</th><th scope="col">Start (Cyprus)</th><th scope="col">End (Cyprus)</th><th scope="col">Points A / V / R / C</th><th scope="col"><span className="sr-only">Notes</span></th></tr>
                </thead>
                <tbody>
                  {seasons.map((s) => {
                    const status = seasonStatus(s, now);
                    const overlaps = overlappingSeasons(s, seasons, s.id);
                    return (
                      <tr key={s.id} aria-current={s.id === selected?.id ? "true" : undefined}>
                        <th scope="row"><Link href={`/crm/partners/rating?season=${encodeURIComponent(s.id)}`}>{s.name}</Link></th>
                        <td><span className={`crm-pill${status === "active" ? " crm-pt-ok" : ""}`}>{STATUS_LABEL[status]}</span></td>
                        <td>{cyprusDay(s.startsAt)}</td>
                        <td>{cyprusDay(s.endsAt)}</td>
                        <td className="num">{POINT_KINDS.map((k) => s.pointRules[k]).join(" / ")}</td>
                        <td>{overlaps.length > 0 && <span className="crm-pill crm-pt-warn" title={overlaps.map((o) => o.name).join(", ")}>Overlaps {overlaps.length}</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {creating && <RatingSeasonForm id={null} initial={EMPTY} active={false} />}

        {selected && (
          <>
            <RatingSeasonForm key={`${selected.id}:${selected.startsAt.getTime()}:${selected.endsAt.getTime()}:${selected.name}`} id={selected.id} initial={seasonFormValues(selected)} active={seasonStatus(selected, now) === "active"} locked={ranking.length > 0} />
            <section className="crm-pt-tiers" aria-labelledby="rs-rank-title">
              <div className="crm-pt-bot-head">
                <h2 id="rs-rank-title">Ranking: {selected.name}</h2>
                <span className="crm-pt-bot-count">
                  {ranking.length} partners with points · ties: earlier last points first ·{" "}
                  <a href={`/crm/partners/rating/export.csv?season=${encodeURIComponent(selected.id)}`}>Export CSV</a>
                </span>
              </div>
              {ranking.length === 0 ? (
                <p>No points in this season yet.</p>
              ) : (
                <div className="crm-in-tablewrap">
                  <table className="crm-in-table">
                    <thead>
                      <tr>
                        <th scope="col" className="num">Rank</th><th scope="col" className="num" title="Rank among ACTIVE partners, as partners see it in the portal">Portal rank</th><th scope="col">Partner</th><th scope="col">Country</th><th scope="col">Status</th>
                        {POINT_KINDS.map((k) => <th key={k} scope="col" className="num">{KIND_LABEL[k]}</th>)}
                        <th scope="col" className="num">Total</th><th scope="col">Last points</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ranking.map((r) => (
                        <tr key={r.partnerId}>
                          <td className="num">{r.rank}</td>
                          <td className="num">{r.portalRank ?? "—"}</td>
                          <th scope="row">{r.name}{r.company && <span className="crm-muted"> · {r.company}</span>}</th>
                          <td>{r.country}</td>
                          <td>{r.status !== "ACTIVE" ? <span className="crm-pill crm-pt-warn">{r.status || "—"}</span> : "Active"}</td>
                          {POINT_KINDS.map((k) => <td key={k} className="num">{r.byKind[k]}</td>)}
                          <td className="num"><b>{r.points}</b></td>
                          <td>{r.lastAt ? cyprusDay(r.lastAt) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p>Partners who are not active are listed here but left out of the ranking partners see in the portal.</p>
            </section>
          </>
        )}
      </ToastProvider>
    </>
  );
}
