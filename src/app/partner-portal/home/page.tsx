import Link from "next/link";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { bankDetailsComplete } from "@/lib/crm/payoutRules";
import { officeContact } from "@/lib/partner/accounts";
import { fmt } from "@/lib/partner/i18n";
import { loadBankDetails } from "@/lib/partner/bankStore";
import { ONBOARDING_DISMISS_COOKIE, onboardingFactsFrom, onboardingHref, onboardingSteps } from "@/lib/partner/onboarding";
import { myOverview } from "@/lib/partner/scope";
import { requirePartner } from "@/lib/partner/session";
import { CopyLink } from "../components/forms";
import { CommissionFigures, ContactCard, dateFmt, tr, type Contact } from "../components/portalBits";
import { portalContext } from "../portalContext";
import { dismissOnboardingAction } from "../settingsActions";

async function managerContact(managerUserId: string | null): Promise<Contact | null> {
  if (!managerUserId) return null;
  const u = await prisma.user.findUnique({ where: { id: managerUserId }, select: { name: true, email: true, phone: true, isActive: true } });
  return u && u.isActive ? { name: u.name, email: u.email, phone: u.phone?.trim() || null } : null;
}

/** Onboarding checklist for an ACTIVE partner; null once complete or hidden (cookie). All reads are the partner's own. */
async function onboardingFor(partnerId: string, status: string) {
  if (cookies().get(ONBOARDING_DISMISS_COOKIE)?.value === "1") return null;
  const [acceptance, claim, bank] = await Promise.all([
    prisma.partnerAgreementAcceptance.findFirst({ where: { partnerId }, select: { id: true } }),
    prisma.partnerClaim.findFirst({ where: { partnerId }, select: { id: true } }),
    loadBankDetails(partnerId),
  ]);
  const bankComplete = bank.state === "ok" && bankDetailsComplete(bank.details) && !!bank.ibanLast4;
  const o = onboardingSteps(onboardingFactsFrom({ status, hasAcceptance: !!acceptance, bankComplete, hasClaim: !!claim }));
  return o.complete ? null : o;
}

export default async function PartnerHome() {
  const me = await requirePartner();
  const { t, locale } = await portalContext();
  const H = t.home;
  // SUSPENDED never gets here: getPartner() treats it as logged out.

  if (me.partner.status === "PENDING") {
    return (
      <section className="pp-card pp-card-wide">
        <p className="pp-eyebrow">{H.title}</p>
        <h1>{H.pendingTitle}</h1>
        <p>{H.pendingText}</p>
      </section>
    );
  }

  const office = officeContact();
  const [manager, overview, onboarding] = await Promise.all([
    managerContact(me.partner.managerUserId),
    myOverview(me.partner.id),
    onboardingFor(me.partner.id, me.partner.status),
  ]);
  const OB = t.onboarding;
  const contact = manager ?? (office && { name: null, ...office });
  const refLink = me.partner.refCode ? `https://cyprusvipestates.com/?ref=${encodeURIComponent(me.partner.refCode)}` : null;
  const O = t.overview;
  const date = dateFmt(locale);
  const kpis = [
    { label: O.kpiActive, value: overview.counts.active },
    { label: O.kpiReview, value: overview.counts.inReview },
    { label: O.kpiViewings, value: overview.counts.viewings },
    { label: O.kpiClosed, value: overview.counts.closed },
  ];
  const hasCommission = Object.values(overview.commission).some((v) => v > 0);
  return (
    <div className="pp-stack pp-stack-wide">
      <section className="pp-card pp-card-wide">
        <p className="pp-eyebrow">{H.title}</p>
        <h1>{fmt(H.welcome, { name: me.partner.firstName })}</h1>
        <p>{H.activeText}</p>
      </section>

      {onboarding && (
        <section className="pp-panel pp-onboarding" aria-labelledby="onboarding-title">
          <div className="pp-onboarding-head">
            <h2 className="pp-h3" id="onboarding-title">{OB.title}</h2>
            <form action={dismissOnboardingAction}>
              <button type="submit" className="pp-linkbtn">{OB.dismiss}</button>
            </form>
          </div>
          <p className="pp-small pp-muted">{fmt(OB.progress, { done: onboarding.done, total: onboarding.total })}</p>
          <progress className="pp-progress" value={onboarding.done} max={onboarding.total} aria-labelledby="onboarding-title" />
          <ul className="pp-onboarding-steps">
            {onboarding.steps.map((s) => {
              const href = onboardingHref(s.key);
              const label = OB.steps[s.key];
              return (
                <li key={s.key} className={s.done ? "pp-onboarding-done" : undefined}>
                  <span className="pp-onboarding-mark" aria-hidden="true">{s.done ? "✓" : ""}</span>
                  {s.done || !href ? <span>{label}</span> : <Link href={href}>{label}</Link>}
                  {s.done && <span className="pp-sr"> ({OB.done})</span>}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <ul className="pp-kpis" aria-label={t.nav.overview}>
        {kpis.map((k) => (
          <li key={k.label} className="pp-panel pp-kpi">
            <span className="pp-figure pp-kpi-n">{k.value}</span>
            <span className="pp-kpi-label">{k.label}</span>
          </li>
        ))}
      </ul>

      <section className="pp-panel">
        <h2 className="pp-h3">{O.commissionTitle}</h2>
        {hasCommission ? <CommissionFigures t={t} locale={locale} totals={overview.commission} /> : <p className="pp-muted">{O.commissionNone}</p>}
      </section>

      <section className="pp-panel">
        <h2 className="pp-h3">{O.latestTitle}</h2>
        {overview.latest.length ? (
          <ol className="pp-timeline">
            {overview.latest.map((m, i) => (
              <li key={`${m.claimId}-${m.key}-${i}`}>
                <time dateTime={m.at.toISOString()}>{date.format(m.at)}</time>
                <span>
                  <Link href={`/clients/${encodeURIComponent(m.claimId)}`}>{m.name}</Link> · {tr(locale, m.key)}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="pp-muted">{O.latestNone}</p>
        )}
        <p className="pp-small"><Link href="/clients">{O.allClients}</Link></p>
      </section>

      {refLink && (
        <section className="pp-panel">
          <h2 className="pp-h3">{H.refLinkTitle}</h2>
          <CopyLink value={refLink} copyLabel={H.copy} copiedLabel={H.copied} />
        </section>
      )}
      {contact && <ContactCard title={H.contactTitle} c={contact} />}
    </div>
  );
}
