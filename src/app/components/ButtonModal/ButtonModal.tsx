"use client";

import React from "react";
import styles from "./ButtonModal.module.scss";
import { useModal } from "@/app/context/ModalContext";

type Props = {
  children: React.ReactNode;
  className?: string;
  modalType?: "brochure" | "roi" | "roiCalculator";
};

export const ButtonModal = ({
  children,
  className,
  modalType = "brochure",
}: Props) => {
  const { openBrochure, openRoi, openRoiCalculator } = useModal();

  const handleClick = () => {
    if (typeof window !== "undefined" && window.fbq) {
      window.fbq("track", "InitiateCheckout", {
        form_name:
          modalType === "roi"
            ? "roi_modal"
            : modalType === "roiCalculator"
              ? "roi_calculator_modal"
              : "brochure_modal",
        page_location: window.location.href,
      });
    }

    if (modalType === "roi") {
      openRoi();
      return;
    }

    if (modalType === "roiCalculator") {
      openRoiCalculator();
      return;
    }

    openBrochure();
  };

  return (
    <button
      type="button"
      className={`${styles.buttonModal} ${className ? className : ""}`}
      onClick={handleClick}
    >
      {children}
    </button>
  );
};
