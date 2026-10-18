import { myPresentationClients, myPresentations, myProjects } from "@/lib/partner/scope";
import { defaultPresentationLocale } from "@/lib/partner/partnerPresentations";
import { requirePartner } from "@/lib/partner/session";
import { PresentationTable } from "../components/presentationBits";
import { PresentationForm } from "../components/presentationForms";
import { portalContext } from "../portalContext";

/** Phase 3e: partner-branded presentations — the partner's own list plus the "New presentation" form. */
export default async function PartnerPresentations() {
  const me = await requirePartner({ active: true });
  const { t, locale } = await portalContext();
  const P = t.presentations;
  const clients = await myPresentationClients(me.partner.id);
  const [items, mine] = await Promise.all([myPresentations(me.partner.id, { clients }), myProjects(me.partner.id)]);
  // Names and towns only — no rates on this page.
  const projects = mine.projects.map((p) => ({ id: p.id, name: p.name, town: p.town }));
  const options = clients.map((c) => ({
    claimId: c.claimId, name: c.name, firstName: c.firstName, locale: defaultPresentationLocale(c.language, locale),
  }));
  return (
    <div className="pp-stack pp-stack-wide">
      <section className="pp-card pp-card-wide pp-card-full">
        <h1>{P.title}</h1>
        <p className="pp-muted">{P.intro}</p>
      </section>
      {items.length ? (
        <section className="pp-panel pp-panel-flush">
          <PresentationTable t={t} locale={locale} items={items} />
        </section>
      ) : (
        <section className="pp-panel"><p className="pp-muted">{P.empty}</p></section>
      )}
      <section className="pp-panel" aria-labelledby="pres-new-title">
        <h2 className="pp-h3" id="pres-new-title">{P.newTitle}</h2>
        <PresentationForm t={t} clients={options} projects={projects} defaultLocale={locale} />
      </section>
    </div>
  );
}
