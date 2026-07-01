"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { isDarkHeroPath } from "./navShared";

/* Toggles <html data-hero-dark> on the dark-hero routes (home, /projects) so the
   global nav stays fully transparent there; every other route keeps the legible
   deep-green top bar. Handles client-side navigation; first paint is covered by
   the inline pre-paint script in [lang]/layout.tsx (so there's no bar → transparent
   flash on the home hero). */
export default function NavHeroFlag() {
  const pathname = usePathname();
  useEffect(() => {
    document.documentElement.toggleAttribute("data-hero-dark", isDarkHeroPath(pathname || "/"));
  }, [pathname]);
  return null;
}
