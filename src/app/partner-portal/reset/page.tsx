import Link from "next/link";
import { tokenLooksValid } from "@/lib/partner/accounts";
import { ResetForm } from "../components/forms";
import { portalContext } from "../portalContext";

/** Read-only check on GET; the token is consumed only when the new password is submitted. */
export default async function ResetPage({ searchParams }: { searchParams: { token?: string | string[] } }) {
  const { t } = await portalContext();
  const token = typeof searchParams.token === "string" ? searchParams.token.slice(0, 200) : "";
  const valid = token ? await tokenLooksValid(token, "RESET_PASSWORD") : false;
  return (
    <section className="pp-card">
      <h1>{t.reset.title}</h1>
      {valid ? (
        <ResetForm t={t} token={token} />
      ) : (
        <>
          <p className="pp-alert pp-alert-error" role="alert">{t.reset.invalid}</p>
          <p className="pp-alt"><Link href="/forgot">{t.reset.requestNew}</Link></p>
        </>
      )}
    </section>
  );
}
