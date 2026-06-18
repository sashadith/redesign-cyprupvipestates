"use client";

import React from "react";
import Link from "next/link";

type Props = {
  href: string;
  className?: string;
  children: React.ReactNode;
  contactType: "Email" | "Phone" | "Link";
  placement?: string;
};

const TrackedContactLink: React.FC<Props> = ({
  href,
  className,
  children,
  contactType,
  placement = "contact_full_block",
}) => {
  const handleClick = () => {
    if (typeof window === "undefined") return;

    const pageUrl = window.location.href;

    let method = "link";

    if (contactType === "Phone") method = "phone";
    if (contactType === "Email") method = "email";
    if (contactType === "Link" && href.includes("wa.me")) method = "whatsapp";

    if (window.fbq) {
      window.fbq("track", "Contact", {
        method,
        placement,
        page_location: pageUrl,
      });
    }

    if (window.dataLayer) {
      window.dataLayer.push({
        event: "contact_click",
        contact_method: method,
        placement,
        page_url: pageUrl,
        href,
      });
    }
  };

  return (
    <Link href={href} className={className} onClick={handleClick}>
      {children}
    </Link>
  );
};

export default TrackedContactLink;
