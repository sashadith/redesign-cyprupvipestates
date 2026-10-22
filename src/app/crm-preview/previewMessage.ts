// The message the owner's design page posts into the /crm-preview frames (same origin only).
// `vars` is cssVars() output: role colours, whitelisted font names and numbers. It never contains
// `{`, `}`, `<` or `>`, so a message that does is not ours and is ignored (it could close the
// `:root{}` rule or the <style> element it is written into).
export type PreviewMessage = { type: "ds-preview"; vars: string; dark: boolean };

export const PREVIEW_TYPE = "ds-preview";

export function isPreviewMessage(data: unknown): data is PreviewMessage {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  return d.type === PREVIEW_TYPE && typeof d.vars === "string" && !/[{}<>]/.test(d.vars) && typeof d.dark === "boolean";
}

// A frame's PreviewBridge posts this to its parent once it listens, so a draft is never lost to a
// frame that loaded before the editor hydrated (or hydrated after the editor's `load` post).
export const READY_TYPE = "ds-preview-ready";

export function isPreviewReady(data: unknown): boolean {
  return typeof data === "object" && data !== null && (data as Record<string, unknown>).type === READY_TYPE;
}
