import React, { FC } from "react";
import styles from "./OffPlanSnapshotBlockComponent.module.scss";
import { ButtonModal } from "../../ButtonModal/ButtonModal";
import FadeUpAnimate from "../../FadeUpAnimate/FadeUpAnimate";

export type OffPlanStat = { label: string; value: string };
export type OffPlanDistrictRow = { district: string; units: string; avgPrice: string };

export type OffPlanSnapshotBlock = {
  _key: string;
  _type: "offPlanSnapshotBlock";
  heading: string;
  blurb: string;
  stats: OffPlanStat[];
  districtTable?: OffPlanDistrictRow[];
  ctaLabel: string;
  footnote: string;
};

type Props = {
  block: OffPlanSnapshotBlock;
};

const OffPlanSnapshotBlockComponent: FC<Props> = ({ block }) => {
  return (
    <section className={styles.snapshot}>
      <div className="container-short">
        <FadeUpAnimate>
          <div>
            <h2 className={styles.heading}>{block.heading}</h2>
            <p className={styles.blurb}>{block.blurb}</p>

            <div className={styles.stats}>
              {block.stats.map((s) => (
                <div className={styles.stat} key={s.label}>
                  <span className={styles.statValue}>{s.value}</span>
                  <span className={styles.statLabel}>{s.label}</span>
                </div>
              ))}
            </div>

            {block.districtTable && block.districtTable.length > 0 && (
              <div className={styles.districtTable}>
                {block.districtTable.map((row) => (
                  <div className={styles.districtRow} key={row.district}>
                    <span className={styles.districtName}>{row.district}</span>
                    <span className={styles.districtUnits}>{row.units} units</span>
                    <span className={styles.districtPrice}>{row.avgPrice}</span>
                  </div>
                ))}
              </div>
            )}

            <div className={styles.ctaRow}>
              <ButtonModal className={styles.ctaButton}>{block.ctaLabel}</ButtonModal>
            </div>

            <p className={styles.footnote}>{block.footnote}</p>
          </div>
        </FadeUpAnimate>
      </div>
    </section>
  );
};

export default OffPlanSnapshotBlockComponent;
