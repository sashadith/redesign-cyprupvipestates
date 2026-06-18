import React from "react";
import styles from "./LinkPrimary.module.scss";
import Link from "next/link";

type Props = {
  children: React.ReactNode;
  className?: string;
  url: string;
};

export const LinkPrimary = ({ children, className, url }: Props) => {
  return (
    <Link href={url} className={`${styles.link} ${className ? className : ""}`}>
      {children}
    </Link>
  );
};
