"use client";

import { useEffect, useState } from "react";

/** Pure helper: does this `document` (or document-shaped stub) declare RTL?
 *  Split out from the hook so it can be unit-tested without a DOM. */
export function isRtlDoc(
  doc: { documentElement?: { dir?: string } } | undefined,
): boolean {
  return doc?.documentElement?.dir === "rtl";
}

/** Client-only hook mirroring the current document's writing direction.
 *  SSR-safe: renders `false` on the server/first paint, then re-evaluates
 *  `<html dir>` on mount so hydration never mismatches. */
export function useIsRtl(): boolean {
  const [isRtl, setIsRtl] = useState(false);

  useEffect(() => {
    setIsRtl(isRtlDoc(typeof document === "undefined" ? undefined : document));
  }, []);

  return isRtl;
}
