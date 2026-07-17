"use client";

import React, { useEffect, useRef, useState } from "react";
import type { navLink } from "@/types/header";
import type { Translation } from "@/types/homepage";
import { i18n } from "@/i18n.config";
import { Globe, ChevronDown } from "./navShared";
import { LANG_LABELS, langCode, resolveNav } from "@/app/components/Header/navShared";

export default function MobileMenu({
  navLinks,
  lang = "en",
  translations,
}: {
  navLinks: navLink[];
  lang?: string;
  translations?: Translation[];
}) {
  // Same opt-in rule as LangSwitch: no `translations` prop → legacy stub list
  // (every language shown, none link anywhere) for unaffected pre-existing
  // callers; `translations` present → real per-language links, current
  // language marked active, untranslated languages omitted.
  const hasRealSwitching = translations !== undefined;
  const byLang = new Map((translations ?? []).map((t) => [t.language, t.path]));
  const [open, setOpen] = useState(false);
  const [openSub, setOpenSub] = useState<string | null>(null); // one submenu at a time
  const [langOpen, setLangOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const close = () => {
    setOpen(false);
    btnRef.current?.focus();
  };

  // accordion: open the tapped submenu, close any other (tap again to close)
  const toggleSub = (key: string) => setOpenSub((cur) => (cur === key ? null : key));

  useEffect(() => {
    if (!open) {
      setOpenSub(null);
      setLangOpen(false);
      return;
    }
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusables = () =>
      Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? []
      ).filter((el) => el.offsetParent !== null && getComputedStyle(el).visibility !== "hidden");

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
              const isOpen = openSub === l._key;
              const subId = `msub-${l._key}`;
              return (
                <li className="mitem" key={l._key}>
                  <div className="mitem__row">
                    <a className="mitem__link" href={resolveNav(lang, l.link).href} onClick={close}>
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
                    <div id={subId} className={`msub ${isOpen ? "is-open" : ""}`}>
                      <ul className="msub__list">
                        {l.subLinks.map((s) => (
                          <li key={s._key}>
                            <a href={resolveNav(lang, s.link).href} onClick={close}>
                              {s.label}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="mmenu__foot">
          <div className={`mlang ${langOpen ? "is-open" : ""}`}>
            <button
              type="button"
              className="mlang__btn"
              aria-haspopup="true"
              aria-expanded={langOpen}
              aria-controls="mlang-list"
              aria-label="Select language"
              onClick={() => setLangOpen((o) => !o)}
            >
              <Globe />
              <span className="mlang__cur">{langCode(lang)}</span>
              <ChevronDown className="mlang__caret" />
            </button>
            <ul id="mlang-list" className="mlang__list" role="menu">
              {i18n.languages.map((l) => {
                const name = LANG_LABELS[l.id]?.name ?? l.id;
                if (l.id === lang) {
                  return (
                    <li key={l.id} role="none">
                      <a role="menuitem" aria-current="page" className="is-active">{name}</a>
                    </li>
                  );
                }
                if (!hasRealSwitching) {
                  return (
                    <li key={l.id} role="none">
                      <a href="#" role="menuitem" onClick={close}>{name}</a>
                    </li>
                  );
                }
                const path = byLang.get(l.id);
                if (!path) return null;
                return (
                  <li key={l.id} role="none">
                    <a href={path} role="menuitem" onClick={close}>{name}</a>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
