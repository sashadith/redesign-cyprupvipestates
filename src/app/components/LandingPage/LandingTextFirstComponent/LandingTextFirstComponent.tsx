import { LandingTextFirst } from "@/types/blog";
import React, { FC } from "react";
import { PortableText } from "@portabletext/react";
import styles from "./LandingTextFirstComponent.module.scss";
import { RichText } from "../../RichText/RichText";
import FadeUpAnimate from "../../FadeUpAnimate/FadeUpAnimate";
import LandingOrder from "../LandingOrder/LandingOrder";
import LandingCta from "../LandingCta/LandingCta";

type Props = {
  lang: string;
  block: LandingTextFirst;
};

const LandingTextFirstComponent: FC<Props> = ({ block, lang }) => {
  return (
    <>
      <section className={styles.textContentComponent}>
        <div className="container-short">
          <div>
            <PortableText value={block.content} components={RichText} />
          </div>
        </div>
      </section>
      <LandingOrder lang={lang} />
      <LandingCta lang={lang} />
    </>
  );
};

export default LandingTextFirstComponent;
