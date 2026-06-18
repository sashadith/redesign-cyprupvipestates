"use client";

import { i18n } from "@/i18n.config";
import { useParams } from "next/navigation";
import Link from "next/link";
import React, { useMemo, useState, useEffect, useRef } from "react";
import styles from "./LocaleSwitcher.module.scss";
import { Translation } from "@/types/homepage";

type Props = {
  translations?: Translation[];
};

const LocaleSwitcher = ({ translations }: Props) => {
  const params = useParams();
  const currentLang = params.lang;
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const availableTranslations = useMemo<Translation[]>(
    () =>
      i18n.languages.reduce<Translation[]>((acc, cur) => {
        if (cur.id !== currentLang) {
          const availableTranslation = translations?.find(
            (translation) => translation.language === cur.id
          );
          if (availableTranslation) {
            acc.push(availableTranslation);
          }
        }
        return acc;
      }, []),
    [translations, currentLang]
  );

  const toggleDropdown = () => {
    setIsOpen((prev) => !prev);
  };

  const handleClickOutside = (event: MouseEvent) => {
    if (
      dropdownRef.current &&
      !dropdownRef.current.contains(event.target as Node)
    ) {
      setIsOpen(false);
    }
  };

  const handleEscapePress = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscapePress);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscapePress);
    };
  }, []);

  return (
    <div className={styles.localeSwitcher} ref={dropdownRef}>
      <div className={styles.localeSwitcherButton} onClick={toggleDropdown}>
        {currentLang}
        <svg
          className={`${styles.arrow} ${isOpen ? styles.open : ""}`}
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
      {isOpen && (
        <ul className={styles.localeSwitcherList}>
          {availableTranslations.map((version) => (
            <li
              key={version.language}
              className={styles.localeSwitcherListItem}
            >
              <Link
                href={version.path}
                locale={version.language}
                className={styles.localeSwitcherLink}
                onClick={() => setIsOpen(false)}
              >
                {version.language}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default LocaleSwitcher;
