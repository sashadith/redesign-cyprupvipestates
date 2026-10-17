"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Records what a visitor does on a page, not just that they arrived.
 *
 * The question it exists to answer: over 90 days, 4,085 real visitors reached
 * project pages and 12 enquired. The only contact form sits near the very
 * bottom. "They saw it and declined" and "they never scrolled that far" have
 * opposite fixes, and nothing distinguished them.
 *
 * Five events, each fired AT MOST ONCE per page view, so a count means one
 * visitor reached that state rather than one visitor scrolling up and down:
 *
 *   scroll_50 / scroll_90  how far down the page they got
 *   form_view              the enquiry form actually entered the viewport
 *   cta_click              the hero button that jumps to the form
 *   wa_click               the floating WhatsApp button
 *
 * Instrumented by DATA ATTRIBUTE rather than by selector or DOM position:
 * `data-engage="form"` / `"cta"` / `"wa"`. A CSS class or an nth-child path
 * would keep type-checking and silently stop matching the first time someone
 * restyles the page, and a measurement that fails silently is worse than none
 * — it reads as "nobody clicks this".
 *
 * Same privacy contract as AnalyticsTracker: cookieless, no PII, sendBeacon,
 * every failure swallowed. Analytics must never break the page.
 */
const SCROLL_MARKS: Array<[number, string]> = [
  [0.5, "scroll_50"],
  [0.9, "scroll_90"],
];

export default function EngagementTracker({ locale, contentId }: { locale: string; contentId?: string }) {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || typeof window === "undefined") return;

    const sent = new Set<string>();
    const send = (type: string) => {
      if (sent.has(type)) return;
      sent.add(type);
      const payload = JSON.stringify({ path: pathname, locale, type, contentId: contentId ?? null });
      try {
        if (navigator.sendBeacon) {
          navigator.sendBeacon("/api/analytics/event", new Blob([payload], { type: "application/json" }));
        } else {
          fetch("/api/analytics/event", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: payload, keepalive: true,
          });
        }
      } catch {
        /* never break the page */
      }
    };

    // ---- scroll depth -----------------------------------------------------
    // Measured against scrollable height, not viewport count: on a short page
    // the bottom is reached immediately and 90% is honestly 90%.
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const doc = document.documentElement;
        const scrollable = doc.scrollHeight - window.innerHeight;
        if (scrollable <= 0) return; // page fits on screen; depth is meaningless
        const ratio = (window.scrollY || doc.scrollTop) / scrollable;
        for (const [mark, type] of SCROLL_MARKS) if (ratio >= mark) send(type);
        if (sent.has("scroll_90")) window.removeEventListener("scroll", onScroll);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll(); // a page already scrolled (restored position, deep link) counts now

    // ---- form in viewport -------------------------------------------------
    // IntersectionObserver rather than a scroll-position guess: it answers the
    // literal question — were those pixels on screen — regardless of layout.
    let io: IntersectionObserver | null = null;
    const formEl = document.querySelector('[data-engage="form"]');
    if (formEl && "IntersectionObserver" in window) {
      io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) {
              send("form_view");
              io?.disconnect();
            }
          }
        },
        // A third of the form visible, so a form scrolled half past the fold
        // at the moment of leaving does not count as seen.
        { threshold: 0.33 },
      );
      io.observe(formEl);
    }

    // ---- clicks -----------------------------------------------------------
    // Delegated from the document: the WhatsApp button and the hero CTA mount
    // at different times, and a listener per element would miss whichever
    // renders later.
    const onClick = (ev: MouseEvent) => {
      const el = (ev.target as HTMLElement | null)?.closest?.("[data-engage]");
      const which = el?.getAttribute("data-engage");
      if (which === "cta") send("cta_click");
      else if (which === "wa") send("wa_click");
    };
    document.addEventListener("click", onClick, { capture: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("click", onClick, { capture: true });
      io?.disconnect();
    };
  }, [pathname, locale, contentId]);

  return null;
}
