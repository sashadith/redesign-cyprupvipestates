// Blog contentBlocks → clean Markdown for the blog MCP tools (2026-10-03).
// Pure twin of src/lib/portableText/ptToHtml.mjs, extended to the article
// block types the reading view renders (src/app/preview-insights/
// insightsBlocks.tsx): textContent, doubleTextBlock, faqBlock/accordionBlock,
// tableBlock, imageFullBlock. Buttons, project sliders, forms and inline
// related-article teasers are chrome, not article text — omitted, as the
// reading view omits them. Every link is collected with the H2 it sits under
// so the tool can report sources with their section.

export type ArticleLink = { text: string; href: string; section: string | null };
export type MarkdownResult = { markdown: string; links: ArticleLink[]; wordCount: number };

const IMAGE_RE = /^image-([a-f0-9]+)-(\d+)x(\d+)-(\w+)$/;

function refToLocalUrl(ref: unknown): string | null {
  if (typeof ref !== "string") return null;
  if (ref.startsWith("/uploads/")) return ref;
  const m = ref.match(IMAGE_RE);
  return m ? `/uploads/images/${m[1]}-${m[2]}x${m[3]}.${m[4]}` : null;
}

function imageUrl(img: any): string | null {
  if (!img) return null;
  return (
    (typeof img?.asset?.url === "string" && img.asset.url.startsWith("/uploads/") ? img.asset.url : null) ??
    refToLocalUrl(img?.asset?._ref ?? img?.asset?._id)
  );
}

const escapeMd = (s: string) => s.replace(/([*_`[\]])/g, "\\$1");
const collapse = (s: string) => s.replace(/[ \t]+/g, " ").trim();

type Ctx = { lines: string[]; links: ArticleLink[]; section: string | null };

function spanMd(span: any, markDefs: any[], ctx: Ctx): string {
  let text = escapeMd(String(span?.text ?? ""));
  for (const m of span?.marks ?? []) {
    if (m === "strong") text = `**${text}**`;
    else if (m === "em") text = `*${text}*`;
    else {
      const def = (markDefs ?? []).find((d) => d?._key === m);
      if (def?._type === "link" && typeof def.href === "string" && def.href.trim()) {
        const href = def.href.trim();
        ctx.links.push({ text: collapse(String(span?.text ?? "")), href, section: ctx.section });
        text = `[${text}](${href})`;
      }
    }
  }
  return text;
}

function portableTextMd(blocks: any[], ctx: Ctx): void {
  let listType: "bullet" | "number" | null = null;
  let n = 0;
  const endList = () => {
    if (listType) ctx.lines.push("");
    listType = null;
    n = 0;
  };
  for (const b of blocks ?? []) {
    if (!b || typeof b !== "object") continue;
    if (b._type === "image") {
      endList();
      const url = imageUrl(b);
      if (url) ctx.lines.push(`![${collapse(String(b.alt ?? ""))}](${url})`, "");
      continue;
    }
    if (b._type !== "block") { endList(); continue; }
    const inner = (b.children ?? []).map((c: any) => spanMd(c, b.markDefs, ctx)).join("");
    const text = collapse(inner);
    if (b.listItem) {
      const lt = b.listItem === "number" ? "number" : "bullet";
      if (listType && listType !== lt) endList();
      listType = lt;
      n++;
      const indent = "  ".repeat(Math.max(0, (b.level ?? 1) - 1));
      ctx.lines.push(`${indent}${lt === "number" ? `${n}.` : "-"} ${text}`);
      continue;
    }
    endList();
    if (!text) continue;
    switch (b.style) {
      case "h1": case "h2": ctx.section = collapse((b.children ?? []).map((c: any) => c?.text ?? "").join("")); ctx.lines.push(`## ${text}`, ""); break;
      case "h3": ctx.lines.push(`### ${text}`, ""); break;
      case "h4": ctx.lines.push(`#### ${text}`, ""); break;
      case "h5": case "h6": ctx.lines.push(`##### ${text}`, ""); break;
      case "blockquote": ctx.lines.push(`> ${text}`, ""); break;
      default: ctx.lines.push(text, "");
    }
  }
  endList();
}

function tableMd(block: any, ctx: Ctx): void {
  const columns: string[] = Array.isArray(block?.columns) ? block.columns.map((c: unknown) => collapse(String(c ?? ""))) : [];
  const rows: string[][] = (block?.rows ?? []).map((r: any) => (r?.cells ?? []).map((c: unknown) => collapse(String(c ?? ""))));
  const width = Math.max(columns.length, ...rows.map((r) => r.length), 0);
  if (!width) return;
  const pad = (r: string[]) => Array.from({ length: width }, (_, i) => (r[i] ?? "").replace(/\|/g, "\\|"));
  const header = columns.length ? pad(columns) : pad(rows.shift() ?? []);
  ctx.lines.push(`| ${header.join(" | ")} |`, `| ${header.map(() => "---").join(" | ")} |`);
  for (const r of rows) ctx.lines.push(`| ${pad(r).join(" | ")} |`);
  ctx.lines.push("");
}

