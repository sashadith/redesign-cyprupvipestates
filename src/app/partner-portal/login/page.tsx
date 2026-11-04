import { redirect } from "next/navigation";
import { LoginForm } from "../components/forms";
import { LogoMark } from "../components/Brand";
import { portalContext } from "../portalContext";

export default async function LoginPage() {
  const { me, t } = await portalContext();
  if (me) redirect("/home");
  return (
    <section className="pp-card pp-card-auth">
      <LogoMark className="pp-mark" />
      <h1>{t.login.title}</h1>
      <LoginForm t={t} />
    </section>
  );
}
