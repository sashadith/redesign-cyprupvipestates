import "./guideCta.css";
import GuideGet from "./GuideGet";
import type { GuideTeaser, GuideUi } from "@/lib/guides/registry";
import { guidesPagePath } from "@/lib/guidesPage";

type Props = {
  teaser: GuideTeaser;
  ui: GuideUi;
  /** FormStandardDocument for the page language (same shape FormMinimalBlockComponent takes). */
  form: any;
  lang: string;
};

/** In-article offer of a free PDF guide: the form opens in the same green popup as the header's consultant button, and the signed download link appears there after submit. */
export default function GuideCta({ teaser, ui, form, lang }: Props) {
  return (
    <section className="guidecta" aria-labelledby={`guidecta-${teaser.id}`} data-guide={teaser.id}>
      <div className="guidecta__doc" aria-hidden="true">
        <span className="guidecta__doc-brand">Cyprus VIP Estates</span>
        <span className="guidecta__doc-title">{teaser.title}</span>
        <span className="guidecta__doc-rule" />
        <span className="guidecta__doc-edition">{teaser.edition}</span>
      </div>

      <div className="guidecta__body">
        <p className="guidecta__eyebrow">{ui.eyebrow} · {ui.fileMeta}</p>
        <h3 className="guidecta__title" id={`guidecta-${teaser.id}`}>{teaser.title}</h3>
        <p className="guidecta__sub">{teaser.subtitle}</p>
        <GuideGet
          id={teaser.id}
          ui={ui}
          form={form}
          lang={lang}
          title={teaser.title}
          closedExtra={
            <>
              <p className="guidecta__label">{ui.insideLabel}</p>
              <ul className="guidecta__list">
                {teaser.inside.map((h) => <li key={h}>{h}</li>)}
              </ul>
            </>
          }
        />
        <p className="guidecta__all"><a href={guidesPagePath(lang)}>{ui.allGuides}</a></p>
      </div>
    </section>
  );
}
