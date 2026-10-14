"use client";
import { useId, useState } from "react";
import "./guideCta.css";
import FormMinimalBlockComponent from "@/app/components/FormMinimalBlockComponent/FormMinimalBlockComponent";
import type { GuideTeaser, GuideUi } from "@/lib/guides/registry";

type Props = {
  teaser: GuideTeaser;
  ui: GuideUi;
  /** FormStandardDocument for the page language (same shape FormMinimalBlockComponent takes). */
  form: any;
  lang: string;
};

const track = (event: string, id: string) => {
  if (typeof window !== "undefined" && (window as any).dataLayer) (window as any).dataLayer.push({ event, guide_id: id, page_url: window.location.href });
};

/** In-article offer of a free PDF guide: the form is revealed in place, the signed download link appears after submit. */
export default function GuideCta({ teaser, ui, form, lang }: Props) {
  const uid = useId();
  const [step, setStep] = useState<"closed" | "form" | "ready">("closed");
  const [url, setUrl] = useState<string | null>(null);

  return (
    <section className="guidecta" aria-labelledby={`${uid}-t`} data-guide={teaser.id}>
      <div className="guidecta__doc" aria-hidden="true">
        <span className="guidecta__doc-brand">Cyprus VIP Estates</span>
        <span className="guidecta__doc-title">{teaser.title}</span>
        <span className="guidecta__doc-rule" />
        <span className="guidecta__doc-edition">{teaser.edition}</span>
      </div>

      <div className="guidecta__body">
        <p className="guidecta__eyebrow">{ui.eyebrow} · {ui.fileMeta}</p>
        <h3 className="guidecta__title" id={`${uid}-t`}>{teaser.title}</h3>
        <p className="guidecta__sub">{teaser.subtitle}</p>

        {step === "closed" && (
          <>
            <p className="guidecta__label">{ui.insideLabel}</p>
            <ul className="guidecta__list">
              {teaser.inside.map((h) => <li key={h}>{h}</li>)}
            </ul>
            <button
              type="button"
              className="guidecta__btn"
              onClick={() => { setStep("form"); track("guide_cta_open", teaser.id); }}
            >
              {ui.button}
            </button>
          </>
        )}

        {step === "form" && (
          <div className="guidecta__formbox">
            <h4 className="guidecta__formtitle">{ui.formTitle}</h4>
            <p className="guidecta__hint">{ui.formHint}</p>
            <div className="artform">
              <div className="artform__form">
                <FormMinimalBlockComponent
                  form={form}
                  lang={lang}
                  hideMessage
                  guideId={teaser.id}
                  offerButtonCustomText={ui.button}
                  onFormSubmitSuccess={(data) => {
                    const link = data?.guide?.url;
                    if (typeof link === "string" && link.startsWith("/api/guides/")) { setUrl(link); setStep("ready"); track("guide_download_ready", teaser.id); }
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {step === "ready" && url && (
          <div className="guidecta__ready" role="status">
            <h4 className="guidecta__formtitle">{ui.readyTitle}</h4>
            <p className="guidecta__hint">{ui.readyText}</p>
            <a className="guidecta__btn" href={url} download onClick={() => track("guide_download_click", teaser.id)}>{ui.download}</a>
          </div>
        )}
      </div>
    </section>
  );
}
