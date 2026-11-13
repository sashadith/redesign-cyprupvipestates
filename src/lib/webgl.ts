"use client";

// Can this browser give MapLibre a WebGL context?
//
// Every map on the site (the /projects listing, the project page, the client
// presentation, the CRM matching map) is MapLibre, which needs WebGL. When the
// browser has none — hardware acceleration off, some VMs and remote desktops,
// locked-down corporate browsers, privacy browsers that block WebGL — the map
// constructor THROWS. It did so inside a layout effect, which unmounted the
// whole React tree: visitors got "Application error: a client-side exception
// has occurred" in place of the listing, the footer and the cookie banner.
// Found 2026-11-02 on /pl/projects and /de/projects.
//
// This probe lets callers skip the map up front. It is a hint, not a guarantee:
// a probe context can succeed where MapLibre's (with its own attributes) still
// fails, so MapContainer also catches the constructor. Both are needed.

import { useEffect, useState } from "react";

type CanvasLike = { getContext(kind: string): unknown };
type DocLike = { createElement(tag: "canvas"): CanvasLike };

let cached: boolean | null = null;

/** Pure probe, exported for tests. Never throws. */
export function probeWebGL(doc: DocLike | null | undefined): boolean {
  if (!doc) return false;
  try {
    const canvas = doc.createElement("canvas");
    const gl = (canvas.getContext("webgl2") || canvas.getContext("webgl")) as
      | { getExtension?(name: string): { loseContext?(): void } | null }
      | null
      | undefined;
    if (!gl) return false;
    // Browsers cap live WebGL contexts (~16 in Chrome) and evict the oldest,
    // which could be a real map. Release the probe's context straight away.
    try { gl.getExtension?.("WEBGL_lose_context")?.loseContext?.(); } catch { /* best effort */ }
    return true;
  } catch {
    return false;
  }
}

/** Cached probe of the current document. False on the server. */
export function canUseWebGL(): boolean {
  if (typeof document === "undefined") return false;
  if (cached === null) cached = probeWebGL(document);
  return cached;
}

/**
 * True until the client-side probe has run and failed. Starting at true keeps
 * the server HTML and the first client render identical (no hydration
 * mismatch); browsers without WebGL drop the map UI one effect later.
 */
export function useWebGLSupport(): boolean {
  const [ok, setOk] = useState(true);
  useEffect(() => {
    if (!canUseWebGL()) setOk(false);
  }, []);
  return ok;
}
