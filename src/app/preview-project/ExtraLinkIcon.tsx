import React from "react";
import type { ExtraLinkKind } from "@/lib/developmentExtraLinks";

/* Line icons for the media tiles under the description (video, 360° tour,
   virtual walkthrough, project camera). Same stroke idiom as amenityIcons.tsx. */

const Svg = ({ size = 20, children }: { size?: number; children: React.ReactNode }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

const ICONS: Record<ExtraLinkKind, React.ReactNode> = {
  video: <Svg size={18}><path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none" /></Svg>,
  tour360: <Svg size={22}><ellipse cx="12" cy="12" rx="9.5" ry="4" /><path d="M12 3.5v17M16.5 17.6l2.2.4-.9 2" /><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" /></Svg>,
  walkthrough: <Svg><path d="M3.5 10.5 12 4l8.5 6.5V20h-5.5v-5.5h-6V20H3.5z" /></Svg>,
  camera: <Svg><rect x="3" y="7" width="13" height="10" rx="2" /><path d="m16 10.5 5-3v9l-5-3z" /></Svg>,
};

export default function ExtraLinkIcon({ kind }: { kind: ExtraLinkKind }) {
  return <>{ICONS[kind]}</>;
}

export function ExtraLinkArrow() {
  return <Svg size={14}><path d="M7 17 17 7M9 7h8v8" /></Svg>;
}
