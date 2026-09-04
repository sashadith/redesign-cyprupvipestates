"use client";
import React, { useEffect, useState } from "react";
import Modal from "react-modal";
import { motion, AnimatePresence } from "framer-motion";
import "./contactModal.css";
import { useModal } from "@/app/context/ModalContext";
import { FormStandardDocument } from "@/types/formStandardDocument";
import FormStandard from "../FormStandard/FormStandard";

/* react-modal paints the overlay and content boxes itself; both are handed over
   to the stylesheet so the panel can be a single grid with its own framing. */
const customStyles: ReactModal.Styles = {
  overlay: {},
  content: {},
};

type Props = {
  lang: string;
  formDocument: FormStandardDocument;
};

const COPY: Record<string, { title: string; accent: string; lead: string }> = {
  en: {
    title: "Speak to an",
    accent: "adviser",
    lead: "Leave your details and we will get back to you, usually the same day.",
  },
  de: {
    title: "Sprechen Sie mit einem",
    accent: "Berater",
    lead: "Hinterlassen Sie Ihre Daten, wir melden uns — meist noch am selben Tag.",
  },
  pl: {
    title: "Porozmawiaj z",
    accent: "doradcą",
    lead: "Zostaw swoje dane, odezwiemy się — zwykle jeszcze tego samego dnia.",
  },
  ru: {
    title: "Поговорите с",
    accent: "консультантом",
    lead: "Оставьте свои данные, мы свяжемся с вами — обычно в тот же день.",
  },
};

/* One phone mock-up per language, each showing an adviser who actually speaks
   it. Dropped silently if the file is missing, so a locale without artwork
   degrades to the gradient panel rather than a broken image.

   WebP at 950px wide (scripts/optimize-contact-art.mjs): the artwork is never
   shown wider than 462 CSS px, and the 1024x1536 PNG originals were ~1.6 MB
   each — 6.2 MB fetched across the set, on every page carrying a contact
   button. Same images at 452 KB total, alpha intact. */
const ART: Record<string, string> = {
  en: "/img/contact/iphone-en.webp",
  de: "/img/contact/iphone-de.webp",
  pl: "/img/contact/iphone-pl.webp",
  ru: "/img/contact/iphone-ru.webp",
};

const ModalBrochure = ({ lang, formDocument }: Props) => {
  const { isBrochureOpen, closeBrochure } = useModal();
  const [artFailed, setArtFailed] = useState(false);
  const copy = COPY[lang] ?? COPY.en;
  const art = ART[lang] ?? ART.en;

  useEffect(() => {
    if (isBrochureOpen) {
      document.body.classList.add("no-scroll");
    } else {
      document.body.classList.remove("no-scroll");
    }

    return () => {
      document.body.classList.remove("no-scroll");
    };
  }, [isBrochureOpen]);

  return (
    <AnimatePresence>
      <Modal
        closeTimeoutMS={200}
        isOpen={isBrochureOpen}
        onRequestClose={closeBrochure}
        ariaHideApp={false}
        style={customStyles}
        overlayClassName="cvpm-overlay"
        className="cvpm-content"
      >
        <motion.div
          className="cvpm"
          initial={{ opacity: 0, y: 26, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 14, scale: 0.98 }}
          transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
        >
          <button
            className="cvpm__close"
            onClick={closeBrochure}
            aria-label={
              lang === "de" ? "Schließen" : lang === "pl" ? "Zamknij" : lang === "ru" ? "Закрыть" : "Close"
            }
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M15 1L1 15M1 1L15 15"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>

          <div className="cvpm__panel">
            <h2 className="cvpm__title">
              {copy.title} <span className="it">{copy.accent}</span>
            </h2>
            <hr className="cvpm__stripe" />
            <p className="cvpm__lead">{copy.lead}</p>

            <div className="cvpm__form">
              <FormStandard form={formDocument} lang={lang} />
            </div>
          </div>

          <div className="cvpm__art" aria-hidden="true">
            {!artFailed && <img src={art} alt="" onError={() => setArtFailed(true)} />}
          </div>
        </motion.div>
      </Modal>
    </AnimatePresence>
  );
};

export default ModalBrochure;
