"use client";

import { useState } from "react";
import styles from "../Header/Header.module.scss";
import NavLinks from "../NavLinks/NavLinks";
import BurgerMenu from "../BurgerMenu/BurgerMenu";
import { Header as HeaderType } from "@/types/header";
import { ButtonModal } from "../ButtonModal/ButtonModal";

type Props = {
  navLinks: HeaderType["navLinks"];
  params: { lang: string };
};

const NavWrapper: React.FC<Props> = ({ navLinks, params }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  const consultationText =
    params.lang === "de"
      ? "Beratung anfragen"
      : params.lang === "pl"
        ? "Umów konsultację"
        : params.lang === "ru"
          ? "Получить консультацию"
          : "Get Consultation";

  return (
    <>
      <div
        className={`${styles.navWrapper} ${
          isMenuOpen ? styles.navWrapperOpen : ""
        }`}
      >
        <NavLinks navLinks={navLinks} params={params} closeMenu={closeMenu} />

        <ButtonModal className={styles.mobileMenuButton}>
          {consultationText}
        </ButtonModal>
      </div>

      <BurgerMenu isMenuOpen={isMenuOpen} onToggle={toggleMenu} />
    </>
  );
};

export default NavWrapper;
