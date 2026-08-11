"use client";
import React, { FC, useEffect, useState } from "react";
import Image from "next/image";
import { urlFor } from "@/sanity/sanity.client";
import VideoPreview from "../VideoPreview/VideoPreview";
import { ImageAlt } from "@/types/property";

type ResponsiveMediaProps = {
  title: string;
  // Typed as required (ImageAlt) everywhere this is threaded through, but not
  // actually guaranteed at the DB layer — a legacy Project row can have
  // previewImage: null (confirmed: akamantis-gardens, all 4 locales, still
  // PUBLISHED — 500'd every request, previewImage.alt on a null value).
  // Widened here rather than at the type's source, which several other
  // required-ImageAlt call sites still assume — this component is the one
  // that actually dereferences it unconditionally.
  previewImage: ImageAlt | null | undefined;
  videoId?: string;
  videoPreview?: ImageAlt;
};

const ResponsiveMedia: FC<ResponsiveMediaProps> = ({
  title,
  previewImage,
  videoId,
  videoPreview,
}) => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Если устройство не мобильное и есть данные для видео, рендерим VideoPreview
  if (!isMobile && videoId && videoPreview) {
    return <VideoPreview videoId={videoId} videoPreview={videoPreview} />;
  }

  // No image and no video to fall back to — render nothing rather than
  // crash. Same "quietly empty, never a 500" outcome this codebase already
  // accepts for an empty projectsSectionBlock (see findEmptyProjectsBlock);
  // the underlying data gap (a PUBLISHED project with no image) is a
  // separate, one-off content problem, not something to paper over with an
  // invented placeholder graphic here.
  if (!previewImage) return null;

  // Иначе отображаем статичное изображение
  return (
    <Image
      alt={previewImage.alt || title}
      src={urlFor(previewImage).url()}
      fill
      sizes="100vw"
      priority
      className="imagePoster"
      {...((previewImage as any).asset?.blurDataURL
        ? { placeholder: "blur" as const, blurDataURL: (previewImage as any).asset.blurDataURL }
        : {})}
    />
  );
};

export default ResponsiveMedia;
