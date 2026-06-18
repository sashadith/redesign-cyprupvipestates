"use client";
import React, { useEffect } from "react";
import Modal from "react-modal";
import { motion, AnimatePresence } from "framer-motion";
import styles from "../ModalBrochure/ModalBrochure.module.scss";
import { useModal } from "@/app/context/ModalContext";
import { FormStandardDocument } from "@/types/formStandardDocument";
import FormStandard from "../FormStandard/FormStandard";
import FormPartners from "../FormPartners/FormPartners";

const customStyles: ReactModal.Styles = {
  overlay: {
    backgroundColor: "rgba(242, 244, 247, 0.7)",
    zIndex: 1000,
  },
  content: {
    position: "absolute",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    padding: "20px",
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
  formDocument: FormStandardDocument;
};

const ModalBrochure = ({ lang, formDocument }: Props) => {
  const { isBrochureOpen, closeBrochure } = useModal();

  useEffect(() => {
    if (isBrochureOpen) {
      document.body.classList.add("no-scroll");
    } else {
      document.body.classList.remove("no-scroll");
    }

    return () => {
      document.body.classList.remove("no-scroll");
    };
  }, [isBrochureOpen]);

  // console.log("formDocument", formDocument);
  return (
    <AnimatePresence>
      <Modal
        closeTimeoutMS={50}
        isOpen={isBrochureOpen}
        onRequestClose={closeBrochure}
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
                      ? "Укажите контакты для связи"
                      : lang === "de"
                        ? "Kontaktieren Sie mich!"
                        : lang === "pl"
                          ? "Proszę podać swoje dane kontaktowe"
                          : "Please provide your contact details"}
                  </h3>
                  <p className={styles.modalText}>
                    {lang === "ru"
                      ? "Свяжемся с вами как можно скорее"
                      : lang === "de"
                        ? "Geben Sie Ihre Daten ein, damit wir Sie kontaktieren können"
                        : lang === "pl"
                          ? "Skontaktujemy się z Tobą jak najszybciej"
                          : "We will contact you as soon as possible"}
                  </p>
                </div>

                <div className={styles.formInner}>
                  <FormPartners form={formDocument} lang={lang} />
                </div>
              </div>
              <button className={styles.closeButton} onClick={closeBrochure}>
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

export default ModalBrochure;
