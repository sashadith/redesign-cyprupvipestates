import React, { FC } from "react";
import styles from "./PropertyDistances.module.scss";
import Image from "next/image";
import { Distances } from "@/types/project";

type Props = {
  distances: Distances;
  lang: string;
};

const PropertyDistances: FC<Props> = ({ distances, lang }) => {
  return (
    <section className={styles.propertyDistances}>
      <div className="container">
        <div className={styles.distances}>
          {distances.beach && (
            <div className={styles.distance}>
              <div className={styles.imageBlock}>
                <Image
                  alt={
                    lang === "en"
                      ? "Distance from Cyprus villa to the beach"
                      : lang === "de"
                        ? "Entfernung von der Zypern Villa zum Strand"
                        : lang === "pl"
                          ? "Odległość od willi na Cyprze do plaży"
                          : lang === "ru"
                            ? "Расстояние от виллы на Кипре до пляжа"
                            : "Distance from Cyprus villa to the beach"
                  }
                  src="/uploads/files/21910cdeda8b4c0b1273cb9e487ea1c16873fcd7.png"
                  width={70}
                  height={70}
                  unoptimized
                  className={styles.image}
                />
              </div>
              <div className={styles.distanceContent}>
                <p className={styles.distanceLabel}>
                  {lang === "en"
                    ? "Beach"
                    : lang === "de"
                      ? "Strand"
                      : lang === "pl"
                        ? "Plaż"
                        : lang === "ru"
                          ? "Пляж"
                          : "Beach"}
                </p>
                <p className={styles.distanceValue}>
                  {distances.beach}
                  {lang === "en"
                    ? " min"
                    : lang === "de"
                      ? " min"
                      : lang === "pl"
                        ? " min"
                        : lang === "ru"
                          ? " мин"
                          : " min"}
                </p>
              </div>
            </div>
          )}
          {distances.restaurants && (
            <div className={styles.distance}>
              <div className={styles.imageBlock}>
                <Image
                  alt={
                    lang === "en"
                      ? "Distance from Cyprus villa to the restaurants"
                      : lang === "de"
                        ? "Entfernung von der Zypern Villa zu den Restaurants"
                        : lang === "pl"
                          ? "Odległość od willi na Cyprze do restauracji"
                          : lang === "ru"
                            ? "Расстояние от виллы на Кипре до ресторанов"
                            : "Distance from Cyprus villa to the restaurants"
                  }
                  src="/uploads/files/2667dfd1da48a595caf5f9d65c27df5c70695ae1.png"
                  width={70}
                  height={70}
                  unoptimized
                  className={styles.image}
                />
              </div>
              <div className={styles.distanceContent}>
                <p className={styles.distanceLabel}>
                  {lang === "en"
                    ? "Restaurants"
                    : lang === "de"
                      ? "Restaurants"
                      : lang === "pl"
                        ? "Restauracje"
                        : lang === "ru"
                          ? "Рестораны"
                          : "Restaurants"}
                </p>
                <p className={styles.distanceValue}>
                  {distances.restaurants}
                  {lang === "en"
                    ? " min"
                    : lang === "de"
                      ? " min"
                      : lang === "pl"
                        ? " min"
                        : lang === "ru"
                          ? " мин"
                          : " min"}
                </p>
              </div>
            </div>
          )}
          {distances.shops && (
            <div className={styles.distance}>
              <div className={styles.imageBlock}>
                <Image
                  alt={
                    lang === "en"
                      ? "Distance from Cyprus villa to the shops"
                      : lang === "de"
                        ? "Entfernung von der Zypern Villa zu den Geschäften"
                        : lang === "pl"
                          ? "Odległość od willi na Cyprze do sklepów"
                          : lang === "ru"
                            ? "Расстояние от виллы на Кипре до магазинов"
                            : "Distance from Cyprus villa to the shops"
                  }
                  src="/uploads/files/91095253a8e1d58c1f8eb5a5356c3ec11e1f7d31.png"
                  width={70}
                  height={70}
                  unoptimized
                  className={styles.image}
                />
              </div>
              <div className={styles.distanceContent}>
                <p className={styles.distanceLabel}>
                  {lang === "en"
                    ? "Shops"
                    : lang === "de"
                      ? "Supermarket"
                      : lang === "pl"
                        ? "Sklepy"
                        : lang === "ru"
                          ? "Супермаркет"
                          : "Shops"}
                </p>
                <p className={styles.distanceValue}>
                  {distances.shops}
                  {lang === "en"
                    ? " min"
                    : lang === "de"
                      ? " min"
                      : lang === "pl"
                        ? " min"
                        : lang === "ru"
                          ? " мин"
                          : " min"}
                </p>
              </div>
            </div>
          )}
          {distances.airport && (
            <div className={styles.distance}>
              <div className={styles.imageBlock}>
                <Image
                  alt={
                    lang === "en"
                      ? "Distance from Cyprus villa to the airport"
                      : lang === "de"
                        ? "Entfernung von der Zypern Villa zum Flughafen"
                        : lang === "pl"
                          ? "Odległość od willi na Cyprze do lotniska"
                          : lang === "ru"
                            ? "Расстояние от виллы на Кипре до аэропорта"
                            : "Distance from Cyprus villa to the airport"
                  }
                  src="/uploads/files/a9935ed23f1f65da3447f3a896c879659619badd.png"
                  width={70}
                  height={70}
                  unoptimized
                  className={styles.image}
                />
              </div>
              <div className={styles.distanceContent}>
                <p className={styles.distanceLabel}>
                  {lang === "en"
                    ? "Airport"
                    : lang === "de"
                      ? "Flughafen"
                      : lang === "pl"
                        ? "Lotnisko"
                        : lang === "ru"
                          ? "Аэропорт"
                          : "Airport"}
                </p>
                <p className={styles.distanceValue}>
                  {distances.airport}
                  {lang === "en"
                    ? " min"
                    : lang === "de"
                      ? " min"
                      : lang === "pl"
                        ? " min"
                        : lang === "ru"
                          ? " мин"
                          : " min"}
                </p>
              </div>
            </div>
          )}
          {distances.hospital && (
            <div className={styles.distance}>
              <div className={styles.imageBlock}>
                <Image
                  alt={
                    lang === "en"
                      ? "Distance from Cyprus villa to the hospital"
                      : lang === "de"
                        ? "Entfernung von der Zypern Villa zum Krankenhaus"
                        : lang === "pl"
                          ? "Odległość od willi na Cyprze do szpitala"
                          : lang === "ru"
                            ? "Расстояние от виллы на Кипре до больницы"
                            : "Distance from Cyprus villa to the hospital"
                  }
                  src="/uploads/files/87c44c6343496d1f4e1990505b571ae0b959d7e9.png"
                  width={70}
                  height={70}
                  unoptimized
                  className={styles.image}
                />
              </div>
              <div className={styles.distanceContent}>
                <p className={styles.distanceLabel}>
                  {lang === "en"
                    ? "Hospital"
                    : lang === "de"
                      ? "Klinik"
                      : lang === "pl"
                        ? "Szpital"
                        : lang === "ru"
                          ? "Больница"
                          : "Hospital"}
                </p>
                <p className={styles.distanceValue}>
                  {distances.hospital}
                  {lang === "en"
                    ? " min"
                    : lang === "de"
                      ? " min"
                      : lang === "pl"
                        ? " min"
                        : lang === "ru"
                          ? " мин"
                          : " min"}
                </p>
              </div>
            </div>
          )}
          {distances.school && (
            <div className={styles.distance}>
              <div className={styles.imageBlock}>
                <Image
                  alt={
                    lang === "en"
                      ? "Distance from Cyprus villa to the school"
                      : lang === "de"
                        ? "Entfernung von der Zypern Villa zur Schule"
                        : lang === "pl"
                          ? "Odległość od willi na Cyprze do szkoły"
                          : lang === "ru"
                            ? "Расстояние от виллы на Кипре до школы"
                            : "Distance from Cyprus villa to the school"
                  }
                  src="/uploads/files/080c0ffcaa49fb8967915d21cadcd6b2b286b5d3.png"
                  width={70}
                  height={70}
                  unoptimized
                  className={styles.image}
                />
              </div>
              <div className={styles.distanceContent}>
                <p className={styles.distanceLabel}>
                  {lang === "en"
                    ? "School"
                    : lang === "de"
                      ? "Schule"
                      : lang === "pl"
                        ? "Szkoła"
                        : lang === "ru"
                          ? "Школа"
                          : "School"}
                </p>
                <p className={styles.distanceValue}>
                  {distances.school}
                  {lang === "en"
                    ? " min"
                    : lang === "de"
                      ? " min"
                      : lang === "pl"
                        ? " min"
                        : lang === "ru"
                          ? " мин"
                          : " min"}
                </p>
              </div>
            </div>
          )}
          {distances.cityCenter && (
            <div className={styles.distance}>
              <div className={styles.imageBlock}>
                <Image
                  alt={
                    lang === "en"
                      ? "Distance from Cyprus villa to the city center"
                      : lang === "de"
                        ? "Entfernung von der Zypern Villa zum Stadtzentrum"
                        : lang === "pl"
                          ? "Odległość od willi na Cyprze do centrum miasta"
                          : lang === "ru"
                            ? "Расстояние от виллы на Кипре до центра города"
                            : "Distance from Cyprus villa to the city center"
                  }
                  src="/uploads/files/18fd16655d5281fa114048456caee2eeffcb2b73.png"
                  width={70}
                  height={70}
                  unoptimized
                  className={styles.image}
                />
              </div>
              <div className={styles.distanceContent}>
                <p className={styles.distanceLabel}>
                  {lang === "en"
                    ? "City center"
                    : lang === "de"
                      ? "Zentrum"
                      : lang === "pl"
                        ? "Centrum miasta"
                        : lang === "ru"
                          ? " Центр города"
                          : "City center"}
                </p>
                <p className={styles.distanceValue}>
                  {distances.cityCenter}
                  {lang === "en"
                    ? " min"
                    : lang === "de"
                      ? " min"
                      : lang === "pl"
                        ? " min"
                        : lang === "ru"
                          ? " мин"
                          : " min"}
                </p>
              </div>
            </div>
          )}
          {distances.golfCourt && (
            <div className={styles.distance}>
              <div className={styles.imageBlock}>
                <Image
                  alt={
                    lang === "en"
                      ? "Distance from Cyprus villa to the golf court"
                      : lang === "de"
                        ? "Entfernung von der Zypern Villa zum Golfplatz"
                        : lang === "pl"
                          ? "Odległość od willi na Cyprze do pola golfowego"
                          : lang === "ru"
                            ? "Расстояние от виллы на Кипре до поля для гольфа"
                            : "Distance from Cyprus villa to the golf court"
                  }
                  src="/uploads/files/d72f5770e677f6830968baefeb4129ee9da2acc3.png"
                  width={70}
                  height={70}
                  unoptimized
                  className={styles.image}
                />
              </div>
              <div className={styles.distanceContent}>
                <p className={styles.distanceLabel}>
                  {lang === "en"
                    ? "Golf court"
                    : lang === "de"
                      ? "Golfplatz"
                      : lang === "pl"
                        ? "Pole golfowe"
                        : lang === "ru"
                          ? "Поле для гольфа"
                          : "Golf court"}
                </p>
                <p className={styles.distanceValue}>
                  {distances.golfCourt}
                  {lang === "en"
                    ? " min"
                    : lang === "de"
                      ? " min"
                      : lang === "pl"
                        ? " min"
                        : lang === "ru"
                          ? " мин"
                          : " min"}
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
