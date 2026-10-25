import { ForgotForm } from "../components/forms";
import { LogoMark } from "../components/Brand";
import { portalContext } from "../portalContext";

export default async function ForgotPage() {
  const { t } = await portalContext();
  return (
    <section className="pp-card pp-card-auth">
      <LogoMark className="pp-mark" />
      <h1>{t.forgot.title}</h1>
      <ForgotForm t={t} />
    </section>
  );
}