function faqMd(block: any, ctx: Ctx): void {
  const items: any[] = block?.faq?.items ?? block?.items ?? [];
  for (const it of items) {
    const q = collapse(String(it?.question ?? ""));
    if (!q) continue;
    ctx.lines.push(`### ${q}`, "");
    if (Array.isArray(it?.answer)) portableTextMd(it.answer, ctx);
    else if (it?.answer) ctx.lines.push(collapse(String(it.answer)), "");
  }
}

export function contentBlocksToMarkdown(blocks: unknown): MarkdownResult {
  const ctx: Ctx = { lines: [], links: [], section: null };
  for (const b of Array.isArray(blocks) ? blocks : []) {
    switch (b?._type) {
      case "textContent": portableTextMd(b.content ?? [], ctx); break;
      case "doubleTextBlock":
        for (const cell of [b.leftContent, b.rightContent]) {
          if (!cell) continue;
          if (cell.type === "image" && cell.image) {
            const url = imageUrl(cell.image);
            if (url) ctx.lines.push(`![${collapse(String(cell.image?.alt ?? ""))}](${url})`, "");
          } else if (Array.isArray(cell.blockContent?.content)) portableTextMd(cell.blockContent.content, ctx);
        }
        break;
      case "faqBlock": case "accordionBlock": faqMd(b, ctx); break;
      case "tableBlock": tableMd(b, ctx); break;
      case "imageFullBlock": {
        const url = imageUrl(b.imageMain?.picture);
        if (url) ctx.lines.push(`![${collapse(String(b.imageMain?.picture?.alt || b.title || ""))}](${url})`, "");
        break;
      }
      default: break; // buttonBlock, projectsSectionBlock, inlineRelatedArticleBlock, forms — not article text
    }
  }
  const markdown = ctx.lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  const WORD_RE = new RegExp("[\\p{L}\\p{N}]", "u"); // constructed: the tsconfig target predates the `u` flag
  const wordCount = markdown.replace(/!\[[^\]]*\]\([^)]*\)/g, "").split(/\s+/).filter((w) => WORD_RE.test(w)).length;
  return { markdown, links: ctx.links, wordCount };
}

// ---- sources ---------------------------------------------------------------

export const OWN_HOST = "cyprusvipestates.com";
// Profile hosts are "follow us", not evidence.
const SOCIAL_HOSTS = ["linkedin.com", "lnkd.in", "facebook.com", "fb.com", "instagram.com", "x.com", "twitter.com", "t.co", "youtube.com", "youtu.be", "tiktok.com", "t.me", "wa.me", "threads.net", "pinterest.com"];

function hostOf(href: string): string | null {
  try { return new URL(href).hostname.toLowerCase().replace(/^www\./, ""); } catch { return null; }
}
const underDomain = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`);

export function isOwnLink(href: string): boolean {
  const h = hostOf(href);
  return h === null ? href.startsWith("/") || href.startsWith("#") : underDomain(h, OWN_HOST);
}
export function isSocialProfileLink(href: string): boolean {
  const h = hostOf(href);
  return !!h && SOCIAL_HOSTS.some((d) => underDomain(h, d));
}

function normalizeUrl(href: string): string {
  try {
    const u = new URL(href);
    u.hash = "";
    let s = u.toString();
    if (s.endsWith("/") && u.pathname === "/") s = s.slice(0, -1);
    return s;
  } catch { return href; }
}

export type SourceLink = { text: string; url: string; section: string | null };

/** External links only: own domain (incl. subdomains), relative/anchor links and social profiles excluded; deduplicated by URL (first text wins). */
export function extractSources(links: ArticleLink[]): { sources: SourceLink[]; internalLinks: SourceLink[] } {
  const sources = new Map<string, SourceLink>();
  const internal = new Map<string, SourceLink>();
  for (const l of links) {
    const href = l.href.trim();
    if (!href || /^(mailto|tel):/i.test(href)) continue;
    if (isOwnLink(href)) { if (!internal.has(href)) internal.set(href, { text: l.text, url: href, section: l.section }); continue; }
    if (!/^https?:\/\//i.test(href) || isSocialProfileLink(href)) continue;
    const key = normalizeUrl(href);
    if (!sources.has(key)) sources.set(key, { text: l.text, url: key, section: l.section });
  }
  return { sources: Array.from(sources.values()), internalLinks: Array.from(internal.values()) };
}
