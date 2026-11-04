import { tokenLooksValid } from "@/lib/partner/accounts";
import { ResendForm, VerifyForm } from "../components/forms";
import { LogoMark } from "../components/Brand";
import { portalContext } from "../portalContext";

/** GET must not change state (mail scanners open links): verification happens on the button press. */
export default async function VerifyPage({ searchParams }: { searchParams: { token?: string | string[] } }) {
  const { t } = await portalContext();
  const token = typeof searchParams.token === "string" ? searchParams.token.slice(0, 200) : "";
  // Read-only check; the token is consumed only by the button's server action.
  const valid = token ? await tokenLooksValid(token, "VERIFY_EMAIL") : false;
  return (
    <section className="pp-card pp-card-auth">
      <LogoMark className="pp-mark" />
      <h1>{t.verify.title}</h1>
      {valid ? (
        <VerifyForm t={t} token={token} />
      ) : (
        <>
          <p className="pp-alert pp-alert-error" role="alert">{t.verify.invalid}</p>
          <ResendForm t={t} />
        </>
      )}
    </section>
  );
}
