import { prisma } from "@/lib/prisma";
import { fmt } from "@/lib/partner/i18n";
import { requirePartner } from "@/lib/partner/session";
import { CopyLink } from "../components/forms";
import { portalContext } from "../portalContext";

type Contact = { name: string | null; email: string | null; phone: string | null };

function officeContact(): Contact | null {
  const email = process.env.PARTNER_OFFICE_EMAIL?.trim() || null;
  const phone = process.env.PARTNER_OFFICE_PHONE?.trim() || null;
  return email || phone ? { name: null, email, phone } : null;
}

async function managerContact(managerUserId: string | null): Promise<Contact | null> {
  if (!managerUserId) return null;
  const u = await prisma.user.findUnique({ where: { id: managerUserId }, select: { name: true, email: true, phone: true, isActive: true } });
  return u && u.isActive ? { name: u.name, email: u.email, phone: u.phone?.trim() || null } : null;
}

const telHref = (p: string) => `tel:${p.replace(/[^\d+]/g, "")}`;

function ContactCard({ title, c }: { title: string; c: Contact }) {
  return (
    <section className="pp-panel pp-contact" aria-label={title}>
      <h2 className="pp-h3">{title}</h2>
      {c.name && <p className="pp-contact-name">{c.name}</p>}
      {c.phone && <p><a href={telHref(c.phone)}>{c.phone}</a></p>}
      {c.email && <p><a href={`mailto:${c.email}`}>{c.email}</a></p>}
    </section>
  );
}

export default async function PartnerHome() {
  const me = await requirePartner();
  const { t } = await portalContext();
  const H = t.home;
  const office = officeContact();

  if (me.partner.status === "PENDING") {
    return (
      <section className="pp-card pp-card-wide">
        <p className="pp-eyebrow">{H.title}</p>
        <h1>{H.pendingTitle}</h1>
        <p>{H.pendingText}</p>
      </section>
    );
  }

  if (me.partner.status === "SUSPENDED") {
    const contact = office ? [office.email, office.phone].filter(Boolean).join(" · ") : "cyprusvipestates.com";
    return (
      <section className="pp-card pp-card-wide">
        <p className="pp-eyebrow">{H.title}</p>
        <h1>{H.suspendedTitle}</h1>
        <p>{fmt(H.suspendedText, { contact })}</p>
      </section>
    );
  }

  const contact = (await managerContact(me.partner.managerUserId)) ?? office;
  const refLink = me.partner.refCode ? `https://cyprusvipestates.com/?ref=${encodeURIComponent(me.partner.refCode)}` : null;
  return (
    <div className="pp-stack">
      <section className="pp-card pp-card-wide">
        <p className="pp-eyebrow">{H.title}</p>
        <h1>{fmt(H.welcome, { name: me.partner.firstName })}</h1>
        <p>{H.activeText}</p>
      </section>
      {refLink && (
        <section className="pp-panel">
          <h2 className="pp-h3">{H.refLinkTitle}</h2>
          <CopyLink value={refLink} copyLabel={H.copy} copiedLabel={H.copied} />
        </section>
      )}
      {contact && <ContactCard title={H.contactTitle} c={contact} />}
    </div>
  );
}
