// Portable Text → HTML (pure, client+server safe). Used to load content into the TipTap editor
// and is the inverse of htmlToPt.mjs. Handles the standard block content the body fields use:
// paragraphs, h2/h3/h4/h5, blockquote, bullet/number lists, strong/em, links, and images.

const IMAGE_RE = /^image-([a-f0-9]+)-(\d+)x(\d+)-(\w+)$/;
const FILE_RE = /^file-([a-f0-9]+)-(\w+)$/;

function refToLocalUrl(ref) {
  if (!ref || typeof ref !== "string") return null;
  if (ref.startsWith("/uploads/")) return ref;
  const i = ref.match(IMAGE_RE);
  if (i) return `/uploads/images/${i[1]}-${i[2]}x${i[3]}.${i[4]}`;
  const f = ref.match(FILE_RE);
  if (f) return `/uploads/files/${f[1]}.${f[2]}`;
  return null;
}

function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function spanHtml(span, markDefs) {
  let html = esc(span?.text ?? "");
  for (const m of span?.marks ?? []) {
    if (m === "strong") html = `<strong>${html}</strong>`;
    else if (m === "em") html = `<em>${html}</em>`;
    else {
      const def = (markDefs ?? []).find((d) => d._key === m);
      if (def && def._type === "link") html = `<a href="${esc(def.href ?? "")}">${html}</a>`;
    }
  }
  return html;
}

export function portableTextToHtml(blocks) {
  if (!Array.isArray(blocks)) return "";
  let html = "";
  let listType = null;
  let buf = [];
  const flush = () => {
    if (buf.length) {
      const tag = listType === "number" ? "ol" : "ul";
      html += `<${tag}>${buf.join("")}</${tag}>`;
      buf = []; listType = null;
    }
  };
  for (const b of blocks) {
    if (!b || typeof b !== "object") continue;
    if (b._type === "image") {
      flush();
      const url = refToLocalUrl(b.asset?._ref ?? b.asset?._id);
      if (url) html += `<img src="${esc(url)}" alt="${esc(b.alt ?? "")}">`;
      continue;
    }
    if (b._type !== "block") { flush(); continue; }
    const children = (b.children ?? []).map((c) => spanHtml(c, b.markDefs)).join("");
    if (b.listItem) {
      const lt = b.listItem === "number" ? "number" : "bullet";
      if (listType && listType !== lt) flush();
      listType = lt;
      buf.push(`<li>${children || ""}</li>`);
      continue;
    }
    flush();
    const style = b.style ?? "normal";
    const tag = style === "h2" ? "h2" : style === "h3" ? "h3" : style === "h4" ? "h4" : style === "h5" ? "h5" : style === "blockquote" ? "blockquote" : "p";
    html += `<${tag}>${children || ""}</${tag}>`;
  }
  flush();
  return html;
}
