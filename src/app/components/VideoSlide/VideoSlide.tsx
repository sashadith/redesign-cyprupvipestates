"use client";
import React, { FC, useState, useRef } from "react";
import styles from "./VideoSlide.module.scss";
import { ImageAlt } from "@/types/property";
import Image from "next/image";
import { FaPlay, FaPause } from "react-icons/fa";
import YouTube, { YouTubePlayer } from "react-youtube";
import { urlFor } from "@/sanity/sanity.client";

type Props = {
  videoId: string;
  videoPreview: ImageAlt;
};

const VideoSlide: FC<Props> = ({ videoId, videoPreview }) => {
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const playerRef = useRef<YouTubePlayer | null>(null);

  const onPlayerReady = (event: { target: YouTubePlayer }) => {
    console.log("Player ready");
    playerRef.current = event.target;
  };

  const onPlayerStateChange = (event: { data: number }) => {
    console.log("Player state changed:", event.data);
    if (event.data === 0) {
      // Video ended
      setIsVideoPlaying(false);
    }
  };

  const handlePlayPause = () => {
    console.log("Play/Pause clicked");
    if (playerRef.current) {
      if (isVideoPlaying) {
        playerRef.current.pauseVideo();
        console.log("Video paused");
      } else {
        playerRef.current.playVideo();
        console.log("Video playing");
      }
      setIsVideoPlaying(!isVideoPlaying);
    }
  };

  return (
    <div className={styles.videoSlide}>
      <div className={styles.posterImageBlock}>
        {!isVideoPlaying && (
          <>
            <Image
              src={urlFor(videoPreview).url()}
              alt={videoId}
              width={1920}
              height={1080}
              className={styles.posterImage}
            />
            <div className={styles.overlay}></div>
          </>
        )}
        <button
          className={isVideoPlaying ? styles.playingButton : styles.playButton}
          onClick={handlePlayPause}
          aria-label={
            isVideoPlaying
              ? `Pause video: ${videoId}`
              : `Play video: ${videoId}`
          }
        >
          {isVideoPlaying ? <FaPause /> : <FaPlay />}
        </button>
        {isVideoPlaying && (
          <YouTube
            videoId={videoId}
            opts={{
              width: "100%",
              height: "100%",
              playerVars: {
                autoplay: 1,
                controls: 1,
                rel: 0,
              },
            }}
            onReady={onPlayerReady}
            onStateChange={onPlayerStateChange}
            className={styles.videoFrame}
          />
        )}
      </div>
    </div>
  );
};

export default VideoSlide;
