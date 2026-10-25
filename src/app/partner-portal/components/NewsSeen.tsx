"use client";
import { useEffect, useRef } from "react";
import { markNewsSeenAction } from "../newsActions";

/** Renders nothing; marks the news as seen once on mount (a server action, so nothing is written during render). */
export function NewsSeen() {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    markNewsSeenAction().catch(() => {});
  }, []);
  return null;
}
