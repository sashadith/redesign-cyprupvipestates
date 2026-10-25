import { agreementText, PARTNER_AGREEMENT_VERSION } from "@/lib/partner/agreement";
import { fmt } from "@/lib/partner/i18n";
import { portalContext } from "../portalContext";

export default async function AgreementPage() {
  const { locale, t } = await portalContext();
  const a = agreementText(locale);
  return (
    <article className="pp-card pp-card-wide pp-doc">
      <p className="pp-draft" role="note">{t.agreement.draftNotice}</p>
      <h1>{a.title}</h1>
      <p className="pp-muted">{fmt(t.agreement.version, { version: PARTNER_AGREEMENT_VERSION })}</p>
      <p>{a.intro}</p>
      {a.sections.map((s) => (
        <section key={s.heading}>
          <h2>{s.heading}</h2>
          <p>{s.body}</p>
        </section>
      ))}
    </article>
  );
}
