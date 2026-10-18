import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoMark } from "./components/Brand";
import { portalContext } from "./portalContext";

export default async function PartnerLanding() {
  const { me, t } = await portalContext();
  if (me) redirect("/home");
  const L = t.landing;
  const steps = [
    { title: L.step1Title, text: L.step1Text },
    { title: L.step2Title, text: L.step2Text },
    { title: L.step3Title, text: L.step3Text },
  ];
  return (
    <div className="pp-landing">
      <section className="pp-hero">
        <LogoMark className="pp-mark pp-mark-hero" />
        <p className="pp-eyebrow">{L.title}</p>
        <h1>{L.headline}</h1>
        <p className="pp-lead">{L.lead}</p>
        <div className="pp-cta">
          <Link href="/register" className="pp-btn pp-btn-lg">{L.cta}</Link>
          <Link href="/login" className="pp-btn pp-btn-ghost pp-btn-lg">{L.loginCta}</Link>
        </div>
      </section>
      <section className="pp-steps-wrap" aria-labelledby="pp-steps-title">
        <h2 id="pp-steps-title" className="pp-h2 pp-ruled">{L.stepsTitle}</h2>
        <ol className="pp-steps">
          {steps.map((s, i) => (
            <li key={i} className="pp-panel">
              <span className="pp-step-n" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
