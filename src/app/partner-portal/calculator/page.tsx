import { myProjects } from "@/lib/partner/scope";
import { requirePartner } from "@/lib/partner/session";
import { Calculator, type CalcProject } from "../components/Calculator";
import { portalContext } from "../portalContext";

export default async function PartnerCalculator() {
  const me = await requirePartner({ active: true });
  const { t, locale } = await portalContext();
  const mine = await myProjects(me.partner.id);
  // Only effective rates go to the client; our rate only in trust mode (same props rule as /projects).
  const projects: CalcProject[] = mine.projects.map((p) => ({
    id: p.id, name: p.name, town: p.town, handoverRate: p.handoverRate, fixRate: p.fixRate, ourRate: mine.trustMode ? p.ourRate : null,
  }));
  return (
    <div className="pp-stack pp-stack-wide">
      <section className="pp-card pp-card-wide pp-card-full">
        <h1>{t.calculator.title}</h1>
        <p className="pp-muted">{t.calculator.intro}</p>
      </section>
      <Calculator t={t} locale={locale} projects={projects} trustMode={mine.trustMode} />
    </div>
  );
}
