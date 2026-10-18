import { prisma } from "@/lib/prisma";
import { requirePartner } from "@/lib/partner/session";
import { PasswordForm, ProfileForm } from "../components/forms";
import { portalContext } from "../portalContext";

export default async function PartnerProfile() {
  const me = await requirePartner();
  const { t } = await portalContext();
  const p = await prisma.partner.findUnique({
    where: { id: me.partner.id },
    select: { firstName: true, lastName: true, company: true, language: true, phone: true, type: true },
  });
  if (!p) return null;
  const P = t.profile;
  return (
    <div className="pp-stack">
      <section className="pp-card pp-card-wide">
        <h1>{P.title}</h1>
        <ProfileForm
          t={t}
          values={{ firstName: p.firstName, lastName: p.lastName, company: p.company ?? "", language: String(p.language) }}
        />
      </section>
      <section className="pp-panel">
        <dl className="pp-dl">
          <div><dt>{P.email}</dt><dd>{me.user.email}</dd></div>
          <div><dt>{P.phone}</dt><dd>{p.phone}</dd></div>
          <div><dt>{P.type}</dt><dd>{t.types[p.type]}</dd></div>
        </dl>
        <p className="pp-muted pp-small">{P.lockedNote}</p>
      </section>
      <section className="pp-panel">
        <h2 className="pp-h3">{P.changePassword}</h2>
        <PasswordForm t={t} />
      </section>
    </div>
  );
}
