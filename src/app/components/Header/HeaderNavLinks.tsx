"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { navLink } from "@/types/header";
import { ChevronDown, resolveNav } from "./navShared";

/* Desktop primary nav (redesign, Option A): the parent label is a real link that
   always navigates in one click; a SEPARATE caret button opens the submenu. Mouse
   users also get hover-to-open (CSS); the caret toggle covers touch + keyboard.
   Closes on outside click, Escape, or focus leaving the nav.

   Link behaviour is preserved from the previous live nav:
   - "/path" and sub-links   → localized <Link> ("/de/projects", …)
   - "https?://…"            → external link (new tab)
   - bare id (e.g. "reviews")→ in-page section anchor with smooth scroll +
     scroll-spy active state (home-page section nav). */
export default function HeaderNavLinks({
  navLinks,
  lang,
}: {
  navLinks: navLink[];
  lang: string;
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState("");
  const [isHomePage, setIsHomePage] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    const onPointer = (e: PointerEvent) => {
      if (el && !el.contains(e.target as Node)) setOpenKey(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenKey(null);
    };
    const onFocusOut = (e: FocusEvent) => {
      if (el && !el.contains(e.relatedTarget as Node)) setOpenKey(null);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    el?.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
      el?.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  // scroll-spy for in-page section links (kept from the previous live nav)
  useEffect(() => {
    const home = window.location.pathname === (lang === "en" ? "/" : `/${lang}`);
    setIsHomePage(home);
    const onScroll = () => {
      let closest = "";
      let smallest = Infinity;
      navLinks?.forEach((l) => {
        if (!l.link || l.link.startsWith("/") || /^https?:\/\//i.test(l.link)) return;
        const sec = document.getElementById(l.link);
        if (sec) {
          const d = Math.abs(sec.getBoundingClientRect().top);
          if (d < smallest) {
            smallest = d;
            closest = l.link;
          }
        }
      });
      setActiveSection(closest);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [navLinks, lang]);

  const scrollToSection = (id: string) => {
    const sec = document.getElementById(id);
    if (sec) {
      const offset = sec.getBoundingClientRect().top + window.scrollY - 100;
      window.scrollTo({ top: offset, behavior: "smooth" });
    }
  };

  return (
    <nav className="nav__links" aria-label="Primary" ref={ref}>
      {navLinks?.map((l) => {
        const hasSub = (l.subLinks?.length ?? 0) > 0;
        const isOpen = openKey === l._key;
        const subId = `navsub-${l._key}`;
        const accent = l.variant === "accent";
        const r = resolveNav(lang, l.link);
        const isActive = r.anchor && activeSection === r.id;
        const linkClass = `nav__link${accent ? " nav__link--accent" : ""}${isActive ? " is-active" : ""}`;

        return (
          <div className={`nav__item ${isOpen ? "is-open" : ""}`} key={l._key}>
            {r.external ? (
              <a className={linkClass} href={r.href} target="_blank" rel="noopener noreferrer">
                {l.label}
              </a>
            ) : r.anchor ? (
              <a
                className={linkClass}
                href={r.href}
                onClick={(e) => {
                  if (isHomePage || document.getElementById(r.id!)) {
                    e.preventDefault();
                    scrollToSection(r.id!);
                  }
                }}
              >
                {l.label}
              </a>
            ) : (
              <Link className={linkClass} href={r.href}>
                {l.label}
              </Link>
            )}

            {hasSub && (
              <button
                type="button"
                className="nav__caret-btn"
                aria-haspopup="true"
                aria-expanded={isOpen}
                aria-controls={subId}
                aria-label={`${l.label} submenu`}
                onClick={() => setOpenKey((cur) => (cur === l._key ? null : l._key))}
              >
                <ChevronDown className="nav__caret" />
              </button>
            )}
            {hasSub && (
              <div className="nav__dropdown" id={subId}>
                {l.subLinks.map((s) => {
                  const sr = resolveNav(lang, s.link);
                  return sr.external ? (
                    <a key={s._key} href={sr.href} target="_blank" rel="noopener noreferrer">
                      {s.label}
                    </a>
                  ) : (
                    <Link key={s._key} href={sr.href}>
                      {s.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
