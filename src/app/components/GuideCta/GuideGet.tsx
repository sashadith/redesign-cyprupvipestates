"use client";
import { useState, type ReactNode } from "react";
import Modal from "react-modal";
import FormMinimalBlockComponent from "@/app/components/FormMinimalBlockComponent/FormMinimalBlockComponent";
import type { GuideId, GuideUi } from "@/lib/guides/registry";

const track = (event: string, id: string) => {
  if (typeof window !== "undefined" && (window as any).dataLayer) (window as any).dataLayer.push({ event, guide_id: id, page_url: window.location.href });
};

type Props = {
  id: GuideId;
  ui: GuideUi;
  /** FormStandardDocument for the page language (same shape FormMinimalBlockComponent takes). */
  form: any;
  lang: string;
  /** Shown above the button while the form is still closed (e.g. the "what is inside" list). */
  closedExtra?: ReactNode;
  /** Class for the button, so a card and an article offer can each style it. */
  buttonClass?: string;
  /** Open the form in a popup instead of expanding in place (the cards on the guides page). */
  popup?: { title: string; cover?: { src: string; width: number; height: number } };
};

/** The shared "get this guide" mechanism: button -> the article form revealed in place -> signed download link.
 *  Used by the in-article offer (GuideCta) and by the cards on the guides page (GuideCard). */
export default function GuideGet({ id, ui, form, lang, closedExtra, buttonClass = "guidecta__btn", popup }: Props) {
  const [step, setStep] = useState<"closed" | "form" | "ready">("closed");
  const [url, setUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  if (popup) {
    // The popup keeps its own state: closing it and opening it again shows the form, or the download once it is ready.
    const openPopup = () => { setOpen(true); if (step === "closed") setStep("form"); track("guide_cta_open", id); };
    return (
      <>
        {closedExtra}
        <button type="button" className={buttonClass} onClick={openPopup}>{ui.button}</button>
        <Modal
          isOpen={open}
          onRequestClose={() => setOpen(false)}
          ariaHideApp={false}
          closeTimeoutMS={200}
          bodyOpenClassName="no-scroll"
          overlayClassName={{ base: "gdm-overlay", afterOpen: "gdm-overlay--open", beforeClose: "gdm-overlay--closing" }}
          className={{ base: "gdm", afterOpen: "gdm--open", beforeClose: "gdm--closing" }}
          contentLabel={popup.title}
        >
          <div className="gdm__panel" data-lenis-prevent>
            <button type="button" className="gdm__close" onClick={() => setOpen(false)} aria-label={ui.close}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M15 1L1 15M1 1L15 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
            </button>
            <div className="gdm__head">
              {popup.cover && <img className="gdm__cover" src={popup.cover.src} width={popup.cover.width} height={popup.cover.height} alt="" />}
              <p className="gdm__title">{popup.title}</p>
            </div>
            {step === "ready" && url ? (
              <div className="gdm__ready" role="status">
                <h4 className="guidecta__formtitle">{ui.readyTitle}</h4>
                <p className="guidecta__hint">{ui.readyText}</p>
                <a className="gdm__download" href={url} download onClick={() => track("guide_download_click", id)}>{ui.download}</a>
              </div>
            ) : (
              <>
                <h4 className="guidecta__formtitle">{ui.formTitle}</h4>
                <p className="guidecta__hint">{ui.formHint}</p>
                <div className="artform">
                  <div className="artform__form">
                    <FormMinimalBlockComponent
                      form={form}
                      lang={lang}
                      hideMessage
                      guideId={id}
                      offerButtonCustomText={ui.button}
                      onFormSubmitSuccess={(data) => {
                        const link = data?.guide?.url;
                        if (typeof link === "string" && link.startsWith("/api/guides/")) { setUrl(link); setStep("ready"); track("guide_download_ready", id); }
                      }}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </Modal>
      </>
    );
  }

  if (step === "form")
    return (
      <div className="guidecta__formbox">
        <h4 className="guidecta__formtitle">{ui.formTitle}</h4>
        <p className="guidecta__hint">{ui.formHint}</p>
        <div className="artform">
          <div className="artform__form">
            <FormMinimalBlockComponent
              form={form}
              lang={lang}
              hideMessage
              guideId={id}
              offerButtonCustomText={ui.button}
              onFormSubmitSuccess={(data) => {
                const link = data?.guide?.url;
                if (typeof link === "string" && link.startsWith("/api/guides/")) { setUrl(link); setStep("ready"); track("guide_download_ready", id); }
              }}
            />
          </div>
        </div>
      </div>
    );

  if (step === "ready" && url)
    return (
      <div className="guidecta__ready" role="status">
        <h4 className="guidecta__formtitle">{ui.readyTitle}</h4>
        <p className="guidecta__hint">{ui.readyText}</p>
        <a className={buttonClass} href={url} download onClick={() => track("guide_download_click", id)}>{ui.download}</a>
      </div>
    );

  return (
    <>
      {closedExtra}
      <button type="button" className={buttonClass} onClick={() => { setStep("form"); track("guide_cta_open", id); }}>
        {ui.button}
      </button>
    </>
  );
}
