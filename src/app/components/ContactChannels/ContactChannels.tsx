import React from "react";

/* The three direct-contact cards (WhatsApp / phone / email), shared by the
   Contacts page and the About page's closing block.

   Extracted rather than duplicated: the two pages showed the same three
   channels, and a second copy would have drifted the moment either was
   restyled. The markup carries the `cnt__channel*` class names because that is
   where the styling already lives (preview-contacts/contacts.css) — About
   imports that stylesheet in its layout, the same way Partners imports
   preview-insights/insights.css. */

export type ContactChannelLabels = {
  whatsapp: string;
  phone: string;
  email: string;
  hint: { whatsapp: string; phone: string; email: string };
};

export const CHANNEL_DETAILS = {
  whatsappNumber: "+357 99 278 285",
  phoneNumber: "+357 99 278 285",
  email: "office@cyprusvipestates.com",
};

const IcoWhatsApp = () => (
  <svg viewBox="0 0 24 24" width="40" height="40" fill="none" aria-hidden>
    <path d="M20.5 11.6a8.4 8.4 0 0 1-12.4 7.4L3.5 20.5l1.6-4.5a8.4 8.4 0 1 1 15.4-4.4Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M9 8.6c.3-.1.6 0 .8.3l.8 1.3c.1.2.1.5 0 .7l-.4.6c.5 1 1.3 1.8 2.3 2.3l.6-.4c.2-.1.5-.1.7 0l1.3.8c.3.2.4.5.3.8-.2.6-.8 1-1.5 1-2.8-.2-5-2.4-5.2-5.2 0-.7.4-1.3 1-1.5Z" fill="currentColor" />
  </svg>
);
const IcoPhone = () => (
  <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M6.6 10.8c1.4 2.8 3.8 5.2 6.6 6.6l2.2-2.2c.3-.3.7-.4 1.1-.3 1.2.4 2.5.6 3.8.6.6 0 1 .4 1 1v3.6c0 .6-.4 1-1 1C10.6 21.1 2.9 13.4 2.9 3.7c0-.6.4-1 1-1H7.5c.6 0 1 .4 1 1 0 1.3.2 2.6.6 3.8.1.4 0 .8-.3 1.1L6.6 10.8Z" />
  </svg>
);
const IcoMail = () => (
  <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="2.5" y="4.5" width="19" height="15" rx="2" />
    <path d="M3 6.5 12 13l9-6.5" />
  </svg>
);
const Arrow = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
    <path d="M3 13L13 3M13 3H6M13 3V10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function ContactChannels({ labels }: { labels: ContactChannelLabels }) {
  const channels = [
    {
      key: "whatsapp",
      href: `https://wa.me/${CHANNEL_DETAILS.whatsappNumber.replace(/[^\d]/g, "")}`,
      ico: <IcoWhatsApp />, title: labels.whatsapp, value: CHANNEL_DETAILS.whatsappNumber,
      hint: labels.hint.whatsapp, external: true,
    },
    {
      key: "phone",
      href: `tel:${CHANNEL_DETAILS.phoneNumber.replace(/[^\d+]/g, "")}`,
      ico: <IcoPhone />, title: labels.phone, value: CHANNEL_DETAILS.phoneNumber,
      hint: labels.hint.phone, external: false,
    },
    {
      key: "email",
      href: `mailto:${CHANNEL_DETAILS.email}`,
      ico: <IcoMail />, title: labels.email, value: CHANNEL_DETAILS.email,
      hint: labels.hint.email, external: false,
    },
  ];

  return (
    <ul className="cnt__channel-grid">
      {channels.map((c, i) => (
        <li key={c.key}>
          <a
            className={`cnt__channel cnt__channel--${c.key}`}
            href={c.href}
            {...(c.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          >
            <span className="cnt__channel-index" aria-hidden>{String(i + 1).padStart(2, "0")}</span>
            <span className="cnt__channel-medallion" aria-hidden>{c.ico}</span>
            <span className="cnt__channel-title">{c.title}</span>
            <span className="cnt__channel-value">{c.value}</span>
            <span className="cnt__channel-hint">{c.hint}</span>
            <span className="cnt__channel-go" aria-hidden><Arrow /></span>
          </a>
        </li>
      ))}
    </ul>
  );
}
