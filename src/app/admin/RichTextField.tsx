"use client";
import { useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import LinkExt from "@tiptap/extension-link";
import ImageExt from "@tiptap/extension-image";

const btn = (active: boolean) =>
  `px-2 py-0.5 text-xs rounded ${active ? "bg-[#1B4B43] text-white" : "bg-white border border-[#E5E7EB] text-[#111827] hover:bg-[#F8F9FA]"}`;

const EDITOR_CLASS =
  "ProseMirror min-h-[140px] outline-none text-[#1A1A1A] [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:text-lg [&_h3]:font-semibold [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_blockquote]:border-l-2 [&_blockquote]:border-[#C29A5E] [&_blockquote]:pl-3 [&_blockquote]:italic [&_a]:text-[#1B4B43] [&_a]:underline [&_img]:max-w-full";

export default function RichTextField({ initialHtml, onChange }: { initialHtml: string; onChange: (html: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit, LinkExt.configure({ openOnClick: false, autolink: false }), ImageExt],
    content: initialHtml || "",
    editorProps: { attributes: { class: EDITOR_CLASS } },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });
  if (!editor) return <div className="text-xs text-[#6B7280]">Loading editor…</div>;

  const setLink = () => {
    const url = window.prompt("Link URL", editor.getAttributes("link")?.href ?? "");
    if (url === null) return;
    if (url === "") editor.chain().focus().extendMarkRange("link").unsetLink().run();
    else editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };
  async function onImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f || !editor) return;
    try {
      const fd = new FormData(); fd.append("file", f);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.ok) editor.chain().focus().setImage({ src: j.url, alt: f.name }).run();
    } finally { if (fileRef.current) fileRef.current.value = ""; }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-2">
        <button type="button" className={btn(editor.isActive("bold"))} onClick={() => editor.chain().focus().toggleBold().run()}><b>B</b></button>
        <button type="button" className={btn(editor.isActive("italic"))} onClick={() => editor.chain().focus().toggleItalic().run()}><i>I</i></button>
        <button type="button" className={btn(editor.isActive("heading", { level: 2 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</button>
        <button type="button" className={btn(editor.isActive("heading", { level: 3 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</button>
        <button type="button" className={btn(editor.isActive("bulletList"))} onClick={() => editor.chain().focus().toggleBulletList().run()}>•</button>
        <button type="button" className={btn(editor.isActive("orderedList"))} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1.</button>
        <button type="button" className={btn(editor.isActive("blockquote"))} onClick={() => editor.chain().focus().toggleBlockquote().run()}>❝</button>
        <button type="button" className={btn(editor.isActive("link"))} onClick={setLink}>Link</button>
        <button type="button" className={btn(false)} onClick={() => fileRef.current?.click()}>Img</button>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={onImageFile} />
      </div>
      <div className="border border-[#E5E7EB] rounded-md p-3 bg-white">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
