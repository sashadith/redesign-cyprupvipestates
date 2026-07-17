import React from "react";
import Link from "next/link";
import { PortableText } from "@portabletext/react";

/* Adapted from preview-insights/InsightsSeo.tsx — same visual treatment
   (.ins__guide / .ins__topics, reused verbatim from insights.css), but the
   Case Studies page content uses h2 for its section breaks (verified against
   the live caseStudiesPage doc — zero h3s, seven h2s), where the Insights
   version specifically parses h3 into topic cards and treats an h2 as the
   start of an "outro" sidebar. Feeding this content through that parser
   unmodified would dump all seven sections into one sidebar column instead of
   the intended card grid, so this is a small parsing variant, not a full
   duplicate: intro (blocks before the first h2) + one topic card per h2, no
   separate outro sidebar (this content doesn't cleanly split into one). */

const blockText = (b: any) => (b?.children ?? []).map((c: any) => c?.text ?? "").join("").trim();

type Topic = { title: string; body: any[] };

function parseByH2(blocks: any[]): { intro: any[]; topics: Topic[] } {
  const intro: any[] = [];
  const topics: Topic[] = [];
  let current: Topic | null = null;

  for (const b of blocks ?? []) {
    const isH2 = b?._type === "block" && b?.style === "h2";
    if (isH2) {
      current = { title: blockText(b), body: [] };
      topics.push(current);
    } else if (current) {
      current.body.push(b);
    } else {
      intro.push(b);
    }
  }
  return { intro, topics };
}

const seoComponents = {
  block: {
    normal: ({ children }: any) => <p className="ins__guide-p">{children}</p>,
  },
  list: {
    bullet: ({ children }: any) => <ul className="ins__guide-ul">{children}</ul>,
    number: ({ children }: any) => <ol className="ins__guide-ul">{children}</ol>,
  },
  listItem: { bullet: ({ children }: any) => <li>{children}</li>, number: ({ children }: any) => <li>{children}</li> },
  marks: {
    strong: ({ children }: any) => <strong>{children}</strong>,
    em: ({ children }: any) => <em>{children}</em>,
    link: ({ children, value }: any) => <Link href={value?.href || "#"} className="ins__guide-link">{children}</Link>,
  },
};

export default function CaseStudiesSeo({
  content,
  eyebrow = "The Guide",
  title = "Understanding Case Studies",
}: {
  content: any[];
  eyebrow?: string;
  title?: string;
}) {
  if (!content?.length) return null;
  const { intro, topics } = parseByH2(content);
  const words = title.trim().split(/\s+/);
  const accent = words.pop() ?? "";
  const lead = words.join(" ");

  return (
    <section className="ins__guide is-light">
      <div className="wrap">
        <header className="ins__guide-head">
          <p className="ins__eyebrow">{eyebrow}</p>
          <h2 className="ins__guide-title">
            {lead ? `${lead} ` : ""}<span className="it">{accent}</span>
          </h2>
          <hr className="shimmer ins__guide-stripe" />
        </header>

        {intro.length > 0 && (
          <div className="ins__guide-cols">
            <div className="ins__guide-intro">
              <PortableText value={intro} components={seoComponents as any} />
            </div>
          </div>
        )}

        {topics.length > 0 && (
          <div className="ins__topics">
            {topics.map((t, i) => (
              <article className="ins__topic" key={i}>
                <span className="ins__topic-no">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="ins__topic-title">{t.title}</h3>
                <div className="ins__topic-body">
                  <PortableText value={t.body} components={seoComponents as any} />
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
