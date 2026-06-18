"use client";
import React, { FC, useRef, useState } from "react";
import styles from "./VideoPreview.module.scss";
import YouTube, { YouTubePlayer } from "react-youtube";
import { ImageAlt } from "@/types/project";
import Image from "next/image";
import { urlFor } from "@/sanity/sanity.client";

type Props = {
  videoId: string;
  videoPreview: ImageAlt;
};

const VideoPreview: FC<Props> = ({ videoId, videoPreview }) => {
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [isPreviewVisible, setIsPreviewVisible] = useState(true);
  const playerRef = useRef<YouTubePlayer | null>(null);

  const onPlayerReady = (event: { target: YouTubePlayer }) => {
    playerRef.current = event.target;
    setIsPlayerReady(true);
    if (isVideoLoaded) {
      event.target.playVideo();
    }
  };

  const onPlayerStateChange = (event: { data: number }) => {
    if (event.data === 1) {
      // Видео начало воспроизводиться
      setIsVideoPlaying(true);
      setIsPreviewVisible(false);
    } else if (event.data === 0) {
      // Видео закончилось
      setIsVideoPlaying(false);
      setIsPreviewVisible(true);
    } else if (event.data === 2) {
      // Видео поставлено на паузу
      setIsVideoPlaying(false);
    }
  };

  const handlePreviewClick = () => {
    setIsVideoLoaded(true);
    if (isPlayerReady && playerRef.current) {
      playerRef.current.playVideo();
    }
  };

  return (
    <div className={styles.videoPreview}>
      {isPreviewVisible && (
        <div className={styles.previewWrapper} onClick={handlePreviewClick}>
          <Image
            alt="Video preview"
            src={urlFor(videoPreview).url()}
            fill
            sizes="100vw"
            className={styles.imagePoster}
          />
        </div>
      )}
      <YouTube
        videoId={videoId}
        opts={{
          width: "100%",
          height: "100%",
          playerVars: {
            autoplay: 1,
            mute: 1,
            controls: 0,
            modestbranding: 1,
            rel: 0,
            disablekb: 1,
            loop: 1,
            playlist: videoId,
            playsinline: 1,
            showinfo: 0,
            vq: "hd720",
            fs: 0,
          },
        }}
        onReady={onPlayerReady}
        onStateChange={onPlayerStateChange}
        className={styles.videoFrame}
      />
      <div className={styles.overlay}></div>
    </div>
  );
};

export default VideoPreview;
