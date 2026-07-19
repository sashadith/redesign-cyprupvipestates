import React from "react";
import Image from "next/image";
import Link from "next/link";
import { PortableText } from "@portabletext/react";
import { urlFor } from "@/sanity/sanity.client";
import { localizedHref } from "@/lib/locale";
import { SITE_URL } from "@/lib/seo";
import FaqAccordion from "./FaqAccordion";

/* Cyprus Insights — article content rendering with the redesigned editorial
   typography. PortableText component map for textContent + renderers for the
   other content blocks. Heading IDs power the sticky table of contents. */

export const slugify = (s: string) =>
  (s || "")
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);

const blockText = (value: any) =>
  (value?.children ?? []).map((c: any) => c?.text ?? "").join("").trim();

const safeUrl = (img: unknown) => {
  try {
    return urlFor(img as never).url();
  } catch {
    return undefined;
  }
};

/** Pull every H2 from the article's contentBlocks for the table of contents. */
export function extractToc(contentBlocks: any[]): Array<{ id: string; text: string }> {
  const toc: Array<{ id: string; text: string }> = [];
  for (const b of contentBlocks ?? []) {
    const content =
      b?._type === "textContent" ? b.content :
      b?._type === "doubleTextBlock" ? [b?.leftContent?.blockContent?.content, b?.rightContent?.blockContent?.content].flat() :
      null;
    if (Array.isArray(content)) {
      for (const node of content) {
        if (node?._type === "block" && node?.style === "h2") {
          const text = blockText(node);
          if (text) toc.push({ id: slugify(text), text });
        }
      }
    }
  }
  return toc;
}

