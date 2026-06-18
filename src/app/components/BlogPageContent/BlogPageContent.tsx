import React, { FC } from "react";
import styles from "./BlogPageContent.module.scss";
import { PortableText } from "@portabletext/react";
import { RichText } from "../RichText/RichText";
import { TextContent } from "@/types/blog";

type Props = {
  content: TextContent;
  lang: string;
};

const BlogPageContent: FC<Props> = ({ content, lang }) => {
  // console.log("BlogPageContent", content);
  return (
    <section className={styles.blogPageContent}>
      <div className="container">
        <div className={styles.content}>
          <PortableText value={content} components={RichText} />
        </div>
      </div>
    </section>
  );
};

export default BlogPageContent;
