"use client";

import React, { useEffect, useId, useRef, useState } from "react";

/* Lightweight accessible select (ARIA APG "select-only combobox"): a styled
   trigger + a listbox panel that matches the filter pills. No library. Focus
   stays on the trigger; aria-activedescendant tracks the highlighted option.
   Keyboard: Tab focuses, Enter/Space/Arrows open, Arrows/Home/End move, Enter/
   Space select, Escape closes, outside click closes. Controlled via value. */

export type PxOption = { value: string; label: string };

export default function PxSelect({
  value,
  onChange,
  options,
  placeholder,
  label,
  id,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: PxOption[];
  placeholder: string; // label shown for the empty value (e.g. "Any location")
  label: string; // accessible field name (e.g. "City")
  id?: string;
  className?: string;
}) {
  const all: PxOption[] = [{ value: "", label: placeholder }, ...options];
  const selectedIndex = Math.max(0, all.findIndex((o) => o.value === value));

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(selectedIndex);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  // mirror state in refs so the key handler always reads current values
  // (immune to render-timing / stale closures during rapid key presses)
  const openRef = useRef(open);
  openRef.current = open;
  const activeRef = useRef(active);
  activeRef.current = active;
  const uid = useId();
  const listId = `${uid}-list`;
  const optId = (i: number) => `${uid}-opt-${i}`;

  const openList = () => {
    setActive(selectedIndex);
    setOpen(true);
  };
  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };
  const choose = (i: number) => {
    onChange(all[i].value);
    close();
  };

  // close on outside pointer (also closes any other open PxSelect)
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [open]);

  // keep the highlighted option in view
  useEffect(() => {
    if (open) document.getElementById(optId(active))?.scrollIntoView({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, active]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const isOpen = openRef.current;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        isOpen ? setActive((a) => Math.min(a + 1, all.length - 1)) : openList();
        break;
      case "ArrowUp":
        e.preventDefault();
        isOpen ? setActive((a) => Math.max(a - 1, 0)) : openList();
        break;
      case "Home":
        if (isOpen) { e.preventDefault(); setActive(0); }
        break;
      case "End":
        if (isOpen) { e.preventDefault(); setActive(all.length - 1); }
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        isOpen ? choose(activeRef.current) : openList();
        break;
      case "Escape":
        if (isOpen) { e.preventDefault(); close(); }
        break;
      case "Tab":
        if (isOpen) setOpen(false);
        break;
      default:
        break;
    }
  };

  const current = all[selectedIndex];

  return (
    <div ref={rootRef} id={id} className={`pxsel${open ? " is-open" : ""}${className ? " " + className : ""}`}>
      <div
        ref={triggerRef}
        role="combobox"
        tabIndex={0}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`${label}: ${current.label}`}
        aria-activedescendant={open ? optId(active) : undefined}
        className="px__select pxsel__btn"
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
      >
        <span className={`pxsel__value${value ? "" : " is-placeholder"}`}>{current.label}</span>
      </div>

      {open && (
        <ul className="pxsel__panel" role="listbox" id={listId} aria-label={label}>
          {all.map((o, i) => (
            <li
              key={o.value || "__any"}
              id={optId(i)}
              role="option"
              aria-selected={o.value === value}
              className={`pxsel__opt${i === active ? " is-active" : ""}${o.value === value ? " is-selected" : ""}`}
              onMouseMove={() => setActive(i)}
              onClick={() => choose(i)}
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
