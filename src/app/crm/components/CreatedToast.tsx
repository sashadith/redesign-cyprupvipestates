"use client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useToast } from "./Toast";

// "Lead created" on the cockpit after New lead (?created=1). The form navigates
// away, so a toast there would never be seen. The flag is dropped from the URL
// so a reload does not repeat the toast.
export function CreatedToast({ show }: { show: boolean }) {
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const done = useRef(false);
  useEffect(() => {
    if (!show || done.current) return;
    done.current = true;
    toast.show("Lead created");
    router.replace(pathname, { scroll: false });
  }, [show, toast, router, pathname]);
  return <>{toast.node}</>;
}
