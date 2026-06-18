"use client";

import React, { useEffect } from "react";
import Modal from "react-modal";
import { motion, AnimatePresence } from "framer-motion";
import { useModal } from "@/app/context/ModalContext";
import { Project } from "@/types/project";
import RoiCalculator from "../roi-calculator/RoiCalculator";

const customStyles: ReactModal.Styles = {
  overlay: {
    backgroundColor: "rgba(15, 15, 15, 0.55)",
    zIndex: 1000,
  },
  content: {
    position: "fixed",
    inset: "0",
    padding: "24px",
    border: "none",
    background: "transparent",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
};

type Props = {
  lang: string;
  project?: Project | null;
};

const ModalRoiCalculator = ({ lang, project }: Props) => {
  const { isRoiCalculatorOpen, closeRoiCalculator, isRoiOpen } = useModal();

  useEffect(() => {
    const lenis = (window as any).lenis;

    if (isRoiCalculatorOpen || isRoiOpen) {
      lenis?.stop?.();
      document.body.classList.add("no-scroll");
    } else {
      lenis?.start?.();
      document.body.classList.remove("no-scroll");
    }

    return () => {
      lenis?.start?.();
      document.body.classList.remove("no-scroll");
    };
  }, [isRoiCalculatorOpen, isRoiOpen]);

  return (
    <AnimatePresence>
      <Modal
        closeTimeoutMS={120}
        isOpen={isRoiCalculatorOpen}
        onRequestClose={closeRoiCalculator}
        ariaHideApp={false}
        style={customStyles}
      >
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.98 }}
          transition={{ duration: 0.2 }}
          onWheelCapture={(e) => e.stopPropagation()}
          style={{
            width: "min(1400px, 100%)",
            maxHeight: "calc(100vh - 48px)",
            overflowY: "auto",
            overflowX: "hidden",
            overscrollBehavior: "contain",
            WebkitOverflowScrolling: "touch",
            background: "#ffffff",
            position: "relative",
            boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
          }}
        >
          <button
            type="button"
            onClick={closeRoiCalculator}
            aria-label="Close"
            style={{
              position: "absolute",
              top: "18px",
              right: "18px",
              width: "42px",
              height: "42px",
              border: "none",
              borderRadius: "50%",
              background: "#f3f3f3",
              cursor: "pointer",
              zIndex: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
            >
              <path
                d="M15 1L1 15M1 1L15 15"
                stroke="#666"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>

          <div style={{ padding: "28px 28px 12px 28px" }}>
            <h3
              style={{
                margin: 0,
                fontSize: "28px",
                lineHeight: 1.2,
                color: "#111",
                fontWeight: 500,
              }}
            >
              {lang === "ru"
                ? "Калькулятор ROI"
                : lang === "de"
                  ? "ROI-Rechner"
                  : lang === "pl"
                    ? "Kalkulator ROI"
                    : "ROI Calculator"}
            </h3>

            <p
              style={{
                margin: "10px 0 0 0",
                fontSize: "15px",
                lineHeight: 1.6,
                color: "#6a6a6a",
                maxWidth: "760px",
              }}
            >
              {lang === "ru"
                ? "Оцените потенциальную доходность этого объекта."
                : lang === "de"
                  ? "Schätzen Sie die potenzielle Rendite dieser Immobilie."
                  : lang === "pl"
                    ? "Oszacuj potencjalną rentowność tej nieruchomości."
                    : "Estimate the potential return of this property."}
            </p>
          </div>

          <div style={{ padding: "0 0 8px 0" }}>
            <RoiCalculator project={project} lang={lang} isInModal={true} />
          </div>
        </motion.div>
      </Modal>
    </AnimatePresence>
  );
};

export default ModalRoiCalculator;
