"use client";
import React, { useState } from "react";
import { useFormStatus } from "react-dom";
import ImagePicker from "@/app/admin/ImagePicker";
import RichTextField from "@/app/admin/RichTextField";
import { portableTextToHtml } from "@/lib/portableText/ptToHtml.mjs";
import { isHtmlMarker } from "@/lib/portableText/richText";
import type { HField } from "@/lib/homepageSchema";

type Opt = { id: string; title: string };
type Ctx = { project: Opt[]; caseStudy: Opt[] };
type Path = (string | number)[];

let kc = 0;
const newKey = () => `k${Date.now().toString(36)}${kc++}`;
const inputCls = "w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#1B4B43]";

function getAt(root: any, path: Path) {
  let cur = root;
  for (const k of path) { if (cur == null) return undefined; cur = cur[k]; }
  return cur;
}
function setAt(root: any, path: Path, value: any) {
  const clone = Array.isArray(root) ? root.slice() : { ...(root ?? {}) };
  let cur: any = clone;
  for (let i = 0; i < path.length - 1; i++) {
    const k = path[i];
    const child = cur[k];
    cur[k] = Array.isArray(child) ? child.slice() : { ...(child ?? {}) };
    cur = cur[k];
  }
  cur[path[path.length - 1]] = value;
  return clone;
}
function emptyForFields(fields: HField[]): any {
  const o: any = { _key: newKey() };
  for (const f of fields) {
    if (f.kind === "object") o[f.name] = emptyForFields(f.fields);
    else if (f.kind === "objectArray" || f.kind === "refArray" || f.kind === "mixedArray") o[f.name] = [];
  }
  return o;
}
function move<T>(arr: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir; if (j < 0 || j >= arr.length) return arr;
  const a = arr.slice(); [a[i], a[j]] = [a[j], a[i]]; return a;
}

function ArrBtn({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled} className="rounded border border-[#E5E7EB] text-xs px-1.5 py-0.5 hover:bg-[#F8F9FA] disabled:opacity-40">{label}</button>;
}

// Stable module-level component (uses local state for the picker) — must NOT be defined inside the editor.
function RefArray({ value, opts, refTypeName, title, onChange }: { value: any[]; opts: Opt[]; refTypeName: string; title: string; onChange: (next: any[]) => void }) {
  const [pick, setPick] = useState("");
  const refs = Array.isArray(value) ? value : [];
  const titleById = new Map(opts.map((o) => [o.id, o.title]));
  const inList = new Set(refs.map((r) => r?._ref));
  const addable = opts.filter((o) => !inList.has(o.id));
  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-[#6B7280]">{title} ({refs.length})</div>
      {refs.map((r, i) => (
        <div key={r?._key ?? i} className="flex items-center gap-2 border border-[#E5E7EB] rounded-md px-3 py-1.5 text-sm">
          <span className="text-xs text-[#9CA3AF] w-5 text-right">{i + 1}</span>
          <span className="flex-1 truncate">{titleById.get(r?._ref) ?? r?._ref}</span>
          <ArrBtn label="↑" onClick={() => onChange(move(refs, i, -1))} disabled={i === 0} />
          <ArrBtn label="↓" onClick={() => onChange(move(refs, i, 1))} disabled={i === refs.length - 1} />
          <button type="button" className="text-[#C0392B] text-xs px-1.5 hover:underline" onClick={() => onChange(refs.filter((_, idx) => idx !== i))}>Remove</button>
        </div>
      ))}
      <div className="flex items-end gap-2">
        <select className={inputCls} value={pick} onChange={(e) => setPick(e.target.value)}>
          <option value="">— select —</option>
          {addable.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
        </select>
        <button type="button" disabled={!pick} className="rounded-md bg-[#C29A5E] text-white text-sm px-4 py-2 hover:opacity-90 disabled:opacity-40"
          onClick={() => { if (pick) { onChange([...refs, { _key: newKey(), _ref: pick, _type: refTypeName }]); setPick(""); } }}>Add</button>
      </div>
    </div>
  );
}

function SaveBar() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}
      className="rounded-md bg-[#1B4B43] text-white text-sm font-medium px-5 py-2.5 hover:bg-[#142E2D] disabled:opacity-60">
      {pending ? "Saving…" : "Save homepage"}
    </button>
  );
}

