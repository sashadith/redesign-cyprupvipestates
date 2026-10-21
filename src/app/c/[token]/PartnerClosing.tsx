import Bdi from "@/app/components/Bdi";
import { websiteLabel } from "@/lib/partner/presentationBranding";
import { COPY, PARTNER_COPY, type PLocale } from "./copy";

// Closing section of a PARTNER-branded presentation (partner portal phase 3e, Decision 7): the partner's
// own brand contact only — no advisor block, no office WhatsApp number, no CVE email/phone/website.
// CVE presentations keep ClosingSection unchanged. Static (no entrance animation), same visual classes.

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.6 10.8c1.4 2.8 3.8 5.2 6.6 6.6l2.2-2.2c.3-.3.7-.4 1.1-.3 1.2.4 2.5.6 3.8.6.6 0 1 .4 1 1v3.6c0 .6-.4 1-1 1C10.6 21.1 2.9 13.4 2.9 3.7c0-.6.4-1 1-1H7.5c.6 0 1 .4 1 1 0 1.3.2 2.6.6 3.8.1.4 0 .8-.3 1.1L6.6 10.8Z" />
    </svg>
  );
}
function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="4.5" width="19" height="15" rx="2" />
      <path d="M3 6.5 12 13l9-6.5" />
    </svg>
  );
}
function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.5 3.8 5.7 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.7-3.8-9s1.3-6.5 3.8-9Z" />
    </svg>
  );
}

export default function PartnerClosing({
  brand, locale,
}: {
  brand: { name: string; phone: string | null; whatsapp: string | null; email: string | null; website: string | null; logoUrl: string | null };
  locale: PLocale;
}) {
  const c = COPY[locale];
  const pc = PARTNER_COPY[locale];
  const waHref = brand.whatsapp ? `https://wa.me/${brand.whatsapp}?text=${encodeURIComponent(c.whatsappMessage)}` : null;
  const telHref = brand.phone ? `tel:${brand.phone.replace(/[^\d+]/g, "")}` : null;
  const mailHref = brand.email ? `mailto:${brand.email}` : null;
  const hasContact = !!(waHref || telHref || mailHref || brand.website);
  return (
    <section className="cp-closing cp-closing--partner">
      <div className="cp-closing__inner">
        <div className="cp-closing__textcol cp-closing__solo">
          {brand.logoUrl && <img src={brand.logoUrl} alt={brand.name} className="cp-closing__partnerlogo" />}
          <p className="eyebrow cp-closing__eyebrow">{pc.contactEyebrow}</p>
          {brand.name && <p className="cp-closing__name">{brand.name}</p>}
          {hasContact && <p className="cp-closing__trust">{pc.contactTrust}</p>}
          {(waHref || telHref || mailHref) && (
            <div className="cp-closing__actions">
              {waHref && <a href={waHref} target="_blank" rel="noopener noreferrer" className="cp-closing__btn cp-closing__btn--whatsapp">{c.whatsapp}</a>}
              {telHref && <a href={telHref} className="cp-closing__btn">{c.call}</a>}
              {mailHref && <a href={mailHref} className="cp-closing__btn">{c.email}</a>}
            </div>
          )}
          {(telHref || mailHref || brand.website) && (
            <ul className="cp-closing__contactlist">
              {telHref && brand.phone && (
                <li>
                  <a href={telHref} className="cp-closing__contactlink">
                    <PhoneIcon />
                    <Bdi ltr>{brand.phone}</Bdi>
                  </a>
                </li>
              )}
              {mailHref && brand.email && (
                <li>
                  <a href={mailHref} className="cp-closing__contactlink">
                    <MailIcon />
                    <Bdi ltr>{brand.email}</Bdi>
                  </a>
                </li>
              )}
              {brand.website && (
                <li>
                  <a href={brand.website} target="_blank" rel="noopener noreferrer" className="cp-closing__contactlink" aria-label={`${pc.website}: ${websiteLabel(brand.website)}`}>
                    <GlobeIcon />
                    <Bdi ltr>{websiteLabel(brand.website)}</Bdi>
                  </a>
                </li>
              )}
            </ul>
          )}
        </div>
        <p className="cp-closing__legal">
          {c.legal} <a href={locale === "en" ? "/privacy-policy" : `/${locale}/privacy-policy`}>{c.privacyPolicy}</a>
        </p>
        {brand.name && <p className="cp-closing__presented">{pc.presentedBy.replace("{name}", () => brand.name)}</p>}
      </div>
    </section>
  );
}
