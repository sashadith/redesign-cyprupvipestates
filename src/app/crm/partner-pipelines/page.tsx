import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCrmUser } from "@/lib/crm/session";
import { canAssignLeads } from "@/lib/crm/access";
import { loadPartnerPipelines, managesPartners, stageAgeText, type Light, type PartnerPipelineGroup } from "@/lib/crm/partnerPipelines";
import { TAKE_OVER_REASON_LABEL } from "@/lib/crm/handoverReviewRules";
import { TakeOverButton } from "../components/TakeOverButton";
import HintForm from "./HintForm";
import { FUNNEL_STATUSES, SIDE_STATUSES, STATUS_LABEL } from "@/lib/crm/leadStatus";

export const dynamic = "force-dynamic";

const NICOSIA = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Nicosia", day: "2-digit", month: "short", year: "numeric" });
const LIGHT_TEXT: Record<Light, string> = { green: "On track", amber: "Needs attention", red: "Overdue" };
const LIGHT_ORDER: Record<Light, number> = { red: 0, amber: 1, green: 2 };

export default async function PartnerPipelinesPage({ searchParams }: { searchParams?: { partner?: string } }) {
  const user = await requireCrmUser();
  if (!(await managesPartners(user))) notFound();
  const now = new Date();
  const partnerId = typeof searchParams?.partner === "string" && searchParams.partner.length <= 64 ? searchParams.partner : undefined;
  const groups = await loadPartnerPipelines(user, { partnerId }, now);
  const total = groups.reduce((n, g) => n + g.cards.length, 0);
  const red = groups.reduce((n, g) => n + g.cards.filter((c) => c.light === "red").length, 0);
  const amber = groups.reduce((n, g) => n + g.cards.filter((c) => c.light === "amber").length, 0);
  const stuck = groups.reduce((n, g) => n + g.stuck.length, 0);

  // Admins see every partner, sorted under their manager ("No manager" last); a manager sees only his own.
  const byManager = new Map<string, PartnerPipelineGroup[]>();
  for (const g of groups) {
    const key = g.partner.managerName ?? "No manager";
    byManager.set(key, [...(byManager.get(key) ?? []), g]);
  }
  const sections = Array.from(byManager.entries()).sort(([a], [b]) => (a === "No manager" ? 1 : b === "No manager" ? -1 : a.localeCompare(b)));
  const admin = canAssignLeads(user);

  return (
    <>
      <div className="crm-headrow">
        <div>
          <h1>Partner pipelines</h1>
          <p>
            {total} {total === 1 ? "client" : "clients"} worked by partners
            {red > 0 && <> · <span className="crm-urgcount overdue">{red} overdue</span></>}
            {amber > 0 && <> · <span className="crm-urgcount now">{amber} need attention</span></>}
            {stuck > 0 && <> · <span className="crm-urgcount overdue">{stuck} the partner can no longer act on</span></>}
          </p>
        </div>
        {partnerId && <Link href="/crm/partner-pipelines" className="crm-chip">All partners</Link>}
      </div>
      {groups.length === 0 && <p className="crm-pp-empty">No partner is working a client right now.</p>}
      {sections.map(([manager, list]) => (
        <section key={manager} className="crm-pp-manager">
          {admin && <h2 className="crm-pp-mh">{manager}</h2>}
          {list.map((g) => {
            const extra = SIDE_STATUSES.filter((s) => g.cards.some((c) => c.status === s));
            const cols = [...FUNNEL_STATUSES, ...extra];
            return (
              <div key={g.partner.id} className="crm-pp-partner">
                <h3 className="crm-pp-ph">
                  <Link href={`/crm/partner-pipelines?partner=${g.partner.id}`}>{g.partner.name}</Link>
                  <span>{g.cards.length + g.stuck.length}</span>
                </h3>
                {g.cards.length > 0 && <div className="crm-pp-scroll">
                  <div className="crm-pp-cols" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(190px, 1fr))` }}>
                    {cols.map((st) => {
                      const cards = g.cards.filter((c) => c.status === st).sort((a, b) => LIGHT_ORDER[a.light] - LIGHT_ORDER[b.light]);
                      return (
                        <div key={st} className="crm-pp-col">
                          <div className="crm-pp-colh">{STATUS_LABEL[st]} <span>{cards.length}</span></div>
                          {cards.map((c) => (
                            <div key={c.claimId} className="crm-pp-item">
                            <Link href={`/crm/leads/${c.leadId}`} className="crm-pp-card">
                              <span className={`crm-pp-light ${c.light}`}><i aria-hidden="true" />{LIGHT_TEXT[c.light]}</span>
                              <b>{c.name}</b>
                              <small>{c.localTime.text}</small>
                              <small>{stageAgeText(c.stageSince, now)}</small>
                              <small>
                                {c.nextFollowUpAt ? `Follow-up ${NICOSIA.format(c.nextFollowUpAt)}${c.overdue ? " (overdue)" : ""}` : "No follow-up set"}
                              </small>
                              <small>{c.lastEntryAt ? `Last entry ${NICOSIA.format(c.lastEntryAt)}` : "No entry yet"}</small>
                              {c.lastPartnerEntry && <small className="crm-pp-entry">{c.lastPartnerEntry}</small>}
                              {c.presentationViews > 0 && (
                                <small>
                                  Presentation opened {c.presentationViews}x{c.lastOpenedAt ? `, last ${NICOSIA.format(c.lastOpenedAt)}` : ""}
                                </small>
                              )}
                            </Link>
                            <HintForm leadId={c.leadId} partnerLanguage={g.partner.language} />
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>}
                {g.stuck.length > 0 && (
                  <div className="crm-pp-stuck">
                    <h4>Partner can no longer act <span>{g.stuck.length}</span></h4>
                    <p className="crm-muted">Still marked as worked by the partner, so read only for staff and missing from work lists. Take the client over to work it.</p>
                    <ul>
                      {g.stuck.map((c) => (
                        <li key={c.claimId} className="crm-pp-item">
                          <Link href={`/crm/leads/${c.leadId}`} className="crm-pp-card">
                            <span className="crm-pp-light red"><i aria-hidden="true" />{TAKE_OVER_REASON_LABEL[c.stuckReason]}</span>
                            <b>{c.name}</b>
                            <small>{STATUS_LABEL[c.status]}, {stageAgeText(c.stageSince, now)}</small>
                            <small>{c.lastEntryAt ? `Last entry ${NICOSIA.format(c.lastEntryAt)}` : "No entry yet"}</small>
                          </Link>
                          <TakeOverButton leadId={c.leadId} client={c.name || "The client"} />
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      ))}
    </>
  );
}
