import React from "react";
import { projectsSeoCopy, type SeoBlock } from "@/app/[lang]/projects/projectsSeo";
import { projectsSeoLinks } from "@/app/[lang]/projects/projectsSeoLinks";
import Bdi from "@/app/components/Bdi";
import ConsultButton from "@/app/preview-home/sections/ConsultButton";
import { HEADER_CONSULT_COPY } from "@/app/components/Header/HeaderConsultButton.copy";
import type { Locale } from "@/lib/locale";

// Server component: the page's only <h1> and the two-column text under the results and the
// pagination. It stays out of the ProjectsExplorer client bundle on purpose (about 12 KB of copy
// per language that never needs to hydrate).

const LINK = /\[([^\]]+)\]\{([a-z0-9-]+)\}/g;

// Hebrew only: amounts, percentages and Latin names inside an RTL sentence are isolated so the
// surrounding paragraph cannot reorder them (same rule as every other Hebrew surface, see
// src/app/components/Bdi.tsx). Euro amounts and numbers keep a fixed LTR order, Latin phrases keep
// their own direction.
const RTL_RUN = /(€\d[\d,]*(?:[–-]€\d[\d,]*)?|\d[\d,.]*%?)|([A-Za-z][A-Za-z0-9.\-]*(?: [A-Za-z0-9][A-Za-z0-9.\-]*)*)/g;

function isolate(text: string, rtl: boolean, keyBase: number): React.ReactNode[] {
  if (!rtl) return [text];
  const out: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  RTL_RUN.lastIndex = 0;
  while ((m = RTL_RUN.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(<Bdi key={`${keyBase}-${m.index}`} ltr={!!m[1]}>{m[0]}</Bdi>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function inline(text: string, links: Record<string, string>, rtl = false): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  LINK.lastIndex = 0;
  while ((m = LINK.exec(text))) {
    if (m.index > last) out.push(...isolate(text.slice(last, m.index), rtl, out.length));
    const href = links[m[2]];
    out.push(href ? <a key={out.length} href={href}>{isolate(m[1], rtl, out.length)}</a> : m[1]);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(...isolate(text.slice(last), rtl, out.length));
  return out;
}

export default function ProjectsSeoText({ lang, h1 }: { lang: string; h1?: string }) {
  const copy = projectsSeoCopy(lang);
  if (!h1 && !copy) return null;
  const links = projectsSeoLinks(lang);
  const rtl = lang === "he";

  const block = (b: SeoBlock, i: number) => {
    if ("p" in b) return <p key={i}>{inline(b.p, links, rtl)}</p>;
    if ("h3" in b) return <h3 key={i}>{isolate(b.h3, rtl, 0)}</h3>;
    return (
      <ul key={i}>
        {b.ul.map((li, j) => <li key={j}>{inline(li, links, rtl)}</li>)}
      </ul>
    );
  };

  return (
    <section className="px__seo wrap" aria-labelledby="px-seo-h1">
      <div className="px__seo-inner">
        {/* Opens the standard consultation popup (same modal and label as the header button).
            It sits where a hairline used to separate the pagination from the text. */}
        <div className="px__seo-cta">
          <ConsultButton className="btn btn--primary" source="projects_text">
            <span>{HEADER_CONSULT_COPY[lang as Locale] ?? HEADER_CONSULT_COPY.en}</span>
          </ConsultButton>
        </div>
        <header className="px__seo-head">
          {h1 && <h1 id="px-seo-h1" className="px__h1">{h1}</h1>}
          {copy && <p className="px__seo-lead">{inline(copy.lead, links, rtl)}</p>}
        </header>
        {copy && (
          <div className="px__seo-cols">
            {copy.sections.map((s, i) => (
              <React.Fragment key={i}>
                <h2>{isolate(s.h2, rtl, 0)}</h2>
                {s.blocks.map(block)}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
