"use client";

import { useModal } from "@/app/context/ModalContext";
import { trackBrochureOpen } from "@/app/components/ModalBrochure/trackBrochureOpen";
import { isLocale } from "@/lib/locale";
import { HEADER_CONSULT_COPY } from "./HeaderConsultButton.copy";

/* The header's one conversion button. Opens the same ModalBrochure the home
   hero's ConsultButton opens. Both report through trackBrochureOpen, which tags
   the event with a `source` so the entry points can actually be told apart —
   they used to send byte-identical payloads, which made them comparable only in
   the sense that nothing distinguished them.

   Header.tsx renders the modal itself, right next to this button — see the note
   there. Before that, the modal was mounted per page and five routes rendered
   the header WITHOUT it, so a global button would have been dead on /projects
   and /developers.

   The label is hidden below 1152px (CSS), leaving the chip alone; the button
   keeps its accessible name through aria-label either way, so the shrunken form
   is still announced as "Ask an adviser" rather than as an unlabelled button. */
export default function HeaderConsultButton({ lang }: { lang: string }) {
  const { openBrochure } = useModal();
  const label = HEADER_CONSULT_COPY[isLocale(lang) ? lang : "en"];

  const onClick = () => {
    trackBrochureOpen("header");
    openBrochure();
  };

  return (
    <button type="button" className="nav__cta" onClick={onClick} aria-label={label}>
      <span className="nav__cta-label">{label}</span>
      <span className="nav__cta-ico" aria-hidden="true">
        {/* A speech bubble, not a handset. The modal this opens asks the visitor
            to CHOOSE a channel — its preferredContact group offers Phone call,
            WhatsApp and Email with none preselected — so an icon that names one
            of the three would announce a decision that has not been made. A
            handset is worse still in the label-less form below 1152px, where an
            unlabelled handset in a header reads as tap-to-call everywhere on the
            web and would instead open a form. The bubble says "a person will
            answer" without promising the medium. */}
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
          <path
            d="M2.6 7.2c0-2.3 2.4-4.1 5.4-4.1s5.4 1.8 5.4 4.1-2.4 4.1-5.4 4.1c-.5 0-1-.05-1.5-.15L3.6 12.6l.7-2.1C3.2 9.7 2.6 8.5 2.6 7.2Z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </button>
  );
}
