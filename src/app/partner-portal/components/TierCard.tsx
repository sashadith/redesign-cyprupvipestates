// The partner's own tier card (phase 4b, Decision 5) on Overview and Commissions. Server-rendered; the data
// comes from myTierStatus (partner-scoped). Shows the tier, the partner's actual shares, closed deals and the
// progress to the next tier, or "Highest tier" at the top.
import { fmt, type PartnerDict, type PartnerLocale } from "@/lib/partner/i18n";
import { formatShare } from "@/lib/partner/notify";
import type { MyTierStatus } from "@/lib/partner/tierStore";

export function TierCard({ t, locale, status }: { t: PartnerDict; locale: PartnerLocale; status: MyTierStatus }) {
  const T = t.tiers;
  const { progress } = status;
  const next = progress.next;
  return (
    <section className="pp-panel pp-tier" aria-labelledby="tier-title">
      <h2 className="pp-h3" id="tier-title">{T.title}</h2>
      <p className="pp-tier-name">{fmt(T.current, { tier: progress.current.name })}</p>
      <p>{fmt(T.shares, { handover: formatShare(locale, status.handoverShare), fix: formatShare(locale, status.fixShare) })}</p>
      <p className="pp-small pp-muted">{fmt(T.closedDeals, { n: status.closedDeals })}</p>
      {next ? (
        <>
          <progress className="pp-progress" value={progress.pct} max={100} aria-label={fmt(T.progressAria, { tier: next.name })} />
          <p className="pp-small">{fmt(T.progress, { n: progress.remaining, tier: next.name })}</p>
        </>
      ) : (
        <>
          <progress className="pp-progress" value={100} max={100} aria-label={T.highest} />
          <p className="pp-small"><b>{T.highest}</b> · {T.highestText}</p>
        </>
      )}
      <p className="pp-small pp-muted">{T.sharesNote}</p>
    </section>
  );
}
