import Link from "next/link";
import { portalContext } from "./portalContext";

export default async function PartnerNotFound() {
  const { me, t } = await portalContext();
  return (
    <section className="pp-card">
      <h1>{t.notFound.title}</h1>
      <p className="pp-muted">{t.notFound.text}</p>
      <p><Link href={me ? "/home" : "/"} className="pp-btn">{t.notFound.back}</Link></p>
    </section>
  );
}
