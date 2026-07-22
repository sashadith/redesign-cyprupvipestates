"use client";
import { useState, useCallback, useMemo } from "react";
import RichTextField from "./RichTextField";
import BlockFieldEditor from "./block-editors/BlockFieldEditor";
import { portableTextToHtml } from "@/lib/portableText/ptToHtml.mjs";

type Item = { key: string; type: string; block?: any; html?: string };

let counter = 0;
const newKey = () => `new-${Date.now().toString(36)}-${counter++}`;

function summarize(b: any): string {
  if (!b || typeof b !== "object") return "";
  if (b._type === "inlineRelatedArticleBlock") return b.label || "Related article";
  return b.title || b.doubleTextBlockTitle || b.faqTitle || b.buttonLabel || "";
}

// Field name of the hidden input this renders — the parent page's single Save
// form reads it directly (any content type using BlockEditor inside its form
// gets content-block persistence "for free", no per-page wiring needed).
export const CONTENT_BLOCKS_FIELD = "contentBlocksJson";

export default function BlockEditor({ kind, initialBlocks }: { kind: "blog" | "singlepage" | "caseStudy"; initialBlocks: any[] }) {
  const [items, setItems] = useState<Item[]>(() =>
    (Array.isArray(initialBlocks) ? initialBlocks : []).map((b, i) => ({
      key: b?._key || `b${i}`,
      type: b?._type || "unknown",
      block: b,
      html: b?._type === "textContent" ? portableTextToHtml(b.content || []) : undefined,
    })),
  );
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  // Same shape saveBlogContentBlocks/saveSinglepageContentBlocks/saveCaseStudyContentBlocks
  // used to receive directly — now serialized into the enclosing form instead.
  const serialized = useMemo(
    () => JSON.stringify(items.map((it) => (it.type === "textContent" ? { type: "textContent", key: it.key, html: it.html ?? "" } : { type: it.type, key: it.key, block: it.block }))),
    [items],
  );

  const setHtml = useCallback((key: string, html: string) => {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, html } : it)));
  }, []);
  const setBlock = useCallback((key: string, block: any) => {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, block } : it)));
  }, []);
  const move = (i: number, dir: -1 | 1) =>
    setItems((prev) => {
      const a = [...prev]; const j = i + dir;
      if (j < 0 || j >= a.length) return prev;
      [a[i], a[j]] = [a[j], a[i]];
      return a;
    });
  const reorder = (from: number, to: number) =>
    setItems((prev) => {
      if (from === to || from < 0 || to < 0 || from >= prev.length || to >= prev.length) return prev;
      const a = [...prev]; const [moved] = a.splice(from, 1); a.splice(to, 0, moved); return a;
    });
  const del = (i: number) => setItems((prev) => prev.filter((_, idx) => idx !== i));
  const addText = () => setItems((prev) => [...prev, { key: newKey(), type: "textContent", html: "<p></p>" }]);
  const addRelated = () =>
    setItems((prev) => {
      const key = newKey();
      return [...prev, { key, type: "inlineRelatedArticleBlock", block: { _type: "inlineRelatedArticleBlock", _key: key, label: "Related Article", article: null } }];
    });
  // Table block — columns are the header row; seed a 2×1 grid, editable via +col / +row.
  const addTable = () =>
    setItems((prev) => {
      const key = newKey();
      return [...prev, { key, type: "tableBlock", block: {
        _type: "tableBlock", _key: key,
        columns: ["Column 1", "Column 2"],
        rows: [{ _key: newKey(), _type: "tableRow", cells: ["", ""] }],
      } }];
    });
  // FAQ block — wraps an accordion (faq.items); answers are rich text. Shape matches
  // the Sanity faqBlock so the existing frontend renderer picks it up unchanged.
  const addFaq = () =>
    setItems((prev) => {
      const key = newKey();
      return [...prev, { key, type: "faqBlock", block: {
        _type: "faqBlock", _key: key,
        faq: { _type: "accordionBlock", _key: newKey(), items: [{ _key: newKey(), question: "", answer: [] }] },
      } }];
    });
  // Image block — upload + alt via the imageFullBlock editor; renders full-width.
  const addImage = () =>
    setItems((prev) => {
      const key = newKey();
      return [...prev, { key, type: "imageFullBlock", block: {
        _type: "imageFullBlock", _key: key, title: "", hasDescription: false,
        imageMain: { picture: { _type: "image", alt: "", asset: null }, aspectRatio: "16:9" },
      } }];
    });
  // Button block — link (buttonText + URL + target); empty URL keeps the modal CTA.
  const addButton = () =>
    setItems((prev) => {
      const key = newKey();
      return [...prev, { key, type: "buttonBlock", block: {
        _type: "buttonBlock", _key: key, buttonText: "Learn more", url: "", target: "_self",
        justifyContent: "center", alignItems: "center",
      } }];
    });
  // Projects block — live city/type/price query + optional pins/excludes,
  // rendered as the paginated grid (ProjectsSectionBlockComponent), same as
  // landing pages. pinnedRefs/excludeRefs present (even empty) is what marks
  // this a "new-style" block for BlockFieldEditor's picker UI and the
  // blog/case-study renderers — see src/types/blog.ts's ProjectsSectionBlock.
  const addProjects = () =>
    setItems((prev) => {
      const key = newKey();
      return [...prev, { key, type: "projectsSectionBlock", block: {
        _type: "projectsSectionBlock", _key: key, title: "", projects: [],
        pinnedRefs: [], excludeRefs: [], pageSize: 12,
      } }];
    });

  return (
    <div className="bg-white rounded-lg border border-[#E5E7EB] p-5">
      <input type="hidden" name={CONTENT_BLOCKS_FIELD} value={serialized} />
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold">Content blocks <span className="text-[#9CA3AF] font-normal">({items.length})</span></h2>
      </div>
      <p className="text-xs text-[#9CA3AF] mb-4">Drag the ⠿ handle to reorder, or use ↑↓. Part of the page&apos;s single Save button below.</p>

      <div className="space-y-3">
        {items.map((it, i) => (
          <div
            key={it.key}
            onDragOver={(e) => { if (dragIndex !== null) e.preventDefault(); }}
            onDrop={(e) => { e.preventDefault(); if (dragIndex !== null) { reorder(dragIndex, i); setDragIndex(null); } }}
            className={`border rounded-md ${dragIndex === i ? "border-[#1B4B43] opacity-60" : "border-[#E5E7EB]"}`}
          >
            <div className="flex items-center justify-between bg-[#F8F9FA] px-3 py-1.5 border-b border-[#E5E7EB]">
              <span className="flex items-center gap-2 text-xs font-medium text-[#6B7280]">
                <span
                  draggable
                  onDragStart={() => setDragIndex(i)}
                  onDragEnd={() => setDragIndex(null)}
                  title="Drag to reorder"
                  className="cursor-grab active:cursor-grabbing select-none text-[#9CA3AF] hover:text-[#1B4B43]"
                >⠿</span>
                {it.type}{summarize(it.block) ? ` — ${summarize(it.block)}` : ""}
              </span>
              <span className="flex items-center gap-1">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="text-xs px-1.5 py-0.5 rounded border border-[#E5E7EB] disabled:opacity-40">↑</button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} className="text-xs px-1.5 py-0.5 rounded border border-[#E5E7EB] disabled:opacity-40">↓</button>
                <button type="button" onClick={() => del(i)} className="text-xs px-1.5 py-0.5 rounded border border-[#E5E7EB] text-[#C0392B]">✕</button>
              </span>
            </div>
            <div className="p-3">
              {it.type === "textContent"
                ? <RichTextField initialHtml={it.html ?? ""} onChange={(html) => setHtml(it.key, html)} />
                : <BlockFieldEditor block={it.block} onChange={(b) => setBlock(it.key, b)} />}
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-[#6B7280]">No content blocks yet.</p>}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={addText} className="rounded-md border border-[#1B4B43] text-[#1B4B43] text-sm px-4 py-1.5 hover:bg-[#1B4B43]/5">
          + Add text block
        </button>
        <button type="button" onClick={addRelated} className="rounded-md border border-[#1B4B43] text-[#1B4B43] text-sm px-4 py-1.5 hover:bg-[#1B4B43]/5">
          + Add related article
        </button>
        {kind === "blog" && (
          <>
            <button type="button" onClick={addTable} className="rounded-md border border-[#1B4B43] text-[#1B4B43] text-sm px-4 py-1.5 hover:bg-[#1B4B43]/5">
              + Add table
            </button>
            <button type="button" onClick={addFaq} className="rounded-md border border-[#1B4B43] text-[#1B4B43] text-sm px-4 py-1.5 hover:bg-[#1B4B43]/5">
              + Add FAQ
            </button>
            <button type="button" onClick={addImage} className="rounded-md border border-[#1B4B43] text-[#1B4B43] text-sm px-4 py-1.5 hover:bg-[#1B4B43]/5">
              + Add image
            </button>
            <button type="button" onClick={addButton} className="rounded-md border border-[#1B4B43] text-[#1B4B43] text-sm px-4 py-1.5 hover:bg-[#1B4B43]/5">
              + Add button
            </button>
            <button type="button" onClick={addProjects} className="rounded-md border border-[#1B4B43] text-[#1B4B43] text-sm px-4 py-1.5 hover:bg-[#1B4B43]/5">
              + Add projects
            </button>
          </>
        )}
      </div>
    </div>
  );
}
