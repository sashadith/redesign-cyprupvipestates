import { TextContent } from "@/types/blog";
import React, { FC } from "react";
import { PortableText } from "@portabletext/react";
import { RichText } from "../RichText/RichText";
import styles from "./TextContentComponent.module.scss";
import FadeUpAnimate from "../FadeUpAnimate/FadeUpAnimate";

type Props = {
  block: TextContent;
};

const marginValues: Record<string, string> = {
  none: "0",
  small: "clamp(1.563rem, 0.938rem + 2.5vw, 2.813rem)",
  medium: "clamp(1.563rem, 6.25vw, 4.688rem)",
  large: "clamp(1.563rem, -1.406rem + 11.88vw, 7.5rem)",
};

const TextContentComponent: FC<Props> = ({ block }) => {
  const { paddingVertical, paddingHorizontal } = block;

  const computedPaddingVertical =
    paddingVertical && marginValues[paddingVertical]
      ? marginValues[paddingVertical]
      : "25px";

  const computedPaddingHorizontal =
    paddingHorizontal && marginValues[paddingHorizontal]
      ? marginValues[paddingHorizontal]
      : "0";

  return (
    <div
      style={{
        background: block.backgroundFull || "transparent",
        marginTop:
          block.marginTop && marginValues[block.marginTop]
            ? marginValues[block.marginTop]
            : "0",
        marginBottom:
          block.marginBottom && marginValues[block.marginBottom]
            ? marginValues[block.marginBottom]
            : "0",
      }}
    >
      <div className="container">
        <div
          className={styles.textContentComponent}
          style={{
            background: block.backgroundColor || "transparent",
            paddingTop: computedPaddingVertical,
            paddingBottom: computedPaddingVertical,
            paddingLeft: computedPaddingHorizontal,
            paddingRight: computedPaddingHorizontal,
            textAlign: block.textAlign || "left",
            color: block.textColor || "inherit",
          }}
        >
          <PortableText value={block.content} components={RichText} />
        </div>
      </div>
    </div>
  );
};

export default TextContentComponent;
