import { publicProjectUrl } from "@/lib/partner/clientDto";
import { myProjects } from "@/lib/partner/scope";
import { requirePartner } from "@/lib/partner/session";
import { ProjectsList, type ProjectRowView } from "../components/ProjectsList";
import { portalContext } from "../portalContext";

export default async function PartnerProjects() {
  const me = await requirePartner({ active: true });
  const { t, locale } = await portalContext();
  const mine = await myProjects(me.partner.id);
  // Only what the page shows goes to the client (no developer ids).
  const projects: ProjectRowView[] = mine.projects.map((p) => ({
    id: p.id, name: p.name, town: p.town, url: publicProjectUrl(locale, p.slug),
    handoverRate: p.handoverRate, fixRate: p.fixRate, ourRate: mine.trustMode ? p.ourRate : null,
  }));
  return (
    <div className="pp-stack pp-stack-wide">
      <section className="pp-card pp-card-wide pp-card-full">
        <h1>{t.projectsPage.title}</h1>
        <p className="pp-muted">{t.projectsPage.intro}</p>
      </section>
      <ProjectsList t={t} locale={locale} projects={projects} trustMode={mine.trustMode} />
    </div>
  );
}
