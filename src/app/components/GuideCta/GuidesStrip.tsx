import "./guideCta.css";
import { GUIDE_UI, guideLangFor } from "@/lib/guides/registry";
import { guidesPagePath } from "@/lib/guidesPage";

/** A slim pointer to the free guides page, shown at the end of blog articles that do not carry a guide of their own. */
export default function GuidesStrip({ lang }: { lang: string }) {
  const ui = GUIDE_UI[guideLangFor(lang)];
  return (
    <aside className="guidestrip" aria-label={ui.stripTitle}>
      <div className="guidestrip__text">
        <p className="guidestrip__title">{ui.stripTitle}</p>
        <p className="guidestrip__sub">{ui.stripText}</p>
      </div>
      <a className="guidestrip__link" href={guidesPagePath(lang)}>{ui.allGuides}</a>
    </aside>
  );
}
