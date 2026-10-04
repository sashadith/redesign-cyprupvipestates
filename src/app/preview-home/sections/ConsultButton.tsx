"use client";

import React from "react";
import { useModal } from "@/app/context/ModalContext";
import { trackBrochureOpen, type BrochureSource } from "@/app/components/ModalBrochure/trackBrochureOpen";

/* Home CTA that opens the brochure/consultation modal (production lead-gen).
   Renders with the exact .btn classes passed in (no extra module class) so it
   matches the staging design. Reports through trackBrochureOpen, tagged with the
   `source` the call site passes. Used for the hero "Get Consultation" and the
   brochure block's CTA — two entry points that used to be indistinguishable in
   Events Manager because both sent the same payload. */
export default function ConsultButton({
  className,
  children,
  source,
}: {
  className?: string;
  children: React.ReactNode;
  /* Which CTA this is, for reporting. Required rather than defaulted: this
     component renders at two different places on the home page, and a default
     would have silently merged whichever call site forgot to pass it back into
     the single undifferentiated bucket this parameter exists to break up. */
  source: BrochureSource;
}) {
  const { openBrochure } = useModal();
  const onClick = () => {
    trackBrochureOpen(source);
    openBrochure();
  };
  return (
    <button type="button" className={className} onClick={onClick}>
      {children}
    </button>
  );
}