export default function HomepageEditor({
  lang, schema, data, action, options,
}: { lang: string; schema: HField[]; data: any; action: (formData: FormData) => void; options: Ctx }) {
  void lang;
  const [doc, setDoc] = useState<any>(() => JSON.parse(JSON.stringify(data ?? {})));
  const set = (path: Path, value: any) => setDoc((d: any) => setAt(d, path, value));

  // Plain render functions (NOT components) — avoids remounting inputs/editors on every keystroke.
  const renderScalar = (field: HField, path: Path): React.ReactNode => {
    const value = getAt(doc, path);
    switch (field.kind) {
      case "string":
        return <input className={inputCls} value={value ?? ""} onChange={(e) => set(path, e.target.value)} />;
      case "text":
        return <textarea className={inputCls} rows={field.rows ?? 3} value={value ?? ""} onChange={(e) => set(path, e.target.value)} />;
      case "number":
        return <input type="number" className={inputCls} value={value ?? ""} onChange={(e) => set(path, e.target.value === "" ? null : Number(e.target.value))} />;
      case "boolean":
        return <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!value} onChange={(e) => set(path, e.target.checked)} /> {field.title}</label>;
      case "enum":
        return (
          <select className={inputCls} value={value ?? ""} onChange={(e) => set(path, e.target.value)}>
            <option value="">—</option>
            {field.options.map((o) => <option key={o.value} value={o.value}>{o.title}</option>)}
          </select>
        );
      case "image":
        return <ImagePicker label="" initial={value} onChange={(img) => set(path, img)} />;
      case "file":
        return <FileField value={value} onChange={(v) => set(path, v)} />;
      case "pt":
        return (
          <RichTextField
            initialHtml={isHtmlMarker(value) ? value.__html : portableTextToHtml(Array.isArray(value) ? value : [])}
            onChange={(html) => set(path, { __html: html })}
          />
        );
      default:
        return null;
    }
  };

  const renderField = (field: HField, path: Path, parent: any): React.ReactNode => {
    if (field.showWhen && parent?.[field.showWhen.field] !== field.showWhen.equals) return null;

    if (field.kind === "object") {
      const val = getAt(doc, path) ?? {};
      return (
        <div className="border-l-2 border-[#E5E7EB] pl-3 space-y-3">
          <div className="text-xs font-semibold text-[#6B7280]">{field.title}</div>
          {field.fields.map((f) => (
            <div key={f.name}>
              {f.kind !== "boolean" && f.kind !== "object" && f.kind !== "objectArray" && f.kind !== "mixedArray" && f.kind !== "refArray" && (
                <label className="block text-xs text-[#6B7280] mb-1">{f.title}</label>
              )}
              {renderField(f, [...path, f.name], val)}
            </div>
          ))}
        </div>
      );
    }

    if (field.kind === "objectArray") {
      const arr: any[] = getAt(doc, path) ?? [];
      return (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-[#6B7280]">{field.title} ({arr.length})</div>
          {arr.map((item, i) => (
            <div key={item?._key ?? i} className="rounded-md border border-[#E5E7EB] p-3 space-y-3 bg-[#FCFCFC]">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#9CA3AF]">{field.itemLabel ?? "Item"} #{i + 1}</span>
                <span className="flex gap-1">
                  <ArrBtn label="↑" onClick={() => set(path, move(arr, i, -1))} disabled={i === 0} />
                  <ArrBtn label="↓" onClick={() => set(path, move(arr, i, 1))} disabled={i === arr.length - 1} />
                  <button type="button" className="text-[#C0392B] text-xs px-1.5 hover:underline" onClick={() => set(path, arr.filter((_, idx) => idx !== i))}>Remove</button>
                </span>
              </div>
              {field.fields.map((f) => (
                <div key={f.name}>
                  {f.kind !== "boolean" && f.kind !== "object" && f.kind !== "objectArray" && f.kind !== "mixedArray" && f.kind !== "refArray" && (
                    <label className="block text-xs text-[#6B7280] mb-1">{f.title}</label>
                  )}
                  {renderField(f, [...path, i, f.name], item)}
                </div>
              ))}
            </div>
          ))}
          <button type="button" className="rounded border border-[#1B4B43] text-[#1B4B43] text-xs px-3 py-1.5 hover:bg-[#F8F9FA]"
            onClick={() => set(path, [...arr, emptyForFields(field.fields)])}>+ Add {field.itemLabel ?? "item"}</button>
        </div>
      );
    }

    if (field.kind === "mixedArray") {
      const arr: any[] = getAt(doc, path) ?? [];
      return (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-[#6B7280]">{field.title} ({arr.length})</div>
          {arr.map((item, i) => {
            const member = field.members.find((m) => m.type === item?._type) ?? field.members[0];
            return (
              <div key={item?._key ?? i} className="rounded-md border border-[#E5E7EB] p-3 space-y-3 bg-[#FCFCFC]">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#9CA3AF]">{member.title} #{i + 1}</span>
                  <span className="flex gap-1">
                    <ArrBtn label="↑" onClick={() => set(path, move(arr, i, -1))} disabled={i === 0} />
                    <ArrBtn label="↓" onClick={() => set(path, move(arr, i, 1))} disabled={i === arr.length - 1} />
                    <button type="button" className="text-[#C0392B] text-xs px-1.5 hover:underline" onClick={() => set(path, arr.filter((_, idx) => idx !== i))}>Remove</button>
                  </span>
                </div>
                {member.fields.map((f) => (
                  <div key={f.name}>
                    {f.kind !== "boolean" && f.kind !== "object" && f.kind !== "objectArray" && f.kind !== "mixedArray" && f.kind !== "refArray" && (
                      <label className="block text-xs text-[#6B7280] mb-1">{f.title}</label>
                    )}
                    {renderField(f, [...path, i, f.name], item)}
                  </div>
                ))}
              </div>
            );
          })}
          <div className="flex gap-2">
            {field.members.map((m) => (
              <button key={m.type} type="button" className="rounded border border-[#1B4B43] text-[#1B4B43] text-xs px-3 py-1.5 hover:bg-[#F8F9FA]"
                onClick={() => set(path, [...arr, { ...emptyForFields(m.fields), _type: m.type }])}>+ Add {m.title}</button>
            ))}
          </div>
        </div>
      );
    }

    if (field.kind === "refArray") {
      return (
        <RefArray
          value={getAt(doc, path) ?? []}
          opts={options[field.refType] ?? []}
          refTypeName={field.refType === "project" ? "projectRef" : "caseStudyRef"}
          title={field.title}
          onChange={(next) => set(path, next)}
        />
      );
    }

    return renderScalar(field, path);
  };

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="doc" value={JSON.stringify(doc)} />
      <div className="flex justify-end"><SaveBar /></div>
      {schema.map((f) => (
        <section key={f.name} className="bg-white rounded-lg border border-[#E5E7EB] p-5 space-y-3">
          <h2 className="text-sm font-semibold">{f.title}</h2>
          {f.kind !== "object" && f.kind !== "objectArray" && f.kind !== "mixedArray" && f.kind !== "refArray" && f.kind !== "boolean" && (
            <label className="block text-xs text-[#6B7280] mb-1">{f.title}</label>
          )}
          {renderField(f, [f.name], doc)}
        </section>
      ))}
      <div className="flex justify-end"><SaveBar /></div>
    </form>
  );
}

