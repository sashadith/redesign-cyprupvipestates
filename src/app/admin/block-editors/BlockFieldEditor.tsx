"use client";
import { useEffect, useState } from "react";
import { refToLocalUrl } from "@/lib/sanityRefs";
import { listBlogArticlesForPicker } from "../actions";
import { portableTextToHtml } from "@/lib/portableText/ptToHtml.mjs";
import RichTextField from "../RichTextField";
import { findRichFields, getAtPath, setAtPath, isHtmlMarker } from "@/lib/portableText/richText";

// Structured editors for non-rich fields (alignment, table cells, images, FAQ
// questions). ALL rich-text fields — anywhere in any block — go through the same
// RichTextField (TipTap) as page descriptions; editing replaces the field with an
// `{__html}` marker that the save action converts via the shared htmlToPortableText.

let kc = 0;
const k = () => `k-${Date.now().toString(36)}-${kc++}`;
const input = "w-full rounded-md border border-[#E5E7EB] px-2 py-1.5 text-sm outline-none focus:border-[#1B4B43]";

const richInitialHtml = (v: any): string => (isHtmlMarker(v) ? v.__html : portableTextToHtml(Array.isArray(v) ? v : []));
const clone = (o: any) => (typeof structuredClone === "function" ? structuredClone(o) : JSON.parse(JSON.stringify(o)));

function ImageField({ refValue, alt, onChange }: { refValue?: string; alt?: string; onChange: (v: { ref?: string; alt?: string }) => void }) {
  const [busy, setBusy] = useState(false);
  const url = refValue ? refToLocalUrl(refValue) : null;
  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    try {
      const fd = new FormData(); fd.append("file", f);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.ref) onChange({ ref: j.ref, alt });
    } finally { setBusy(false); e.target.value = ""; }
  }
  return (
    <div className="flex items-start gap-3">
      <div className="w-24 h-16 rounded border border-[#E5E7EB] bg-[#F8F9FA] overflow-hidden shrink-0 flex items-center justify-center">
        {url ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={url} alt="" className="w-full h-full object-cover" /> : <span className="text-[10px] text-[#9CA3AF]">none</span>}
      </div>
      <div className="flex-1 space-y-1.5">
        <input type="file" accept="image/*" onChange={upload} disabled={busy}
          className="text-xs file:mr-2 file:rounded file:border-0 file:bg-[#1B4B43] file:text-white file:px-2 file:py-1 file:text-xs" />
        <input value={alt ?? ""} onChange={(e) => onChange({ ref: refValue, alt: e.target.value })} placeholder="Alt text" className={input} />
      </div>
    </div>
  );
}

const MARGINS = ["none", "small", "medium", "large"];

// Generic add/remove/reorder list for arrays of objects. `render(item, patch, i)`
// draws one item; `patch(partial)` merges into it. New items get a fresh _key.
function ListEditor({ items, onChange, render, makeNew, addLabel }: {
  items: any[];
  onChange: (next: any[]) => void;
  render: (item: any, patch: (p: any) => void, i: number) => React.ReactNode;
  makeNew: () => any;
  addLabel: string;
}) {
  const list = Array.isArray(items) ? items : [];
  return (
    <div className="space-y-2">
      {list.map((it, i) => (
        <div key={it._key ?? i} className="border border-[#E5E7EB] rounded p-2 space-y-1.5">
          {render(it, (p) => onChange(list.map((x, j) => (j === i ? { ...x, ...p } : x))), i)}
          <button type="button" onClick={() => onChange(list.filter((_, j) => j !== i))} className="text-[11px] text-[#C0392B] hover:underline">Remove</button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...list, { _key: k(), ...makeNew() }])} className="text-xs text-[#1B4B43] hover:underline">{addLabel}</button>
    </div>
  );
}

function RichField({ label, value, onChange }: { label: string; value: any; onChange: (html: string) => void }) {
  return (
    <div>
      <div className="text-xs font-medium text-[#6B7280] mb-1">{label}</div>
      <RichTextField initialHtml={richInitialHtml(value)} onChange={onChange} />
    </div>
  );
}

