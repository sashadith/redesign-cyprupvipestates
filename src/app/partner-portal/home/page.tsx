import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { officeContact } from "@/lib/partner/accounts";
import { fmt } from "@/lib/partner/i18n";
import { myOverview } from "@/lib/partner/scope";
import { requirePartner } from "@/lib/partner/session";
import { CopyLink } from "../components/forms";
import { CommissionFigures, ContactCard, dateFmt, tr, type Contact } from "../components/portalBits";
import { portalContext } from "../portalContext";

async function managerContact(managerUserId: string | null): Promise<Contact | null> {
  if (!managerUserId) return null;
  const u = await prisma.user.findUnique({ where: { id: managerUserId }, select: { name: true, email: true, phone: true, isActive: true } });
  return u && u.isActive ? { name: u.name, email: u.email, phone: u.phone?.trim() || null } : null;
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
  const [manager, overview] = await Promise.all([managerContact(me.partner.managerUserId), myOverview(me.partner.id)]);
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
