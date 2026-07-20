"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    clarity?: (...args: any[]) => void;
    // временная очередь команд до того, как clarity загрузится
    _clarityQueue?: any[];
  }
}

export default function MicrosoftClarity({
  hasConsent,
}: {
  hasConsent: boolean;
}) {
  useEffect(() => {
    // 1. Инициализация Clarity (твой же сниппет)
    (function (c: any, l: Document, a: string, r: string, i: string) {
      // если clarity уже инициалирован — ничего не делаем повторно
      if (c[a]) return;

      // Shim stays synchronous (cheap, no network) so any window.clarity(...)
      // call anywhere in the app — including the consent effect just below —
      // queues safely before the real script exists.
      c[a] = function () {
        // если clarity уже подцепился — просто пушим аргументы
        (c[a].q = c[a].q || []).push(arguments);
      };

      // The actual script tag (network fetch + eventual execution of the real
      // clarity.js) is what showed up as a ~200ms main-thread long task inside
      // the LCP window in a live PSI run (2026-07-20) despite already being
      // `async` — `async` only means non-blocking for HTML parsing, not that
      // it avoids competing for main-thread time once it does load. Session
      // recording has no reason to start before the page is idle, so defer
      // the insertion itself: requestIdleCallback when available, a 2s
      // setTimeout fallback for browsers without it (Safari).
      const insert = () => {
        const t = l.createElement(r) as HTMLScriptElement;
        t.async = true;
        t.src = "https://www.clarity.ms/tag/" + i;

        const y = l.getElementsByTagName(r)[0];
        if (y && y.parentNode) {
          y.parentNode.insertBefore(t, y);
        } else {
          l.head.appendChild(t);
        }
      };
      if (typeof (window as any).requestIdleCallback === "function") {
        (window as any).requestIdleCallback(insert, { timeout: 4000 });
      } else {
        setTimeout(insert, 2000);
      }
    })(window, document, "clarity", "script", "qoasnhd0ms");
  }, []);

  useEffect(() => {
    // 2. Передаём согласие безопасно
    // Трюк: даже если clarity ещё подгружается, её shim-функция уже есть.
    // shim складывает вызовы в очередь (c[a].q).
    try {
      if (
        typeof window !== "undefined" &&
        typeof window.clarity === "function"
      ) {
        window.clarity("consent", hasConsent === true);
      }
    } catch (err) {
      // просто гасим возможный ранний сбой, чтобы не крашить приложение
      // (после загрузки clarity сама ещё раз вызовет очередь .q)
      console.warn("Clarity consent set failed early:", err);
    }
  }, [hasConsent]);

  return null;
}
