"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

type Show = (text: string, kind?: "ok" | "error") => void;

function useOwnToast() {
  const [msg, setMsg] = useState<{ text: string; kind: "ok" | "error" } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback<Show>((text, kind = "ok") => {
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

// One toast per page: panels inside a ToastProvider share its single toast, so
// a new message replaces the previous one instead of stacking on top of it.
const ToastContext = createContext<Show | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { show, node } = useOwnToast();
  return <ToastContext.Provider value={show}>{children}{node}</ToastContext.Provider>;
}

// Inside a ToastProvider: the shared toast (node is null, the provider renders
// it). Outside: a toast of the component's own.
export function useToast(): { show: Show; node: React.ReactNode } {
  const shared = useContext(ToastContext);
  const own = useOwnToast();
  return shared ? { show: shared, node: null } : own;
}
