"use client";

import React from "react";
import { useModal } from "@/app/context/ModalContext";

/* Home CTA that opens the brochure/consultation modal (production lead-gen).
   Renders with the exact .btn classes passed in (no extra module class) so it
   matches the staging design, and fires the same Meta InitiateCheckout event as
   the shared ButtonModal. Used for the hero "Get Consultation" + brochure CTAs. */
export default function ConsultButton({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const { openBrochure } = useModal();
  const onClick = () => {
    if (typeof window !== "undefined" && (window as any).fbq) {
      (window as any).fbq("track", "InitiateCheckout", {
        form_name: "brochure_modal",
        page_location: window.location.href,
      });
    }
    openBrochure();
  };
  return (
    <button type="button" className={className} onClick={onClick}>
      {children}
    </button>
  );
}
