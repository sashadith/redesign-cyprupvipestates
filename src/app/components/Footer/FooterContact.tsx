"use client";

import Link from "next/link";
import type { Contact } from "@/types/footer";
import { urlFor } from "@/sanity/sanity.client";

/* Footer contact link (redesign look) — keeps the previous live ContactLink
   behaviour verbatim: mailto/tel/wa.me/http resolution + fbq "Contact" and GTM
   "contact_click" tracking with placement "footer_contact". */

const clean = (s: string) => s.replace(/[^a-zA-Z0-9@+]/g, "");

const getHref = (c: Contact) => {
  const l = clean(c.label);
  if (c.type === "Email") return `mailto:${l}`;
  if (c.type === "Phone") return `tel:${l}`;
  if (c.type === "Link") {
    if (l.match(/^\+?\d+$/)) return `https://wa.me/${l.replace("+", "")}`;
    return l.startsWith("http://") || l.startsWith("https://") ? l : `https://${l}`;
  }
  return "#";
};

const safeUrl = (img: unknown) => {
  try {
    return urlFor(img as never).url();
  } catch {
    return undefined;
  }
};

export default function FooterContact({ contact }: { contact: Contact }) {
  const onClick = () => {
    if (typeof window === "undefined") return;
    const pageUrl = window.location.href;
    let method: "phone" | "email" | "whatsapp" | "link" = "link";
    if (contact.type === "Phone") method = "phone";
    if (contact.type === "Email") method = "email";
    if (contact.type === "Link" && contact.label.match(/^\+?\d+$/)) method = "whatsapp";
    if (window.fbq) {
      window.fbq("track", "Contact", { method, placement: "footer_contact", page_location: pageUrl });
    }
    if (window.dataLayer) {
      window.dataLayer.push({
        event: "contact_click",
        contact_type: method,
        contact_label: contact.label,
        placement: "footer_contact",
        page_url: pageUrl,
      });
    }
  };

  const icon = safeUrl(contact.icon);

  return (
    <Link
      href={getHref(contact)}
      className="pf__contact"
      onClick={onClick}
      target={contact.type === "Link" ? "_blank" : undefined}
      rel={contact.type === "Link" ? "noopener" : undefined}
    >
      {icon && <img className="pf__contact-icon" src={icon} alt="" width={20} height={20} />}
      <span>{contact.label}</span>
    </Link>
  );
}
