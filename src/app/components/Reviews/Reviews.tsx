import React, { FC } from "react";
import styles from "./Reviews.module.scss";
import { ReviewsBlock } from "@/types/homepage";
import SliderReviews from "../SliderReviews/SliderReviews";

type Props = {
  reviews: ReviewsBlock;
};

const Reviews: FC<Props> = ({ reviews }) => {
  if (!reviews || reviews.reviews.length === 0) {
    return null;
  }

  return (
    <section id="reviews" className={styles.reviews}>
      <div className="container">
        {/* <FadeUpAnimate> */}
        <h2 className={styles.title}>{reviews.title}</h2>
        {/* </FadeUpAnimate> */}
        <SliderReviews reviews={reviews.reviews} />
      </div>
    </section>
  );
};

export default Reviews;
