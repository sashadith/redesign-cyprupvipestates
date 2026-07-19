"use client";
import { useState, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import LinkExt from "@tiptap/extension-link";
import ImageExt from "@tiptap/extension-image";
import { portableTextToHtml } from "@/lib/portableText/ptToHtml.mjs";
import { saveProjectField } from "./actions";

const btn = (active: boolean) =>
  `px-2.5 py-1 text-sm rounded ${active ? "bg-[#1B4B43] text-white" : "bg-white border border-[#E5E7EB] text-[#111827] hover:bg-[#F8F9FA]"}`;

export default function PtEditor({
  projectId,
  field = "description",
  label = "Description (rich text)",
  initial,
  saveAction,
}: {
  projectId?: string;
  field?: string;
  label?: string;
  initial: unknown;
  // When provided, used instead of the default project-field save (e.g. case-study sections).
  saveAction?: (html: string) => Promise<any>;
}) {
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "err">("idle");
  const fileRef = useRef<HTMLInputElement>(null);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      LinkExt.configure({ openOnClick: false, autolink: false }),
      ImageExt,
    ],
    content: portableTextToHtml(Array.isArray(initial) ? initial : []),
    editorProps: {
      attributes: {
        class:
          "ProseMirror min-h-[240px] outline-none text-[#1A1A1A] [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-3 [&_h3]:text-lg [&_h3]:font-semibold [&_h4]:text-base [&_h4]:font-semibold [&_h5]:text-sm [&_h5]:font-semibold [&_h5]:uppercase [&_h5]:tracking-wide [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_blockquote]:border-l-2 [&_blockquote]:border-[#C29A5E] [&_blockquote]:pl-3 [&_blockquote]:italic [&_a]:text-[#1B4B43] [&_a]:underline",
      },
    },
  });

  if (!editor) return <div className="text-sm text-[#6B7280]">Loading editor…</div>;

  const setLink = () => {
    const prev = editor.getAttributes("link")?.href ?? "";
    const url = window.prompt("Link URL", prev);
    if (url === null) return;
    if (url === "") editor.chain().focus().extendMarkRange("link").unsetLink().run();
    else editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  async function onImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f || !editor) return;
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.ok) editor.chain().focus().setImage({ src: j.url, alt: f.name }).run();
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function save() {
    if (!editor) return;
    setStatus("saving");
    try {
      if (saveAction) await saveAction(editor.getHTML());
      else await saveProjectField(projectId as string, field, editor.getHTML());
      setStatus("saved");
    } catch {
      setStatus("err");
    }
  }

  return (
    <div className="bg-white rounded-lg border border-[#E5E7EB] p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold">{label}</h2>
        <div className="flex items-center gap-2">
          {status === "saved" && <span className="text-xs text-[#2D6E62]">Saved ✓</span>}
          {status === "err" && <span className="text-xs text-[#C0392B]">Save failed</span>}
          <button type="button" onClick={save} disabled={status === "saving"}
            className="rounded-md bg-[#1B4B43] text-white text-sm px-4 py-1.5 hover:bg-[#142E2D] disabled:opacity-60">
            {status === "saving" ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-2 pb-2 border-b border-[#E5E7EB]">
        <button type="button" className={btn(editor.isActive("bold"))} onClick={() => editor.chain().focus().toggleBold().run()}><b>B</b></button>
        <button type="button" className={btn(editor.isActive("italic"))} onClick={() => editor.chain().focus().toggleItalic().run()}><i>I</i></button>
        <button type="button" className={btn(editor.isActive("heading", { level: 2 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</button>
        <button type="button" className={btn(editor.isActive("heading", { level: 3 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</button>
        <button type="button" className={btn(editor.isActive("heading", { level: 4 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}>H4</button>
        <button type="button" className={btn(editor.isActive("heading", { level: 5 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 5 }).run()}>H5</button>
        <button type="button" className={btn(editor.isActive("bulletList"))} onClick={() => editor.chain().focus().toggleBulletList().run()}>• List</button>
        <button type="button" className={btn(editor.isActive("orderedList"))} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. List</button>
        <button type="button" className={btn(editor.isActive("blockquote"))} onClick={() => editor.chain().focus().toggleBlockquote().run()}>❝</button>
        <button type="button" className={btn(editor.isActive("link"))} onClick={setLink}>Link</button>
        <button type="button" className={btn(false)} onClick={() => fileRef.current?.click()}>Image</button>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={onImageFile} />
      </div>
      <div className="border border-[#E5E7EB] rounded-md p-3 max-h-[500px] overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
