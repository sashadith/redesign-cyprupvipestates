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

      c[a] = function () {
        // если clarity уже подцепился — просто пушим аргументы
        (c[a].q = c[a].q || []).push(arguments);
      };

      const t = l.createElement(r) as HTMLScriptElement;
      t.async = true;
      t.src = "https://www.clarity.ms/tag/" + i;

      const y = l.getElementsByTagName(r)[0];
      if (y && y.parentNode) {
        y.parentNode.insertBefore(t, y);
      } else {
        l.head.appendChild(t);
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
