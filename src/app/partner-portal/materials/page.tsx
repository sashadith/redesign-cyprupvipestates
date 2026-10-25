import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { fmt } from "@/lib/partner/i18n";
import { brochureRows } from "@/lib/partner/materials";
import { myProjects } from "@/lib/partner/scope";
import { requirePartner } from "@/lib/partner/session";
import { BrochureList } from "../components/BrochureList";
import { dateFmt } from "../components/portalBits";
import { portalContext } from "../portalContext";

const GUIDELINES = ["g1", "g2", "g3", "g4", "g5", "g6"] as const;
const FAQ = ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8", "q9", "q10"] as const;

export default async function PartnerMaterials() {
  const me = await requirePartner({ active: true });
  const { t, locale } = await portalContext();
  const M = t.materials;
  const [acceptance, mine] = await Promise.all([
    prisma.partnerAgreementAcceptance.findFirst({
      where: { partnerId: me.partner.id },
      orderBy: { acceptedAt: "desc" },
      select: { version: true, acceptedAt: true },
    }),
    myProjects(me.partner.id),
  ]);
  // Names/towns/slugs only — no rates on this page.
  const rows = brochureRows(locale, mine.projects);
  const date = dateFmt(locale);
  return (
    <div className="pp-stack pp-stack-wide">
      <section className="pp-card pp-card-wide pp-card-full">
        <h1>{M.title}</h1>
        <p className="pp-muted">{M.intro}</p>
      </section>

      <section className="pp-panel">
        <h2 className="pp-h3">{M.agreementTitle}</h2>
        <p className="pp-muted">
          {acceptance ? fmt(M.agreementMeta, { version: acceptance.version, date: date.format(acceptance.acceptedAt) }) : M.agreementNone}
        </p>
        <p><Link href="/agreement">{M.agreementLink}</Link></p>
      </section>

      <section className="pp-panel">
        <h2 className="pp-h3">{M.guidelinesTitle}</h2>
        <ul className="pp-guidelines">
          {GUIDELINES.map((k) => <li key={k}>{M.guidelines[k]}</li>)}
        </ul>
      </section>

      <section className="pp-panel">
        <h2 className="pp-h3">{M.faqTitle}</h2>
        <div className="pp-faq">
          {FAQ.map((k) => (
            <details key={k} className="pp-details pp-faq-item">
              <summary>{M.faq[k].q}</summary>
              <p>{M.faq[k].a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="pp-panel">
        <h2 className="pp-h3">{M.brochuresTitle}</h2>
        <p className="pp-muted">{M.brochuresIntro}</p>
        <BrochureList t={t} rows={rows} />
      </section>
    </div>
  );
}
