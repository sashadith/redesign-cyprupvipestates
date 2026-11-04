"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useModal } from "@/app/context/ModalContext";
import type { FormStandardDocument } from "@/types/formStandardDocument";

/* The adviser modal pulls react-modal, framer-motion's AnimatePresence, the whole FormStandard
   (formik, yup, axios, react-phone-number-input + libphonenumber) — roughly 135 KB gzipped — and the
   header mounts it on EVERY page. Nobody has seen it until the button is pressed, so its code is only
   fetched then (and as soon as the pointer/finger heads for the button, see HeaderConsultButton). */
const ModalBrochure = dynamic(() => import("./ModalBrochure"), { ssr: false });

export const preloadBrochureModal = () => {
  void import("./ModalBrochure");
};

export default function ModalBrochureLazy(props: { lang: string; formDocument: FormStandardDocument }) {
  const { isBrochureOpen } = useModal();
  const [wanted, setWanted] = useState(false);
  useEffect(() => {
    if (isBrochureOpen) setWanted(true);
  }, [isBrochureOpen]);
  return wanted ? <ModalBrochure {...props} /> : null;
}
