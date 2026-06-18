"use client";

import React, { useEffect } from "react";
import Modal from "react-modal";
import { motion, AnimatePresence } from "framer-motion";
import styles from "../ModalBrochure/ModalBrochure.module.scss";
import { useModal } from "@/app/context/ModalContext";
import {
  RoiCalculationResult,
  RoiCalculatorInput,
  RoiScenario,
  RoiStrategy,
} from "@/lib/roi";
import FormRoi from "../FormRoi/FormRoi";

const customStyles: ReactModal.Styles = {
  overlay: {
    backgroundColor: "rgba(242, 244, 247, 0.7)",
    zIndex: 1100,
  },
  content: {
    position: "absolute",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    padding: "0",
    width: "100%",
    height: "100%",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    border: "none",
    inset: "0",
  },
};

type Props = {
  lang: string;
  strategy: RoiStrategy;
  scenario: RoiScenario;
  input: RoiCalculatorInput;
  result: RoiCalculationResult;
};

const ModalRoi = ({ lang, strategy, scenario, input, result }: Props) => {
  const { isRoiOpen, closeRoi } = useModal();

  useEffect(() => {
    if (isRoiOpen) {
      document.body.classList.add("no-scroll");
    } else {
      document.body.classList.remove("no-scroll");
    }

    return () => {
      document.body.classList.remove("no-scroll");
    };
  }, [isRoiOpen]);

  return (
    <AnimatePresence>
      <Modal
        closeTimeoutMS={50}
        isOpen={isRoiOpen}
        onRequestClose={closeRoi}
        ariaHideApp={false}
        style={customStyles}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.3 }}
          style={{ width: "100%" }}
        >
          <div className={styles.popupContent}>
            <div className={styles.popupContentWrapper}>
              <div className={styles.formContent}>
                <div className={styles.formText}>
                  <h3 className={styles.modalTitle}>
                    {lang === "ru"
                      ? "Отправить расчет на email"
                      : lang === "de"
                        ? "Berechnung per E-Mail senden"
                        : lang === "pl"
                          ? "Wyślij kalkulację na e-mail"
                          : "Send calculation by email"}
                  </h3>
                  <p className={styles.modalText}>
                    {lang === "ru"
                      ? "Мы отправим вам копию расчета и получим ее на нашу почту."
                      : lang === "de"
                        ? "Wir senden Ihnen eine Kopie der Berechnung und erhalten sie auch auf unserer Seite."
                        : lang === "pl"
                          ? "Wyślemy Ci kopię kalkulacji i otrzymamy ją również na naszą skrzynkę."
                          : "We will send you a copy of the calculation and receive it on our side as well."}
                  </p>
                </div>

                <div className={styles.formInner}>
                  <FormRoi
                    lang={lang}
                    strategy={strategy}
                    scenario={scenario}
                    input={input}
                    result={result}
                    onFormSubmitSuccess={() => {
                      setTimeout(() => {
                        closeRoi();
                      }, 2500);
                    }}
                  />
                </div>
              </div>

              <button className={styles.closeButton} onClick={closeRoi}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="#BABABA"
                >
                  <path
                    d="M15 1L1 15M1.00001 1L15 15"
                    stroke="#BABABA"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </div>
        </motion.div>
      </Modal>
    </AnimatePresence>
  );
};

export default ModalRoi;
