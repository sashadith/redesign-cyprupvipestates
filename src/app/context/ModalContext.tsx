"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

type ModalContextType = {
  isBrochureOpen: boolean;
  isRoiCalculatorOpen: boolean;
  isRoiOpen: boolean;

  openBrochure: () => void;
  closeBrochure: () => void;

  openRoiCalculator: () => void;
  closeRoiCalculator: () => void;

  openRoi: () => void;
  closeRoi: () => void;

  closeAllModals: () => void;
};

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const ModalProvider = ({ children }: { children: ReactNode }) => {
  const [isBrochureOpen, setIsBrochureOpen] = useState(false);
  const [isRoiCalculatorOpen, setIsRoiCalculatorOpen] = useState(false);
  const [isRoiOpen, setIsRoiOpen] = useState(false);

  const openBrochure = () => setIsBrochureOpen(true);
  const closeBrochure = () => setIsBrochureOpen(false);

  const openRoiCalculator = () => setIsRoiCalculatorOpen(true);
  const closeRoiCalculator = () => setIsRoiCalculatorOpen(false);

  const openRoi = () => setIsRoiOpen(true);
  const closeRoi = () => setIsRoiOpen(false);

  const closeAllModals = () => {
    setIsBrochureOpen(false);
    setIsRoiCalculatorOpen(false);
    setIsRoiOpen(false);
  };

  return (
    <ModalContext.Provider
      value={{
        isBrochureOpen,
        isRoiCalculatorOpen,
        isRoiOpen,
        openBrochure,
        closeBrochure,
        openRoiCalculator,
        closeRoiCalculator,
        openRoi,
        closeRoi,
        closeAllModals,
      }}
    >
      {children}
    </ModalContext.Provider>
  );
};

export const useModal = () => {
  const context = useContext(ModalContext);

  if (!context) {
    throw new Error("useModal must be used within a ModalProvider");
  }

  return context;
};
