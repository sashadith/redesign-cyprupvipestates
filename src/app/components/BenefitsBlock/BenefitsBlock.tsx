import React, { FC } from "react";
import styles from "./BenefitsBlock.module.scss";
import { BenefitsBlock as BenefitsBlockType } from "@/types/homepage";
import Image from "next/image";
import CountNumber from "../CountNumber/CountNumber";

type Props = {
  benefitsBlock: BenefitsBlockType;
};

const BenefitsBlock: FC<Props> = ({ benefitsBlock }) => {
  if (!benefitsBlock || benefitsBlock.benefits.length === 0) {
    return null;
  }
  return (
    <section className={styles.benefitsBlock}>
      <div className="container">
        <div className={styles.inner}>
          {/* {benefitsBlock.title && <h2 className="h2">{benefitsBlock.title}</h2>} */}
          <div className={styles.benefitsList}>
            {benefitsBlock.benefits.map((benefit) => (
              <div key={benefit._key} className={styles.benefitItem}>
                <div className={styles.image}>
                  <Image
                    src="/uploads/files/fc32736b9254db609636afb517d52ee174377d9f.png"
                    alt="Cyprus VIP Estates Benefits"
                    width={80}
                    height={80}
                    className={styles.icon}
                    unoptimized
                  />
                </div>
                <div className={styles.content}>
                  {benefit.counting && (
                    <div className={styles.conuting}>
                      <div className={styles.conuter}>
                        <CountNumber>
                          {benefit.counting.conuntNumber}
                        </CountNumber>
                        {benefit.counting.sign && (
                          <span>{benefit.counting.sign}</span>
                        )}
                      </div>
                    </div>
                  )}
                  <div className={styles.text}>
                    {benefit.title && (
                      <p className={styles.title}>{benefit.title}</p>
                    )}
                    {benefit.description && (
                      <p className={styles.description}>
                        {benefit.description}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default BenefitsBlock;
