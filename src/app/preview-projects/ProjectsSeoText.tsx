import React from "react";
import { projectsSeoCopy, type SeoBlock } from "@/app/[lang]/projects/projectsSeo";
import { projectsSeoLinks } from "@/app/[lang]/projects/projectsSeoLinks";

// Server component: the page's only <h1> and the two-column text under the results and the
// pagination. It stays out of the ProjectsExplorer client bundle on purpose (about 12 KB of copy
// per language that never needs to hydrate).

const LINK = /\[([^\]]+)\]\{([a-z0-9-]+)\}/g;

function inline(text: string, links: Record<string, string>): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  LINK.lastIndex = 0;
  while ((m = LINK.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const href = links[m[2]];
    out.push(href ? <a key={out.length} href={href}>{m[1]}</a> : m[1]);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export default function ProjectsSeoText({ lang, h1 }: { lang: string; h1?: string }) {
  const copy = projectsSeoCopy(lang);
  if (!h1 && !copy) return null;
  const links = projectsSeoLinks(lang);

  const block = (b: SeoBlock, i: number) => {
    if ("p" in b) return <p key={i}>{inline(b.p, links)}</p>;
    if ("h3" in b) return <h3 key={i}>{b.h3}</h3>;
    return (
      <ul key={i}>
        {b.ul.map((li, j) => <li key={j}>{inline(li, links)}</li>)}
      </ul>
    );
  };

  return (
    <section className="px__seo wrap" aria-labelledby="px-seo-h1">
      <div className="px__seo-inner">
        <header className="px__seo-head">
          {h1 && <h1 id="px-seo-h1" className="px__h1">{h1}</h1>}
          {copy && <p className="px__seo-lead">{inline(copy.lead, links)}</p>}
        </header>
        {copy && (
          <div className="px__seo-cols">
            {copy.sections.map((s, i) => (
              <React.Fragment key={i}>
                <h2>{s.h2}</h2>
                {s.blocks.map(block)}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
