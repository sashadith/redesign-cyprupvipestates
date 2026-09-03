import React, { FC } from "react";
import { NotFoundPage } from "@/types/notFoundPage";
import { localePrefix } from "@/lib/locale";

type Props = {
  notFoundPage: NotFoundPage;
  lang: string;
};

/* The 404 in the site's own design language — the same shell every landing and
   article page uses (`.pl` + `iart__hero--image` from insights.css, the gold
   `.shimmer` divider, `.btn--glass`), rather than the module-scoped SCSS card
   this page carried over from the old theme.

   The illustration was already the strongest thing on the page, so it moves
   from a boxed thumbnail beside the text to the full-bleed hero behind it,
   under the same scrim the article heroes use.

   Content still comes from the CMS (notFoundPage). The fallbacks below are not
   copy decisions — they only keep the page from rendering an empty shell if the
   document is missing, which is exactly when a visitor is already lost. */
const FALLBACK: Record<string, { code: string; title: string; lead: string; cta: string }> = {
  en: { code: "404", title: "Estate Not Found", lead: "The page you are looking for may have been moved, renamed, or is temporarily unavailable.", cta: "View all projects" },
  de: { code: "404", title: "Immobilie nicht gefunden", lead: "Die gesuchte Seite wurde möglicherweise verschoben, umbenannt oder ist vorübergehend nicht verfügbar.", cta: "Alle Projekte anzeigen" },
  pl: { code: "404", title: "Nie znaleziono nieruchomości", lead: "Szukana strona mogła zostać przeniesiona, zmieniła nazwę lub jest tymczasowo niedostępna.", cta: "Zobacz wszystkie projekty" },
  ru: { code: "404", title: "Недвижимость не найдена", lead: "Страница могла быть перемещена, переименована или временно недоступна.", cta: "Смотреть все проекты" },
};

/* Gold-animate the closing word of the headline, the way the developer index
   accents its titles — one accent per page, on the word that carries it. */
const withAccent = (title: string) => {
  const i = title.trim().lastIndexOf(" ");
  if (i < 0) return <span className="it">{title}</span>;
  return (
    <>
      {title.slice(0, i + 1)}
      <span className="it">{title.slice(i + 1)}</span>
    </>
  );
};

const NotFoundPageComponent: FC<Props> = ({ notFoundPage, lang }) => {
  const fb = FALLBACK[lang] ?? FALLBACK.en;
  const code = notFoundPage?.textStart || fb.code;
  const title = notFoundPage?.textEnd || fb.title;
  const lead = notFoundPage?.description || fb.lead;
  const cta = notFoundPage?.buttonText || fb.cta;

  return (
    <main className="pl nf" data-theme="dark">
      <header className="iart__hero iart__hero--image nf__hero">
        <div className="iart__hero-bg" aria-hidden="true">
          <img
            src="/uploads/files/40cbe6eb7197905bf9ffc938cad80c648888ef21.jpg"
            alt=""
            fetchPriority="high"
          />
          <span className="iart__hero-scrim" />
        </div>
        <div className="wrap iart__hero-inner">
          <p className="nf__code" aria-hidden="true">
            {code}
          </p>
          <h1 className="iart__title nf__title">{withAccent(title)}</h1>
          <hr className="shimmer pl-hero__stripe" />
          <p className="pl-hero__lead">{lead}</p>
          <div className="nf__cta">
            <a className="btn btn--glass" href={`${localePrefix(lang)}/projects`}>
              {cta}
            </a>
          </div>
        </div>
      </header>
    </main>
  );
};

export default NotFoundPageComponent;
