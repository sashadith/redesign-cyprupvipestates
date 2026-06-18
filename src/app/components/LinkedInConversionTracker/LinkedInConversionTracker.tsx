"use client";

import { useEffect, useRef } from "react";

type Props = {
  conversionId: number;
};

export default function LinkedInConversionTracker({ conversionId }: Props) {
  const trackedRef = useRef(false);

  useEffect(() => {
    if (trackedRef.current) return;
    trackedRef.current = true;

    if (
      typeof window !== "undefined" &&
      typeof (window as any).lintrk === "function"
    ) {
      (window as any).lintrk("track", {
        conversion_id: conversionId,
      });
    }
  }, [conversionId]);

  return null;
}
