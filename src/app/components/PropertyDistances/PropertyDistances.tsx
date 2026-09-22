import React, { FC } from "react";
import styles from "./PropertyDistances.module.scss";
import Image from "next/image";
import { Distances } from "@/types/project";
import { propertyDistancesCopy } from "./PropertyDistances.copy";

type Props = {
  distances: Distances;
  lang: string;
};

const PropertyDistances: FC<Props> = ({ distances, lang }) => {
  const t = propertyDistancesCopy(lang);

  return (
    <section className={styles.propertyDistances}>
      <div className="container">
        <div className={styles.distances}>
          {distances.beach && (
            <div className={styles.distance}>
              <div className={styles.imageBlock}>
                <Image
                  alt={t.beach.alt}
                  src="/uploads/files/21910cdeda8b4c0b1273cb9e487ea1c16873fcd7.png"
                  width={70}
                  height={70}
                  unoptimized
                  className={styles.image}
                />
              </div>
              <div className={styles.distanceContent}>
                <p className={styles.distanceLabel}>{t.beach.label}</p>
                <p className={styles.distanceValue}>
                  {distances.beach}
                  {t.minSuffix}
                </p>
              </div>
            </div>
          )}
          {distances.restaurants && (
            <div className={styles.distance}>
              <div className={styles.imageBlock}>
                <Image
                  alt={t.restaurants.alt}
                  src="/uploads/files/2667dfd1da48a595caf5f9d65c27df5c70695ae1.png"
                  width={70}
                  height={70}
                  unoptimized
                  className={styles.image}
                />
              </div>
              <div className={styles.distanceContent}>
                <p className={styles.distanceLabel}>{t.restaurants.label}</p>
                <p className={styles.distanceValue}>
                  {distances.restaurants}
                  {t.minSuffix}
                </p>
              </div>
            </div>
          )}
          {distances.shops && (
            <div className={styles.distance}>
              <div className={styles.imageBlock}>
                <Image
                  alt={t.shops.alt}
                  src="/uploads/files/91095253a8e1d58c1f8eb5a5356c3ec11e1f7d31.png"
                  width={70}
                  height={70}
                  unoptimized
                  className={styles.image}
                />
              </div>
              <div className={styles.distanceContent}>
                <p className={styles.distanceLabel}>{t.shops.label}</p>
                <p className={styles.distanceValue}>
                  {distances.shops}
                  {t.minSuffix}
                </p>
              </div>
            </div>
          )}
          {distances.airport && (
            <div className={styles.distance}>
              <div className={styles.imageBlock}>
                <Image
                  alt={t.airport.alt}
                  src="/uploads/files/a9935ed23f1f65da3447f3a896c879659619badd.png"
                  width={70}
                  height={70}
                  unoptimized
                  className={styles.image}
                />
              </div>
              <div className={styles.distanceContent}>
                <p className={styles.distanceLabel}>{t.airport.label}</p>
                <p className={styles.distanceValue}>
                  {distances.airport}
                  {t.minSuffix}
                </p>
              </div>
            </div>
          )}
          {distances.hospital && (
            <div className={styles.distance}>
              <div className={styles.imageBlock}>
                <Image
                  alt={t.hospital.alt}
                  src="/uploads/files/87c44c6343496d1f4e1990505b571ae0b959d7e9.png"
                  width={70}
                  height={70}
                  unoptimized
                  className={styles.image}
                />
              </div>
              <div className={styles.distanceContent}>
                <p className={styles.distanceLabel}>{t.hospital.label}</p>
                <p className={styles.distanceValue}>
                  {distances.hospital}
                  {t.minSuffix}
                </p>
              </div>
            </div>
          )}
          {distances.school && (
            <div className={styles.distance}>
              <div className={styles.imageBlock}>
                <Image
                  alt={t.school.alt}
                  src="/uploads/files/080c0ffcaa49fb8967915d21cadcd6b2b286b5d3.png"
                  width={70}
                  height={70}
                  unoptimized
                  className={styles.image}
                />
              </div>
              <div className={styles.distanceContent}>
                <p className={styles.distanceLabel}>{t.school.label}</p>
                <p className={styles.distanceValue}>
                  {distances.school}
                  {t.minSuffix}
                </p>
              </div>
            </div>
          )}
          {distances.cityCenter && (
            <div className={styles.distance}>
              <div className={styles.imageBlock}>
                <Image
                  alt={t.cityCenter.alt}
                  src="/uploads/files/18fd16655d5281fa114048456caee2eeffcb2b73.png"
                  width={70}
                  height={70}
                  unoptimized
                  className={styles.image}
                />
              </div>
              <div className={styles.distanceContent}>
                <p className={styles.distanceLabel}>{t.cityCenter.label}</p>
                <p className={styles.distanceValue}>
                  {distances.cityCenter}
                  {t.minSuffix}
                </p>
              </div>
            </div>
          )}
          {distances.golfCourt && (
            <div className={styles.distance}>
              <div className={styles.imageBlock}>
                <Image
                  alt={t.golfCourt.alt}
                  src="/uploads/files/d72f5770e677f6830968baefeb4129ee9da2acc3.png"
                  width={70}
                  height={70}
                  unoptimized
                  className={styles.image}
                />
              </div>
              <div className={styles.distanceContent}>
                <p className={styles.distanceLabel}>{t.golfCourt.label}</p>
                <p className={styles.distanceValue}>
                  {distances.golfCourt}
                  {t.minSuffix}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default PropertyDistances;