/* PortableText component map — the article's editorial typography. */
export const insightsComponents = {
  types: {
    image: ({ value }: any) => {
      const url = value?.asset?.url || safeUrl(value);
      const w = value?.asset?.metadata?.dimensions?.width || 1600;
      const h = value?.asset?.metadata?.dimensions?.height || 1000;
      if (!url) return null;
      return (
        <figure className="iart__figure">
          <Image src={url} alt={value?.alt || "Cyprus VIP Estates"} width={w} height={h} style={{ width: "100%", height: "auto" }} loading="lazy" />
          {value?.alt && <figcaption className="iart__caption">{value.alt}</figcaption>}
        </figure>
      );
    },
  },
  block: {
    normal: ({ children, value }: any) => {
      // legacy "Related Article: <link>" paragraphs → the inline callout (preview only)
      const rec = detectRelatedArticleParagraph(value);
      return rec ? <RelatedArticleCallout {...rec} /> : <p className="iart__p">{children}</p>;
    },
    h1: ({ children, value }: any) => <h2 id={slugify(blockText(value))} className="iart__h2">{children}</h2>,
    h2: ({ children, value }: any) => <h2 id={slugify(blockText(value))} className="iart__h2">{children}</h2>,
    h3: ({ children }: any) => <h3 className="iart__h3">{children}</h3>,
    h4: ({ children }: any) => <h4 className="iart__h4">{children}</h4>,
    h5: ({ children }: any) => <h5 className="iart__h4">{children}</h5>,
    blockquote: ({ children }: any) => (
      <blockquote className="iart__quote"><p>{children}</p></blockquote>
    ),
  },
  list: {
    bullet: ({ children }: any) => <ul className="iart__ul">{children}</ul>,
    number: ({ children }: any) => <ol className="iart__ol">{children}</ol>,
  },
  listItem: {
    bullet: ({ children }: any) => <li className="iart__li">{children}</li>,
    number: ({ children }: any) => <li className="iart__li">{children}</li>,
  },
  marks: {
    strong: ({ children }: any) => <strong>{children}</strong>,
    em: ({ children }: any) => <em>{children}</em>,
    link: ({ children, value }: any) => {
      const href = value?.href || "#";
      const ext = /^https?:\/\//.test(href);
      return (
        <Link href={href} className="iart__link" {...(ext ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
          {children}
        </Link>
      );
    },
  },
};

/* ---- non-text content blocks ---- */
function ImageFull({ block }: { block: any }) {
  const url = safeUrl(block?.imageMain?.picture);
  if (!url) return null;
  const ratio = block?.imageMain?.aspectRatio === "1:1" ? "1 / 1" : block?.imageMain?.aspectRatio === "4:3" ? "4 / 3" : "16 / 9";
  const caption = (block?.description?.textItems ?? []).map((t: any) => t.text).join("");
  return (
    <figure className="iart__figure iart__figure--full">
      <div className="iart__figure-media" style={{ aspectRatio: ratio }}>
        <img src={url} alt={block?.imageMain?.picture?.alt || block?.title || ""} loading="lazy" />
      </div>
      {block?.hasDescription && caption && <figcaption className="iart__caption">{caption}</figcaption>}
    </figure>
  );
}

function FaqBlock({ block }: { block: any }) {
  const raw = block?.faq?.items ?? block?.items ?? [];
  if (!raw.length) return null;
  // pre-render answers on the server; the client accordion only drives open/close
  const items = raw.map((it: any, i: number) => ({
    key: it._key ?? String(i),
    question: it.question,
    answer: Array.isArray(it.answer)
      ? <PortableText value={it.answer} components={insightsComponents as any} />
      : <p className="iart__p">{it.answer}</p>,
  }));
  return <FaqAccordion items={items} />;
}

/* Shared editorial callout (no image) for both the CMS-authored block and the
   render-time conversion of legacy references. Emits its own Article/BlogPosting
   JSON-LD — independent per instance, so multiple are all valid and the main
   article schema is never touched. */
function RelatedArticleCallout({ label, title, excerpt, href, canonical, schemaType = "BlogPosting" }: {
  label: string; title: string; excerpt?: string; href: string; canonical?: string; schemaType?: string;
}) {
  if (!title || !href) return null;
  const clean = (excerpt || "").trim();
  const ld = canonical
    ? { "@context": "https://schema.org", "@type": schemaType, headline: title, ...(clean ? { description: clean } : {}), url: canonical, mainEntityOfPage: canonical }
    : null;
  return (
    <aside className="iart__inrel">
      <a className="iart__inrel-card" href={href}>
        <span className="iart__inrel-label">{label}</span>
        <h4 className="iart__inrel-title">{title}</h4>
        {clean && <p className="iart__inrel-excerpt">{clean}</p>}
        <span className="iart__inrel-cta">
          Read article
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M3 13L13 3M13 3H6M13 3V10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </a>
      {ld && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />}
    </aside>
  );
}

/* CMS-authored Inline Related Article block (data-driven). */
function InlineRelatedArticle({ block }: { block: any }) {
  const r = block?.resolved;
  if (!r?.title || !r?.slug) return null;
  return (
    <RelatedArticleCallout
      label={block?.label === "Related Guide" ? "Related Guide" : "Related Article"}
      title={r.title}
      excerpt={r.excerpt}
      href={`/preview-insights/${r.slug}`}
      canonical={`${SITE_URL}${localizedHref(r.language || "en", ["blog", r.slug])}`}
      schemaType="BlogPosting"
    />
  );
}

/* Render-time conversion: detect a standalone legacy "Related Article: <link>"
   paragraph and return callout props. Only fires when the paragraph TEXT STARTS
   with the label, so contextual in-sentence links are never touched. Preview only:
   stored content and the live blog are unchanged. */
function detectRelatedArticleParagraph(value: any): null | { label: string; title: string; href: string; canonical?: string; schemaType?: string } {
  if (!value || value._type !== "block") return null;
  const children = value.children ?? [];
  const text = children.map((c: any) => c?.text ?? "").join("").trim();
  if (!/^related\s+article\s*:/i.test(text)) return null;
  const linkDef = (value.markDefs ?? []).find((d: any) => d?._type === "link" && d?.href);
  if (!linkDef?.href) return null;
  const linkedText = children
    .filter((c: any) => Array.isArray(c?.marks) && c.marks.includes(linkDef._key))
    .map((c: any) => c?.text ?? "")
    .join("")
    .trim();
  const title = linkedText || text.replace(/^related\s+article\s*:\s*/i, "").trim();
  if (!title) return null;

  const raw = String(linkDef.href).trim();
  const blog = raw.match(/\/blog\/([^/?#]+)/);
  if (blog) {
    const slug = blog[1];
    // Was `/preview-insights/${slug}` — a route that 500s in production (the
    // live blog page at src/app/[lang]/blog/[slug]/page.tsx uses this same
    // function, despite the file header's "preview only" assumption). Use the
    // real localized blog path instead, matching `canonical` just below.
    const href = localizedHref("en", ["blog", slug]);
    return { label: "Related Article", title, href, canonical: `${SITE_URL}${href}`, schemaType: "BlogPosting" };
  }
  // non-blog target (e.g. a case study) — keep the original destination
  const abs = /^https?:\/\//i.test(raw) ? raw : `${SITE_URL}${raw.startsWith("/") ? "" : "/"}${raw}`;
  return { label: "Related Article", title, href: raw, canonical: abs, schemaType: "Article" };
}

function TableBlock({ block }: { block: any }) {
  const cols = block?.columns ?? [];
  const rows = block?.rows ?? [];
  if (!cols.length && !rows.length) return null;
  return (
    <div className="iart__table-wrap">
      <table className="iart__table">
        {cols.length > 0 && (
          <thead><tr>{cols.map((c: string, i: number) => <th key={i}>{c}</th>)}</tr></thead>
        )}
        <tbody>
          {rows.map((r: any) => (
            <tr key={r._key}>{(r.cells ?? []).map((cell: string, i: number) => <td key={i}>{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function renderInsightsBlock(block: any) {
  switch (block?._type) {
    case "textContent":
      return (
        <div className="iart__rich" key={block._key}>
          <PortableText value={block.content} components={insightsComponents as any} />
        </div>
      );
    case "imageFullBlock":
      return <ImageFull block={block} key={block._key} />;
    case "faqBlock":
    case "accordionBlock":
      return <FaqBlock block={block} key={block._key} />;
    case "inlineRelatedArticleBlock":
      return <InlineRelatedArticle block={block} key={block._key} />;
    case "tableBlock":
      return <TableBlock block={block} key={block._key} />;
    case "doubleTextBlock": {
      const cells = [block?.leftContent, block?.rightContent].filter(Boolean);
      return (
        <div className="iart__double" key={block._key}>
          {cells.map((c: any, i: number) =>
            c?.type === "image" && c?.image ? (
              <figure className="iart__figure" key={i}><img src={safeUrl(c.image)} alt="" loading="lazy" /></figure>
            ) : c?.blockContent?.content ? (
              <div className="iart__rich" key={i}><PortableText value={c.blockContent.content} components={insightsComponents as any} /></div>
            ) : null,
          )}
        </div>
      );
    }
    default:
      return null; // button/projects/form blocks are omitted in the reading preview
  }
}
