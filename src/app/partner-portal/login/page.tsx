import { redirect } from "next/navigation";
import { LoginForm } from "../components/forms";
import { portalContext } from "../portalContext";

export default async function LoginPage() {
  const { me, t } = await portalContext();
  if (me) redirect("/home");
  return (
    <section className="pp-card">
      <h1>{t.login.title}</h1>
      <LoginForm t={t} />
    </section>
  );
}
