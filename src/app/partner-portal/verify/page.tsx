import { ResendForm, VerifyForm } from "../components/forms";
import { portalContext } from "../portalContext";

/** GET must not change state (mail scanners open links): verification happens on the button press. */
export default async function VerifyPage({ searchParams }: { searchParams: { token?: string | string[] } }) {
  const { t } = await portalContext();
  const token = typeof searchParams.token === "string" ? searchParams.token.slice(0, 200) : "";
  return (
    <section className="pp-card">
      <h1>{t.verify.title}</h1>
      {token ? (
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
