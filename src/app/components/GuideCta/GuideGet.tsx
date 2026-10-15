"use client";
import { useEffect, useState, type ReactNode } from "react";
import Modal from "react-modal";
import { motion, AnimatePresence } from "framer-motion";
import FormStandard from "@/app/components/FormStandard/FormStandard";
import { ART } from "@/app/components/ModalBrochure/ModalBrochure";
import "@/app/components/ModalBrochure/contactModal.css";
import type { GuideId, GuideUi } from "@/lib/guides/registry";

const track = (event: string, id: string) => {
  if (typeof window !== "undefined" && (window as any).dataLayer) (window as any).dataLayer.push({ event, guide_id: id, page_url: window.location.href });
};

type Props = {
  id: GuideId;
  ui: GuideUi;
  /** Name of the guide, shown above the headline in the popup. */
  title: string;
  /** FormStandardDocument for the page language (same shape FormStandard takes). */
  form: any;
  lang: string;
  /** Shown above the button (e.g. the "what is inside" list). */
  closedExtra?: ReactNode;
  /** Class for the button, so a card and an article offer can each style it. */
  buttonClass?: string;
};

/** The shared "get this guide" mechanism: a button that opens the same green popup as the consultant button in the header
 *  (the .cvpm skin of ModalBrochure, with the adviser artwork), holding the standard form. After a successful send the popup
 *  turns into the signed download link. Used by the in-article offer (GuideCta) and by the cards on the guides page. */
export default function GuideGet({ id, ui, title, form, lang, closedExtra, buttonClass = "guidecta__btn" }: Props) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [artFailed, setArtFailed] = useState(false);
  const art = ART[lang] ?? ART.en;

  // Same scroll lock as the header modal.
  useEffect(() => {
    document.body.classList.toggle("no-scroll", open);
    return () => document.body.classList.remove("no-scroll");
  }, [open]);

  // The last word of the headline is set in gold italic, as in "Speak to an adviser".
  const words = (url ? ui.readyTitle : ui.formTitle).split(" ");
  const accent = words.pop();

  return (
    <>
      {closedExtra}
      <button type="button" className={buttonClass} onClick={() => { setOpen(true); track("guide_cta_open", id); }}>
        {ui.button}
      </button>
      <AnimatePresence>
        <Modal
          closeTimeoutMS={200}
          isOpen={open}
          onRequestClose={() => setOpen(false)}
          ariaHideApp={false}
          overlayClassName="cvpm-overlay"
          className="cvpm-content"
          contentLabel={title}
        >
          <motion.div
            className="cvpm cvpm--guide"
            data-lenis-prevent
            initial={{ opacity: 0, y: 26, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.98 }}
            transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          >
            <button className="cvpm__close" onClick={() => setOpen(false)} aria-label={ui.close}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M15 1L1 15M1 1L15 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>

            <div className="cvpm__panel">
              <p className="cvpm__guide">{title}</p>
              <h2 className="cvpm__title">
                {words.join(" ")} <span className="it">{accent}</span>
              </h2>
              <hr className="cvpm__stripe" />
              <p className="cvpm__lead">{url ? ui.readyText : ui.formHint}</p>

              {url ? (
                <div className="cvpm__form" role="status">
                  <a className="cvpm__download" href={url} download onClick={() => track("guide_download_click", id)}>{ui.download}</a>
                </div>
              ) : (
                <div className="cvpm__form">
                  <FormStandard
                    form={form}
                    lang={lang}
                    guideId={id}
                    hideMessage
                    offerButtonCustomText={ui.button}
                    onFormSubmitSuccess={(data) => {
                      const link = data?.guide?.url;
                      if (typeof link === "string" && link.startsWith("/api/guides/")) { setUrl(link); track("guide_download_ready", id); }
                    }}
                  />
                </div>
              )}
            </div>

            <div className="cvpm__art" aria-hidden="true">
              {!artFailed && <img src={art} alt="" onError={() => setArtFailed(true)} />}
            </div>
          </motion.div>
        </Modal>
      </AnimatePresence>
    </>
  );
}
