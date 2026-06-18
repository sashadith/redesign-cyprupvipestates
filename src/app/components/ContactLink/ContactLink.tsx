"use client";

import Link from "next/link";
import Image from "next/image";
import { Contact } from "@/types/footer";
import styles from "../Footer/Footer.module.scss";
import { urlFor } from "@/sanity/sanity.client";

type Props = {
  contact: Contact;
};

export default function ContactLink({ contact }: Props) {
  const cleanLink = (link: string) => {
    return link.replace(/[^a-zA-Z0-9@+]/g, "");
  };

  const getContactHref = (contact: Contact) => {
    const cleanedLabel = cleanLink(contact.label);

    switch (contact.type) {
      case "Email":
        return `mailto:${cleanedLabel}`;
      case "Phone":
        return `tel:${cleanedLabel}`;
      case "Link":
        if (cleanedLabel.match(/^\+?\d+$/)) {
          const whatsappNumber = cleanedLabel.replace("+", "");
          return `https://wa.me/${whatsappNumber}`;
        }
        return cleanedLabel.startsWith("http://") ||
          cleanedLabel.startsWith("https://")
          ? cleanedLabel
          : `https://${cleanedLabel}`;
      default:
        return "#";
    }
  };

  const handleClick = () => {
    if (typeof window === "undefined") return;

    const pageUrl = window.location.href;

    let method: "phone" | "email" | "whatsapp" | "link" = "link";

    if (contact.type === "Phone") method = "phone";
    if (contact.type === "Email") method = "email";

    if (contact.type === "Link" && contact.label.match(/^\+?\d+$/)) {
      method = "whatsapp";
    }

    // ✅ Meta Pixel
    if (window.fbq) {
      window.fbq("track", "Contact", {
        method,
        placement: "footer_contact",
        page_location: pageUrl,
      });
    }

    // ✅ GTM (у тебя уже было — просто чуть улучшим)
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

  return (
    <Link
      href={getContactHref(contact)}
      className={styles.contact}
      onClick={handleClick}
      target={contact.type === "Link" ? "_blank" : undefined}
      rel={contact.type === "Link" ? "noopener" : undefined}
    >
      <Image
        alt={contact.label}
        src={urlFor(contact.icon).url()}
        width={30}
        height={30}
        unoptimized
      />
      <p className={styles.contactLabel}>{contact.label}</p>
    </Link>
  );
}
