import { publicProjectUrl } from "@/lib/partner/clientDto";
import { myPresentationClients, myPresentations } from "@/lib/partner/scope";
import { defaultPresentationLocale } from "@/lib/partner/partnerPresentations";
import { requirePartner } from "@/lib/partner/session";
import { PresentationTable } from "../components/presentationBits";
import { PresentationBuilder, type BuilderMode } from "../components/presentationBuilder/PresentationBuilder";
import { portalContext } from "../portalContext";

const param = (v: string | string[] | undefined) => (typeof v === "string" && v.length > 0 && v.length <= 64 ? v : undefined);

/**
 * Phase 3e: partner-branded presentations — the partner's own list plus the builder (2026-11-11: built like
 * the CRM). ?client=<claimId> starts a new one for that client, ?edit=<id> edits, ?favorites=<id> starts from
 * the client's favourites of that presentation. The actions re-check ownership; these are only starting points.
 */
export default async function PartnerPresentations({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const me = await requirePartner({ active: true });
  const { t, locale } = await portalContext();
  const P = t.presentations;
  const clients = await myPresentationClients(me.partner.id);
  const items = await myPresentations(me.partner.id, { clients });
  const options = clients.map((c) => ({
    claimId: c.claimId, name: c.name, firstName: c.firstName, locale: defaultPresentationLocale(c.language, locale),
  }));
  const edit = param(searchParams?.edit);
  const favorites = param(searchParams?.favorites);
  const mode: BuilderMode = edit ? { kind: "edit", id: edit } : favorites ? { kind: "favorites", id: favorites } : { kind: "new", claimId: param(searchParams?.client) };
  const title = mode.kind === "edit" ? t.presBuilder.editTitle : mode.kind === "favorites" ? t.presBuilder.fromFavorites : P.newTitle;
  const projectBase = (publicProjectUrl(locale, "_") ?? "").replace(/_$/, "");
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
        <h2 className="pp-h3" id="pres-new-title">{title}</h2>
        <PresentationBuilder key={`${mode.kind}:${edit ?? favorites ?? ""}`} t={t} locale={locale} clients={options} mode={mode} projectBase={projectBase} />
      </section>
    </div>
  );
}