// Minimal file field (heroBlock.video) — reuses the existing upload endpoint, preserves shape.
function FileField({ value, onChange }: { value: any; onChange: (v: any) => void }) {
  const [busy, setBusy] = useState(false);
  const ref = value?.asset?._ref ?? value?.asset?._id;
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    setBusy(true);
    try {
      const fd = new FormData(); fd.append("file", f);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.ref) onChange({ _type: "file", asset: { _ref: j.ref, _type: "reference" } });
    } finally { setBusy(false); e.target.value = ""; }
  }
  return (
    <div className="text-sm">
      {ref ? <div className="text-xs text-[#6B7280] mb-1 truncate">Current: {ref}</div> : <div className="text-xs text-[#9CA3AF] mb-1">none</div>}
      <input type="file" onChange={onFile} disabled={busy}
        className="text-xs file:mr-2 file:rounded file:border-0 file:bg-[#1B4B43] file:text-white file:px-3 file:py-1.5 file:text-xs hover:file:bg-[#142E2D] file:cursor-pointer" />
      {ref && <button type="button" className="text-xs text-[#C0392B] ml-2" onClick={() => onChange(null)}>Remove</button>}
      {busy && <span className="text-xs text-[#6B7280] ml-2">Uploading…</span>}
    </div>
  );
}
