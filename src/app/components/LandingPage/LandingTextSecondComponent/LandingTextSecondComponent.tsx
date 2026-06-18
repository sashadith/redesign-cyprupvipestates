import { LandingTextSecond } from "@/types/blog";
import React, { FC } from "react";
import { PortableText } from "@portabletext/react";
import styles from "./LandingTextSecondComponent.module.scss";
import { RichText } from "../../RichText/RichText";
import FadeUpAnimate from "../../FadeUpAnimate/FadeUpAnimate";
import LandingCount from "../LandingCount/PartnersCount";
import LandingCta from "../LandingCta/LandingCta";
import LandingContact from "../LandingContact/LandingContact";
import { FormStandardDocument } from "@/types/formStandardDocument";

type Props = {
  lang: string;
  block: LandingTextSecond;
  formDocument: FormStandardDocument;
};

const LandingTextSecondComponent: FC<Props> = ({
  block,
  lang,
  formDocument,
}) => {
  return (
    <>
      <section className={styles.textContentComponent}>
        <div className="container-short">
          <div>
            <PortableText value={block.content} components={RichText} />
          </div>
        </div>
      </section>
      <LandingCount lang={lang} />
      <LandingContact lang={lang} form={formDocument} />
    </>
  );
};

export default LandingTextSecondComponent;
