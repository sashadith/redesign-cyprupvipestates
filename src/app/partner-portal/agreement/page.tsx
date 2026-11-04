import { agreementText, PARTNER_AGREEMENT_VERSION } from "@/lib/partner/agreement";
import { needsAgreementAcceptance } from "@/lib/partner/agreementGate";
import { fmt } from "@/lib/partner/i18n";
import { portalContext } from "../portalContext";
import { acceptAgreementAction } from "../agreementActions";

export default async function AgreementPage() {
  const { me, locale, t } = await portalContext();
  const a = agreementText(locale);
  // An ACTIVE partner who has not accepted this version lands here from every portal page.
  const mustAccept = me ? await needsAgreementAcceptance(me.partner) : false;
  const acceptForm = mustAccept && (
    <form action={acceptAgreementAction} className="pp-agree">
      <div className="pp-check">
        <input id="f-accept" type="checkbox" name="accept" required />
        <label htmlFor="f-accept">{fmt(t.agreement.acceptLabel, { version: PARTNER_AGREEMENT_VERSION })}</label>
      </div>
      <button type="submit" className="pp-btn">{t.agreement.acceptButton}</button>
    </form>
  );
  return (
    <article className="pp-card pp-card-wide pp-doc">
      {mustAccept && (
        <div className="pp-draft" role="note">
          <strong>{t.agreement.updateTitle}</strong>
          <p>{fmt(t.agreement.updateIntro, { version: PARTNER_AGREEMENT_VERSION })}</p>
        </div>
      )}
      <h1>{a.title}</h1>
      <p className="pp-muted">{fmt(t.agreement.version, { version: PARTNER_AGREEMENT_VERSION })}</p>
      <p>{a.intro}</p>
      <div className="pp-parties">
        {a.parties.map((p) => (
          <p key={p.name}>
            <strong>{p.name}</strong>
            {p.lines.map((l) => (
              <span key={l}><br />{l}</span>
            ))}
          </p>
        ))}
      </div>
      {a.sections.map((s) => (
        <section key={s.heading}>
          <h2>{s.heading}</h2>
          {s.clauses.map((c) => (
            <p key={c}>{c}</p>
          ))}
        </section>
      ))}
      {acceptForm}
    </article>
  );
}
