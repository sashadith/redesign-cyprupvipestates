import { redirect } from "next/navigation";
import { countryOptions } from "@/lib/partner/countries";
import { RegisterForm } from "../components/forms";
import { portalContext } from "../portalContext";

export default async function RegisterPage() {
  const { me, locale, t } = await portalContext();
  if (me) redirect("/home");
  return (
    <section className="pp-card pp-card-wide">
      <h1>{t.register.title}</h1>
      <p className="pp-muted">{t.register.intro}</p>
      <RegisterForm t={t} locale={locale} countries={countryOptions(locale)} />
    </section>
  );
}
