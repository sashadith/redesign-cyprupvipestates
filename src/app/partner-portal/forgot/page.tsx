import { ForgotForm } from "../components/forms";
import { portalContext } from "../portalContext";

export default async function ForgotPage() {
  const { t } = await portalContext();
  return (
    <section className="pp-card">
      <h1>{t.forgot.title}</h1>
      <ForgotForm t={t} />
    </section>
  );
}
