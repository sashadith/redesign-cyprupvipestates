import React, { FC } from "react";
import { PortableText } from "@portabletext/react";
import styles from "./LandingTextStartComponent.module.scss";
import { RichText } from "../../RichText/RichText";
import FadeUpAnimate from "../../FadeUpAnimate/FadeUpAnimate";
import LandingOrder from "../LandingOrder/LandingOrder";
import LandingCta from "../LandingCta/LandingCta";
import { LandingTextStart } from "@/types/blog";

type Props = {
  lang: string;
  block: LandingTextStart;
};

const LandingTextStartComponent: FC<Props> = ({ block, lang }) => {
  return (
    <>
      <section className={styles.textContentComponent}>
        <div className="container-short">
          <div>
            <PortableText value={block.content} components={RichText} />
          </div>
        </div>
      </section>
    </>
  );
};

export default LandingTextStartComponent;
