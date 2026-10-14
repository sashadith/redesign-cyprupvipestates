"use client";
import { useState, type ReactNode } from "react";
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
};

/** The shared "get this guide" mechanism: button -> the article form revealed in place -> signed download link.
 *  Used by the in-article offer (GuideCta) and by the cards on the guides page (GuideCard). */
export default function GuideGet({ id, ui, form, lang, closedExtra, buttonClass = "guidecta__btn" }: Props) {
  const [step, setStep] = useState<"closed" | "form" | "ready">("closed");
  const [url, setUrl] = useState<string | null>(null);

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
