import React, { FC } from "react";
import styles from "./ButtonBlockComponent.module.scss";
import { ButtonBlock } from "@/types/blog";
import { ButtonModal } from "../ButtonModal/ButtonModal";

type Props = {
  block: ButtonBlock;
};

const ButtonBlockComponent: FC<Props> = ({ block }) => {
  const marginValues: Record<string, string> = {
    small: "clamp(0.625rem, 2.5vw, 1.875rem)",
    medium: "clamp(1.25rem, 0.5rem + 3vw, 2.75rem)",
    large: "clamp(1.25rem, 5vw, 3.75rem)",
  };

  const { buttonText, marginTop, marginBottom, justifyContent, alignItems } =
    block;
  return (
    <div
      className={styles.buttonBlock}
      style={{
        display: "flex",
        marginTop:
          marginTop && marginValues[marginTop] ? marginValues[marginTop] : "0",
        marginBottom:
          marginBottom && marginValues[marginBottom]
            ? marginValues[marginBottom]
            : "0",
        justifyContent: justifyContent,
        alignItems: alignItems,
      }}
    >
      <ButtonModal>{buttonText}</ButtonModal>
    </div>
  );
};

export default ButtonBlockComponent;