export default function BlockFieldEditor({ block, onChange }: { block: any; onChange: (b: any) => void }) {
  const type = block?._type;
  const set = (patch: any) => onChange({ ...block, ...patch });
  // Replace a rich field (by path) with an {__html} marker, immutably.
  const setRich = (path: string, html: string) => { const next = clone(block); setAtPath(next, path, { __html: html }); onChange(next); };

  if (type === "inlineRelatedArticleBlock") {
    return <InlineRelatedArticleEditor block={block} set={set} />;
  }

  if (type === "buttonBlock") {
    return (
      <div className="grid grid-cols-2 gap-2">
        <label className="col-span-2 text-xs text-[#6B7280]">Button text
          <input className={input} value={block.buttonText ?? ""} onChange={(e) => set({ buttonText: e.target.value })} />
        </label>
        <label className="col-span-2 text-xs text-[#6B7280]">Link URL <span className="text-[#9CA3AF]">(leave empty for the brochure popup)</span>
          <input className={input} value={block.url ?? ""} placeholder="https://…  or  /en/contacts" onChange={(e) => set({ url: e.target.value })} />
        </label>
        <label className="text-xs text-[#6B7280]">Open in
          <select className={input} value={block.target ?? "_self"} onChange={(e) => set({ target: e.target.value })}>
            <option value="_self">Same tab</option>
            <option value="_blank">New tab</option>
          </select>
        </label>
        <label className="text-xs text-[#6B7280]">Align
          <select className={input} value={block.alignItems ?? "center"} onChange={(e) => set({ alignItems: e.target.value })}>
            {["flex-start", "center", "flex-end"].map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <label className="text-xs text-[#6B7280]">Justify
          <select className={input} value={block.justifyContent ?? "center"} onChange={(e) => set({ justifyContent: e.target.value })}>
            {["flex-start", "center", "flex-end"].map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
      </div>
    );
  }

  if (type === "imageFullBlock") {
    const pic = block.imageMain?.picture ?? {};
    const setPicture = (v: { ref?: string; alt?: string }) =>
      set({ imageMain: { ...(block.imageMain ?? {}), picture: { ...pic, _type: "image", alt: v.alt, asset: v.ref ? { _type: "reference", _ref: v.ref } : pic.asset } } });
    return (
      <div className="space-y-2">
        <ImageField refValue={pic.asset?._ref} alt={pic.alt} onChange={setPicture} />
        <label className="text-xs text-[#6B7280] block">Aspect ratio
          <input className={input} value={block.imageMain?.aspectRatio ?? ""} placeholder="e.g. 10:5"
            onChange={(e) => set({ imageMain: { ...(block.imageMain ?? {}), aspectRatio: e.target.value } })} />
        </label>
      </div>
    );
  }

  if (type === "tableBlock") {
    const columns: string[] = block.columns ?? [];
    const rows: any[] = block.rows ?? [];
    const setCols = (c: string[]) => set({ columns: c });
    const setRows = (r: any[]) => set({ rows: r });
    const deleteColumn = (ci: number) => {
      if (!window.confirm("Delete this column?")) return;
      setCols(columns.filter((_, j) => j !== ci));
      setRows(rows.map((r) => ({ ...r, cells: (r.cells || []).filter((_: string, j: number) => j !== ci) })));
    };
    const deleteRow = (ri: number) => {
      if (!window.confirm("Delete this row?")) return;
      setRows(rows.filter((_, j) => j !== ri));
    };
    return (
      <div className="space-y-2 overflow-x-auto">
        <div className="flex gap-1">
          {columns.map((c, ci) => (
            <div key={ci} className="flex items-center gap-0.5 min-w-28">
              <input className={`${input} min-w-0`} value={c} placeholder={`Col ${ci + 1}`}
                onChange={(e) => setCols(columns.map((x, j) => (j === ci ? e.target.value : x)))} />
              <button type="button" onClick={() => deleteColumn(ci)} title="Delete column" className="text-xs text-[#C0392B] px-1 shrink-0">✕</button>
            </div>
          ))}
          <button type="button" onClick={() => { setCols([...columns, ""]); setRows(rows.map((r) => ({ ...r, cells: [...(r.cells || []), ""] }))); }}
            className="text-xs text-[#1B4B43] px-2 shrink-0">+col</button>
        </div>
        {rows.map((r, ri) => (
          <div key={r._key ?? ri} className="flex gap-1">
            {(r.cells || []).map((cell: string, ci: number) => (
              <input key={ci} className={`${input} min-w-28`} value={cell}
                onChange={(e) => setRows(rows.map((x, j) => (j === ri ? { ...x, cells: x.cells.map((cc: string, k2: number) => (k2 === ci ? e.target.value : cc)) } : x)))} />
            ))}
            <button type="button" onClick={() => deleteRow(ri)} title="Delete row" className="text-xs text-[#C0392B] px-2 shrink-0">✕</button>
          </div>
        ))}
        <button type="button" onClick={() => setRows([...rows, { _key: k(), _type: "tableRow", cells: columns.map(() => "") }])}
          className="text-xs text-[#1B4B43] hover:underline">+ Add row</button>
      </div>
    );
  }

  // FAQ / accordion: question (text) + answer (unified RichTextField).
  if (type === "faqBlock" || type === "landingFaqBlock" || type === "accordionBlock") {
    const itemsPath = block.faq ? "faq.items" : "items";
    const items: any[] = getAtPath(block, itemsPath) ?? [];
    const writeItems = (next: any[]) => { const b = clone(block); setAtPath(b, itemsPath, next); onChange(b); };
    return (
      <div className="space-y-3">
        {items.map((it, i) => (
          <div key={it._key ?? i} className="border border-[#E5E7EB] rounded p-2 space-y-2">
            <div className="flex gap-2">
              <input className={input} value={it.question ?? ""} placeholder="Question"
                onChange={(e) => writeItems(items.map((x, j) => (j === i ? { ...x, question: e.target.value } : x)))} />
              <button type="button" onClick={() => writeItems(items.filter((_, j) => j !== i))} className="text-xs text-[#C0392B] px-2">✕</button>
            </div>
            <RichField label="Answer" value={it.answer} onChange={(html) => setRich(`${itemsPath}.${i}.answer`, html)} />
          </div>
        ))}
        <button type="button" onClick={() => writeItems([...items, { _key: k(), question: "", answer: [] }])}
          className="text-xs text-[#1B4B43] hover:underline">+ Add question</button>
      </div>
    );
  }

  // Landing intro: image + plain-text fields (its `content` siblings render via
  // the rich-text branch below; this block's text is plain strings).
  if (type === "landingIntroBlock") {
    const img = block.image ?? {};
    const setImg = (v: { ref?: string; alt?: string }) =>
      set({ image: { ...img, _type: "image", alt: v.alt, asset: v.ref ? { _type: "reference", _ref: v.ref } : img.asset } });
    return (
      <div className="space-y-2">
        <label className="text-xs text-[#6B7280] block">Title<input className={input} value={block.title ?? ""} onChange={(e) => set({ title: e.target.value })} /></label>
        <label className="text-xs text-[#6B7280] block">Subtitle<input className={input} value={block.subtitle ?? ""} onChange={(e) => set({ subtitle: e.target.value })} /></label>
        <label className="text-xs text-[#6B7280] block">Button label<input className={input} value={block.buttonLabel ?? ""} onChange={(e) => set({ buttonLabel: e.target.value })} /></label>
        <label className="text-xs text-[#6B7280] block">Description<textarea rows={3} className={input} value={block.description ?? ""} onChange={(e) => set({ description: e.target.value })} /></label>
        <div><div className="text-xs text-[#6B7280] mb-1">Image</div><ImageField refValue={img.asset?._ref} alt={img.alt} onChange={setImg} /></div>
      </div>
    );
  }

  // Landing projects: editable title; the selected projects list is preserved
  // (managed by the relational project references, not edited here).
  if (type === "landingProjectsBlock") {
    return (
      <div className="space-y-2">
        <label className="text-xs text-[#6B7280] block">Title<input className={input} value={block.title ?? ""} onChange={(e) => set({ title: e.target.value })} /></label>
        <p className="text-[11px] text-[#9CA3AF]">{Array.isArray(block.projects) ? `${block.projects.length} linked projects (preserved)` : "No linked projects"}</p>
      </div>
    );
  }

  const titleRow = (
    <label className="text-xs text-[#6B7280] block">Title<input className={input} value={block.title ?? ""} onChange={(e) => set({ title: e.target.value })} /></label>
  );
  const marginRow = (
    <label className="text-xs text-[#6B7280] block">Spacing below
      <select className={input} value={block.marginBottom ?? "large"} onChange={(e) => set({ marginBottom: e.target.value })}>
        {MARGINS.map((m) => <option key={m} value={m}>{m}</option>)}
      </select>
    </label>
  );

  if (type === "bulletsBlock" || type === "howWeWorkBlock") {
    return <div className="space-y-2">{titleRow}{marginRow}</div>;
  }

  if (type === "formMinimalBlock") {
    return (
      <div className="space-y-2">
        {titleRow}
        <label className="text-xs text-[#6B7280] block">Button text<input className={input} value={block.buttonText ?? ""} onChange={(e) => set({ buttonText: e.target.value })} /></label>
        {marginRow}
      </div>
    );
  }

  if (type === "projectsSectionBlock") {
    return (
      <div className="space-y-2">
        {titleRow}
        <p className="text-[11px] text-[#9CA3AF]">{Array.isArray(block.projects) ? `${block.projects.length} linked projects (preserved)` : "No linked projects"}</p>
        {marginRow}
      </div>
    );
  }

  if (type === "locationBlock") {
    const loc = block.location ?? {};
    const setLoc = (p: any) => set({ location: { ...loc, ...p } });
    const num = (v: string) => (v === "" ? null : Number(v));
    return (
      <div className="space-y-2">
        {titleRow}
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-[#6B7280] block">Latitude<input type="number" step="any" className={input} value={loc.lat ?? ""} onChange={(e) => setLoc({ lat: num(e.target.value) })} /></label>
          <label className="text-xs text-[#6B7280] block">Longitude<input type="number" step="any" className={input} value={loc.lng ?? ""} onChange={(e) => setLoc({ lng: num(e.target.value) })} /></label>
        </div>
      </div>
    );
  }

  if (type === "benefitsBlock") {
    return (
      <div className="space-y-2">
        {titleRow}
        <ListEditor items={block.benefits} onChange={(b) => set({ benefits: b })} makeNew={() => ({ title: "", counting: "", description: "" })} addLabel="+ Add benefit"
          render={(it, patch) => (<>
            <input className={input} placeholder="Title" value={it.title ?? ""} onChange={(e) => patch({ title: e.target.value })} />
            <input className={input} placeholder="Number / counting" value={it.counting ?? ""} onChange={(e) => patch({ counting: e.target.value })} />
            <textarea className={input} rows={2} placeholder="Description" value={it.description ?? ""} onChange={(e) => patch({ description: e.target.value })} />
          </>)} />
      </div>
    );
  }

  if (type === "imageBulletsBlock") {
    const img = block.image ?? {};
    const setImg = (v: { ref?: string; alt?: string }) => set({ image: { ...img, _type: "image", alt: v.alt, asset: v.ref ? { _type: "reference", _ref: v.ref } : img.asset } });
    return (
      <div className="space-y-2">
        {titleRow}
        <div><div className="text-xs text-[#6B7280] mb-1">Image</div><ImageField refValue={img.asset?._ref} alt={img.alt} onChange={setImg} /></div>
        <div className="text-xs text-[#6B7280]">Bullets</div>
        <ListEditor items={block.bullets} onChange={(b) => set({ bullets: b })} makeNew={() => ({ title: "", description: "" })} addLabel="+ Add bullet"
          render={(it, patch) => (<>
            <input className={input} placeholder="Title" value={it.title ?? ""} onChange={(e) => patch({ title: e.target.value })} />
            <textarea className={input} rows={2} placeholder="Description" value={it.description ?? ""} onChange={(e) => patch({ description: e.target.value })} />
          </>)} />
      </div>
    );
  }

  if (type === "teamBlock") {
    return (
      <div className="space-y-2">
        {titleRow}
        <ListEditor items={block.members} onChange={(m) => set({ members: m })} makeNew={() => ({ name: "", position: "", description: "" })} addLabel="+ Add member"
          render={(it, patch) => {
            const mi = it.image ?? {};
            return (<>
              <input className={input} placeholder="Name" value={it.name ?? ""} onChange={(e) => patch({ name: e.target.value })} />
              <input className={input} placeholder="Position" value={it.position ?? ""} onChange={(e) => patch({ position: e.target.value })} />
              <textarea className={input} rows={2} placeholder="Description" value={it.description ?? ""} onChange={(e) => patch({ description: e.target.value })} />
              <ImageField refValue={mi.asset?._ref} alt={mi.alt} onChange={(v) => patch({ image: { ...mi, _type: "image", alt: v.alt, asset: v.ref ? { _type: "reference", _ref: v.ref } : mi.asset } })} />
            </>);
          }} />
      </div>
    );
  }

  if (type === "contactFullBlock") {
    return (
      <div className="space-y-2">
        {titleRow}
        <label className="text-xs text-[#6B7280] block">Description<textarea className={input} rows={2} value={block.description ?? ""} onChange={(e) => set({ description: e.target.value })} /></label>
        <div className="text-xs text-[#6B7280]">Contacts</div>
        <ListEditor items={block.contacts} onChange={(c) => set({ contacts: c })} makeNew={() => ({ type: "Email", label: "", title: "" })} addLabel="+ Add contact"
          render={(it, patch) => (<>
            <select className={input} value={it.type ?? "Email"} onChange={(e) => patch({ type: e.target.value })}>{["Email", "Phone", "Link"].map((t) => <option key={t} value={t}>{t}</option>)}</select>
            <input className={input} placeholder="Value (email / phone / url)" value={it.label ?? ""} onChange={(e) => patch({ label: e.target.value })} />
            <input className={input} placeholder="Label" value={it.title ?? ""} onChange={(e) => patch({ title: e.target.value })} />
          </>)} />
      </div>
    );
  }

  if (type === "reviewsFullBlock") {
    return (
      <div className="space-y-2">
        {titleRow}
        <ListEditor items={block.reviews} onChange={(r) => set({ reviews: r })} makeNew={() => ({ name: "", text: [] })} addLabel="+ Add review"
          render={(it, patch) => {
            const ri = it.image ?? {};
            return (<>
              <input className={input} placeholder="Name" value={it.name ?? ""} onChange={(e) => patch({ name: e.target.value })} />
              <ImageField refValue={ri.asset?._ref} alt={ri.alt} onChange={(v) => patch({ image: { ...ri, _type: "image", alt: v.alt, asset: v.ref ? { _type: "reference", _ref: v.ref } : ri.asset } })} />
              <RichField label="Review text" value={it.text} onChange={(html) => patch({ text: { __html: html } })} />
            </>);
          }} />
      </div>
    );
  }

  // Generic: a unified RichTextField for every Portable Text field found in the
  // block, plus a JSON fallback for the remaining (non-rich) structure.
  const rich = findRichFields(block);
  return (
    <div className="space-y-3">
      {rich.map((f) => (
        <RichField key={f.path} label={f.label} value={getAtPath(block, f.path)} onChange={(html) => setRich(f.path, html)} />
      ))}
      <JsonFallback block={block} onChange={onChange} hasRich={rich.length > 0} />
    </div>
  );
}

// Inline Related Article: pick a label + one internal blog article. Stores the
// article as a Sanity-style reference; the public side resolves title/excerpt/url.
function InlineRelatedArticleEditor({ block, set }: { block: any; set: (patch: any) => void }) {
  const [list, setList] = useState<{ ref: string; title: string; language: string }[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    listBlogArticlesForPicker()
      .then((rows) => { if (alive) setList(rows); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);
  const ref = block.article?._ref ?? "";
  return (
    <div className="space-y-2">
      <label className="text-xs text-[#6B7280] block">Label
        <select className={input} value={block.label ?? "Related Article"} onChange={(e) => set({ label: e.target.value })}>
          <option value="Related Article">Related Article</option>
          <option value="Related Guide">Related Guide</option>
        </select>
      </label>
      <label className="text-xs text-[#6B7280] block">Linked article
        <select className={input} value={ref}
          onChange={(e) => set({ article: e.target.value ? { _type: "reference", _ref: e.target.value } : null })}>
          <option value="">{loading ? "Loading…" : "— Select an article —"}</option>
          {list.map((a) => (
            <option key={a.ref} value={a.ref}>{a.title}{a.language !== "en" ? ` (${a.language})` : ""}</option>
          ))}
        </select>
      </label>
      {ref && !list.some((a) => a.ref === ref) && !loading && (
        <p className="text-[11px] text-[#C0392B]">Selected article not found — it may have been deleted.</p>
      )}
      <p className="text-[11px] text-[#9CA3AF]">Title, excerpt and URL are pulled automatically from the selected article.</p>
    </div>
  );
}

function JsonFallback({ block, onChange, hasRich }: { block: any; onChange: (b: any) => void; hasRich: boolean }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(() => JSON.stringify(block, null, 2));
  const [err, setErr] = useState<string | null>(null);
  return (
    <div>
      <button type="button" onClick={() => setOpen((o) => !o)} className="text-[11px] text-[#9CA3AF] hover:text-[#6B7280]">
        {open ? "▾" : "▸"} {hasRich ? "Other fields" : "Block fields"} (advanced JSON)
      </button>
      {open && (
        <>
          <textarea
            className="mt-1 w-full font-mono text-[11px] rounded-md border border-[#E5E7EB] px-2 py-1.5 outline-none focus:border-[#1B4B43]"
            rows={8}
            value={text}
            onChange={(e) => { setText(e.target.value); try { onChange(JSON.parse(e.target.value)); setErr(null); } catch { setErr("Invalid JSON — not saved until fixed"); } }}
          />
          {err && <p className="text-[11px] text-[#C0392B]">{err}</p>}
        </>
      )}
    </div>
  );
}
