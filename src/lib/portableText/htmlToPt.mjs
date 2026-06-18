// HTML → Portable Text (server-side; uses node-html-parser). Inverse of ptToHtml.mjs.
// Consumes TipTap's getHTML() output and produces valid Portable Text blocks.
import { parse } from "node-html-parser";

let _k = 0;
const key = () => `pt${(_k++).toString(36)}`;
const textSpan = (text, marks = []) => ({ _type: "span", _key: key(), text, marks });

function localUrlToRef(url) {
  if (!url) return null;
  let m = url.match(/\/uploads\/images\/([a-f0-9]+)-(\d+x\d+)\.(\w+)$/);
  if (m) return `image-${m[1]}-${m[2]}-${m[3]}`;
  m = url.match(/\/uploads\/files\/([a-f0-9]+)\.(\w+)$/);
  if (m) return `file-${m[1]}-${m[2]}`;
  return null;
}

function block(style, children, markDefs) {
  return { _type: "block", _key: key(), style, markDefs: markDefs ?? [], children: children.length ? children : [textSpan("")] };
}

// Walk inline content collecting spans + link markDefs, accumulating decorator marks.
function parseInline(node, marks, markDefs, spans) {
  for (const child of node.childNodes ?? []) {
    if (child.nodeType === 3) {
      const text = child.text;
      if (text) spans.push(textSpan(text, [...marks]));
    } else if (child.nodeType === 1) {
      const tag = (child.tagName ?? "").toLowerCase();
      if (tag === "strong" || tag === "b") parseInline(child, [...new Set([...marks, "strong"])], markDefs, spans);
      else if (tag === "em" || tag === "i") parseInline(child, [...new Set([...marks, "em"])], markDefs, spans);
      else if (tag === "a") {
        const mk = key();
        markDefs.push({ _key: mk, _type: "link", href: child.getAttribute("href") ?? "" });
        parseInline(child, [...marks, mk], markDefs, spans);
      } else if (tag === "br") {
        // soft break — ignore for block content
      } else {
        parseInline(child, marks, markDefs, spans);
      }
    }
  }
}

function inlineBlock(el, style) {
  const spans = [];
  const markDefs = [];
  parseInline(el, [], markDefs, spans);
  return block(style, spans, markDefs);
}

export function htmlToPortableText(html) {
  _k = 0;
  const root = parse(html ?? "", { lowerCaseTagName: true });
  const blocks = [];
  for (const el of root.childNodes ?? []) {
    if (el.nodeType === 3) {
      const t = el.text.trim();
      if (t) blocks.push(block("normal", [textSpan(t)]));
      continue;
    }
    if (el.nodeType !== 1) continue;
    const tag = (el.tagName ?? "").toLowerCase();
    if (tag === "p" || tag === "blockquote") blocks.push(inlineBlock(el, tag === "p" ? "normal" : "blockquote"));
    else if (tag === "h1" || tag === "h2") blocks.push(inlineBlock(el, "h2"));
    else if (tag === "h3") blocks.push(inlineBlock(el, "h3"));
    else if (tag === "h4" || tag === "h5" || tag === "h6") blocks.push(inlineBlock(el, "h4"));
    else if (tag === "ul" || tag === "ol") {
      const lt = tag === "ol" ? "number" : "bullet";
      for (const li of el.childNodes ?? []) {
        if (li.nodeType === 1 && (li.tagName ?? "").toLowerCase() === "li") {
          const spans = [];
          const markDefs = [];
          parseInline(li, [], markDefs, spans);
          blocks.push({ _type: "block", _key: key(), style: "normal", listItem: lt, level: 1, markDefs, children: spans.length ? spans : [textSpan("")] });
        }
      }
    } else if (tag === "img") {
      const ref = localUrlToRef(el.getAttribute("src"));
      if (ref) blocks.push({ _type: "image", _key: key(), asset: { _type: "reference", _ref: ref }, alt: el.getAttribute("alt") ?? "" });
    } else {
      const b = inlineBlock(el, "normal");
      if (b.children.some((c) => c.text)) blocks.push(b);
    }
  }
  if (!blocks.length) blocks.push(block("normal", [textSpan("")]));
  return blocks;
}
