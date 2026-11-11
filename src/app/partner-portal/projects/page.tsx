import { publicProjectUrl } from "@/lib/partner/clientDto";
import { projectCatalog } from "@/lib/partner/projectCatalog";
import { requirePartner } from "@/lib/partner/session";
import { ProjectsList, type ProjectRowView } from "../components/ProjectsList";
import { portalContext } from "../portalContext";

export default async function PartnerProjects() {
  const me = await requirePartner({ active: true });
  const { t, locale } = await portalContext();
  const catalog = await projectCatalog(me.partner.id);
  // Only what the page shows goes to the client (no developer, no slug or account ids). Our rate only
  // in trust mode — projectRates already nulls it otherwise; gated here again on purpose.
  const projects: ProjectRowView[] = catalog.projects.map(({ slug, ourRate, ...p }) => ({
    ...p, ourRate: catalog.trustMode ? ourRate : null, url: publicProjectUrl(locale, slug),
  }));
  return (
    <div className="pp-stack pp-stack-wide">
      <section className="pp-card pp-card-wide pp-card-full">
        <h1>{t.projectsPage.title}</h1>
        <p className="pp-muted">{t.projectsPage.intro}</p>
      </section>
      <ProjectsList t={t} locale={locale} projects={projects} trustMode={catalog.trustMode} now={new Date().toISOString()} />
    </div>
  );
}
