"use client";
import { useState, useCallback } from "react";
import RichTextField from "./RichTextField";
import { portableTextToHtml } from "@/lib/portableText/ptToHtml.mjs";
import { saveBlogContentBlocks, saveSinglepageContentBlocks } from "./actions";

type Item = { key: string; type: string; block?: any; html?: string };

let counter = 0;
const newKey = () => `new-${Date.now().toString(36)}-${counter++}`;

function summarize(b: any): string {
  if (!b || typeof b !== "object") return "";
  return b.title || b.doubleTextBlockTitle || b.faqTitle || b.buttonLabel || "";
}

export default function BlockEditor({ targetId, kind, initialBlocks }: { targetId: string; kind: "blog" | "singlepage"; initialBlocks: any[] }) {
  const [items, setItems] = useState<Item[]>(() =>
    (Array.isArray(initialBlocks) ? initialBlocks : []).map((b, i) => ({
      key: b?._key || `b${i}`,
      type: b?._type || "unknown",
      block: b,
      html: b?._type === "textContent" ? portableTextToHtml(b.content || []) : undefined,
    })),
  );
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "err">("idle");

  const setHtml = useCallback((key: string, html: string) => {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, html } : it)));
  }, []);
  const move = (i: number, dir: -1 | 1) =>
    setItems((prev) => {
      const a = [...prev]; const j = i + dir;
      if (j < 0 || j >= a.length) return prev;
      [a[i], a[j]] = [a[j], a[i]];
      return a;
    });
  const del = (i: number) => setItems((prev) => prev.filter((_, idx) => idx !== i));
  const addText = () => setItems((prev) => [...prev, { key: newKey(), type: "textContent", html: "<p></p>" }]);

  async function save() {
    setStatus("saving");
    try {
      const action = kind === "singlepage" ? saveSinglepageContentBlocks : saveBlogContentBlocks;
      await action(
        targetId,
        items.map((it) =>
          it.type === "textContent"
            ? { type: "textContent", key: it.key, html: it.html ?? "" }
            : { type: it.type, key: it.key, block: it.block },
        ),
      );
      setStatus("saved");
    } catch {
      setStatus("err");
    }
  }

  return (
    <div className="bg-white rounded-lg border border-[#E5E7EB] p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold">Content blocks <span className="text-[#9CA3AF] font-normal">({items.length})</span></h2>
        <div className="flex items-center gap-2">
          {status === "saved" && <span className="text-xs text-[#2D6E62]">Saved ✓</span>}
          {status === "err" && <span className="text-xs text-[#C0392B]">Save failed</span>}
          <button type="button" onClick={save} disabled={status === "saving"}
            className="rounded-md bg-[#1B4B43] text-white text-sm px-4 py-1.5 hover:bg-[#142E2D] disabled:opacity-60">
            {status === "saving" ? "Saving…" : "Save content blocks"}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {items.map((it, i) => (
          <div key={it.key} className="border border-[#E5E7EB] rounded-md">
            <div className="flex items-center justify-between bg-[#F8F9FA] px-3 py-1.5 border-b border-[#E5E7EB]">
              <span className="text-xs font-medium text-[#6B7280]">
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
                : <p className="text-xs text-[#9CA3AF]">Preserved block (edit its fields in a future update). Reorder or remove it here.</p>}
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-[#6B7280]">No content blocks yet.</p>}
      </div>

      <div className="mt-4">
        <button type="button" onClick={addText} className="rounded-md border border-[#1B4B43] text-[#1B4B43] text-sm px-4 py-1.5 hover:bg-[#1B4B43]/5">
          + Add text block
        </button>
      </div>
    </div>
  );
}
