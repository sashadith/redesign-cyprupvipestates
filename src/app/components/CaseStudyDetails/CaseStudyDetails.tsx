import React, { FC } from "react";
import styles from "./CaseStudyDetails.module.scss";
import { PortableText } from "@portabletext/react";
import { RichText } from "../RichText/RichText";
import { CaseDetails } from "@/types/caseStudy";

type Props = {
  lang: string;
  caseDetails: CaseDetails;
};

const labels = {
  en: {
    clientSituation: "Client Situation",
    requirements: "Client Requirements",
    solution: "Our Solution",
    selectedProperty: "Selected Property",
    result: "Result",
  },
  pl: {
    clientSituation: "Sytuacja klienta",
    requirements: "Wymagania klienta",
    solution: "Nasze rozwiązanie",
    selectedProperty: "Wybrana nieruchomość",
    result: "Rezultat",
  },
  ru: {
    clientSituation: "Ситуация клиента",
    requirements: "Требования клиента",
    solution: "Наше решение",
    selectedProperty: "Выбранная недвижимость",
    result: "Результат",
  },
  de: {
    clientSituation: "Ausgangssituation des Kunden",
    requirements: "Anforderungen des Kunden",
    solution: "Unsere Lösung",
    selectedProperty: "Ausgewählte Immobilie",
    result: "Ergebnis",
  },
};

const CaseStudyDetails: FC<Props> = ({ lang, caseDetails }) => {
  const currentLabels = labels[lang as keyof typeof labels] || labels.en;

  const items = [
    {
      key: "clientSituation",
      title: currentLabels.clientSituation,
      content: caseDetails.clientSituation,
    },
    {
      key: "requirements",
      title: currentLabels.requirements,
      content: caseDetails.requirements,
    },
    {
      key: "solution",
      title: currentLabels.solution,
      content: caseDetails.solution,
    },
    {
      key: "selectedProperty",
      title: currentLabels.selectedProperty,
      content: caseDetails.selectedProperty,
    },
    {
      key: "result",
      title: currentLabels.result,
      content: caseDetails.result,
    },
  ];

  return (
    <section className={styles.caseDetails}>
      <div className="container">
        <div className={styles.caseDetailsList}>
          {items
            .filter((item) => item.content)
            .map((item) => (
              <div className={styles.caseDetailsItem} key={item.key}>
                <h2 className={styles.caseDetailsTitle}>{item.title}</h2>
                <div className={styles.caseDetailsContent}>
                  <PortableText
                    value={item.content as any}
                    components={RichText}
                  />
                </div>
              </div>
            ))}
        </div>
      </div>
    </section>
  );
};

export default CaseStudyDetails;
