"use client";

import React, { useEffect, useRef, useState } from "react";
import type { navLink } from "@/types/header";
import { LANGS, flag, ChevronDown } from "./navShared";

export default function MobileMenu({ navLinks }: { navLinks: navLink[] }) {
  const [open, setOpen] = useState(false);
  const [openSubs, setOpenSubs] = useState<Set<string>>(new Set());
  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const close = () => {
    setOpen(false);
    btnRef.current?.focus();
  };

  const toggleSub = (key: string) =>
    setOpenSubs((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });

  // body scroll-lock + Escape + simple focus trap while open
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusables = () =>
      Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? []
      ).filter((el) => el.offsetParent !== null);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key === "Tab") {
        const list = focusables();
        if (list.length === 0) return;
        const first = list[0];
        const last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);

    // move focus into the panel
    panelRef.current?.querySelector<HTMLElement>("a[href], button")?.focus();

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="mnav">
      <button
        ref={btnRef}
        type="button"
        className={`burger ${open ? "is-open" : ""}`}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen((o) => !o)}
      >
        <span />
        <span />
        <span />
      </button>

      <div
        id="mobile-menu"
        ref={panelRef}
        className={`mmenu ${open ? "is-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
      >
        <nav className="mmenu__nav" aria-label="Mobile">
          <ul>
            {navLinks?.map((l) => {
              const hasSub = (l.subLinks?.length ?? 0) > 0;
              const isOpen = openSubs.has(l._key);
              const subId = `msub-${l._key}`;
              return (
                <li className="mitem" key={l._key}>
                  <div className="mitem__row">
                    <a className="mitem__link" href={l.link || "#"} onClick={close}>
                      {l.label}
                    </a>
                    {hasSub && (
                      <button
                        type="button"
                        className={`mitem__toggle ${isOpen ? "is-open" : ""}`}
                        aria-expanded={isOpen}
                        aria-controls={subId}
                        aria-label={`${isOpen ? "Collapse" : "Expand"} ${l.label} submenu`}
                        onClick={() => toggleSub(l._key)}
                      >
                        <ChevronDown />
                      </button>
                    )}
                  </div>
                  {hasSub && (
                    <ul id={subId} className={`msub ${isOpen ? "is-open" : ""}`} hidden={!isOpen}>
                      {l.subLinks.map((s) => (
                        <li key={s._key}>
                          <a href={s.link || "#"} onClick={close}>
                            {s.label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="mmenu__lang" aria-label="Language">
          {LANGS.map(([code, name, cc]) => (
            <a key={code} href="#" className={code === "EN" ? "is-active" : ""} onClick={close}>
              <img src={flag(cc)} alt="" width={26} height={18} />
              <span>{name}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
