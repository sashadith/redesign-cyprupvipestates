import { Slide } from "@/types/homepage";
import React, { FC } from "react";
import styles from "./Hero.module.scss";
import SliderMain from "../SliderMain/SliderMain";
import HeroSlide from "../HeroSlide/HeroSlide";

type Props = {
  slides: Slide[];
};

const Hero: FC<Props> = ({ slides }) => {
  return (
    <section className={styles.hero}>
      <SliderMain>
        {slides.map((slide, index) => (
          <HeroSlide
            key={index}
            image={slide.image}
            title={slide.title}
            description={slide.description}
            linkLabel={slide.linkLabel}
            linkDestination={slide.linkDestination}
            buttonLabel={slide.buttonLabel}
          />
        ))}
      </SliderMain>
    </section>
  );
};

export default Hero;
