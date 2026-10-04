"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { isDarkHeroPath, isScrimHeroPath } from "./navShared";

/* Toggles <html data-hero-dark> on the dark-hero routes (home, /projects) so the
   global nav stays fully transparent there; every other route keeps the legible
   deep-green top bar. Handles client-side navigation; first paint is covered by
   the inline pre-paint script in [lang]/layout.tsx (so there's no bar → transparent
   flash on the home hero). */
export default function NavHeroFlag() {
  const pathname = usePathname();
  useEffect(() => {
    document.documentElement.toggleAttribute("data-hero-dark", isDarkHeroPath(pathname || "/"));
    /* isScrimHeroPath was imported here but never used: the attribute was set
       once by the pre-paint script and then never cleared, so a client-side
       navigation away from a project page carried the scrim onto the next one
       and a navigation INTO one never got it. Toggled with the dark flag now. */
    document.documentElement.toggleAttribute("data-hero-scrim", isScrimHeroPath(pathname || "/"));
  }, [pathname]);
  return null;
}
