"use client";
import React, { FC, useEffect, useRef } from "react";
import { gsap } from "gsap";
import styles from "./AnimatedPreview.module.scss";

export type AnimatedPreviewProps = {
  imageUrl: string;
  onAnimationComplete: () => void;
  direction?: "in" | "out";
};

const NUM_ROWS = 25; // 25 строк
const NUM_COLS = 40; // 40 столбцов (25 x 40 = 1000 кусочков)

const AnimatedPreview: FC<AnimatedPreviewProps> = ({
  imageUrl,
  onAnimationComplete,
  direction = "out",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // В зависимости от направления задаём начальные и конечные состояния
    if (containerRef.current) {
      if (direction === "out") {
        // Начальное состояние – собранное изображение
        gsap.set(`.${styles.piece}`, {
          scale: 1,
          rotation: 0,
          opacity: 1,
          x: 0,
          y: 0,
          transformStyle: "preserve-3d",
          willChange: "transform, opacity",
        });
        // Анимация разбора: кусочки исчезают, уменьшаются, поворачиваются
        gsap.to(`.${styles.piece}`, {
          duration: 1.2,
          opacity: 0,
          scale: 0,
          rotation: 15,
          ease: "power2.in",
          stagger: {
            each: 0.005,
            grid: [NUM_ROWS, NUM_COLS],
            from: "center",
          },
          onComplete: onAnimationComplete,
        });
      } else {
        // direction === "in": начальное состояние – кусочки скрыты
        gsap.set(`.${styles.piece}`, {
          opacity: 0,
          scale: 0,
          rotation: 15,
          x: 0,
          y: 0,
          transformStyle: "preserve-3d",
          willChange: "transform, opacity",
        });
        // Анимация сборки: кусочки собираются в единое изображение
        gsap.to(`.${styles.piece}`, {
          duration: 1.2,
          opacity: 1,
          scale: 1,
          rotation: 0,
          ease: "power2.out",
          stagger: {
            each: 0.005,
            grid: [NUM_ROWS, NUM_COLS],
            from: "center",
          },
          onComplete: onAnimationComplete,
        });
      }
    }
  }, [onAnimationComplete, direction]);

  const pieces = [];
  for (let row = 0; row < NUM_ROWS; row++) {
    for (let col = 0; col < NUM_COLS; col++) {
      const key = `${row}-${col}`;
      // Вычисляем позицию фона для каждого кусочка
      const posX = (100 * col) / (NUM_COLS - 1);
      const posY = (100 * row) / (NUM_ROWS - 1);
      pieces.push(
        <div
          key={key}
          className={styles.piece}
          style={{
            backgroundImage: `url(${imageUrl})`,
            backgroundSize: `${NUM_COLS * 100}% ${NUM_ROWS * 100}%`,
            backgroundPosition: `${posX}% ${posY}%`,
          }}
        />
      );
    }
  }

  return (
    <div className={styles.animatedPreview} ref={containerRef}>
      {pieces}
    </div>
  );
};

export default AnimatedPreview;
