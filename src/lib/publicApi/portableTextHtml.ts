// Portable Text → HTML serializer for the public blog API.
//
// The site renders Portable Text with @portabletext/react at request time; a
// consuming portal cannot do that, so this module produces the same document
// as plain, semantic HTML. It is deliberately dependency-free and framework-
// free: every tag here is one a foreign CMS/theme can style with its own CSS.
//
// Heading ids come from the shared `slugify` (transliterating, so Cyrillic
// headings get real anchors) — the same function the on-site table of contents
// uses, so anchor links keep working when an article is republished elsewhere.
import { slugify } from "@/lib/slugify";
import { refToLocalUrl, refDimensions } from "@/lib/sanityRefs";
import { blurForRef } from "@/lib/blurStore";
import { abs, SITE_URL } from "@/lib/seo";

export type ApiImage = {
  url: string;
  width: number | null;
  height: number | null;
  alt: string;
  blurDataUrl: string | null;
};

export type Heading = { id: string; text: string; level: number };

export type SerializeContext = {
  /** Every image encountered, in document order (deduped by URL by the caller). */
  images: ApiImage[];
  /** Every h2/h3/h4, in document order — ready to build a table of contents. */
  headings: Heading[];
};

export function createContext(): SerializeContext {
  return { images: [], headings: [] };
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Resolve a Sanity-style image object (or bare ref) to an absolute, public URL. */
export function resolveImage(source: any, fallbackAlt = ""): ApiImage | null {
  const ref: string | null =
    typeof source === "string"
      ? source
      : source?.asset?._ref ?? source?.asset?._id ?? source?._ref ?? source?._id ?? source?.asset?.url ?? source?.url ?? null;
  const localUrl = refToLocalUrl(ref);
  if (!localUrl) return null;
  const dims = refDimensions(ref);
  return {
    url: abs(localUrl),
    width: dims?.width ?? null,
    height: dims?.height ?? null,
    alt: typeof source?.alt === "string" ? source.alt : fallbackAlt,
    blurDataUrl: blurForRef(ref),
  };
}

function imageHtml(img: ApiImage): string {
  const dims =
    img.width && img.height ? ` width="${img.width}" height="${img.height}"` : "";
  return (
    `<figure class="cvp-figure">` +
    `<img src="${escapeHtml(img.url)}" alt="${escapeHtml(img.alt)}"${dims} loading="lazy" decoding="async">` +
    `</figure>`
  );
}

/** Flatten a Portable Text block's spans to plain text (for TOC labels, JSON-LD). */
export function blockPlainText(block: any): string {
  return (block?.children ?? []).map((c: any) => c?.text ?? "").join("").trim();
}

/** Flatten a whole Portable Text array to plain text, one paragraph per line. */
export function portableTextToPlainText(value: any): string {
  if (!Array.isArray(value)) return "";
  return value
    .filter((n) => n?._type === "block")
    .map(blockPlainText)
    .filter(Boolean)
    .join("\n");
}

const DECORATOR_TAGS: Record<string, string> = {
  strong: "strong",
  em: "em",
  underline: "u",
  "strike-through": "s",
  code: "code",
};

function spansHtml(block: any): string {
  const markDefs: any[] = Array.isArray(block?.markDefs) ? block.markDefs : [];
  const parts: string[] = [];

  for (const span of block?.children ?? []) {
    if (span?._type !== "span") continue;
    const text = escapeHtml(String(span.text ?? ""));
    if (!text) continue;

    const open: string[] = [];
    const close: string[] = [];
    for (const mark of span.marks ?? []) {
      const decorator = DECORATOR_TAGS[mark];
      if (decorator) {
        open.push(`<${decorator}>`);
        close.unshift(`</${decorator}>`);
        continue;
      }
      // Anything else is a markDef key — the only annotation the corpus uses is
      // `link`. Unknown annotations degrade to plain text rather than vanishing.
      const def = markDefs.find((d) => d?._key === mark);
      if (def?._type === "link" && typeof def.href === "string" && def.href) {
        const href = def.href.trim();
        // Cross-references between articles are stored site-relative ("/de/blog/x").
        // Left as-is they would 404 on a foreign domain, so they go out absolute —
        // a working link back to the original always beats a broken one. The
        // original path rides along in data-cvp-internal so a consumer that has
        // its own copy of that article can rewrite the href to it.
        const internalPath = href.startsWith("/")
          ? href
          : href.startsWith(SITE_URL)
            ? href.slice(SITE_URL.length) || "/"
            : null;
        const finalHref = internalPath ? abs(internalPath) : href;
        const rel = internalPath ? "" : ` target="_blank" rel="noopener nofollow"`;
        const marker = internalPath ? ` data-cvp-internal="${escapeHtml(internalPath)}"` : "";
        open.push(`<a href="${escapeHtml(finalHref)}"${marker}${rel}>`);
        close.unshift("</a>");
      }
    }
    parts.push(open.join("") + text + close.join(""));
  }

  return parts.join("");
}

const STYLE_TAGS: Record<string, string> = {
  normal: "p",
  h1: "h2", // an article body never owns the page <h1>
  h2: "h2",
  h3: "h3",
  h4: "h4",
  h5: "h5",
  h6: "h6",
  blockquote: "blockquote",
};

/**
 * Serialize a Portable Text array to HTML. Lists (including one level of
 * nesting, which the corpus does use) are reassembled from the flat
 * `listItem`/`level` blocks Portable Text stores them as.
 */
export function portableTextToHtml(value: any, ctx: SerializeContext): string {
  if (!Array.isArray(value)) return "";

  const out: string[] = [];
  const openLists: string[] = [];
  const itemOpen: boolean[] = [];

  const closeListsDownTo = (targetDepth: number) => {
    while (openLists.length > targetDepth) {
      const depth = openLists.length;
      if (itemOpen[depth]) {
        out.push("</li>");
        itemOpen[depth] = false;
      }
      out.push(`</${openLists.pop()}>`);
    }
  };

  for (const node of value) {
    if (!node || typeof node !== "object") continue;

    if (node._type === "image") {
      closeListsDownTo(0);
      const img = resolveImage(node);
      if (img) {
        ctx.images.push(img);
        out.push(imageHtml(img));
      }
      continue;
    }

    if (node._type !== "block") continue;

    if (node.listItem) {
      const tag = node.listItem === "number" ? "ol" : "ul";
      const level = Math.max(1, Number(node.level) || 1);

      closeListsDownTo(level);
      // Same depth but a different list type → start a fresh list.
      if (openLists.length === level && openLists[level - 1] !== tag) {
        if (itemOpen[level]) {
          out.push("</li>");
          itemOpen[level] = false;
        }
        out.push(`</${openLists.pop()}>`);
      }
      // Opening a deeper list happens *inside* the currently open <li>, which
      // is exactly what nested-list markup requires — so no </li> here.
      while (openLists.length < level) {
        out.push(`<${tag}>`);
        openLists.push(tag);
      }
      if (itemOpen[level]) {
        out.push("</li>");
        itemOpen[level] = false;
      }
      out.push(`<li>${spansHtml(node)}`);
      itemOpen[level] = true;
      continue;
    }

    closeListsDownTo(0);

    const inner = spansHtml(node);
    if (!inner) continue; // the corpus is full of empty spacer paragraphs

    const tag = STYLE_TAGS[node.style ?? "normal"] ?? "p";
    if (tag === "h2" || tag === "h3" || tag === "h4") {
      const text = blockPlainText(node);
      const id = slugify(text);
      if (id) ctx.headings.push({ id, text, level: Number(tag.slice(1)) });
      out.push(`<${tag}${id ? ` id="${escapeHtml(id)}"` : ""}>${inner}</${tag}>`);
    } else {
      out.push(`<${tag}>${inner}</${tag}>`);
    }
  }

  closeListsDownTo(0);
  return out.join("\n");
}


/**
 * Reading time in minutes, using the exact formula the article page shows
 * (textContent words / 200, floor 1) so both properties display the same number.
 */
export function estimateReadingTime(contentBlocks: unknown): number {
  const blocks: any[] = Array.isArray(contentBlocks) ? contentBlocks : [];
  let words = 0;
  for (const block of blocks) {
    if (block?._type !== "textContent" || !Array.isArray(block.content)) continue;
    for (const node of block.content) {
      if (node?._type !== "block") continue;
      words += blockPlainText(node).split(/\s+/).filter(Boolean).length;
    }
  }
  return Math.max(1, Math.round(words / 200));
}
