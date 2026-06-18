// Admin document shell. The app's root layout is a pass-through fragment (the localized site
// provides its own <html>/<body> under [lang]); /admin lives outside [lang], so it needs its own
// html/body + global stylesheet (Tailwind), otherwise it renders unstyled with no document shell.
import "@/app/globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin — Cyprus VIP Estates",
  robots: { index: false, follow: false },
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
