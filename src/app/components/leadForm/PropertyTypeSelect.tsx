"use client";
import React, { useEffect, useRef, useState } from "react";
import "./leadForm.css";

/* Property type as a dropdown with checkboxes (operator, 2026-11-01), instead of
   five pill buttons. The trigger reads the picked types ("Villa, Penthouse") or
   the placeholder. Closes on outside click, Escape and Tab-out. */

export function PropertyTypeSelect({ id, name, options, values, onChange, placeholder, labelledBy, className }: {
  id: string;
  name: string;
  options: { value: string; label: string }[];
  values: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  labelledBy?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); button.current?.focus(); } };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const picked = options.filter((o) => values.includes(o.value)).map((o) => o.label);
  const toggle = (v: string) => onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);

  return (
    <div
      ref={root} className={`lf-types${open ? " is-open" : ""}${className ? ` ${className}` : ""}`}
      onBlur={(e) => { if (!root.current?.contains(e.relatedTarget as Node)) setOpen(false); }}
    >
      <button
        ref={button} id={id} type="button" className={`lf-types__btn${picked.length ? " has-value" : ""}`}
        aria-haspopup="true" aria-expanded={open} aria-labelledby={labelledBy ? `${labelledBy} ${id}` : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <span>{picked.length ? picked.join(", ") : placeholder}</span>
      </button>
      {open && (
        <div className="lf-types__pop" role="group" aria-labelledby={labelledBy}>
          {options.map((o) => (
            <label key={o.value} className="lf-types__opt">
              <input type="checkbox" name={name} value={o.value} checked={values.includes(o.value)} onChange={() => toggle(o.value)} />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
