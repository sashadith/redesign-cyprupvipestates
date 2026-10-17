"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export function useToast() {
  const [msg, setMsg] = useState<{ text: string; kind: "ok" | "error" } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((text: string, kind: "ok" | "error" = "ok") => {
    setMsg({ text, kind });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 2800);
  }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const node = (
    <div role="status" aria-live="polite" className={`crm-toast${msg ? " show" : ""}${msg?.kind === "error" ? " error" : ""}`}>{msg?.text}</div>
  );
  return { show, node };
}
