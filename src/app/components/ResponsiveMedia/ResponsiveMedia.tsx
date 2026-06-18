"use client";
import React, { FC, useEffect, useState } from "react";
import Image from "next/image";
import { urlFor } from "@/sanity/sanity.client";
import VideoPreview from "../VideoPreview/VideoPreview";
import { ImageAlt } from "@/types/property";

type ResponsiveMediaProps = {
  title: string;
  previewImage: ImageAlt;
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
