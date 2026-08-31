// Admin document shell. The app's root layout is a pass-through fragment (the localized site
// provides its own <html>/<body> under [lang]); /admin lives outside [lang], so it needs its own
// html/body + global stylesheet (Tailwind), otherwise it renders unstyled with no document shell.
import "@/app/globals.css";
// Definitions only — no element or utility rules, and no variable name
// overlaps with globals.css, so this adds the shared type/colour scale to
// the admin without restyling anything that does not ask for it.
import "@/app/design-tokens.css";
import "./admin-mobile.css";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Admin — Cyprus VIP Estates",
  robots: { index: false, follow: false },
};

// 2026-08-03 — neither this layout nor [lang]/layout.tsx (the public site,
// completely separate <html>/<body> tree, untouched by this change) ever
// set a viewport meta tag at all, so iOS fell back to rendering the admin
// at desktop width and scaling down (explains it not filling the screen)
// on top of the auto-zoom-into-input behavior above. maximumScale/
// userScalable are a best-effort ask, not a guarantee — iOS only honors
// them for a Home Screen / standalone-mode install, and even then only on
// some versions; regular in-Safari admin use still lets a visitor pinch-
// zoom freely regardless of these values.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  // globals.css sets `body { color:#fff }` for the frontend's dark sections; override for admin
  // and force dark text on all form controls so inputs aren't white-on-white.
  return (
    <html lang="en">
      <body className="antialiased bg-[#F8F9FA] text-[#111827] [&_input]:text-[#111827] [&_select]:text-[#111827] [&_textarea]:text-[#111827] [&_input::placeholder]:text-[#9CA3AF] [&_textarea::placeholder]:text-[#9CA3AF]">
        {children}
      </body>
    </html>
  );
}
