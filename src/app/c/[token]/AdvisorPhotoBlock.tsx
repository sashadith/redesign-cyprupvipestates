"use client";
import { useLayoutEffect, useRef, useState } from "react";

// The photo's rendered width varies with its source aspect ratio (photoPng is
// height-constrained, width auto), so the "pedestal" divider under it can't be
// a fixed CSS width — it's measured from the actual <img> box and kept at 1.15x.
export default function AdvisorPhotoBlock({
  src, isPhoto,
}: {
  src: string;
  isPhoto: boolean;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [dividerWidth, setDividerWidth] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (!isPhoto) return;
    const measure = () => {
      if (imgRef.current) setDividerWidth(imgRef.current.getBoundingClientRect().width * 1.15);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [isPhoto]);

  return (
    <div className="cp-closing__photocol">
      <img
        ref={imgRef}
        src={src}
        alt=""
        className={isPhoto ? "cp-closing__photo" : "cp-closing__avatar"}
        onLoad={() => { if (imgRef.current) setDividerWidth(imgRef.current.getBoundingClientRect().width * 1.15); }}
      />
      <div
        className={`cp-closing__divider${isPhoto ? " cp-closing__divider--photo" : ""}`}
        style={isPhoto && dividerWidth ? { width: `${dividerWidth}px` } : undefined}
      />
    </div>
  );
}
