import React, { FC } from "react";
import styles from "./TeamBlockComponent.module.scss";
import { TeamBlock } from "@/types/blog";
import Image from "next/image";
import { urlFor } from "@/sanity/sanity.client";
import { ButtonModal } from "../ButtonModal/ButtonModal";
import FadeUpAnimate from "../FadeUpAnimate/FadeUpAnimate";

type Props = {
  block: TeamBlock;
  lang: string;
};

const TeamBlockComponent: FC<Props> = ({ block, lang }) => {
  // console.log("TeamBlockComponent", block, lang);
  const { title, members } = block;
  return (
    <section className={styles.teamBlock}>
      <div className="container">
        <h2 className="h2-white">{title}</h2>
        <FadeUpAnimate>
          <div className={styles.members}>
            {members.map((member) => (
              <div key={member._key} className={styles.member}>
                <div className={styles.memberImage}>
                  <Image
                    alt={member.image.alt || member.name}
                    src={urlFor(member.image).url()}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  />
                </div>
                <div className={styles.memberInfo}>
                  <div className={styles.memberInfoStart}>
                    <h3 className={styles.name}>{member.name}</h3>
                    <p className={styles.position}>{member.position}</p>
                    <p className={styles.description}>{member.description}</p>
                  </div>
                  <div className={styles.memberInfoEnd}>
                    <div className={styles.button}>
                      <ButtonModal>
                        {lang === "en"
                          ? "Contact"
                          : lang === "de"
                            ? "Kontaktieren"
                            : lang === "pl"
                              ? "Kontakt"
                              : lang === "ru"
                                ? "Связаться"
                                : "Contact"}
                      </ButtonModal>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </FadeUpAnimate>
      </div>
    </section>
  );
};

export default TeamBlockComponent;
