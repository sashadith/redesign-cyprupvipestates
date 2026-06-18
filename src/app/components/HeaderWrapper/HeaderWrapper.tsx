"use client";
import styles from "../Header/Header.module.scss";
import { useEffect, useState } from "react";

type Props = {
  children: React.ReactNode;
};

const HeaderWrapper: React.FC<Props> = ({ children }) => {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 50) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
    <div className={isScrolled ? `${styles.scrolled}` : ""}>{children}</div>
  );
};

export default HeaderWrapper;
