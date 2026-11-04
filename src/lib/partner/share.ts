/** Commission share (percent) the partner earns for a given mode. HANDOVER → handoverShare, FIX → fixShare. */
export function partnerShareFor(p: { mode: "HANDOVER" | "FIX"; handoverShare: number; fixShare: number }): number {
  return p.mode === "FIX" ? p.fixShare : p.handoverShare;
}
