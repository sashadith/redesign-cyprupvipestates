import { requirePartner } from "@/lib/partner/session";
import { myProjects } from "@/lib/partner/scope";
import { SubmitForm, type SubmitProject } from "../components/SubmitForm";
import { portalContext } from "../portalContext";

export default async function PartnerSubmit() {
  const me = await requirePartner({ active: true });
  const { t, locale } = await portalContext();
  const mine = await myProjects(me.partner.id);
  // Only what the form shows goes to the client (no slugs, no developer ids).
  const projects: SubmitProject[] = mine.projects.map((p) => ({
    id: p.id, name: p.name, town: p.town, handoverRate: p.handoverRate, fixRate: p.fixRate, ourRate: p.ourRate,
  }));
  return (
    <section className="pp-card pp-card-wide pp-card-form">
      <h1>{t.submit.title}</h1>
      <p className="pp-muted">{t.submit.intro}</p>
      <SubmitForm
        t={t}
        locale={locale}
        projects={projects}
        handoverShare={mine.handoverShare}
        fixShare={mine.fixShare}
        trustMode={mine.trustMode}
      />
    </section>
  );
}
