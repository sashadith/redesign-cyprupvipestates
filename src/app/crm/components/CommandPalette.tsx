"use client";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { paletteActions } from "@/lib/crm/leadSearch";
import { searchLeadsAction, type LeadHit } from "../actions";

export type PaletteHandle = { open: () => void };
type Item = { key: string; label: string; sub?: string; href: string };

export const CommandPalette = forwardRef<PaletteHandle, { canAssign: boolean; oldCrm: boolean }>(function CommandPalette({ canAssign, oldCrm }, handle) {
  const router = useRouter();
  const dlg = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const seq = useRef(0);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<LeadHit[]>([]);
  const [active, setActive] = useState(0);
  const [pending, setPending] = useState(false);

  const open = useCallback(() => {
    const d = dlg.current;
    if (!d || d.open) return;
    returnTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    d.showModal();
    input.current?.focus();
  }, []);
  const close = useCallback(() => { dlg.current?.close(); }, []);
  useImperativeHandle(handle, () => ({ open }), [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")) return;
      const t = e.target as HTMLElement | null;
      const typing = !!t && t !== input.current && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
      if (typing) return;
      e.preventDefault();
      if (dlg.current?.open) close(); else open();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  // Debounced search; a stale answer never overwrites a newer query.
  useEffect(() => {
    const term = q.trim();
    const mine = ++seq.current;
    if (term.length < 2) { setHits([]); setPending(false); return; }
    setPending(true);
    const done = () => { if (mine === seq.current) setPending(false); };
    const t = setTimeout(() => {
      searchLeadsAction(term).then((r) => { if (mine === seq.current) setHits(r); }, () => { if (mine === seq.current) setHits([]); }).then(done);
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  const term = q.trim().toLowerCase();
  const goTo: Item[] = useMemo(
    () => paletteActions(canAssign, oldCrm).filter((a) => !term || a.label.toLowerCase().includes(term)).map((a) => ({ key: a.id, label: a.label, href: a.href })),
    [canAssign, oldCrm, term],
  );
  const leads: Item[] = hits.map((h) => ({ key: h.id, label: h.name, sub: [h.statusLabel, h.sub].filter(Boolean).join(" · "), href: `/crm/leads/${h.id}` }));
  const items = [...goTo, ...leads];
  const cur = Math.min(active, Math.max(items.length - 1, 0));

  useEffect(() => { setActive(0); }, [q, hits]);

  const go = (it: Item | undefined) => {
    if (!it) return;
    close();
    router.push(it.href);
  };

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(items.length ? (cur + 1) % items.length : 0); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(items.length ? (cur - 1 + items.length) % items.length : 0); }
    else if (e.key === "Enter") {
      e.preventDefault();
      // Not while an IME composes, and not while the lead search for this query is still running.
      if (e.nativeEvent.isComposing || pending) return;
      go(items[cur]);
    }
  };

  const row = (it: Item, i: number) => (
    <li key={it.key} id={`pal-${it.key}`} role="option" aria-selected={i === cur} onMouseMove={() => setActive(i)} onClick={() => go(it)}>
      <span>{it.label}</span>{it.sub && <small>{it.sub}</small>}
    </li>
  );

  return (
    <dialog ref={dlg} className="crm-palette" aria-label="Command palette"
      onClose={() => { setQ(""); setHits([]); returnTo.current?.focus(); returnTo.current = null; }}
      onClick={(e) => { if (e.target === dlg.current) close(); }}>
      <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onInputKey}
        role="combobox" aria-expanded="true" aria-controls="pal-list" aria-autocomplete="list"
        aria-activedescendant={items[cur] ? `pal-${items[cur].key}` : undefined}
        placeholder="Search leads by name, email or phone, or jump to…" autoComplete="off" spellCheck={false} />
      <ul id="pal-list" role="listbox" aria-label="Results">
        {goTo.length > 0 && <li role="presentation" className="sec">Go to</li>}
        {goTo.map((it, i) => row(it, i))}
        {leads.length > 0 && <li role="presentation" className="sec">Leads</li>}
        {leads.map((it, i) => row(it, goTo.length + i))}
      </ul>
      {items.length === 0 && <p className="empty">{term.length < 2 ? "Type at least 2 characters to search leads." : "No matches."}</p>}
    </dialog>
  );
});
